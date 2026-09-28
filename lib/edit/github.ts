import { REPO } from './config.ts'

/**
 * The slice of git the editor needs, as an interface — so the service can be tested against an
 * in-memory fake (`fake-github.ts`) and run for real against the GitHub REST API.
 */

export interface TreeEntry {
  path: string
  sha: string
  type: 'blob' | 'tree'
}

export interface LogEntry {
  sha: string
  message: string
  /** ISO 8601. */
  date: string
  author: string
}

export interface Git {
  head(): Promise<{ commit: string; tree: string }>
  /** Every entry, recursively. */
  tree(treeSha: string): Promise<TreeEntry[]>
  blob(sha: string): Promise<Uint8Array>
  /**
   * One commit on top of `parent` that writes each file (or deletes it, for `null`), then moves
   * the branch to it — refusing, with GitConflict, if the branch has moved since `parent`.
   */
  commit(parent: string, baseTree: string, files: { path: string; content: Uint8Array | null }[], message: string): Promise<string>
  /** Newest first: commits on the branch that touched anything under `path`. */
  log(path: string, n: number): Promise<LogEntry[]>
  diff(sha: string): Promise<{ parent: string; message: string; files: { path: string; status: 'added' | 'modified' | 'removed' }[] }>
  blobAt(commit: string, path: string): Promise<{ sha: string; bytes: Uint8Array } | null>
}

/** The branch moved underneath us. Someone else committed; reload and try again. */
export class GitConflict extends Error {}

export class GitHubError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const b64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0))

export function githubGit(token: string, fetchImpl: typeof fetch = fetch): Git {
  const base = `https://api.github.com/repos/${REPO.owner}/${REPO.repo}`

  async function api<T>(path: string, init: RequestInit = {}, ok404 = false): Promise<T | null> {
    const res = await fetchImpl(path.startsWith('https:') ? path : base + path, {
      ...init,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'portfolio-canvas-edit',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (ok404 && res.status === 404) return null
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (res.status === 422 && /fast.forward|Update is not a fast forward/i.test(text)) throw new GitConflict(text)
      throw new GitHubError(res.status, `GitHub ${res.status} on ${path.split('?')[0]}: ${text.slice(0, 200)}`)
    }
    return (await res.json()) as T
  }
  const must = async <T>(p: string, init?: RequestInit) => (await api<T>(p, init)) as T

  return {
    async head() {
      const ref = await must<{ object: { sha: string } }>(`/git/ref/heads/${REPO.branch}`)
      const c = await must<{ tree: { sha: string } }>(`/git/commits/${ref.object.sha}`)
      return { commit: ref.object.sha, tree: c.tree.sha }
    },
    async tree(treeSha) {
      const t = await must<{ tree: TreeEntry[]; truncated: boolean }>(`/git/trees/${treeSha}?recursive=1`)
      if (t.truncated) throw new GitHubError(500, 'repository tree too large to list')
      return t.tree.filter((e) => e.type === 'blob' || e.type === 'tree').map(({ path, sha, type }) => ({ path, sha, type }))
    },
    async blob(sha) {
      const b = await must<{ content: string }>(`/git/blobs/${sha}`)
      return unb64(b.content)
    },
    async commit(parent, baseTree, files, message) {
      const tree = []
      for (const f of files) {
        if (f.content === null) {
          tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null })
          continue
        }
        const blob = await must<{ sha: string }>('/git/blobs', {
          method: 'POST',
          body: JSON.stringify({ content: b64(f.content), encoding: 'base64' }),
        })
        tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha })
      }
      const t = await must<{ sha: string }>('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree }) })
      const c = await must<{ sha: string }>('/git/commits', {
        method: 'POST',
        body: JSON.stringify({ message, tree: t.sha, parents: [parent] }),
      })
      await must(`/git/refs/heads/${REPO.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha, force: false }) })
      return c.sha
    },
    async log(path, n) {
      const list = await must<{ sha: string; commit: { message: string; author: { name: string; date: string } } }[]>(
        `/commits?sha=${REPO.branch}&path=${encodeURIComponent(path)}&per_page=${n}`,
      )
      return list.map((c) => ({ sha: c.sha, message: c.commit.message, date: c.commit.author.date, author: c.commit.author.name }))
    },
    async diff(sha) {
      const c = await must<{
        parents: { sha: string }[]
        commit: { message: string }
        files: { filename: string; status: string; previous_filename?: string }[]
      }>(`/commits/${sha}`)
      const files: { path: string; status: 'added' | 'modified' | 'removed' }[] = []
      for (const f of c.files) {
        if (f.status === 'added' || f.status === 'removed') files.push({ path: f.filename, status: f.status })
        else if (f.status === 'renamed' && f.previous_filename) {
          files.push({ path: f.filename, status: 'added' }, { path: f.previous_filename, status: 'removed' })
        } else files.push({ path: f.filename, status: 'modified' })
      }
      return { parent: c.parents[0]?.sha ?? '', message: c.commit.message, files }
    },
    async blobAt(commit, path) {
      const f = await api<{ sha: string; content?: string; type: string }>(
        `/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${commit}`,
        {},
        true,
      )
      if (!f || f.type !== 'file') return null
      // the contents API leaves `content` empty above 1 MB; the blob API has no such limit
      const bytes = f.content ? unb64(f.content) : await this.blob(f.sha)
      return { sha: f.sha, bytes }
    },
  }
}
