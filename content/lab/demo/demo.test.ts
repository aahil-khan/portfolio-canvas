/**
 * The demo set (API.md, "Demo mode"): the approved mockup's content, converted once by
 * `scripts/once/lab-from-mockup.ts`. The one place outside the set's own files that may name its
 * ids. Deleted with it.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { createLab, loadSet } from '../../../lib/lab/content.ts'
import { validateLab } from '../../../lib/lab/rules.ts'
import { loadMockup, mockupRoutes, renamedPath } from '../../../scripts/once/mockup.ts'

const demo = loadSet('demo')
const api = createLab(demo.lab, demo.bodies)

test('routes() with demo on equals the mockup’s Lab.routes(), mapped to real paths', () => {
  const ours = api.routes().map((r) => r.path)
  // real paths: `#/x` → `/lab/x`, with the three ids the demo set renames (DEMO_RENAMES)
  const theirs = mockupRoutes(loadMockup()).map(renamedPath)
  assert.deepEqual([...ours].sort(), [...theirs].sort())
  const kinds = (k: string) => api.routes().filter((r) => r.kind === k).length
  assert.equal(kinds('entry'), 17)
  assert.equal(kinds('section'), 3)
  assert.equal(kinds('tag'), 8)
  assert.equal(kinds('index'), 1)
  assert.equal(kinds('glossary'), 1)
  assert.ok(!ours.some((p) => p === '/lab/experiments'), 'Experiments has no entries, so it is hidden')
})

test('the demo set passes every rule the real set would, privacy denylist included', () => {
  const issues = validateLab(demo.lab, demo.bodies, (p) => fs.existsSync(path.join('public', p.slice(1))))
  assert.deepEqual(issues.map((i) => `${i.rule} ${i.path}: ${i.message}`), [])
})

test('every demo image and body is where the set says', () => {
  for (const [id, file] of Object.entries(demo.bodyFiles)) assert.ok(fs.existsSync(file) || !demo.bodies[id], file)
  assert.equal(Object.keys(demo.bodies).length, 17)
})

test('privacy: the board shows T21, T22 and T41 as later, and holds nothing past T42 but T48', () => {
  const board = demo.lab.studies['agent-reliability']
  const status = Object.fromEntries(board.topics.map((t) => [t.id, t.status]))
  for (const id of ['T21', 'T22', 'T41']) assert.equal(status[id], 'later', id)
  for (let n = 43; n <= 47; n++) assert.equal(status[`T${n}`], undefined, `T${n}`)
  const text = JSON.stringify(demo.lab).toLowerCase()
  for (const w of ['interview', 'role evidence', 'target compan', 'summary sheet']) assert.ok(!text.includes(w), w)
})

test('the essays keep names as published (open question 1, answered 27 Nov)', () => {
  assert.match(demo.bodies['chrome-hackathon'], /Samsung Prism|hackathon/i)
})

test('Holt’s verdict names are on record with their source', () => {
  const t = demo.lab.terms.find((x) => x.id === 'holt-verdict')!
  assert.ok(t, 'the holt-verdict term')
  assert.match(t.source, /githolt\.com/)
  for (const v of ['worth your time', 'long shot', 'not worth your time', 'not enough evidence', 'personal project', 'a list rather than code']) assert.ok(t.def.toLowerCase().includes(v), v)
})
