/**
 * Whether `/edit` exists at all, and with what.
 *
 * Every value is required. With any one missing — or malformed — this returns null and every
 * editor route 404s, exactly like `/stats` without its token: forgetting a variable fails closed,
 * never open.
 */

export interface EditConfig {
  /** GitHub App's OAuth client id and secret. */
  clientId: string
  clientSecret: string
  /** Seals the session cookie. At least 32 characters. */
  secret: string
  /** Numeric GitHub user id — never the login, which can be renamed and re-registered. */
  allowedUserId: number
  /** Public origin of the site, e.g. https://portfolio-redesign.aahil-khan.xyz */
  origin: string
}

export const REPO = { owner: 'aahil-khan', repo: 'portfolio-canvas', branch: 'main' } as const

/** A session lasts at most this long, whatever GitHub says the token is good for. */
export const SESSION_MS = 8 * 3600 * 1000

export function editConfig(env: Record<string, string | undefined> = process.env): EditConfig | null {
  const clientId = env.EDIT_GITHUB_APP_CLIENT_ID?.trim()
  const clientSecret = env.EDIT_GITHUB_APP_CLIENT_SECRET?.trim()
  const secret = env.EDIT_SESSION_SECRET?.trim()
  const id = env.EDIT_ALLOWED_USER_ID?.trim()
  const origin = env.EDIT_ORIGIN?.trim().replace(/\/+$/, '')
  if (!clientId || !clientSecret || !secret || !id || !origin) return null
  if (secret.length < 32 || !/^\d+$/.test(id)) return null
  // the session cookie is `__Host-`, which browsers only accept over https (or on localhost)
  if (!/^https:\/\/[^/]+$/.test(origin) && !/^http:\/\/localhost(:\d+)?$/.test(origin)) return null
  return { clientId, clientSecret, secret, allowedUserId: Number(id), origin }
}
