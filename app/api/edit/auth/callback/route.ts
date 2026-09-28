import { cookies } from 'next/headers'

import { editCopy } from '@/content/edit'
import { editConfig } from '@/lib/edit/config'
import { loginAllowed, NO_STORE, notFound } from '@/lib/edit/http'
import { finishLogin, sameString } from '@/lib/edit/oauth'
import { COOKIE, FLOW_COOKIE, seal, unsealValue } from '@/lib/edit/session'

export const dynamic = 'force-dynamic'

const clearFlow = `${FLOW_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`

function refuse(status: number, message: string) {
  const headers = new Headers({ ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' })
  headers.append('Set-Cookie', clearFlow)
  return new Response(message, { status, headers })
}

export async function GET(req: Request) {
  const cfg = editConfig()
  if (!cfg) return notFound()
  if (!(await loginAllowed(req))) return refuse(429, 'Too many attempts')

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const flow = (await unsealValue((await cookies()).get(FLOW_COOKIE)?.value, cfg.secret)) as
    | { state: string; verifier: string; exp: number }
    | null

  if (!code || !state || !flow || flow.exp < Date.now() || !sameString(state, flow.state))
    return refuse(400, 'Sign-in expired or was not started here. Go back to /edit and try again.')

  const result = await finishLogin(cfg, code, flow.verifier)
  if (!result.ok && result.status === 403) {
    const { title, body, home } = editCopy.denied
    const headers = new Headers({ ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8' })
    headers.append('Set-Cookie', clearFlow)
    return new Response(
      `<!doctype html><meta name="viewport" content="width=device-width"><title>Go away</title>` +
        `<body style="font:16px/1.6 system-ui;max-width:32rem;margin:20vh auto;padding:0 16px;background:#F7F5EE;color:#161616">` +
        `<h1 style="font-size:1.75rem;line-height:1.15">${title}</h1><p>${body}</p><p><a href="/" style="color:inherit">${home}</a></p>`,
      { status: 403, headers },
    )
  }
  if (!result.ok) return refuse(result.status, result.reason)

  const { session } = result
  /*
   * A page, not a 303. This request arrived by a redirect from github.com, so a redirect onward
   * is still a cross-site navigation and the browser would hold back the SameSite=Strict cookie
   * we are about to set — you would land on /edit signed out. A refresh from our own page is a
   * same-site navigation, and the cookie goes along.
   */
  const headers = new Headers({ ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8' })
  headers.append('Set-Cookie', clearFlow)
  headers.append(
    'Set-Cookie',
    `${COOKIE}=${await seal(session, cfg.secret)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor((session.exp - Date.now()) / 1000)}`,
  )
  return new Response('<!doctype html><meta http-equiv="refresh" content="0;url=/edit"><title>Signed in</title>', {
    status: 200,
    headers,
  })
}
