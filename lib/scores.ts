'use client'

import { boards, arcade, type BoardId } from '@/content/arcade'

/** One row of a global board, as the API hands it back. */
export interface BoardScore {
  name: string
  value: number
}

/**
 * How a game's number should read.
 *
 * Minesweeper's score is a completion time and everything else is points, which is the whole of
 * the difference — but it is a difference the launcher, the strip and the end-of-run hint all
 * have to agree on, so it lives here rather than being re-derived at each of them.
 */
export function formatScore(game: string, value: number | undefined): string {
  if (!value) return arcade.noScore
  const kind = Object.hasOwn(boards, game) ? boards[game as BoardId].kind : 'points'
  if (kind !== 'time') return value.toLocaleString()
  return `${Math.floor(value / 60)}:${String(Math.round(value) % 60).padStart(2, '0')}`
}

/** True when `next` beats `prev` on this game's board. `prev` of 0 means nothing set yet. */
export function beats(game: string, next: number, prev: number): boolean {
  if (next <= 0) return false
  if (!prev) return true
  return Object.hasOwn(boards, game) && boards[game as BoardId].lowerWins
    ? next < prev
    : next > prev
}

export const lowerWins = (game: string): boolean =>
  Object.hasOwn(boards, game) ? boards[game as BoardId].lowerWins : false

/* ------------------------------------------------------------------ player */

const NAME_KEY = 'canvas.player'

/**
 * The name this visitor last posted under.
 *
 * It is what lets the world column say "yours" when the record on it is theirs. That is a claim
 * this browser makes about itself and nothing checks it — someone who types a stranger's name
 * gets a badge they didn't earn. On a board whose scores are self-reported anyway, a server-side
 * identity would be a lock on a door with no walls.
 *
 * An external store rather than `useState` + an effect, for the same reason as `lib/best.ts`:
 * reading localStorage during render is a hydration mismatch, and seeding it from an effect
 * cascades a second render on every mount. The snapshot has to stay referentially stable between
 * writes or `useSyncExternalStore` spins, which for a string means caching the read.
 */
let nameCache: string | null = null
const nameListeners = new Set<() => void>()

export const subscribePlayer = (fn: () => void) => {
  nameListeners.add(fn)
  return () => nameListeners.delete(fn)
}

export function getPlayerSnapshot(): string {
  if (nameCache !== null) return nameCache
  if (typeof localStorage === 'undefined') return (nameCache = '')
  try {
    nameCache = localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    nameCache = ''
  }
  return nameCache
}

export const getPlayerServerSnapshot = (): string => ''

export function setPlayerName(name: string): void {
  if (nameCache === name) return
  nameCache = name
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // private mode or a full quota; the board still takes the score, it just won't say "yours"
  }
  for (const fn of nameListeners) fn()
}

/* -------------------------------------------------------------------- wire */

export async function fetchBoard(game: string): Promise<BoardScore[]> {
  const res = await fetch(`/api/scores?game=${encodeURIComponent(game)}`)
  const data = (await res.json()) as { scores?: BoardScore[] }
  return data.scores ?? []
}

export async function postScore(
  game: string,
  name: string,
  value: number,
): Promise<BoardScore[] | null> {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game, name, value }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { scores?: BoardScore[] }
  return data.scores ?? []
}
