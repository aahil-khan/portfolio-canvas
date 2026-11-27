import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createGate, DWELL_MS, type GateEnv } from './admission.ts'

/** A fake window: a clock you move by hand, listeners you fire by hand, storage in a variable. */
function fakeEnv({ webdriver = false, session = false } = {}) {
  let t = 0
  const timers: { at: number; fn: () => void }[] = []
  const listeners = new Map<string, Set<(e: { type: string; isTrusted: boolean }) => void>>()
  const state = { webdriver, session, sessionWrites: 0 }
  const env: GateEnv = {
    now: () => t,
    listen: (type, fn) => {
      const s = listeners.get(type) ?? new Set()
      s.add(fn)
      listeners.set(type, s)
    },
    unlisten: (type, fn) => void listeners.get(type)?.delete(fn),
    later: (fn, ms) => void timers.push({ at: t + ms, fn }),
    webdriver: () => state.webdriver,
    sessionGet: () => state.session,
    sessionSet: () => {
      state.session = true
      state.sessionWrites += 1
    },
  }
  return {
    env,
    state,
    input(type: string, isTrusted = true) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn({ type, isTrusted })
    },
    advance(ms: number) {
      t += ms
      for (const timer of timers.filter((x) => x.at <= t)) {
        timers.splice(timers.indexOf(timer), 1)
        timer.fn()
      }
    },
    listening: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  }
}

test('trusted input plus the dwell admits, and not a moment before', () => {
  const w = fakeEnv()
  const gate = createGate(w.env)
  let admitted = 0
  gate.whenAdmitted(() => (admitted += 1))
  w.advance(1200)
  w.input('pointerdown')
  w.advance(DWELL_MS - 1200 - 1)
  assert.equal(admitted, 0, 'admitted before the dwell ran out')
  assert.equal(gate.isAdmitted(), false)
  w.advance(1)
  assert.equal(admitted, 1)
  assert.equal(gate.isAdmitted(), true)
  assert.equal(w.state.session, true, 'the tab is marked admitted for its session')
})

test('the dwell alone admits nothing: no input, no admission, ever', () => {
  const w = fakeEnv()
  const gate = createGate(w.env)
  let admitted = 0
  gate.whenAdmitted(() => (admitted += 1))
  w.advance(10 * 60_000)
  assert.equal(admitted, 0)
  assert.equal(gate.isAdmitted(), false)
})

test('input after the dwell admits at once', () => {
  const w = fakeEnv()
  const gate = createGate(w.env)
  let admitted = 0
  gate.whenAdmitted(() => (admitted += 1))
  w.advance(20_000)
  w.input('keydown')
  assert.equal(admitted, 1)
})

test('synthetic input (isTrusted false) never unlocks it, of any of the four kinds', () => {
  const w = fakeEnv()
  const gate = createGate(w.env)
  let admitted = 0
  let decisions = 0
  gate.whenAdmitted(() => (admitted += 1))
  gate.onDecision(() => (decisions += 1))
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) w.input(type, false)
  w.advance(60_000)
  assert.equal(admitted, 0)
  assert.equal(decisions, 0)
  assert.equal(w.listening(), 4, 'still listening for a real input')
})

test('scroll and click are not inputs', () => {
  const w = fakeEnv()
  const gate = createGate(w.env)
  gate.isAdmitted()
  w.input('scroll')
  w.input('click')
  w.advance(60_000)
  assert.equal(gate.isAdmitted(), false)
})

test('navigator.webdriver never unlocks it, and the refusal is still a decision', () => {
  const w = fakeEnv({ webdriver: true })
  const gate = createGate(w.env)
  let admitted = 0
  const seen: unknown[] = []
  gate.whenAdmitted(() => (admitted += 1))
  gate.onDecision((d) => seen.push(d))
  w.advance(500)
  w.input('wheel')
  w.advance(DWELL_MS)
  assert.equal(admitted, 0)
  assert.equal(gate.isAdmitted(), false)
  assert.deepEqual(seen, [{ admitted: false, via: 'wheel', input: 500, webdriver: true }])
  assert.equal(w.state.sessionWrites, 0, 'a refused tab is never marked admitted')
})

test('one admission per tab session: a later load in an admitted tab is admitted at once', () => {
  const w = fakeEnv({ session: true })
  const gate = createGate(w.env)
  let admitted = 0
  gate.whenAdmitted(() => (admitted += 1))
  assert.equal(admitted, 1)
  assert.equal(gate.isAdmitted(), true)
})

test('…but its own decision, for the visit ping, still waits for its own input and dwell', () => {
  const w = fakeEnv({ session: true })
  const gate = createGate(w.env)
  const seen: { admitted: boolean }[] = []
  gate.onDecision((d) => seen.push(d))
  w.advance(DWELL_MS * 2)
  assert.equal(seen.length, 0)
  w.input('touchstart')
  assert.equal(seen.length, 1)
  assert.equal(seen[0].admitted, true)
})

test('a forged session flag cannot admit a browser that says it is automated', () => {
  const w = fakeEnv({ session: true, webdriver: true })
  const gate = createGate(w.env)
  let admitted = 0
  gate.whenAdmitted(() => (admitted += 1))
  assert.equal(admitted, 0)
  assert.equal(gate.isAdmitted(), false)
})

test('storage that throws is survived: admitted for the page load only', () => {
  const w = fakeEnv()
  w.env.sessionGet = () => {
    throw new Error('SecurityError')
  }
  w.env.sessionSet = () => {
    throw new Error('QuotaExceededError')
  }
  const gate = createGate(w.env)
  assert.equal(gate.isAdmitted(), false)
  w.input('pointerdown')
  w.advance(DWELL_MS)
  assert.equal(gate.isAdmitted(), true)
})

test('the first input removes every listener, and each waiter is called once', () => {
  const w = fakeEnv()
  const gate = createGate(w.env)
  const calls: string[] = []
  gate.whenAdmitted(() => calls.push('a'))
  gate.whenAdmitted(() => calls.push('b'))
  w.input('pointerdown')
  w.input('keydown')
  assert.equal(w.listening(), 0)
  w.advance(DWELL_MS * 3)
  gate.whenAdmitted(() => calls.push('c'))
  assert.deepEqual(calls, ['a', 'b', 'c'])
})
