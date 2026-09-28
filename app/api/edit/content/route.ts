import { editRoute } from '@/lib/edit/route'
import { json } from '@/lib/edit/respond'
import { load } from '@/lib/edit/service'

export const dynamic = 'force-dynamic'

/** Everything the editor opens with: each content file, its blob sha, and what is in public/. */
export const GET = editRoute(false, async (git, _req, session) => json({ ...(await load(git)), login: session.login }))
