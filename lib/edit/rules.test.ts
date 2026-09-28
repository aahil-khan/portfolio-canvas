import { test } from 'node:test'
import assert from 'node:assert/strict'

import { validateSet } from './rules.ts'
import type { ContentSet } from '../../content/schema/index.ts'
import { fixture } from './test-fixture.ts'

const FILES = new Set(['/work/p1-1.webp', '/cv.pdf', '/logos/py.svg'])
const exists = (p: string) => FILES.has(p)
const run = (set: ContentSet) => validateSet(set, exists)
const messages = (set: ContentSet) => run(set).map((i) => `${i.path}: ${i.message}`).join('\n')

test('the fixture is valid', () => {
  assert.deepEqual(run(fixture()), [])
})

test('a duplicate project slug is reported', () => {
  const s = fixture()
  const p = (s.projects as object[])[0]
  s.projects = [p, { ...p }]
  assert.match(messages(s), /duplicate slug "p1"/)
})

test('every item sharing a slug is flagged, so the one you just edited shows it too', () => {
  const s = fixture()
  const p = (s.projects as object[])[0]
  s.projects = [p, { ...p }]
  const paths = run(s).filter((i) => /duplicate/.test(i.message)).map((i) => i.path)
  assert.deepEqual(paths, ['projects[0].slug', 'projects[1].slug'])
})

test('a stack entry with no tool on the shelf names the project', () => {
  const s = fixture()
  ;(s.projects as { stack: string[] }[])[0].stack = ['Nope']
  assert.match(messages(s), /"p1" lists stack "Nope"/)
})

test('removing a tool still named by a job is caught', () => {
  const s = fixture()
  s.stack = [{ label: 'Languages', tools: [{ name: 'Go' }] }]
  assert.match(messages(s), /"j1" lists stack "Python"/)
})

test('an image that is not in public/ is reported', () => {
  const s = fixture()
  ;(s.projects as { images: string[] }[])[0].images = ['/work/missing.webp']
  assert.match(messages(s), /file not found .*\/work\/missing\.webp/)
})

test('an archive picture with a caption is checked for existence too', () => {
  const s = fixture()
  s.archive = [{ id: 'a1', kind: 'built', title: 'T', when: 'now', images: [{ src: '/archive/x.jpeg', caption: 'c' }] }]
  assert.match(messages(s), /archive\/x\.jpeg/)
})

test('the "Al Powered" typo is forbidden', () => {
  const s = fixture()
  ;(s.experience as { jobs: { highlights: string[] }[] }).jobs[0].highlights = ['Al Powered search']
  assert.match(messages(s), /capital i/)
})

test('a derived stat must name something that can be derived', () => {
  const s = fixture()
  ;(s.profile as { headlineStats: object[] }).headlineStats = [{ derived: 'x', label: 'x' }]
  assert.notEqual(run(s).length, 0)
})

test('a stat needs either a value or a derivation, not both or neither', () => {
  const s = fixture()
  ;(s.profile as { headlineStats: object[] }).headlineStats = [{ label: 'x' }, { value: '1', derived: 'wins', label: 'y' }]
  assert.equal(run(s).length, 2)
})

test('a schema error is reported with the file as the path prefix', () => {
  const s = fixture()
  ;(s.projects as { kind: string }[])[0].kind = 'Hobby'
  assert.match(messages(s), /^projects\[0\]\.kind:/m)
})

test('a relative project link is rejected', () => {
  const s = fixture()
  ;(s.projects as { links: { label: string; href: string }[] }[])[0].links = [{ label: 'Demo', href: 'example.com' }]
  assert.notEqual(run(s).length, 0)
})
