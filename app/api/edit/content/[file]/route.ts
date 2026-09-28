import { FILES, type FileId } from '@/content/schema'
import { json } from '@/lib/edit/respond'
import { editRoute, readJson } from '@/lib/edit/route'
import { save } from '@/lib/edit/service'

export const dynamic = 'force-dynamic'

/** Save one content file. Body: `{ data, sha, message? }` — `sha` is the blob you started from. */
export const PUT = editRoute<{ params: Promise<{ file: string }> }>(true, async (git, req, _s, { params }) => {
  const { file } = await params
  if (!FILES.some((f) => f.id === file)) return json({ message: 'No such file' }, 404)
  let body: { data?: unknown; sha?: unknown; message?: unknown }
  try {
    body = (await readJson(req)) as typeof body
  } catch {
    return json({ message: 'That was not valid JSON, or it was too big.' }, 400)
  }
  if (typeof body.sha !== 'string' || body.data === undefined) return json({ message: 'Missing data or sha' }, 400)
  const message = typeof body.message === 'string' ? body.message.slice(0, 200) : ''
  const r = await save(git, file as FileId, body.data, body.sha, message)
  return json(r, r.ok ? 200 : r.status)
})
