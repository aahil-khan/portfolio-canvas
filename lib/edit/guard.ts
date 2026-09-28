import { devFake, editConfig, type EditConfig } from './config.ts'
import { json, notFound } from './respond.ts'
import { COOKIE, unseal, type Session } from './session.ts'

/**
 * The gate every editor API route passes through first, in this order:
 *
 *   not configured → 404   (the editor does not exist)
 *   mutation from anywhere but our own origin → 403   (CSRF, on top of SameSite=Strict)
 *   no valid session → 401
 *   a session for someone other than the owner → 403
 *
 * The owner check repeats the one made at sign-in on purpose: if the allowed id is ever changed,
 * sessions sealed for the old one stop working at once instead of in eight hours.
 */

export type Guarded = { ok: true; cfg: EditConfig; session: Session } | { ok: false; res: Response }

function cookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return undefined
}

export async function guard(
  req: Request,
  opts: { mutate: boolean },
  env: Record<string, string | undefined> = process.env,
  now = Date.now(),
): Promise<Guarded> {
  if (devFake(env)) {
    const origin = env.EDIT_ORIGIN?.replace(/\/+$/, '') || new URL(req.url).origin
    if (opts.mutate && req.headers.get('origin') !== origin) return { ok: false, res: json({ message: 'Forbidden' }, 403) }
    const cfg = { clientId: '', clientSecret: '', secret: '', allowedUserId: 0, origin }
    return { ok: true, cfg, session: { token: 'dev-fake', userId: 0, login: 'dev', exp: now + 3600_000 } }
  }
  const cfg = editConfig(env)
  if (!cfg) return { ok: false, res: notFound() }
  if (opts.mutate && req.headers.get('origin') !== cfg.origin)
    return { ok: false, res: json({ message: 'Forbidden' }, 403) }
  const session = await unseal(cookie(req, COOKIE), cfg.secret, now)
  if (!session) return { ok: false, res: json({ message: 'Signed out — sign in again.' }, 401) }
  if (session.userId !== cfg.allowedUserId) return { ok: false, res: json({ message: 'Forbidden' }, 403) }
  return { ok: true, cfg, session }
}
