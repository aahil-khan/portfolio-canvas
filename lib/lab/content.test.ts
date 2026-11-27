/**
 * The loaders (API.md §2), over the real set as committed, over a synthetic set, and with the
 * fixture. The demo set's own tests are in `content/lab/demo/`.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { createLab, loadSet } from './content.ts'
import type { Entry, Lab } from './types.ts'

test('the real set starts empty, and every loader returns empty without throwing', () => {
  const real = loadSet('real')
  assert.deepEqual([real.lab.sections, real.lab.tags, real.lab.entries, real.lab.terms], [[], [], [], []])
  assert.deepEqual([real.lab.figures, real.lab.unfurls, real.lab.studies], [{}, {}, {}])
  const api = createLab(real.lab, real.bodies)
  assert.deepEqual(api.routes(), [
    { kind: 'home', path: '/lab' },
    { kind: 'index', path: '/lab/index' },
    { kind: 'glossary', path: '/lab/glossary' },
  ])
  assert.deepEqual(api.homeBands(), [])
  assert.deepEqual(api.latest(), [])
  assert.deepEqual(api.related('anything'), [])
  assert.deepEqual(api.backlinks('anything'), [])
  assert.deepEqual(api.children('anything'), [])
  assert.equal(api.newHere(), null)
  assert.equal(api.newHere('anything'), null)
  assert.equal(api.entryByPath(['a', 'b']), null)
  assert.equal(api.bodyOf('anything'), '')
  assert.equal(api.readTime('anything'), 1)
  // the chrome's copy is real either way
  assert.equal(typeof real.lab.copy.demoMarker, 'string')
})

test('a missing set reads as empty', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-empty-'))
  const s = loadSet('real', { root })
  assert.equal(s.lab.entries.length, 0)
  assert.deepEqual(createLab(s.lab, s.bodies).routes().map((r) => r.path), ['/lab', '/lab/index', '/lab/glossary'])
})

const e = (x: Partial<Entry> & Pick<Entry, 'id' | 'kind'>): Entry =>
  ({ slug: x.id, section: 'bench', title: x.id, published: '2026-01-01', ...x }) as Entry

function synthetic(): Lab {
  return {
    copy: {},
    sections: [
      { id: 'bench', title: 'Bench', thesis: 't' },
      { id: 'shelf', title: 'Shelf', thesis: 't' },
      { id: 'attic', title: 'Attic', thesis: 'never shown: nothing top-level lives here' },
    ],
    tags: [
      { id: 'a', title: 'a' },
      { id: 'b', title: 'b' },
      { id: 'unused', title: 'unused' },
    ],
    terms: [{ id: 'wat', name: 'Wat', def: 'd', link: 'n1', source: 's' }],
    figures: {},
    unfurls: {},
    studies: {},
    entries: [
      e({ id: 'st', kind: 'study', published: '2026-01-01', tags: ['a'] }),
      e({ id: 'n1', kind: 'note', parent: 'st', published: '2026-01-05', tags: ['a', 'b'] }),
      e({ id: 'n0', kind: 'note', parent: 'st', published: '2026-01-03' }),
      e({ id: 'se', kind: 'series', published: '2026-01-02' }),
      e({ id: 'c2', kind: 'chapter', parent: 'se', order: 2, published: '2026-01-07' }),
      e({ id: 'c1', kind: 'chapter', parent: 'se', order: 1, published: '2026-01-06' }),
      e({ id: 'c3', kind: 'chapter', parent: 'se', order: 3, published: null, draft: true }),
      e({ id: 'b1', kind: 'build', section: 'shelf', published: '2026-01-04', tags: ['a', 'b'], mentions: ['se'] }),
      e({ id: 'lonely', kind: 'essay', section: 'shelf', published: '2025-12-01' }),
      e({ id: 'loft', kind: 'chapter', section: 'attic', parent: 'se', order: 9, published: '2026-01-08' }),
    ],
  }
}
const bodies = { st: 'See [[b1|the build]], then [[t:wat|a term]].\n', b1: 'Links to [[st|the study]].\n' }

test('routes: home, shown sections, published entries, index, used tags, glossary', () => {
  const api = createLab(synthetic(), bodies)
  const r = api.routes()
  assert.deepEqual(
    r.map((x) => x.kind),
    ['home', 'section', 'section', ...Array(9).fill('entry'), 'index', 'tag', 'tag', 'glossary'],
  )
  assert.ok(!r.some((x) => x.path === '/lab/attic'), 'a section with no top-level entry is not a route')
  assert.ok(!r.some((x) => x.path.endsWith('/c3')), 'a draft is not a route')
  assert.ok(!r.some((x) => x.path === '/lab/tags/unused'), 'an unused tag is not a route')
  assert.ok(r.some((x) => x.path === '/lab/bench/se/c1'), 'a chapter sits under its series')
  assert.ok(r.some((x) => x.path === '/lab/bench/st/n1'), 'a note sits under its study')
})

test('entryByPath and pathOf agree; anything else is null', () => {
  const api = createLab(synthetic(), bodies)
  for (const r of api.routes()) if (r.kind === 'entry') assert.equal(api.pathOf(api.entryByPath(r.path.split('/').slice(2))!), r.path)
  assert.equal(api.entryByPath(['bench', 'se', 'c3']), null)
  assert.equal(api.entryByPath(['bench', 'c1']), null)
})

test('children: chapters by order, notes by date', () => {
  const api = createLab(synthetic(), bodies)
  assert.deepEqual(api.children('se').map((x) => x.id), ['c1', 'c2', 'c3', 'loft'])
  assert.deepEqual(api.children('st').map((x) => x.id), ['n0', 'n1'])
  assert.deepEqual(api.children('b1'), [])
})

test('related: links first (terms that point at an entry count), then shared tags, then the section', () => {
  const api = createLab(synthetic(), bodies)
  const ids = api.related('st').map((x) => x.id)
  assert.deepEqual(ids.slice(0, 2), ['b1', 'n1'], 'body links in order: the build, then the term that links to n1')
  assert.ok(ids.indexOf('n0') > 1, 'its own section comes after')
  assert.ok(!ids.includes('st'))
  // the essay has no links and no tags: its section still gives it something
  assert.deepEqual(api.related('lonely').map((x) => x.id), ['b1'])
  // never empty while there are two entries
  const two = createLab({ ...synthetic(), entries: [e({ id: 'x', kind: 'essay' }), e({ id: 'y', kind: 'essay', section: 'shelf' })] })
  assert.deepEqual(two.related('x').map((x) => x.id), ['y'])
})

test('backlinks: body links and mentions', () => {
  const api = createLab(synthetic(), bodies)
  assert.deepEqual(api.backlinks('st').map((x) => x.id), ['b1'])
  assert.deepEqual(api.backlinks('se').map((x) => x.id), ['b1'])
  assert.deepEqual(api.backlinks('n1').map((x) => x.id), ['st'])
})

test('homeBands: top-level entries only, newest first, at most 5; total counts children', () => {
  const api = createLab(synthetic(), bodies)
  const bands = api.homeBands()
  assert.deepEqual(bands.map((b) => b.section.id), ['bench', 'shelf'])
  assert.deepEqual(bands[0].entries.map((x) => x.id), ['se', 'st'])
  assert.equal(bands[0].total, 6)
})

test('latest: any kind, newest first, no cap per series', () => {
  assert.deepEqual(createLab(synthetic(), bodies).latest(3).map((x) => x.id), ['loft', 'c2', 'c1'])
})

test('newHere: counts by kind, and the oldest of the highest-ranked kind', () => {
  const api = createLab(synthetic(), bodies)
  const all = api.newHere()!
  assert.equal(all.start.id, 'st')
  assert.equal(all.counts.chapter, 3)
  assert.equal(api.newHere('shelf')!.start.id, 'b1')
  assert.equal(api.newHere('nowhere'), null)
})

test('readTime: 220 words a minute, at least 1', () => {
  const lab = synthetic()
  assert.equal(createLab(lab, { st: 'word '.repeat(660) }).readTime('st'), 3)
  assert.equal(createLab(lab, {}).readTime('st'), 1)
})

test('the fixture loads only when asked, and every fixture id starts fx-', () => {
  for (const name of ['real', 'demo'] as const) {
    const plain = loadSet(name)
    assert.ok(!JSON.stringify(plain.lab).includes('fx-'), `${name}: no fixture id without the fixture`)
    const fx = loadSet(name, { fixture: true })
    const added = fx.lab.entries.filter((x) => !plain.lab.entries.some((p) => p.id === x.id))
    assert.equal(added.length, 7)
    assert.deepEqual([...new Set(added.map((x) => x.kind))].sort(), ['build', 'chapter', 'essay', 'experiment', 'note', 'series', 'study'])
    for (const x of [...added, ...fx.lab.sections.filter((s) => !plain.lab.sections.some((p) => p.id === s.id))]) assert.match(x.id, /^fx-/)
    const api = createLab(fx.lab, fx.bodies)
    assert.ok(api.routes().some((r) => r.path === '/lab/fx-voice'), 'the new section appears')
    assert.ok(!api.routes().some((r) => r.path === '/lab/fx-empty'), 'an empty section never does')
  }
})
