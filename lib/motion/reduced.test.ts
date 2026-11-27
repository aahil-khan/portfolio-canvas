import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { MOTION_QUERY, prefersReducedMotion, REDUCED_QUERY, subscribeReducedMotion } from './reduced.ts'

const g = globalThis as { window?: unknown }
afterEach(() => {
  delete g.window
})

/** A window whose reduced-motion query answers `matches`, recording its listeners. */
function fakeWindow(matches: boolean) {
  const listeners = new Set<() => void>()
  const asked: string[] = []
  g.window = {
    matchMedia: (q: string) => {
      asked.push(q)
      return {
        matches,
        addEventListener: (_: string, l: () => void) => listeners.add(l),
        removeEventListener: (_: string, l: () => void) => listeners.delete(l),
      }
    },
  }
  return { listeners, asked }
}

test('the queries are the standard ones', () => {
  assert.equal(REDUCED_QUERY, '(prefers-reduced-motion: reduce)')
  assert.equal(MOTION_QUERY, '(prefers-reduced-motion: no-preference)')
})

test('on the server the answer is "reduced", so nothing starts moving before the browser is asked', () => {
  assert.equal(prefersReducedMotion(), true)
  assert.doesNotThrow(() => subscribeReducedMotion(() => {})())
})

test('in the browser it asks the reduced-motion query', () => {
  const w = fakeWindow(false)
  assert.equal(prefersReducedMotion(), false)
  assert.deepEqual(w.asked, [REDUCED_QUERY])
  fakeWindow(true)
  assert.equal(prefersReducedMotion(), true)
})

test('subscribing adds one listener, and the returned function removes it', () => {
  const w = fakeWindow(false)
  const stop = subscribeReducedMotion(() => {})
  assert.equal(w.listeners.size, 1)
  stop()
  assert.equal(w.listeners.size, 0)
})
