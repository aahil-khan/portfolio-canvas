import assert from 'node:assert/strict'
import { test } from 'node:test'

import { byYear, counted, holdsWords, kindCounts, kindLabel, kindParam, letterOf, lettersOf, listJoin, sectionGroups, splitLink, stripOf, tagged } from './lists.ts'
import type { Entry, Term } from './types.ts'

const copy = {
  listsNumbers: 'no|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve',
  listsAnd: 'and',
  nounStudy: 'study|studies',
  nounSeries: 'series|series',
  nounChapter: 'chapter|chapters',
  nounNote: 'note|notes',
  nounBuild: 'build|builds',
  nounEssay: 'essay|essays',
  nounEntry: 'entry|entries',
  secHolds: 'It holds {list}.',
}

const base = { section: 's', published: '2026-01-01' as string | null }
const E = (x: Record<string, unknown>) => ({ ...base, slug: String(x.id), title: String(x.id), ...x }) as unknown as Entry

const entries: Entry[] = [
  E({ id: 'study', kind: 'study', published: '2026-11-19', tags: ['a'] }),
  E({ id: 'series', kind: 'series', published: '2026-11-20', study: 'study', tags: ['a', 'b'] }),
  E({ id: 'c2', kind: 'chapter', parent: 'series', order: 2, published: '2026-11-27' }),
  E({ id: 'c1', kind: 'chapter', parent: 'series', order: 1, published: '2026-11-28' }),
  E({ id: 'c3', kind: 'chapter', parent: 'series', order: 3, published: null, draft: true }),
  E({ id: 'n2', kind: 'note', parent: 'study', published: '2026-11-21' }),
  E({ id: 'n1', kind: 'note', parent: 'study', published: '2026-11-19' }),
  E({ id: 'loose', kind: 'note', published: '2025-03-01', tags: ['b'] }),
  E({ id: 'other', kind: 'build', section: 't', published: '2025-07-31' }),
]

test('counted and listJoin speak in words from the copy', () => {
  assert.equal(counted(copy, 8, 'chapter'), 'eight chapters')
  assert.equal(counted(copy, 1, 'study'), 'one study')
  assert.equal(counted(copy, 14, 'note'), '14 notes')
  assert.equal(counted(copy, 2, 'series'), 'two series')
  assert.equal(listJoin(copy, []), '')
  assert.equal(listJoin(copy, ['a']), 'a')
  assert.equal(listJoin(copy, ['a', 'b']), 'a and b')
  assert.equal(listJoin(copy, ['a', 'b', 'c']), 'a, b and c')
  assert.equal(kindLabel(copy, 'chapter'), 'Chapters')
})

test('kindCounts follows the reading order and drops absent kinds', () => {
  const pub = entries.filter((e) => !e.draft && e.section === 's')
  assert.deepEqual(kindCounts(pub), [
    { kind: 'study', n: 1 },
    { kind: 'series', n: 1 },
    { kind: 'note', n: 3 },
    { kind: 'chapter', n: 2 },
  ])
  assert.equal(holdsWords(copy, pub), 'one study, one series, three notes and two chapters')
  assert.equal(holdsWords(copy, []), '')
})

test('sectionGroups lists every published entry once, top-level newest first, kids under them', () => {
  const groups = sectionGroups(entries, 's')
  assert.deepEqual(
    groups.map((g) => [g.entry.id, g.kids.map((k) => k.id)]),
    [
      ['series', ['c1', 'c2']],
      ['study', ['n1', 'n2']],
      ['loose', []],
    ],
  )
  const listed = groups.flatMap((g) => [g.entry.id, ...g.kids.map((k) => k.id)])
  assert.equal(new Set(listed).size, listed.length)
  assert.ok(!listed.includes('c3'), 'a draft is not listed')
  assert.deepEqual(sectionGroups([], 's'), [])
})

test('stripOf takes the three newest top-level entries', () => {
  assert.deepEqual(
    stripOf(entries, 's').map((e) => e.id),
    ['series', 'study', 'loose'],
  )
  assert.deepEqual(
    stripOf(entries, 's', 2).map((e) => e.id),
    ['series', 'study'],
  )
})

test('byYear groups the index newest year first, newest entry first', () => {
  const years = byYear(entries)
  assert.deepEqual(
    years.map((y) => y.year),
    ['2026', '2025'],
  )
  assert.deepEqual(
    years[0].entries.map((e) => e.id),
    ['c1', 'c2', 'n2', 'series', 'n1', 'study'],
  )
  const sameDay = byYear([E({ id: 'b', kind: 'chapter', parent: 'p', order: 2, published: '2026-11-27' }), E({ id: 'a', kind: 'chapter', parent: 'p', order: 1, published: '2026-11-27' })])
  assert.deepEqual(
    sameDay[0].entries.map((e) => e.id),
    ['a', 'b'],
  )
  assert.deepEqual(
    years[1].entries.map((e) => e.id),
    ['other', 'loose'],
  )
  assert.deepEqual(byYear([]), [])
})

test('tagged lists a tag newest first', () => {
  assert.deepEqual(
    tagged(entries, 'b').map((e) => e.id),
    ['series', 'loose'],
  )
  assert.deepEqual(tagged(entries, 'none'), [])
})

test('lettersOf files terms by their first letter, case-insensitively', () => {
  const T = (name: string) => ({ id: name, name, def: '', source: '' }) as Term
  const groups = lettersOf([T('pass^k'), T('all-MiniLM-L6-v2'), T('Blind agent'), T('Pass@k'), T('`tool_call`')])
  assert.deepEqual(
    groups.map((g) => [g.letter, g.terms.map((t) => t.name)]),
    [
      ['A', ['all-MiniLM-L6-v2']],
      ['B', ['Blind agent']],
      ['P', ['Pass@k', 'pass^k']],
      ['T', ['`tool_call`']],
    ],
  )
  assert.equal(letterOf('`tool_call`'), 'T')
  assert.equal(letterOf('9 lives'), '9')
  assert.equal(letterOf('—'), '#')
})

test('splitLink finds the one link in a copy string', () => {
  assert.deepEqual(splitLink('Begin with [[{link}]]: it maps.'), { before: 'Begin with ', after: ': it maps.', hasLink: true })
  assert.deepEqual(splitLink('No link.'), { before: 'No link.', after: '', hasLink: false })
})

test('kindParam accepts only a kind the index lists', () => {
  assert.equal(kindParam('build', ['build', 'essay']), 'build')
  assert.equal(kindParam('study', ['build', 'essay']), 'all')
  assert.equal(kindParam(null, ['build']), 'all')
})
