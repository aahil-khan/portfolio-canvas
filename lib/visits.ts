/**
 * The visitor's own history, kept only in their browser.
 *
 * The server counts distinct people and nothing else — it cannot tell you which of them you are,
 * so "your 4th visit" has to be counted here. Nothing in this file is ever sent anywhere, which
 * is what lets the card say something personal without the backend knowing anything personal.
 *
 * A visit is a browser session, not a page load: reloading twice is one visit, coming back
 * tomorrow is two. Everything is wrapped because Safari's private mode throws on `localStorage`
 * rather than returning null, and a card is not worth an unhandled rejection.
 */

const KEY = 'canvas.visits'
/** Marks the current tab session, so a reload doesn't count as coming back. */
const SESSION = 'canvas.visits.seen'

export interface OwnVisits {
  /** How many sessions, including this one. */
  n: number
  /** Epoch ms of the first one. */
  first: number
}

/**
 * The stored value, raw.
 *
 * Deliberately the STRING and not a parsed object: the card reads this through
 * `useSyncExternalStore`, whose snapshot has to be referentially stable, and a fresh object
 * every call makes React loop. Strings compare by value under `Object.is`, so this is stable
 * for free. Parsing happens once, in a memo, on the other side.
 */
export function visitsSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    // private mode, or storage disabled outright
    return null
  }
}

export function parseVisits(raw: string | null): OwnVisits | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<OwnVisits>
    if (typeof v?.n !== 'number' || typeof v?.first !== 'number') return null
    if (!Number.isFinite(v.n) || !Number.isFinite(v.first)) return null
    return { n: v.n, first: v.first }
  } catch {
    // someone hand-edited the value, which is their right
    return null
  }
}

export function readVisits(): OwnVisits | null {
  return parseVisits(visitsSnapshot())
}

/** Called once per page load. Counts a new visit only on the first load of a session. */
export function markVisit(): void {
  try {
    if (sessionStorage.getItem(SESSION)) return
    sessionStorage.setItem(SESSION, '1')
    const prev = readVisits()
    const next: OwnVisits = prev
      ? { n: prev.n + 1, first: prev.first }
      : { n: 1, first: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode — the card falls back to its first-visit line */
  }
}
