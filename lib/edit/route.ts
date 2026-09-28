import { devFake } from './config.ts'
import { devGit } from './dev-git.ts'
import { GitHubError, githubGit, type Git } from './github.ts'
import { guard } from './guard.ts'
import { json } from './respond.ts'
import type { Session } from './session.ts'

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
      if (e instanceof GitHubError && e.status === 401) return json({ message: 'GitHub signed you out — sign in again.' }, 401)
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
