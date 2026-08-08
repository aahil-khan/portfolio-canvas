'use client'

import { play } from './audio'

/**
 * Which easter eggs this visitor has found.
 *
 * Same external-store shape as lib/theme.ts and lib/best.ts, and for the same reason: reading
 * localStorage during render is a hydration mismatch, and copying it into state in an effect
 * cascades a render on every mount.
 */

const KEY = 'canvas.eggs'

export const EGGS = [
  { id: 'konami', label: 'Up up down down…', hint: 'Enter the code' },
  { id: 'terminal', label: 'Found the terminal', hint: 'It has to be unlocked first' },
  { id: 'deepspace', label: 'Went looking', hint: 'Pan much further than anyone should' },
  { id: 'completionist', label: 'Opened everything', hint: 'Every card in the dock, at once' },
  { id: 'tidy-freak', label: 'Tried every arrangement', hint: 'All five of them' },
] as const

export type EggId = (typeof EGGS)[number]['id']

/** Module constant, so the server snapshot is the same object every time. */
const EMPTY: readonly string[] = Object.freeze([])

let cache: readonly string[] | null = null
const listeners = new Set<() => void>()

function read(): readonly string[] {
  if (cache) return cache
  if (typeof localStorage === 'undefined') return (cache = EMPTY)
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    cache = Array.isArray(parsed) ? Object.freeze(parsed.filter((x) => typeof x === 'string')) : EMPTY
  } catch {
    cache = EMPTY
  }
  return cache
}

export const subscribeEggs = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getEggsSnapshot = (): readonly string[] => read()

export const getEggsServerSnapshot = (): readonly string[] => EMPTY

export const hasEgg = (id: EggId): boolean => read().includes(id)

/**
 * Marks an egg found. Returns true the first time only, and plays the unlock cue then — so
 * re-triggering the konami code doesn't re-congratulate you.
 */
export function findEgg(id: EggId): boolean {
  const current = read()
  if (current.includes(id)) return false
  cache = Object.freeze([...current, id])
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // private mode: the unlock still holds for this session
  }
  play('unlock')
  for (const fn of listeners) fn()
  return true
}
