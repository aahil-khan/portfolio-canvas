'use client'

/**
 * Whether this phone has asked for the canvas instead of the résumé.
 *
 * An external store rather than `useState` + an effect, for the reason set out in lib/best.ts
 * and lib/theme.ts: reading localStorage during render is a hydration mismatch, and setting
 * state in an effect costs a second render on every mount — the lint rule in this repo rejects
 * it outright. `useSyncExternalStore` reads the real value on the client and a stable `false` on
 * the server, so the first paint matches and the résumé is always what a phone opens on.
 */

const KEY = 'canvas.mobile-interactive'

let cache: boolean | null = null
const listeners = new Set<() => void>()

function read(): boolean {
  if (cache !== null) return cache
  if (typeof localStorage === 'undefined') return (cache = false)
  try {
    cache = localStorage.getItem(KEY) === '1'
  } catch {
    cache = false
  }
  return cache
}

export const subscribeInteractive = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getInteractiveSnapshot = (): boolean => read()

/** Booleans are primitives, so no cached-object dance is needed to keep this stable. */
export const getInteractiveServerSnapshot = (): boolean => false

/**
 * Remembered, so the offer is made once rather than on every visit — and forgotten on the way
 * back, because returning to the résumé is a decision too.
 */
export function setInteractive(on: boolean): void {
  cache = on
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {}
  for (const fn of listeners) fn()
}
