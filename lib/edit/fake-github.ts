import { GitConflict, type Git, type LogEntry } from './github.ts'

/**
 * An in-memory `Git`, for tests and for `EDIT_DEV_FAKE` in local development.
 *
 * Commits are whole snapshots (path → bytes), which is all the service can observe of real git
 * through the interface. A commit's tree sha is `tree:<commit sha>`.
 */

interface Commit {
  sha: string
  parent: string
  files: Map<string, Uint8Array>
  message: string
  date: string
}

/** Not git's sha1 — a stable content hash is all the service relies on. */
function hash(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (const b of bytes) {
    h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ b, 0x5bd1e995) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + bytes.length.toString(16)
}

export interface FakeGit extends Git {
  commits(): number
  lastMessage(): string
  read(path: string): string
  has(path: string): boolean
  failNextCommit(): void
}

export function fakeGit(initial: Record<string, Uint8Array>): FakeGit {
  const blobs = new Map<string, Uint8Array>()
  const all = new Map<string, Commit>()
  let n = 0
  let failNext = false

  const add = (parent: string, files: Map<string, Uint8Array>, message: string) => {
    n += 1
    const sha = `c${n.toString().padStart(4, '0')}`
    for (const b of files.values()) blobs.set(hash(b), b)
    all.set(sha, { sha, parent, files, message, date: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString() })
    return sha
  }
  let head = add('', new Map(Object.entries(initial)), 'Initial commit')

  const at = (sha: string) => {
    const c = all.get(sha.replace(/^tree:/, ''))
    if (!c) throw new Error(`fake git: no commit ${sha}`)
    return c
  }
  const changed = (c: Commit) => {
    const before = c.parent ? at(c.parent).files : new Map<string, Uint8Array>()
    const paths = new Set([...before.keys(), ...c.files.keys()])
    return [...paths].filter((p) => {
      const a = before.get(p)
      const b = c.files.get(p)
      return !a || !b || hash(a) !== hash(b)
    })
  }

  return {
    async head() {
      return { commit: head, tree: `tree:${head}` }
    },
    async tree(treeSha) {
      return [...at(treeSha).files].map(([path, b]) => ({ path, sha: hash(b), type: 'blob' as const }))
    },
    async blob(sha) {
      const b = blobs.get(sha)
      if (!b) throw new Error(`fake git: no blob ${sha}`)
      return b
    },
    async commit(parent, _baseTree, files, message) {
      if (failNext || parent !== head) {
        failNext = false
        throw new GitConflict('not a fast forward')
      }
      const next = new Map(at(parent).files)
      for (const f of files) {
        if (f.content === null) next.delete(f.path)
        else next.set(f.path, f.content)
      }
      head = add(parent, next, message)
      return head
    },
    async log(path, limit) {
      const out: LogEntry[] = []
      for (let c: Commit | undefined = at(head); c && out.length < limit; c = c.parent ? at(c.parent) : undefined) {
        if (changed(c).some((p) => p === path || p.startsWith(`${path}/`)))
          out.push({ sha: c.sha, message: c.message, date: c.date, author: 'fake' })
      }
      return out
    },
    async diff(sha) {
      const c = at(sha)
      const before = c.parent ? at(c.parent).files : new Map()
      return {
        parent: c.parent,
        message: c.message,
        files: changed(c).map((path) => ({
          path,
          status: !before.has(path) ? ('added' as const) : !c.files.has(path) ? ('removed' as const) : ('modified' as const),
        })),
      }
    },
    async blobAt(commit, path) {
      const b = at(commit).files.get(path)
      return b ? { sha: hash(b), bytes: b } : null
    },
    commits: () => all.size,
    lastMessage: () => at(head).message,
    read: (path) => new TextDecoder().decode(at(head).files.get(path)),
    has: (path) => at(head).files.has(path),
    failNextCommit: () => {
      failNext = true
    },
  }
}
