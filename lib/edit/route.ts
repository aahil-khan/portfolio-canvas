import { devFake } from './config.ts'
import { devGit } from './dev-git.ts'
import { GitHubError, githubGit, type Git } from './github.ts'
import { guard } from './guard.ts'
import { json } from './respond.ts'
import { COOKIE, type Session } from './session.ts'

/**
 * Wraps an editor route: guard first, then hand the handler a `Git` bound to the signed-in
 * user's own token. GitHub failures become a message the editor can show instead of a stack.
 */
export function editRoute<C = unknown>(
  mutate: boolean,
  handler: (git: Git, req: Request, session: Session, ctx: C) => Promise<Response>,
) {
  return async (req: Request, ctx: C) => {
    const g = await guard(req, { mutate })
    if (!g.ok) return g.res
    try {
      const git = devFake() ? devGit() : githubGit(g.session.token)
      return await handler(git, req, g.session, ctx)
    } catch (e) {
      if (e instanceof GitHubError && e.status === 401) {
        // the token was revoked or expired on GitHub's side: drop our cookie too, or the editor's
        // reload-on-401 would land straight back in a signed-in page with a dead token, forever
        const res = json({ message: 'GitHub signed you out — sign in again.' }, 401)
        res.headers.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)
        return res
      }
      if (e instanceof GitHubError && (e.status === 403 || e.status === 404))
        return json({ message: 'GitHub refused. Is the GitHub App still installed on the repo?' }, 502)
      console.error('[edit]', e)
      return json({ message: 'Something went wrong talking to GitHub. Nothing was saved.' }, 502)
    }
  }
}

/** Reads a JSON body, refusing anything over `max` bytes before parsing it. */
export async function readJson(req: Request, max = 1024 * 1024): Promise<unknown> {
  const text = await req.text()
  if (text.length > max) throw new RangeError('body too large')
  return JSON.parse(text)
}
