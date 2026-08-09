'use client'

/**
 * Which of the three shells a phone has asked for.
 *
 * `resume` is where every phone starts: the plain document, with the offer above it. `phone` is
 * the touch shell — a dock and full-height sheets. There is deliberately no third mode for the
 * canvas: a phone that wants it turns on desktop site in its own browser, which is a switch that
 * already exists and works better than ours did.
 *
 * An external store rather than `useState` + an effect, for the reason set out in lib/best.ts
 * and lib/theme.ts: reading localStorage during render is a hydration mismatch, and setting
 * state in an effect costs a second render on every mount — the lint rule in this repo rejects
 * it outright. `useSyncExternalStore` reads the real value on the client and a stable `resume`
 * on the server, so the first paint matches and the résumé is always what a phone opens on.
 */

export type ShellMode = 'resume' | 'phone'

const KEY = 'canvas.shell-mode'
/** What this setting was called when it was a boolean. Read once, so nobody is bounced out. */
const LEGACY_KEY = 'canvas.mobile-interactive'

let cache: ShellMode | null = null
const listeners = new Set<() => void>()

function read(): ShellMode {
  if (cache !== null) return cache
  if (typeof localStorage === 'undefined') return (cache = 'resume')
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'phone' || stored === 'resume') return (cache = stored)
    // a visitor who had already opted into the touch shell keeps it
    cache = localStorage.getItem(LEGACY_KEY) === '1' ? 'phone' : 'resume'
  } catch {
    cache = 'resume'
  }
  return cache
}

export const subscribeShellMode = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getShellModeSnapshot = (): ShellMode => read()

/** A stable module constant, so `useSyncExternalStore` sees the same value every time. */
export const getShellModeServerSnapshot = (): ShellMode => 'resume'

/**
 * Remembered, so the offer is made once rather than on every visit — and forgotten on the way
 * back, because returning to the résumé is a decision too.
 */
export function setShellMode(mode: ShellMode): void {
  if (cache === mode) return
  cache = mode
  try {
    if (mode === 'resume') {
      localStorage.removeItem(KEY)
      localStorage.removeItem(LEGACY_KEY)
    } else {
      localStorage.setItem(KEY, mode)
    }
  } catch {
    // private mode or a full quota; the choice still holds for this session
  }
  for (const fn of listeners) fn()
}
