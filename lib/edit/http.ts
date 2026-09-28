import { allow, bucketFor } from '../store.ts'

/** Shared response helpers for the editor's routes. Nothing here is cached, ever. */

export const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }

export const notFound = () => new Response('Not found', { status: 404, headers: NO_STORE })

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE })

/** Limits sign-in attempts per client, so the callback can't be hammered with guessed codes. */
export async function loginAllowed(req: Request): Promise<boolean> {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  return allow(`edit-login:${await bucketFor(ip)}`, 10, 600)
}
