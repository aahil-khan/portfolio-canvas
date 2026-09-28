import { test } from 'node:test'
import assert from 'node:assert/strict'

import { GitConflict, githubGit } from './github.ts'

/** Answers each GitHub REST call from a table; the ref update gets `refStatus`. */
function fakeFetch(refStatus: number, refBody: string, seen: string[] = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    seen.push(`${init?.method ?? 'GET'} ${url.replace('https://api.github.com/repos/aahil-khan/portfolio-canvas', '')}`)
    if (url.endsWith('/git/blobs')) return Response.json({ sha: 'blob1' })
    if (url.endsWith('/git/trees')) return Response.json({ sha: 'tree1' })
    if (url.endsWith('/git/commits')) return Response.json({ sha: 'commit1' })
    if (url.includes('/git/refs/heads/main')) return new Response(refBody, { status: refStatus })
    return new Response('?', { status: 500 })
  }) as typeof fetch
}

test('a non-fast-forward ref update becomes GitConflict', async () => {
  const git = githubGit('t', fakeFetch(422, '{"message":"Update is not a fast forward"}'))
  await assert.rejects(git.commit('p', 't', [{ path: 'a', content: new Uint8Array([1]) }], 'm'), GitConflict)
})

test('a commit is blob → tree → commit → ref, with force off', async () => {
  const seen: string[] = []
  const git = githubGit('t', fakeFetch(200, '{}', seen))
  assert.equal(await git.commit('p', 't', [{ path: 'a', content: new Uint8Array([1]) }], 'm'), 'commit1')
  assert.deepEqual(seen, ['POST /git/blobs', 'POST /git/trees', 'POST /git/commits', 'PATCH /git/refs/heads/main'])
})

test('any other GitHub error is not mistaken for a conflict', async () => {
  const git = githubGit('t', fakeFetch(403, '{"message":"Resource not accessible by integration"}'))
  await assert.rejects(git.commit('p', 't', [], 'm'), (e) => !(e instanceof GitConflict))
})
