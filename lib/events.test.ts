import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Gate } from './admission.ts'
import { createTracker, DEBOUNCE_MS, EVENT_NAMES, eventFields, MAX_BATCH, parseBatch, parseEvent, track } from './events.ts'

test('the allowlist is the twelve names the plan names, no more', () => {
  assert.deepEqual([...EVENT_NAMES].sort(), [
    'agents_view', 'back_to_desk', 'lab_view', 'lead_use', 'look_switch', 'md_view',
    'name_say', 'player_minutes', 'player_start', 'preview_open', 'read_depth', 'share',
  ])
})

/* ------------------------------------------------------------------ parsing */

const valid = [
  { name: 'lab_view', props: { path: '/lab', kind: 'home', source: 'direct' } },
  { name: 'lab_view', props: { path: '/lab/shopkeeper/05-haggle', kind: 'chapter', source: 'linkedin' } },
  { name: 'read_depth', props: { path: '/lab/notes/x', depth: 75 } },
  { name: 'lead_use', props: { path: '/lab/builds/konta', lead: 'tool-log' } },
  { name: 'preview_open', props: { via: 'tap', target: 'term' } },
  { name: 'look_switch', props: { look: 'lab', mode: 'dark' } },
  { name: 'look_switch', props: { look: 'paper' } },
  { name: 'name_say', props: {} },
  { name: 'player_start', props: { source: 'noise' } },
  { name: 'player_minutes', props: { minutes: 15 } },
  { name: 'share', props: { path: '/lab/essays/a', via: 'copy' } },
  { name: 'md_view', props: { path: '/work/konta.md' } },
  { name: 'agents_view', props: {} },
  { name: 'back_to_desk', props: {} },
]

test('every allowlisted shape parses, and comes back unchanged', () => {
  for (const e of valid) assert.deepEqual(parseEvent(e), e, JSON.stringify(e))
  // every name is covered by at least one example
  assert.deepEqual(new Set(valid.map((e) => e.name)), new Set(EVENT_NAMES))
})

const invalid: [string, unknown][] = [
  ['an unknown name', { name: 'page_view', props: {} }],
  ['a prototype name', { name: '__proto__', props: {} }],
  ['no props', { name: 'name_say' }],
  ['an extra top-level key', { name: 'name_say', props: {}, at: 1 }],
  ['an extra prop', { name: 'name_say', props: { x: 1 } }],
  ['a missing prop', { name: 'lab_view', props: { path: '/lab', kind: 'home' } }],
  ['a depth outside its buckets', { name: 'read_depth', props: { path: '/lab/a', depth: 33 } }],
  ['a depth as a string', { name: 'read_depth', props: { path: '/lab/a', depth: '75' } }],
  ['minutes outside the buckets', { name: 'player_minutes', props: { minutes: 7 } }],
  ['an unknown source', { name: 'lab_view', props: { path: '/lab', kind: 'home', source: 'google' } }],
  ['the old look name', { name: 'look_switch', props: { look: 'premium', mode: 'night' } }],
  ['a path outside the Lab', { name: 'lab_view', props: { path: '/work', kind: 'home', source: 'direct' } }],
  ['a path with a query', { name: 'share', props: { path: '/lab/a?ref=me', via: 'copy' } }],
  ['a path with upper case', { name: 'md_view', props: { path: '/Lab/a.md' } }],
  ['a path that climbs', { name: 'md_view', props: { path: '/lab/../x.md' } }],
  ['a path too deep', { name: 'read_depth', props: { path: '/lab/a/b/c/d', depth: 25 } }],
  ['a segment too long', { name: 'read_depth', props: { path: `/lab/${'a'.repeat(65)}`, depth: 25 } }],
  ['an .md path without .md', { name: 'md_view', props: { path: '/work/konta' } }],
  ['a lead with spaces', { name: 'lead_use', props: { path: '/lab/a', lead: 'my lead' } }],
  ['an array', [{ name: 'name_say', props: {} }]],
  ['null', null],
  ['a class instance as props', { name: 'name_say', props: new Date() }],
]

for (const [why, e] of invalid) {
  test(`parseEvent refuses ${why}`, () => assert.equal(parseEvent(e), null))
}

test('parseBatch takes { events } and nothing else, and refuses the whole batch for one bad event', () => {
  assert.deepEqual(parseBatch({ events: valid }), valid)
  assert.equal(parseBatch({ events: [...valid, { name: 'nope', props: {} }] }), null)
  assert.equal(parseBatch({ events: [] }), null)
  assert.equal(parseBatch({ events: valid, extra: 1 }), null)
  assert.equal(parseBatch({ opens: ['about'] }), null)
  assert.equal(parseBatch(valid), null)
  assert.equal(parseBatch({ events: Array(MAX_BATCH + 1).fill(valid[7]) }), null)
  assert.equal(parseBatch({ events: Array(MAX_BATCH).fill(valid[7]) })?.length, MAX_BATCH)
})

test('eventFields: closed props become counts, open ones are kept apart, never crossed', () => {
  assert.deepEqual(eventFields(parseEvent(valid[1])!), {
    counts: ['lab_view', 'lab_view.kind:chapter', 'lab_view.source:linkedin'],
    open: ['lab_view|/lab/shopkeeper/05-haggle'],
  })
  assert.deepEqual(eventFields(parseEvent(valid[3])!), {
    counts: ['lead_use'],
    open: ['lead_use|/lab/builds/konta', 'lead_use.lead|tool-log'],
  })
  assert.deepEqual(eventFields(parseEvent(valid[7])!), { counts: ['name_say'], open: [] })
})

/* ------------------------------------------------------------------ the queue */

function fakeGate(admittedAtStart = false) {
  let admitted = admittedAtStart
  const waiting: (() => void)[] = []
  const gate: Gate = {
    onDecision: () => {},
    whenAdmitted: (cb) => (admitted ? cb() : void waiting.push(cb)),
    isAdmitted: () => admitted,
  }
  return {
    gate,
    admit() {
      admitted = true
      for (const cb of waiting.splice(0)) cb()
    },
  }
}

function harness(admittedAtStart = false) {
  const g = fakeGate(admittedAtStart)
  const sent: { body: { events: unknown[] }; beacon: boolean }[] = []
  let t = 0
  let timers: { at: number; fn: () => void; id: number }[] = []
  let id = 0
  const hides: (() => void)[] = []
  const warnings: string[] = []
  const tr = createTracker({
    gate: g.gate,
    send: (body, beacon) => sent.push({ body: JSON.parse(body), beacon }),
    later: (fn, ms) => {
      timers.push({ at: t + ms, fn, id: ++id })
      return id
    },
    cancel: (h) => (timers = timers.filter((x) => x.id !== h)),
    onHide: (fn) => hides.push(fn),
    warn: (m) => warnings.push(m),
  })
  return {
    track: tr,
    sent,
    warnings,
    admit: g.admit,
    hide: () => hides.forEach((f) => f()),
    advance(ms: number) {
      t += ms
      for (const x of timers.filter((x) => x.at <= t)) {
        timers = timers.filter((y) => y !== x)
        x.fn()
      }
    },
  }
}

test('nothing is sent before admission, however long the page is open', () => {
  const h = harness()
  h.track('lab_view', { path: '/lab', kind: 'home', source: 'direct' })
  h.track('read_depth', { path: '/lab', depth: 25 })
  h.advance(60 * 60_000)
  assert.equal(h.sent.length, 0)
})

test('an unadmitted tab sends nothing on the way out either', () => {
  const h = harness()
  h.track('name_say', {})
  h.hide()
  assert.equal(h.sent.length, 0)
})

test('on admission, everything queued goes out in one batch', () => {
  const h = harness()
  h.track('lab_view', { path: '/lab', kind: 'home', source: 'x' })
  h.track('read_depth', { path: '/lab', depth: 25 })
  h.track('look_switch', { look: 'lab', mode: 'light' })
  h.admit()
  assert.equal(h.sent.length, 1)
  assert.equal(h.sent[0].beacon, false)
  assert.deepEqual(h.sent[0].body.events.map((e) => (e as { name: string }).name), ['lab_view', 'read_depth', 'look_switch'])
})

test('after admission, events go out on the debounce, and with a beacon when the page hides', () => {
  const h = harness(true)
  h.track('name_say', {})
  h.advance(DEBOUNCE_MS - 1)
  h.track('agents_view', {})
  h.advance(DEBOUNCE_MS - 1)
  assert.equal(h.sent.length, 0, 'the debounce restarts on each event')
  h.advance(1)
  assert.equal(h.sent.length, 1)
  assert.equal(h.sent[0].body.events.length, 2)
  h.track('back_to_desk', {})
  h.hide()
  assert.equal(h.sent.length, 2)
  assert.equal(h.sent[1].beacon, true)
  h.advance(DEBOUNCE_MS * 2)
  assert.equal(h.sent.length, 2, 'the hidden flush cancelled the timer; nothing goes twice')
})

test('a bad event is dropped with a warning, and never sent', () => {
  const h = harness(true)
  // @ts-expect-error: not on the list
  h.track('page_view', {})
  // @ts-expect-error: outside the buckets
  h.track('read_depth', { path: '/lab', depth: 33 })
  h.advance(DEBOUNCE_MS)
  assert.equal(h.sent.length, 0)
  assert.equal(h.warnings.length, 2)
})

test('the queue holds at most one batch', () => {
  const h = harness()
  for (let i = 0; i < MAX_BATCH + 25; i++) h.track('name_say', {})
  h.admit()
  assert.equal(h.sent.length, 1)
  assert.equal(h.sent[0].body.events.length, MAX_BATCH)
  assert.ok(parseBatch(h.sent[0].body), 'what the client sends is what the server accepts')
})

test('track on the server is a no-op: no window, nothing sent, nothing thrown', () => {
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
