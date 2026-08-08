/**
 * The only place that talks to shared storage.
 *
 * SERVER ONLY. It reads `process.env` for credentials, so it must never reach a client bundle —
 * import it from route handlers under `app/api/` and nowhere else. (There is no `server-only`
 * guard package here on purpose: that would be a runtime dependency, and this file is the one
 * thing standing between the project and its "Next and React only" rule.)
 *
 * Everything the canvas persists across visitors — the notes wall, the typing leaderboard, the
 * deep-space find counter, the visitor stats — goes through here, so swapping the backend is a
 * one-file change.
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

/**
 * Several commands, one round trip.
 *
 * Upstash's `/pipeline` endpoint takes an array of command arrays and answers an array of
 * `{ result }` in the same order. Recording a visit touches six keys and reading the card's
 * stats touches nineteen — as individual `cmd()` calls that would be nineteen HTTPS handshakes
 * on a route that runs on every page load.
 *
 * A single command inside the pipeline can fail while the rest succeed, so entries come back as
 * `{ error }` in that position; those become null rather than taking the whole batch down.
 */
async function pipe(cmds: (string | number)[][]): Promise<unknown[] | null> {
  if (!live || !cmds.length) return null
  try {
    const res = await fetch(`${URL_!.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`[store] pipeline failed: ${res.status}`)
      return null
    }
    const json = (await res.json()) as ({ result: unknown } | { error: string })[]
    if (!Array.isArray(json)) return null
    return json.map((entry) => ('result' in entry ? entry.result : null))
  } catch (err) {
    console.warn('[store] pipeline threw:', err)
    return null
  }
}

/* ------------------------------------------------------- in-memory fallback */

const mem = {
  notes: [] as Note[],
  scores: new Map<string, Map<string, Score>>(),
  found: 0,
  rate: new Map<string, { n: number; until: number }>(),
  vis: {
    /** A real Set here, not a HyperLogLog: exact is easy when it only has to last one process. */
    ids: new Set<string>(),
    day: new Map<string, Set<string>>(),
    views: 0,
    online: new Map<string, number>(),
    geo: new Map<string, number>(),
    since: 0,
  },
  opens: new Map<string, number>(),
  refs: new Map<string, number>(),
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

/* --------------------------------------------------------------- visitors */

/**
 * Visitor counting.
 *
 * Uniques live in a HyperLogLog rather than a set. That answers "how many distinct people" in a
 * fixed ~12KB no matter how much traffic arrives, and — the part that actually matters — it is
 * not reversible: the structure holds register maxima, not members, so there is nothing in here
 * to walk back to a person. The price is roughly 0.8% error on the count, which is well under
 * what anyone reading a portfolio card would notice.
 *
 * The visitor id is a truncated SHA-256 of address plus user agent, computed per request and
 * never stored on its own. No cookie is set anywhere on this site, and the raw address never
 * leaves the request handler.
 */

/** Someone counts as "here now" for this long after their last page load. */
const ONLINE_SEC = 300
/** How many days of history the card's chart shows. */
export const VISITOR_DAYS = 14
/** Daily keys outlive the chart window by a margin and then expire themselves. */
const DAY_TTL_SEC = (VISITOR_DAYS + 7) * 86_400
/** Countries shown on the card, most visitors first. */
const GEO_LIMIT = 8

/**
 * Preview deploys and `npm run dev` share this Redis with production, so they get their own
 * namespace. Without it every local reload would inflate the number on the live site, and the
 * first thing you would do after shipping this is stop trusting it.
 */
const VNS = process.env.VERCEL_ENV === 'production' ? 'canvas:vis' : 'canvas:vis:dev'

const V = {
  uniq: `${VNS}:uniq`,
  day: (d: string) => `${VNS}:day:${d}`,
  views: `${VNS}:views`,
  online: `${VNS}:online`,
  geo: `${VNS}:geo`,
  since: `${VNS}:since`,
} as const

export interface Visitors {
  /** Distinct people, all time. */
  unique: number
  /** Page loads, all time. */
  views: number
  /** Distinct people seen in the last five minutes. */
  online: number
  /** Uniques per day, oldest first, exactly `VISITOR_DAYS` long and ending today. */
  daily: number[]
  /** The UTC day stamps `daily` covers, same order. Sent so the client never re-derives them. */
  days: string[]
  /** ISO-3166 alpha-2 codes with a count of distinct people, largest first. */
  countries: { code: string; n: number }[]
  /** How many distinct countries have been seen, including ones past `GEO_LIMIT`. */
  countryCount: number
  /** Epoch ms of the first recorded visit, or null before anyone has arrived. */
  since: number | null
  /** False when no shared store is configured, so the card can say so instead of showing zeros. */
  live: boolean
}

const NO_VISITORS: Visitors = {
  unique: 0,
  views: 0,
  online: 0,
  daily: Array<number>(VISITOR_DAYS).fill(0),
  days: chartDays(),
  countries: [],
  countryCount: 0,
  since: null,
  live,
}

/** UTC day stamp, `YYYY-MM-DD`. UTC so the series does not shift when the server region does. */
function utcDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

/** The `VISITOR_DAYS` day stamps the chart covers, oldest first, ending today. */
function chartDays(): string[] {
  return Array.from({ length: VISITOR_DAYS }, (_, i) => utcDay(i - (VISITOR_DAYS - 1)))
}

/**
 * Stable, non-reversible id for one visitor.
 *
 * Address alone collapses everyone behind a corporate NAT or a carrier CGNAT into one person,
 * so the user agent goes in too. It is still an approximation — that is inherent to counting
 * people without storing anything about them, and the card's copy does not claim otherwise.
 */
export async function visitorId(ip: string, ua: string): Promise<string> {
  const data = new TextEncoder().encode(`canvas:visitor:${ip}:${ua}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest).slice(0, 12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function recordVisit(id: string, country: string | null): Promise<void> {
  const now = Date.now()
  const today = utcDay()

  if (!live) {
    fallbackWarning()
    const fresh = !mem.vis.ids.has(id)
    mem.vis.ids.add(id)
    let day = mem.vis.day.get(today)
    if (!day) {
      day = new Set<string>()
      mem.vis.day.set(today, day)
    }
    day.add(id)
    mem.vis.views += 1
    mem.vis.online.set(id, now)
    if (!mem.vis.since) mem.vis.since = now
    if (fresh && country) mem.vis.geo.set(country, (mem.vis.geo.get(country) ?? 0) + 1)
    return
  }

  const out = await pipe([
    ['PFADD', V.uniq, id],
    ['PFADD', V.day(today), id],
    ['EXPIRE', V.day(today), DAY_TTL_SEC],
    ['INCR', V.views],
    ['ZADD', V.online, now, id],
    // sweep the window on every write, so nothing else has to own expiring it
    ['ZREMRANGEBYSCORE', V.online, '-inf', now - ONLINE_SEC * 1000],
    ['EXPIRE', V.online, ONLINE_SEC * 3],
    ['SET', V.since, now, 'NX'],
  ])

  /*
   * Country is counted per PERSON, not per page load, so it can only be bumped once the PFADD
   * above reports it actually added something — and that answer arrives one round trip later.
   * The cost is a second call on a visitor's first-ever page load, and nothing on any load after
   * it. Counting it inline instead would quietly turn this row into a view count wearing a
   * visitor count's label.
   */
  if (country && out?.[0] === 1) await cmd(['HINCRBY', V.geo, country, 1])
}

/** Upstash answers HGETALL as a flat `[field, value, ...]` array; older responses use an object. */
function readHash(raw: unknown): Record<string, string> {
  if (!raw) return {}
  if (Array.isArray(raw)) {
    const out: Record<string, string> = {}
    for (let i = 0; i + 1 < raw.length; i += 2) out[String(raw[i])] = String(raw[i + 1])
    return out
  }
  if (typeof raw === 'object') return raw as Record<string, string>
  return {}
}

function rankGeo(counts: Record<string, number>): Pick<Visitors, 'countries' | 'countryCount'> {
  const all = Object.entries(counts)
    .map(([code, n]) => ({ code, n }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n || a.code.localeCompare(b.code))
  return { countries: all.slice(0, GEO_LIMIT), countryCount: all.length }
}

export async function getVisitors(): Promise<Visitors> {
  const now = Date.now()
  const days = chartDays()

  if (!live) {
    fallbackWarning()
    return {
      ...NO_VISITORS,
      unique: mem.vis.ids.size,
      views: mem.vis.views,
      online: [...mem.vis.online.values()].filter((t) => t > now - ONLINE_SEC * 1000).length,
      daily: days.map((d) => mem.vis.day.get(d)?.size ?? 0),
      days,
      ...rankGeo(Object.fromEntries(mem.vis.geo)),
      since: mem.vis.since || null,
    }
  }

  const out = await pipe([
    ['PFCOUNT', V.uniq],
    ['GET', V.views],
    ['ZCOUNT', V.online, now - ONLINE_SEC * 1000, '+inf'],
    ['HGETALL', V.geo],
    ['GET', V.since],
    ...days.map((d) => ['PFCOUNT', V.day(d)]),
  ])
  if (!out) return NO_VISITORS

  const [unique, views, online, geo, since, ...daily] = out
  const counts: Record<string, number> = {}
  for (const [code, n] of Object.entries(readHash(geo))) counts[code] = Number(n) || 0

  return {
    unique: Number(unique) || 0,
    views: Number(views) || 0,
    online: Number(online) || 0,
    // pad defensively: a short pipeline answer must not shorten the chart and shift its axis
    daily: days.map((_, i) => Number(daily[i]) || 0),
    days,
    ...rankGeo(counts),
    since: Number(since) || null,
    live: true,
  }
}

/* ----------------------------------------------------------- card opens */

/**
 * Which cards people actually open.
 *
 * The Visitors card answers "how many people"; this answers "and what did they look at", which
 * is the question that changes what goes on the site. It is deliberately not public: a project
 * nobody opens is useful to know and embarrassing to publish.
 *
 * A plain hash of counters — no per-visitor rows, so this cannot be turned into a session
 * replay even by whoever holds the token. It says a card was opened N times, and nothing about
 * who or in what order.
 */

const C = {
  opens: `${VNS}:opens`,
  openDay: (d: string) => `${VNS}:opens:${d}`,
  referrers: `${VNS}:refs`,
} as const

/** Cards opened per day are kept for a fortnight; the all-time hash never expires. */
const OPEN_DAY_TTL_SEC = 14 * 86_400

export interface CardOpens {
  /** Card id → times opened, all time, largest first. */
  cards: { id: string; n: number }[]
  /** Referrer host → visits, largest first. Empty for direct traffic, which is not counted. */
  referrers: { host: string; n: number }[]
  total: number
}

const NO_OPENS: CardOpens = { cards: [], referrers: [], total: 0 }

/**
 * Records that a card was opened, and where the visitor came from.
 *
 * Both are capped by the caller — an id that is not a real card, or a host longer than a
 * hostname can be, never reaches here.
 */
export async function recordOpens(ids: string[], referrer: string | null): Promise<void> {
  if (!ids.length && !referrer) return
  const today = utcDay()

  if (!live) {
    fallbackWarning()
    for (const id of ids) {
      mem.opens.set(id, (mem.opens.get(id) ?? 0) + 1)
    }
    if (referrer) mem.refs.set(referrer, (mem.refs.get(referrer) ?? 0) + 1)
    return
  }

  const cmds: (string | number)[][] = []
  for (const id of ids) {
    cmds.push(['HINCRBY', C.opens, id, 1])
    cmds.push(['HINCRBY', C.openDay(today), id, 1])
  }
  if (ids.length) cmds.push(['EXPIRE', C.openDay(today), OPEN_DAY_TTL_SEC])
  if (referrer) cmds.push(['HINCRBY', C.referrers, referrer, 1])
  await pipe(cmds)
}

export async function getOpens(): Promise<CardOpens> {
  if (!live) {
    fallbackWarning()
    const cards = [...mem.opens.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n)
    return {
      cards,
      referrers: [...mem.refs.entries()].map(([host, n]) => ({ host, n })).sort((a, b) => b.n - a.n),
      total: cards.reduce((t, c) => t + c.n, 0),
    }
  }

  const out = await pipe([
    ['HGETALL', C.opens],
    ['HGETALL', C.referrers],
  ])
  if (!out) return NO_OPENS

  const cards = Object.entries(readHash(out[0]))
    .map(([id, n]) => ({ id, n: Number(n) || 0 }))
    .sort((a, b) => b.n - a.n)
  const referrers = Object.entries(readHash(out[1]))
    .map(([host, n]) => ({ host, n: Number(n) || 0 }))
    .sort((a, b) => b.n - a.n)

  return { cards, referrers, total: cards.reduce((t, c) => t + c.n, 0) }
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
