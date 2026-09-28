import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fakeGit, type FakeGit } from './fake-github.ts'
import { history, load, revert, save, upload } from './service.ts'
import { FILES } from '../../content/schema/index.ts'
import { FIXTURE_FILES, fixture } from './test-fixture.ts'

const enc = new TextEncoder()
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const PDF = enc.encode('%PDF-1.7\nhello')

function seeded(): FakeGit {
  const set = fixture()
  const files: Record<string, Uint8Array> = {}
  for (const f of FILES) files[f.path] = enc.encode(JSON.stringify(set[f.id], null, 2) + '\n')
  for (const p of FIXTURE_FILES) files[`public${p}`] = PNG
  return fakeGit(files)
}

const shaOf = async (git: FakeGit, id: string) => (await load(git)).files[id as 'projects'].sha

test('load returns every content file with its blob sha, and the public file list', async () => {
  const git = seeded()
  const l = await load(git)
  assert.equal(Object.keys(l.files).length, FILES.length)
  assert.ok(l.publicFiles.includes('/work/p1-1.webp'))
  assert.equal((l.files.projects.data as { slug: string }[])[0].slug, 'p1')
})

test('save makes exactly one commit, pretty-printed, with the trailer', async () => {
  const git = seeded()
  const before = git.commits()
  const data = fixture().projects as { name: string }[]
  data[0].name = 'Renamed'
  const r = await save(git, 'projects', data, await shaOf(git, 'projects'), '')
  assert.ok(r.ok)
  assert.equal(git.commits(), before + 1)
  assert.match(git.lastMessage(), /^Edit Projects\n\nEdited-via: \/edit$/)
  const text = git.read('content/data/projects.json')
  assert.match(text, /"name": "Renamed"/)
  assert.ok(text.endsWith('\n'))
})

test('saving unchanged content makes no commit', async () => {
  const git = seeded()
  const r = await save(git, 'projects', fixture().projects, await shaOf(git, 'projects'), '')
  assert.ok(r.ok)
  assert.equal(git.commits(), 1)
})

test('save rejects stale sha', async () => {
  const git = seeded()
  const stale = await shaOf(git, 'projects')
  const other = fixture().projects as { tagline: string }[]
  other[0].tagline = 'changed on the laptop'
  await save(git, 'projects', other, stale, 'laptop')
  const r = await save(git, 'projects', fixture().projects, stale, 'editor')
  assert.equal(!r.ok && r.status, 409)
})

test('save validates the whole set', async () => {
  const git = seeded()
  // the shelf loses Python, which the fixture's project and job still name
  const r = await save(git, 'stack', [{ label: 'Languages', tools: [{ name: 'Go' }] }], await shaOf(git, 'stack'), '')
  assert.equal(!r.ok && r.status, 422)
  assert.ok(!r.ok && r.issues?.some((i) => /lists stack "Python"/.test(i.message)))
  assert.equal(git.commits(), 1)
})

test('save maps 422 non-fast-forward to 409', async () => {
  const git = seeded()
  git.failNextCommit()
  const data = fixture().projects as { name: string }[]
  data[0].name = 'Changed'
  const r = await save(git, 'projects', data, await shaOf(git, 'projects'), '')
  assert.equal(!r.ok && r.status, 409)
})

test('upload of a 6 MB image is 413', async () => {
  const big = new Uint8Array(6 * 1024 * 1024)
  big.set(PNG)
  const r = await upload(seeded(), big, { dir: 'work', slug: 'p1' })
  assert.equal(!r.ok && r.status, 413)
})

test('upload of SVG or HTML is 415, whatever it is called', async () => {
  const git = seeded()
  for (const body of ['<svg xmlns="http://www.w3.org/2000/svg"/>', '<!doctype html><script>alert(1)</script>']) {
    const r = await upload(git, enc.encode(body), { dir: 'work', slug: 'x' })
    assert.equal(!r.ok && r.status, 415)
  }
})

test('a PDF is not an image, and an image is not a résumé', async () => {
  const git = seeded()
  assert.equal((await upload(git, PDF, { dir: 'work', slug: 'x' })).ok, false)
  assert.equal((await upload(git, PNG, { resume: true })).ok, false)
})

test('upload numbering continues after the highest existing number', async () => {
  const git = seeded()
  await upload(git, PNG, { dir: 'work', slug: 'p1' })
  const r = await upload(git, PNG, { dir: 'work', slug: 'p1' })
  assert.equal(r.ok && r.path, '/work/p1-3.png')
  assert.match(git.lastMessage(), /Edited-via: \/edit/)
})

test('the server chooses the file name, not the client', async () => {
  const r = await upload(seeded(), PNG, { dir: 'work', slug: '../../Etc/Passwd!!' })
  assert.equal(r.ok && r.path, '/work/etc-passwd-1.png')
})

test('an unknown upload folder is refused', async () => {
  const r = await upload(seeded(), PNG, { dir: '../app', slug: 'x' })
  assert.equal(r.ok, false)
})

test('a résumé replaces the file the profile already points at', async () => {
  const git = seeded()
  const r = await upload(git, PDF, { resume: true })
  assert.equal(r.ok && r.path, '/cv.pdf')
})

test('history lists content and upload commits newest first, without duplicates', async () => {
  const git = seeded()
  await upload(git, PNG, { dir: 'work', slug: 'p1' })
  const data = fixture().projects as { name: string }[]
  data[0].name = 'Changed'
  await save(git, 'projects', data, await shaOf(git, 'projects'), 'a save')
  const h = await history(git)
  assert.equal(h[0].message.split('\n')[0], 'a save')
  assert.equal(new Set(h.map((c) => c.sha)).size, h.length)
})

test('revert restores the previous content in one commit', async () => {
  const git = seeded()
  const data = fixture().projects as { name: string }[]
  data[0].name = 'Oops'
  const r = await save(git, 'projects', data, await shaOf(git, 'projects'), 'oops')
  assert.ok(r.ok)
  const back = await revert(git, r.ok ? r.commit : '')
  assert.ok(back.ok)
  assert.doesNotMatch(git.read('content/data/projects.json'), /Oops/)
  assert.match(git.lastMessage(), /^Revert "oops"/)
})

test('revert refuses when file moved on', async () => {
  const git = seeded()
  const a = fixture().projects as { name: string }[]
  a[0].name = 'First'
  const first = await save(git, 'projects', a, await shaOf(git, 'projects'), 'first')
  a[0].name = 'Second'
  await save(git, 'projects', a, await shaOf(git, 'projects'), 'second')
  const r = await revert(git, first.ok ? first.commit : '')
  assert.equal(!r.ok && r.status, 409)
  assert.match(!r.ok ? r.message : '', /second/)
})

test('revert of an upload deletes the file', async () => {
  const git = seeded()
  const up = await upload(git, PNG, { dir: 'work', slug: 'new' })
  const r = await revert(git, up.ok ? up.commit : '')
  assert.ok(r.ok)
  assert.equal(git.has('public/work/new-1.png'), false)
})

test('revert that would leave content invalid is refused', async () => {
  const git = seeded()
  // add a tool, use it, then try to revert adding the tool
  const shelf = fixture().stack as { label: string; tools: { name: string }[] }[]
  shelf[0].tools.push({ name: 'Go' })
  const added = await save(git, 'stack', shelf, await shaOf(git, 'stack'), 'add Go')
  const p = fixture().projects as { stack: string[] }[]
  p[0].stack = ['Go']
  await save(git, 'projects', p, await shaOf(git, 'projects'), 'use Go')
  const r = await revert(git, added.ok ? added.commit : '')
  assert.equal(!r.ok && r.status, 422)
})
