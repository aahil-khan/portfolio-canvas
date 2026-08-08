'use client'

/**
 * Personal bests, per game, in localStorage.
 *
 * An external store rather than `useState` + an effect, for the reason set out in lib/theme.ts:
 * reading localStorage during render is a hydration mismatch, and setting state in an effect
 * causes a cascading render on every mount. `useSyncExternalStore` reads the real value on the
 * client and a stable empty one on the server, so the first paint matches.
 *
 * The snapshot must be referentially stable between writes or useSyncExternalStore loops
 * forever, so the parsed object is cached and only replaced when something actually changes.
 */

const KEY = 'canvas.best'

export type Bests = Readonly<Record<string, number>>

/** Module constant, so the server snapshot is the same object every time it is asked for. */
const EMPTY: Bests = Object.freeze({})

let cache: Bests | null = null
const listeners = new Set<() => void>()

function read(): Bests {
  if (cache) return cache
  if (typeof localStorage === 'undefined') return (cache = EMPTY)
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, number> = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
      }
      cache = Object.freeze(out)
    } else {
      cache = EMPTY
    }
  } catch {
    cache = EMPTY
  }
  return cache
}

export const subscribeBest = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getBestSnapshot = (): Bests => read()

export const getBestServerSnapshot = (): Bests => EMPTY

export function getBest(game: string): number {
  return read()[game] ?? 0
}

/**
 * Records `value` if it beats the stored best. Returns true when it was a new record.
 *
 * `lowerIsBetter` is for Minesweeper, whose score is a completion time. Without it the store
 * would happily record your worst game as your best.
 */
export function recordBest(game: string, value: number, lowerIsBetter = false): boolean {
  const current = read()
  const existing = current[game]
  const better = !existing ? true : lowerIsBetter ? value < existing : value > existing
  if (!better) return false
  cache = Object.freeze({ ...current, [game]: value })
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // private mode or a full quota — the in-memory best still works for this session
  }
  for (const fn of listeners) fn()
  return true
}
