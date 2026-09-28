import { allow, bucketFor } from '../store.ts'

export { json, NO_STORE, notFound } from './respond.ts'

/** Limits sign-in attempts per client, so the callback can't be hammered with guessed codes. */
export async function loginAllowed(req: Request): Promise<boolean> {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  return allow(`edit-login:${await bucketFor(ip)}`, 10, 600)
}
