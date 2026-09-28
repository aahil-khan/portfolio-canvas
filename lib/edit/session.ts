/**
 * The editor session: your GitHub token, sealed into a cookie.
 *
 * AES-256-GCM, so the cookie is both unreadable and tamper-evident — flip one bit and `unseal`
 * returns null. Nothing is stored server-side: revoking the GitHub App on github.com kills every
 * session, because each API call is made with the token inside it.
 */

export interface Session {
  token: string
  userId: number
  login: string
  /** Epoch ms. */
  exp: number
}

/** `__Host-` means: Secure, Path=/, no Domain — the browser enforces all three. */
export const COOKIE = '__Host-edit'
/** Holds the OAuth `state` and PKCE verifier between the redirect out and the callback. */
export const FLOW_COOKIE = '__Host-edit-flow'

const enc = new TextEncoder()

export function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(v: string): Uint8Array {
  const s = atob(v.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

async function key(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret))
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Seal any JSON value. Exported for the OAuth flow cookie, which uses the same scheme. */
export async function sealValue(value: unknown, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), enc.encode(JSON.stringify(value)))
  const out = new Uint8Array(12 + ct.byteLength)
  out.set(iv)
  out.set(new Uint8Array(ct), 12)
  return b64url(out)
}

export async function unsealValue(v: string | undefined, secret: string): Promise<unknown> {
  if (!v) return null
  try {
    const raw = fromB64url(v)
    if (raw.length < 13) return null
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await key(secret), raw.slice(12))
    return JSON.parse(new TextDecoder().decode(pt))
  } catch {
    return null
  }
}

export const seal = (s: Session, secret: string) => sealValue(s, secret)

export async function unseal(v: string | undefined, secret: string, now = Date.now()): Promise<Session | null> {
  const s = (await unsealValue(v, secret)) as Session | null
  if (!s || typeof s.token !== 'string' || typeof s.userId !== 'number' || typeof s.exp !== 'number') return null
  return s.exp > now ? s : null
}
