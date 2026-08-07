'use client'

import { MAX_SCALE, MIN_SCALE } from './geometry'

/**
 * Remembers how you left the desktop.
 *
 * Open cards, where you dragged them, their stacking order and tilt, the hero's position, and
 * the camera. Restored on the next visit so the canvas is *your* canvas rather than a fresh
 * random deal every time.
 *
 * The stored shape is versioned. Card ids encode content (`project:konta`, `shot:edutube`), so
 * a session saved before a project was renamed would restore ghosts — bumping VERSION discards
 * old data instead of half-restoring it. Unknown ids are dropped on load regardless, which
 * covers content edits that don't warrant a version bump.
 */

const KEY = 'canvas.session'
const VERSION = 1

export interface SavedCard {
  id: string
  x: number
  y: number
  z: number
  rot?: number
}

export interface Session {
  v: number
  cards: SavedCard[]
  hero: { x: number; y: number }
  cam: { x: number; y: number; s: number }
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function saveSession(s: Omit<Session, 'v'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...s }))
  } catch {
    /* private mode or quota — the layout just won't persist */
  }
}

/**
 * Returns a session only if it is structurally sound AND still refers to cards that exist.
 * `known` is the set of card ids the current build can render.
 */
export function loadSession(known: ReadonlySet<string>): Session | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const s = parsed as Partial<Session>
    if (s.v !== VERSION) return null
    if (!Array.isArray(s.cards) || !s.hero || !s.cam) return null
    if (!finite(s.hero.x) || !finite(s.hero.y)) return null
    if (!finite(s.cam.x) || !finite(s.cam.y) || !finite(s.cam.s)) return null

    const cards = s.cards.filter(
      (c): c is SavedCard =>
        !!c && typeof c.id === 'string' && known.has(c.id) && finite(c.x) && finite(c.y) && finite(c.z),
    )

    return {
      v: VERSION,
      cards,
      hero: { x: s.hero.x, y: s.hero.y },
      // a corrupt or out-of-range scale would strand the camera somewhere unusable
      cam: { x: s.cam.x, y: s.cam.y, s: Math.min(MAX_SCALE, Math.max(MIN_SCALE, s.cam.s)) },
    }
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
