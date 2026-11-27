import assert from 'node:assert/strict'
import { test } from 'node:test'

import { EVENT_NAMES, track } from './events.ts'

test('the allowlist is the twelve names the plan names, no more', () => {
  assert.deepEqual([...EVENT_NAMES].sort(), [
    'agents_view', 'back_to_desk', 'lab_view', 'lead_use', 'look_switch', 'md_view',
    'name_say', 'player_minutes', 'player_start', 'preview_open', 'read_depth', 'share',
  ])
})

test('track is a no-op until PR 4: it sends nothing and throws nothing', () => {
  const g = globalThis as { fetch?: unknown }
  const real = g.fetch
  let calls = 0
  g.fetch = () => {
    calls += 1
    return Promise.resolve(new Response(null))
  }
  try {
    assert.equal(track('lab_view', { path: '/lab', kind: 'home', source: 'direct' }), undefined)
    assert.equal(track('name_say', {}), undefined)
    assert.equal(calls, 0)
  } finally {
    g.fetch = real
  }
})
