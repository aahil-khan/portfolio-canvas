/**
 * The instruments' logic apart from the DOM: the board's rows and keys, the scenario list's keys,
 * pass@k's arithmetic, and the registry's schemas, which every figure in both sets must pass.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import type { StudyData } from '../types.ts'
import { boardMove, boardRows, defaultTopic, topicFill } from './board.ts'
import { passAt, passHat, pct } from './passk.ts'
import { listMove } from './scenarios.ts'
import { DEMO_CONTENT } from '../visibility.ts'
import { INSTRUMENT_SCHEMAS } from './schemas.ts'

const t = (id: string, track: string, status: StudyData['topics'][number]['status'] = 'todo', finished: string | null = null) => ({ id, track, topic: id, phase: 'p', est: 4, spent: 1, status, finished })
const study: StudyData = {
  id: 's',
  tracks: ['A', 'B', 'C'],
  topics: [t('a1', 'A', 'done', '2026-11-01'), t('a2', 'A', 'done', '2026-11-05'), t('a3', 'A'), t('b1', 'B'), t('c1', 'C', 'doing'), t('c2', 'C'), t('c3', 'C'), t('c4', 'C')],
}

test('the board: a row per track, in order', () => {
  assert.deepEqual(
    boardRows(study).map((r) => [r.track, r.topics.map((x) => x.id)]),
    [
      ['A', ['a1', 'a2', 'a3']],
      ['B', ['b1']],
      ['C', ['c1', 'c2', 'c3', 'c4']],
    ],
  )
})

test('the board opens on the topic under way, else the newest done', () => {
  assert.equal(defaultTopic(study), 'c1')
  assert.equal(defaultTopic({ ...study, topics: study.topics.filter((x) => x.status !== 'doing') }), 'a2')
})

test('a square fills by hours over the estimate, never full until done', () => {
  assert.equal(topicFill({ status: 'done', spent: 0, est: 4 }), 100)
  assert.equal(topicFill({ status: 'doing', spent: 1, est: 4 }), 25)
  assert.equal(topicFill({ status: 'doing', spent: 9, est: 4 }), 96)
  assert.equal(topicFill({ status: 'doing', spent: 0, est: 10 }), 4)
  assert.equal(topicFill({ status: 'todo', spent: 3, est: 4 }), 0)
})

test('the board’s keys: reading order across rows, columns clamped to a shorter row', () => {
  const rows = boardRows(study)
  assert.equal(boardMove(rows, 'a3', 'ArrowRight'), 'b1')
  assert.equal(boardMove(rows, 'b1', 'ArrowLeft'), 'a3')
  assert.equal(boardMove(rows, 'a3', 'ArrowDown'), 'b1')
  assert.equal(boardMove(rows, 'b1', 'ArrowDown'), 'c1')
  assert.equal(boardMove(rows, 'c4', 'ArrowUp'), 'b1')
  assert.equal(boardMove(rows, 'c4', 'ArrowDown'), 'c4')
  assert.equal(boardMove(rows, 'a1', 'ArrowUp'), 'a1')
  assert.equal(boardMove(rows, 'c2', 'Home'), 'c1')
  assert.equal(boardMove(rows, 'c2', 'End'), 'c4')
  assert.equal(boardMove(rows, 'c2', 'Home', true), 'a1')
  assert.equal(boardMove(rows, 'a2', 'End', true), 'c4')
  assert.equal(boardMove(rows, 'a2', 'Enter'), null)
})

test('the scenario list’s keys', () => {
  const ids = ['A1', 'A2', 'A3']
  assert.equal(listMove(ids, 'A1', 'ArrowDown'), 'A2')
  assert.equal(listMove(ids, 'A3', 'ArrowDown'), 'A3')
  assert.equal(listMove(ids, 'A2', 'ArrowUp'), 'A1')
  assert.equal(listMove(ids, 'A2', 'End'), 'A3')
  assert.equal(listMove(ids, 'A2', 'Home'), 'A1')
  assert.equal(listMove(ids, 'A2', 'a'), null)
  assert.equal(listMove([], 'A2', 'Home'), null)
})

test('pass@k and pass^k: the note’s own numbers', () => {
  assert.equal(pct(passHat(0.9, 5)), '59%')
  assert.equal(pct(passAt(0.9, 5)), '99.999%')
  assert.equal(pct(passAt(0.9, 1)), '90%')
  assert.equal(pct(passHat(0.9, 3)), '72.9%')
  assert.equal(pct(1), '100%')
  for (let k = 1; k <= 8; k++) assert.ok(passAt(0.7, k) >= passHat(0.7, k))
})

for (const set of ['content/data/lab-figures.json', `${DEMO_CONTENT}/lab-figures.json`]) {
  test(`every figure in ${set} has its instrument’s shape`, () => {
    const figures = JSON.parse(readFileSync(set, 'utf8')) as Record<string, { instrument: string; data: Record<string, unknown> }>
    for (const [id, f] of Object.entries(figures)) {
      const schema = INSTRUMENT_SCHEMAS[f.instrument]
      assert.ok(schema, `${id}: "${f.instrument}" is not registered`)
      assert.deepEqual(schema(f.data), [], id)
    }
  })
}

test('the schemas refuse what the instruments cannot draw', () => {
  const S = INSTRUMENT_SCHEMAS
  assert.ok(S.compare({ head: ['', 'A'], rows: [['x', 'y', 'z']] }).some((m) => m.includes('cells')))
  assert.ok(S.compare({ head: ['', 'A', 'B'], rows: [['x', 'y', 'z']], chosen: 0 }).length)
  assert.ok(S.chart({ max: 1, rows: [{ label: 'x', lo: 2 }] }).some((m) => m.includes('past max')))
  assert.ok(S.haggle({ items: { X: { name: 'x', list: 100, floor: 120 } }, copy: {} }).some((m) => m.includes('under the list')))
  assert.ok(S.haggle({ items: { X: { name: 'x', list: 899, floor: 650 } }, copy: {} }).some((m) => m === 'copy.open is missing'))
  assert.ok(S.scenarios({ groups: [{ id: 'A', name: 'A' }], items: [{ g: 'B', id: 'B1', who: 'w', wants: 'x', expected: 'SALE' }], copy: {} }).some((m) => m.includes('not one of the groups')))
  assert.ok(S.passk({ copy: { p: 'p', at: 'a', hat: 'h', atKey: 'a', hatKey: 'h' }, p: 1.5 }).length)
  assert.deepEqual(S.board({}), [])
})
