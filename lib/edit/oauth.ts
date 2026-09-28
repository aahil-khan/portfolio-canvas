import { SESSION_MS, type EditConfig } from './config.ts'
import { b64url, type Session } from './session.ts'

/**
 * Sign-in through a GitHub App (user-to-server OAuth, with PKCE).
 *
 * A GitHub App rather than an OAuth App because its user tokens can only do what the App was
 * granted — contents on this one repo — and they expire. The token doubles as the commit
 * credential, so the server never holds a long-lived key that can write to the repo.
 */

const UA = { 'User-Agent': 'portfolio-canvas-edit' }

export const callbackUrl = (cfg: EditConfig) => `${cfg.origin}/api/edit/auth/callback`

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken(32)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: b64url(new Uint8Array(digest)) }
}

export function authorizeUrl(cfg: EditConfig, state: string, challenge: string): string {
  const u = new URL('https://github.com/login/oauth/authorize')
  u.searchParams.set('client_id', cfg.clientId)
  u.searchParams.set('redirect_uri', callbackUrl(cfg))
  u.searchParams.set('state', state)
  u.searchParams.set('code_challenge', challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.set('allow_signup', 'false')
  return u.toString()
}

/** Constant-time string compare, for the OAuth state. */
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export type LoginResult = { ok: true; session: Session } | { ok: false; status: 403 | 502; reason: string }

export async function finishLogin(
  cfg: EditConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<LoginResult> {
  const tokenRes = await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', ...UA },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: callbackUrl(cfg),
      code_verifier: verifier,
    }).toString(),
  })
  const tok = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; expires_in?: number }
  if (!tokenRes.ok || !tok.access_token) return { ok: false, status: 502, reason: 'GitHub did not issue a token' }

  const userRes = await fetchImpl('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/vnd.github+json', ...UA },
  })
  const user = (await userRes.json().catch(() => ({}))) as { id?: number; login?: string }
  if (!userRes.ok || typeof user.id !== 'number') return { ok: false, status: 502, reason: 'GitHub did not say who you are' }

  if (user.id !== cfg.allowedUserId) {
    // they will never use it here, so don't leave a live token lying around on GitHub either
    await fetchImpl(`https://api.github.com/applications/${cfg.clientId}/token`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${btoa(`${cfg.clientId}:${cfg.clientSecret}`)}`,
        Accept: 'application/vnd.github+json',
        ...UA,
      },
      body: JSON.stringify({ access_token: tok.access_token }),
    }).catch(() => {})
    return { ok: false, status: 403, reason: 'This editor belongs to someone else' }
  }

  const life = Math.min((tok.expires_in ?? Infinity) * 1000, SESSION_MS)
  return { ok: true, session: { token: tok.access_token, userId: user.id, login: user.login ?? '', exp: now + life } }
}
