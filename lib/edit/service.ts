import { FILES, type ContentSet, type FileId } from '../../content/schema/index.ts'
import { GitConflict, type Git, type LogEntry, type TreeEntry } from './github.ts'
import { validateSet } from './rules.ts'
import type { Issue } from './schema.ts'
import { sniff } from './sniff.ts'

/**
 * What the editor can do to the repo: read the content, save a file, upload a picture, list and
 * revert recent edits. Every write is exactly one commit on `main`, and every write that would
 * leave the content invalid is refused before it is committed — so the build that follows a save
 * cannot fail on content.
 */

export const TRAILER = 'Edited-via: /edit'
export const UPLOAD_DIRS = ['work', 'archive', 'pfp', 'logos'] as const
export const MAX_IMAGE = 5 * 1024 * 1024
export const MAX_PDF = 10 * 1024 * 1024

export interface Loaded {
  head: string
  files: Record<FileId, { sha: string; data: unknown }>
  /** Every file under public/, as the site references it: `/work/a.webp`. */
  publicFiles: string[]
}

const dec = new TextDecoder()
const enc = new TextEncoder()
const label = (id: FileId) => FILES.find((f) => f.id === id)!.label
const withTrailer = (message: string) => `${message.trim()}\n\n${TRAILER}`
const subject = (message: string) => message.split('\n')[0]

async function snapshot(git: Git) {
  const head = await git.head()
  const entries = await git.tree(head.tree)
  const byPath = new Map<string, TreeEntry>(entries.map((e) => [e.path, e]))
  const publicFiles = entries.filter((e) => e.type === 'blob' && e.path.startsWith('public/')).map((e) => e.path.slice(6))
  return { head, byPath, publicFiles }
}

async function readSet(git: Git, byPath: Map<string, TreeEntry>) {
  const files = {} as Loaded['files']
  await Promise.all(
    FILES.map(async (f) => {
      const e = byPath.get(f.path)
      if (!e) throw new Error(`${f.path} is missing from the repository`)
      files[f.id] = { sha: e.sha, data: JSON.parse(dec.decode(await git.blob(e.sha))) }
    }),
  )
  return files
}

const setOf = (files: Loaded['files']) =>
  Object.fromEntries(FILES.map((f) => [f.id, files[f.id].data])) as ContentSet

const serialise = (data: unknown) => enc.encode(JSON.stringify(data, null, 2) + '\n')

export async function load(git: Git): Promise<Loaded> {
  const { head, byPath, publicFiles } = await snapshot(git)
  return { head: head.commit, files: await readSet(git, byPath), publicFiles }
}

export type SaveResult =
  | { ok: true; commit: string }
  | { ok: false; status: 409 | 422; issues?: Issue[]; message: string }

const CONFLICT = 'This changed somewhere else since you opened it. Reload to get the latest, then redo your edit.'

export async function save(git: Git, id: FileId, data: unknown, baseSha: string, message: string): Promise<SaveResult> {
  const { head, byPath, publicFiles } = await snapshot(git)
  const file = FILES.find((f) => f.id === id)!
  if (byPath.get(file.path)?.sha !== baseSha) return { ok: false, status: 409, message: CONFLICT }

  const files = await readSet(git, byPath)
  const set = { ...setOf(files), [id]: data }
  const known = new Set(publicFiles)
  const issues = validateSet(set, (p) => known.has(p))
  if (issues.length) return { ok: false, status: 422, issues, message: `${issues.length} problem(s) to fix first` }

  // nothing changed: no empty commit, and so no rebuild for nothing
  const bytes = serialise(data)
  if (JSON.stringify(files[id].data) === JSON.stringify(data)) return { ok: true, commit: head.commit }

  try {
    const commit = await git.commit(head.commit, head.tree, [{ path: file.path, content: bytes }], withTrailer(message || `Edit ${label(id)}`))
    return { ok: true, commit }
  } catch (e) {
    if (e instanceof GitConflict) return { ok: false, status: 409, message: CONFLICT }
    throw e
  }
}

export type UploadTarget = { dir: string; slug: string } | { resume: true }
export type UploadResult = { ok: true; path: string; commit: string } | { ok: false; status: 409 | 413 | 415 | 400; message: string }

/** The server names every file. What the browser called it never reaches the path. */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'file'
  )
}

export async function upload(git: Git, bytes: Uint8Array, target: UploadTarget, message = ''): Promise<UploadResult> {
  const pdf = 'resume' in target
  if (!pdf && !(UPLOAD_DIRS as readonly string[]).includes(target.dir))
    return { ok: false, status: 400, message: 'Unknown folder' }
  if (bytes.length > (pdf ? MAX_PDF : MAX_IMAGE))
    return { ok: false, status: 413, message: `Too big — the limit is ${pdf ? 10 : 5} MB` }
  const kind = sniff(bytes)
  if (!kind || (kind === 'pdf') !== pdf)
    return { ok: false, status: 415, message: pdf ? 'That is not a PDF' : 'Only PNG, JPEG or WebP pictures' }

  const { head, byPath, publicFiles } = await snapshot(git)
  let path: string
  if (pdf) {
    const profile = JSON.parse(dec.decode(await git.blob(byPath.get('content/data/profile.json')!.sha)))
    path = profile.profile?.resumePdf || '/resume.pdf'
  } else {
    const slug = slugify(target.slug)
    const re = new RegExp(`^/${target.dir}/${slug}-(\\d+)\\.[a-z]+$`)
    const highest = Math.max(0, ...publicFiles.map((p) => Number(re.exec(p)?.[1] ?? 0)))
    path = `/${target.dir}/${slug}-${highest + 1}.${kind}`
  }

  try {
    const commit = await git.commit(head.commit, head.tree, [{ path: `public${path}`, content: bytes }], withTrailer(message || `Upload ${path}`))
    return { ok: true, path, commit }
  } catch (e) {
    if (e instanceof GitConflict) return { ok: false, status: 409, message: CONFLICT }
    throw e
  }
}

export async function history(git: Git, n = 20): Promise<LogEntry[]> {
  const [a, b] = await Promise.all([git.log('content/data', n), git.log('public', n)])
  const seen = new Map<string, LogEntry>()
  for (const c of [...a, ...b]) seen.set(c.sha, c)
  return [...seen.values()].sort((x, y) => y.date.localeCompare(x.date)).slice(0, n)
}

export type RevertResult = { ok: true; commit: string } | { ok: false; status: 409 | 422; message: string; issues?: Issue[] }

export async function revert(git: Git, sha: string): Promise<RevertResult> {
  const d = await git.diff(sha)
  const { head, byPath, publicFiles } = await snapshot(git)
  const changes: { path: string; content: Uint8Array | null }[] = []

  for (const f of d.files) {
    const now = byPath.get(f.path)?.sha ?? null
    const then = (await git.blobAt(sha, f.path))?.sha ?? null
    if (now !== then) {
      const [later] = await git.log(f.path, 1)
      return {
        ok: false,
        status: 409,
        message: `${f.path} was changed again later, in "${later ? subject(later.message) : 'a newer commit'}". Revert that one first.`,
      }
    }
    changes.push({ path: f.path, content: f.status === 'added' ? null : ((await git.blobAt(d.parent, f.path))?.bytes ?? null) })
  }

  // validate the content as it would be after the revert, before committing anything
  const files = await readSet(git, byPath)
  const set = setOf(files)
  for (const c of changes) {
    const file = FILES.find((f) => f.path === c.path)
    if (file && c.content) set[file.id] = JSON.parse(dec.decode(c.content))
  }
  const after = new Set(publicFiles)
  for (const c of changes)
    if (c.path.startsWith('public/')) {
      if (c.content) after.add(c.path.slice(6))
      else after.delete(c.path.slice(6))
    }
  const issues = validateSet(set, (p) => after.has(p))
  if (issues.length)
    return { ok: false, status: 422, issues, message: 'Undoing this would break something that was added since. Edit it by hand instead.' }

  try {
    const commit = await git.commit(head.commit, head.tree, changes, withTrailer(`Revert "${subject(d.message)}"`))
    return { ok: true, commit }
  } catch (e) {
    if (e instanceof GitConflict) return { ok: false, status: 409, message: CONFLICT }
    throw e
  }
}
