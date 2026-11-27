import { test } from 'node:test'
import assert from 'node:assert/strict'

import { feedItems, lastChange } from './feed-items.ts'

const posts = [
  { slug: 'a', title: 'Post A', blurb: 'a', year: 2025, href: 'https://elsewhere.test/a' },
  { slug: 'b', title: 'Same Title', blurb: 'b', year: 2026, href: 'https://elsewhere.test/b', lab: 'essay-b' },
  { slug: 'c', title: 'Lab Essay', blurb: 'c', year: 2024, href: 'https://elsewhere.test/c' },
]
const lab = [
  { id: 'essay-b', title: 'Same Title, reworded', url: 'https://site.test/lab/writing/essay-b', description: 'B', published: '2026-03-02' },
  { id: 'study-x', title: 'Lab Essay', url: 'https://site.test/lab/studies/x', description: 'X', published: '2026-11-20', updated: '2026-11-25' },
]

test('while the Lab is hidden, only the posts are listed, and a lab field changes nothing', () => {
  const items = feedItems({ posts, lab, labPublic: false })
  assert.deepEqual(items.map((i) => i.link), ['https://elsewhere.test/b', 'https://elsewhere.test/a', 'https://elsewhere.test/c'])
  assert.ok(!items.some((i) => i.link.includes('/lab')))
})

test('while public, Lab entries join, and a post naming one in `lab` gives way to it', () => {
  const items = feedItems({ posts, lab, labPublic: true })
  const links = items.map((i) => i.link)
  assert.deepEqual(links, [
    'https://site.test/lab/studies/x',
    'https://site.test/lab/writing/essay-b',
    'https://elsewhere.test/a',
    'https://elsewhere.test/c',
  ])
})

test('dedupe is by the lab field, never by title', () => {
  // post c shares study-x's title exactly, and is still listed
  const items = feedItems({ posts, lab, labPublic: true })
  assert.equal(items.filter((i) => i.title === 'Lab Essay').length, 2)
  // a post naming an entry the Lab does not have is kept
  const orphan = feedItems({ posts: [{ ...posts[1], lab: 'no-such-entry' }], lab, labPublic: true })
  assert.ok(orphan.some((i) => i.link === 'https://elsewhere.test/b'))
})

test('dates: a Lab day at noon UTC, a post on 1 January of its year; updated only when later', () => {
  const items = feedItems({ posts, lab, labPublic: true })
  const x = items.find((i) => i.id.endsWith('/x'))!
  assert.equal(x.date.toISOString(), '2026-11-20T12:00:00.000Z')
  assert.equal(x.updated?.toISOString(), '2026-11-25T12:00:00.000Z')
  assert.equal(items.find((i) => i.id.endsWith('/essay-b'))!.updated, undefined)
  assert.equal(items.find((i) => i.id.endsWith('/a'))!.date.toISOString(), '2025-01-01T12:00:00.000Z')
  assert.equal(lastChange(items)?.toISOString(), '2026-11-25T12:00:00.000Z')
  assert.equal(lastChange([]), null)
})
