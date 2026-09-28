import { json } from '@/lib/edit/respond'
import { editRoute, readJson } from '@/lib/edit/route'
import { revert } from '@/lib/edit/service'

export const dynamic = 'force-dynamic'

/** Body: `{ sha }` — one of the commits `/api/edit/history` listed. */
export const POST = editRoute(true, async (git, req) => {
  const body = (await readJson(req, 1024).catch(() => null)) as { sha?: unknown } | null
  if (typeof body?.sha !== 'string' || !/^[0-9a-z]{4,40}$/.test(body.sha)) return json({ message: 'Bad commit id' }, 400)
  const r = await revert(git, body.sha)
  return json(r, r.ok ? 200 : r.status)
})
