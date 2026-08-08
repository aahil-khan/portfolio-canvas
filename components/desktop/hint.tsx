'use client'

import { type ReactNode, useSyncExternalStore } from 'react'

/**
 * The corner hint, with a dismiss button.
 *
 * Once you know you can drag the canvas you never need telling again, so the choice is
 * remembered. Same external-store shape as lib/theme.ts and lib/best.ts, and for the same
 * reason: reading localStorage during render is a hydration mismatch, and copying it into state
 * in an effect cascades a second render on every mount.
 */

const KEY = 'canvas.hint'

let cache: boolean | null = null
const listeners = new Set<() => void>()

function read(): boolean {
  if (cache !== null) return cache
  if (typeof localStorage === 'undefined') return (cache = false)
  try {
    cache = localStorage.getItem(KEY) === 'off'
  } catch {
    cache = false
  }
  return cache
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function dismiss() {
  cache = true
  try {
    localStorage.setItem(KEY, 'off')
  } catch {
    // private mode: it stays hidden for this session, which is the whole ask
  }
  for (const fn of listeners) fn()
}

export function Hint({ children }: { children: ReactNode }) {
  const hidden = useSyncExternalStore(
    subscribe,
    read,
    () => false, // server always renders it; the client hides it after hydration if dismissed
  )
  if (hidden) return null

  return (
    <p id="hint">
      {/* aria-hidden on the text only — the dismiss button must stay reachable */}
      <span aria-hidden>{children}</span>
      <button type="button" className="hint__x" onClick={dismiss} aria-label="Hide this hint">
        ×
      </button>
    </p>
  )
}
