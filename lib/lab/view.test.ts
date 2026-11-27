import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Entry } from './types.ts'
import { dotX, fill, formatDay, kindWords, pad2, progress, resolveLead, shareUrls } from './view.ts'

test('fill leaves an unknown placeholder visible', () => {
  assert.equal(fill('{n} min read', { n: 4 }), '4 min read')
  assert.equal(fill('A chapter from {parent}', {}), 'A chapter from {parent}')
  assert.equal(fill(undefined), '')
})

test('formatDay keeps a date on one line and drops the current year', () => {
  assert.equal(formatDay('2026-11-26', '2026-11-27'), '26 Nov')
  assert.equal(formatDay('2025-07-31', '2026-11-27'), '31 Jul 2025')
  assert.ok(!/ /.test(formatDay('2025-07-31', '2026-11-27')))
})

test('pad2', () => {
  assert.equal(pad2(5), '05')
  assert.equal(pad2(12), '12')
})

const base = { id: 'x', slug: 'x', section: 's', title: 'X', published: '2026-11-01' }

test('resolveLead walks each kind’s chain, first match wins', () => {
  const studies = { st: { id: 'st', tracks: [], topics: [] } }
  const ctx = { studies, chapters: 0 }
  assert.equal(resolveLead({ ...base, id: 'st', kind: 'study', log: [{ date: '2026-11-01', did: 'x' }] } as Entry, ctx), 'board')
  assert.equal(resolveLead({ ...base, kind: 'study', log: [{ date: '2026-11-01', did: 'x' }] } as Entry, ctx), 'logline')
  assert.equal(resolveLead({ ...base, kind: 'series' } as Entry, { studies, chapters: 3 }), 'progress')
  assert.equal(resolveLead({ ...base, kind: 'series', premise: 'p' } as Entry, ctx), 'progress')
  assert.equal(resolveLead({ ...base, kind: 'chapter', parent: 'p', order: 1, keyLine: 'k' } as Entry, ctx), 'keyline')
  assert.equal(resolveLead({ ...base, kind: 'chapter', parent: 'p', order: 1, keyLine: 'k', lead: { instrument: 'haggle' } } as Entry, ctx), 'instrument')
  const build = { ...base, kind: 'build', ending: { text: 'e' }, endingKind: 'do' }
  assert.equal(resolveLead({ ...build, install: 'npm i x' } as Entry, ctx), 'install')
  assert.equal(resolveLead({ ...build, install: 'npm i x', lead: { figure: 'f' } } as Entry, ctx), 'figure')
  assert.equal(resolveLead({ ...build, lead: { images: [{ src: '/a.webp', w: 1, h: 1, alt: '' }], figure: 'f' } } as Entry, ctx), 'screens')
  assert.equal(resolveLead({ ...build, lead: { demo: { src: '/a.webp', poster: '/p.webp', w: 1, h: 1, alt: '' } } } as Entry, ctx), 'demo')
  assert.equal(resolveLead({ ...base, kind: 'essay', opening: 'o' } as Entry, ctx), 'opening')
  assert.equal(resolveLead({ ...base, kind: 'experiment', result: { question: 'q', setup: 's', value: 'v' }, ending: { text: 'e' }, endingKind: 'do' } as Entry, ctx), 'result')
  assert.equal(resolveLead({ ...base, kind: 'essay', opening: '' } as Entry, ctx), null)
})

test('kindWords names the parent of a chapter or a note', () => {
  const copy = { kindChapter: 'A chapter from {parent}', kindNote: 'A note from {parent}', kindBuild: 'A build' }
  assert.equal(kindWords(copy, { ...base, kind: 'chapter', parent: 'p', order: 1 } as Entry, 'The Shopkeeper'), 'A chapter from The Shopkeeper')
  assert.equal(kindWords(copy, { ...base, kind: 'note' } as Entry), 'A note')
  assert.equal(kindWords(copy, { ...base, kind: 'build', ending: { text: 'e' }, endingKind: 'do' } as Entry), 'A build')
})

test('progress is 0 at the top, monotonic, and exactly 1 when the body’s end meets the viewport’s bottom', () => {
  const top = 120
  const end = 5000
  const vh = 900
  const target = end - vh
  assert.equal(progress(0, top, end, vh), 0)
  let last = 0
  for (let y = 0; y <= target; y += 37) {
    const p = progress(y, top, end, vh)
    assert.ok(p >= last, `monotonic at ${y}`)
    last = p
  }
  assert.equal(progress(target, top, end, vh), 1)
  assert.ok(progress(target - 1, top, end, vh) < 1)
  assert.equal(progress(target + 400, top, end, vh), 1)
})

test('progress on a body that ends inside the first screen', () => {
  assert.equal(progress(0, 120, 700, 900), 1)
  assert.equal(progress(0, 120, 1000, 900), 0)
})

test('dotX rides the trail’s end but stays clear of the mark and the edge', () => {
  assert.equal(dotX(0, 1440, 120), 120)
  assert.equal(dotX(0.5, 1440, 120), 709)
  assert.equal(dotX(1, 1440, 120), 1440 - 22 - 8)
})

test('shareUrls encode the canonical URL', () => {
  const s = shareUrls('https://aahil-khan.xyz/lab/a b', 'T & U')
  assert.ok(s.x.includes('url=https%3A%2F%2Faahil-khan.xyz%2Flab%2Fa%20b'))
  assert.ok(s.x.includes('text=T%20%26%20U'))
  assert.ok(s.linkedin.startsWith('https://www.linkedin.com/sharing/share-offsite/?url=https%3A'))
})
