import { json } from '@/lib/edit/respond'
import { editRoute } from '@/lib/edit/route'
import { MAX_PDF, upload } from '@/lib/edit/service'

export const dynamic = 'force-dynamic'

/** Multipart: `file`, and either `dir` + `slug` for a picture or `resume=1` for the PDF. */
export const POST = editRoute(true, async (git, req) => {
  // refuse an oversized body before reading it into memory
  if (Number(req.headers.get('content-length') ?? 0) > MAX_PDF + 64 * 1024) return json({ message: 'Too big' }, 413)
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!form || !(file instanceof File)) return json({ message: 'No file' }, 400)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const target = form.get('resume') === '1' ? ({ resume: true } as const) : { dir: String(form.get('dir') ?? ''), slug: String(form.get('slug') ?? '') }
  const r = await upload(git, bytes, target)
  return json(r, r.ok ? 200 : r.status)
})
