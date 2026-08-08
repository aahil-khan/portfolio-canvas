/**
 * The only place that talks to shared storage.
 *
 * SERVER ONLY. It reads `process.env` for credentials, so it must never reach a client bundle —
 * import it from route handlers under `app/api/` and nowhere else. (There is no `server-only`
 * guard package here on purpose: that would be a runtime dependency, and this file is the one
 * thing standing between the project and its "Next and React only" rule.)
 *
 * Everything the canvas persists across visitors — the notes wall, the typing leaderboard, the
 * deep-space find counter — goes through here, so swapping the backend is a one-file change.
 *
 * Backed by Upstash Redis over its REST API, called with plain `fetch`. That is deliberate:
 * CLAUDE.md holds this project to "no runtime dependencies beyond Next and React", and a Redis
 * SDK would be the first break. REST costs us nothing here — every operation is one round trip.
 *
 * With no credentials configured it falls back to an in-memory store and warns once. That keeps
 * `next build` and local dev working with no secrets, which matters because this is deployed
 * from a repo that has none checked in.
 */

const URL_ = process.env.UPSTASH_REDIS_REST_URL
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const live = Boolean(URL_ && TOKEN)

export interface Note {
  id: string
  /** Already length-capped and stored as plain text. Rendered as a text node, never as HTML. */
  text: string
  name: string
  at: number
}

export interface Score {
  name: string
  wpm: number
  at: number
}

/* ---------------------------------------------------------------- keys */

const K = {
  notes: 'canvas:notes',
  notesHidden: 'canvas:notes:hidden',
  scores: (game: string) => `canvas:scores:${game}`,
  found: 'canvas:found',
  rate: (bucket: string) => `canvas:rl:${bucket}`,
} as const

/** Notes kept in Redis. Older ones fall off the end rather than growing without bound. */
const NOTE_CAP = 500

/* ------------------------------------------------------- upstash transport */

let warned = false
function fallbackWarning() {
  if (warned) return
  warned = true
  console.warn(
    '[store] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. ' +
      'Using an in-memory store: notes and scores will not persist and are not shared between ' +
      'visitors or between server instances. Set both to enable real storage.',
  )
}

/**
 * One Redis command. Upstash takes the command as a JSON array and answers `{ result }`.
 *
 * Failures return null rather than throwing: a dead cache should degrade the notes wall to an
 * empty list, not 500 the card.
 */
async function cmd<T>(args: (string | number)[]): Promise<T | null> {
  if (!live) return null
  try {
    const res = await fetch(URL_!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`[store] ${args[0]} failed: ${res.status}`)
      return null
    }
    const json = (await res.json()) as { result: T }
    return json.result
  } catch (err) {
    console.warn(`[store] ${args[0]} threw:`, err)
    return null
  }
}

/* ------------------------------------------------------- in-memory fallback */

const mem = {
  notes: [] as Note[],
  scores: new Map<string, Map<string, Score>>(),
  found: 0,
  rate: new Map<string, { n: number; until: number }>(),
}

/* ------------------------------------------------------------------ notes */

export async function listNotes(limit = 60): Promise<Note[]> {
  if (!live) {
    fallbackWarning()
    return mem.notes.slice(0, limit)
  }
  const [raw, hidden] = await Promise.all([
    cmd<string[]>(['LRANGE', K.notes, 0, limit - 1]),
    cmd<string[]>(['SMEMBERS', K.notesHidden]),
  ])
  if (!raw) return []
  const blocked = new Set(hidden ?? [])
  const out: Note[] = []
  for (const s of raw) {
    try {
      const n = JSON.parse(s) as Note
      if (!blocked.has(n.id)) out.push(n)
    } catch {
      // a malformed entry is skipped rather than taking the whole wall down
    }
  }
  return out
}

export async function addNote(note: Note): Promise<void> {
  if (!live) {
    fallbackWarning()
    mem.notes.unshift(note)
    mem.notes.length = Math.min(mem.notes.length, NOTE_CAP)
    return
  }
  await cmd(['LPUSH', K.notes, JSON.stringify(note)])
  await cmd(['LTRIM', K.notes, 0, NOTE_CAP - 1])
}

/* ----------------------------------------------------------------- scores */

export async function topScores(game: string, limit = 5): Promise<Score[]> {
  if (!live) {
    fallbackWarning()
    return [...(mem.scores.get(game)?.values() ?? [])].sort((a, b) => b.wpm - a.wpm).slice(0, limit)
  }
  // WITHSCORES gives [member, score, member, score, ...]
  const raw = await cmd<string[]>(['ZRANGE', K.scores(game), 0, limit - 1, 'REV', 'WITHSCORES'])
  if (!raw) return []
  const out: Score[] = []
  for (let i = 0; i < raw.length; i += 2) {
    try {
      const meta = JSON.parse(raw[i]) as { name: string; at: number }
      out.push({ name: meta.name, at: meta.at, wpm: Number(raw[i + 1]) })
    } catch {
      /* skip */
    }
  }
  return out
}

/**
 * One row per player, holding their best.
 *
 * The member is the player's identity, not the attempt — `GT` means a worse run never replaces a
 * better one, and the board can't be flooded by one person playing repeatedly.
 */
export async function addScore(game: string, score: Score): Promise<void> {
  if (!live) {
    fallbackWarning()
    const board = mem.scores.get(game) ?? new Map<string, Score>()
    const prev = board.get(score.name)
    if (!prev || score.wpm > prev.wpm) board.set(score.name, score)
    mem.scores.set(game, board)
    return
  }
  const member = JSON.stringify({ name: score.name, at: score.at })
  await cmd(['ZADD', K.scores(game), 'GT', 'CH', score.wpm, member])
}

/* ------------------------------------------------------------ find counter */

export async function getFound(): Promise<number> {
  if (!live) {
    fallbackWarning()
    return mem.found
  }
  return Number((await cmd<string>(['GET', K.found])) ?? 0)
}

export async function bumpFound(): Promise<number> {
  if (!live) {
    fallbackWarning()
    return ++mem.found
  }
  return Number((await cmd<number>(['INCR', K.found])) ?? 0)
}

/* -------------------------------------------------------------- rate limit */

/**
 * Fixed-window limiter, `max` writes per `windowSec` per bucket. Returns true when allowed.
 *
 * A fixed window can let through up to 2x the limit across a boundary. That is fine for holding
 * back a spammer on a guestbook and costs one round trip instead of a sorted set.
 */
export async function allow(bucket: string, max = 3, windowSec = 60): Promise<boolean> {
  if (!live) {
    fallbackWarning()
    const now = Date.now()
    const hit = mem.rate.get(bucket)
    if (!hit || hit.until < now) {
      mem.rate.set(bucket, { n: 1, until: now + windowSec * 1000 })
      return true
    }
    hit.n += 1
    return hit.n <= max
  }
  const key = K.rate(bucket)
  const n = await cmd<number>(['INCR', key])
  if (n === null) return true // storage is down; don't lock the wall shut
  if (n === 1) await cmd(['EXPIRE', key, windowSec])
  return n <= max
}

/** Stable, non-reversible bucket id for an IP. We never store the address itself. */
export async function bucketFor(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`canvas:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** True when real storage is configured — lets a card say so instead of silently doing nothing. */
export const storeIsLive = live
