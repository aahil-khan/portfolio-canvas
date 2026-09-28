import { editConfig } from '@/lib/edit/config'
import { loginAllowed, NO_STORE, notFound } from '@/lib/edit/http'
import { authorizeUrl, pkcePair, randomToken } from '@/lib/edit/oauth'
import { FLOW_COOKIE, sealValue } from '@/lib/edit/session'

export const dynamic = 'force-dynamic'

/** Starts sign-in: remembers a fresh state + PKCE verifier in a sealed cookie, then off to GitHub. */
export async function GET(req: Request) {
  const cfg = editConfig()
  if (!cfg) return notFound()
  if (!(await loginAllowed(req))) return new Response('Too many attempts', { status: 429, headers: NO_STORE })

  const state = randomToken(16)
  const { verifier, challenge } = await pkcePair()
  const flow = await sealValue({ state, verifier, exp: Date.now() + 10 * 60_000 }, cfg.secret)

  const headers = new Headers(NO_STORE)
  headers.set('Location', authorizeUrl(cfg, state, challenge))
  // Lax, not Strict: this cookie has to come back on GitHub's top-level redirect to the callback
  headers.append('Set-Cookie', `${FLOW_COOKIE}=${flow}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)
  return new Response(null, { status: 302, headers })
}
