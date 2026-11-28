/**
 * `scripts/lab-import-study.ts`: columns by header, never by position; private columns, sheets,
 * tracks and topics never reach the board; a private word refuses the import.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fromSheets } from '../../scripts/lab-import-study.ts'

const HEAD = ['Notes', 'ID', 'Why it matters for the role', 'Track', 'Topic', 'What to learn', 'Phase', 'Est. hrs', 'Hours spent', 'Status', 'Finished on', 'Your starting point (resume)']
const row = (o: Record<string, string>) => HEAD.map((h) => o[h] ?? '')
const topics = [
  ['A title row'],
  HEAD,
  row({ ID: 'T01', Track: 'Evals', Topic: 'One', 'What to learn': 'Learn one.', Phase: 'Phase 1 · Core', 'Est. hrs': '3', 'Hours spent': '1.5', Status: 'Done', 'Finished on': '46345', Notes: 'secret note', 'Why it matters for the role': 'secret', 'Your starting point (resume)': 'secret' }),
  row({ ID: 'T02', Track: 'Evals', Topic: 'Two', Phase: 'Phase 5 · Later things', 'Est. hrs': '2' }),
  row({ ID: 'T03', Track: 'Interview prep', Topic: 'Hidden track' }),
  row({ ID: 'T44', Track: 'Evals', Topic: 'Hidden topic' }),
  row({ ID: 'T05', Track: 'FDE & deployment', Topic: 'Five', Phase: 'Parked', Status: 'Not started' }),
  row({ ID: 'Total' }),
]
const log = [['Date', 'Hours', 'Topic ID', 'Topic (auto)', 'What you did'], ['46345', '2', 'T01', 'One', 'Read a paper'], ['46345', '1', 'T03', 'x', 'hidden'], ['', '', '', '', '']]

test('the board takes only the allowlisted columns, by header', () => {
  const { board } = fromSheets('st', topics, log)
  assert.deepEqual(board.topics.map((t) => t.id), ['T01', 'T02', 'T05'])
  assert.deepEqual(Object.keys(board.topics[0]).sort(), ['est', 'finished', 'id', 'learn', 'phase', 'spent', 'status', 'topic', 'track'])
  assert.ok(!JSON.stringify(board).includes('secret'))
  assert.deepEqual(board.topics.map((t) => t.status), ['done', 'later', 'parked'])
  assert.equal(board.topics[1].phase, 'later')
  assert.equal(board.topics[0].finished, '2026-11-19')
  assert.deepEqual(board.tracks, ['Evals', 'Deployment'])
})

test('the log reads by header too, and keeps only shown topics', () => {
  assert.deepEqual(fromSheets('st', topics, log).log, [{ date: '2026-11-19', topic: 'T01', did: 'Read a paper' }])
})

test('a missing allowlisted column fails, rather than reading the wrong one', () => {
  assert.throws(() => fromSheets('st', [HEAD.filter((h) => h !== 'Status')], log), /no header row/)
})

test('a private word refuses the import', () => {
  const bad = [...topics]
  bad[2] = row({ ID: 'T01', Track: 'Evals', Topic: 'Prep for an interview', Status: 'Done' })
  assert.throws(() => fromSheets('st', bad, log), /refused/)
})
