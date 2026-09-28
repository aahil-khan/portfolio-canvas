import { editConfig } from '@/lib/edit/config'
import { NO_STORE, notFound } from '@/lib/edit/http'
import { COOKIE } from '@/lib/edit/session'

export const dynamic = 'force-dynamic'

/** POST only, and only from our own pages — a link elsewhere can't sign you out. */
export async function POST(req: Request) {
  const cfg = editConfig()
  if (!cfg) return notFound()
  if (req.headers.get('origin') !== cfg.origin) return new Response('Forbidden', { status: 403, headers: NO_STORE })
  const headers = new Headers(NO_STORE)
  headers.set('Location', `${cfg.origin}/`)
  headers.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)
  return new Response(null, { status: 303, headers })
}
