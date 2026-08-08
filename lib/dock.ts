'use client'

/**
 * Which dock folders are expanded.
 *
 * Kept in localStorage because an expanded folder is a preference, not a transient popover —
 * someone who lives in the arcade should find it open tomorrow. Same external-store shape as
 * lib/theme.ts and lib/eggs.ts, and for the same reason: reading localStorage during render is
 * a hydration mismatch, and copying it into state in an effect cascades a render on mount.
 *
 * The snapshot is a cached frozen array, so `useSyncExternalStore` sees a stable reference and
 * does not loop.
 */

const KEY = 'canvas.folders'

const EMPTY: readonly string[] = Object.freeze([])
let cache: readonly string[] | null = null
const listeners = new Set<() => void>()

function read(): readonly string[] {
  if (cache) return cache
  if (typeof localStorage === 'undefined') return (cache = EMPTY)
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    cache = Array.isArray(parsed)
      ? Object.freeze(parsed.filter((x): x is string => typeof x === 'string'))
      : EMPTY
  } catch {
    cache = EMPTY
  }
  return cache
}

export const subscribeFolders = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getFoldersSnapshot = (): readonly string[] => read()

/** Module constant, so the server snapshot is the same object every time. */
export const getFoldersServerSnapshot = (): readonly string[] => EMPTY

export function toggleFolder(id: string): void {
  const open = read()
  const next = open.includes(id) ? open.filter((x) => x !== id) : [...open, id]
  cache = Object.freeze(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode — it just won't survive the tab */
  }
  for (const l of listeners) l()
}
