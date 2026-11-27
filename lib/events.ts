/**
 * Analytics events, through the site's own counter. Contract: `content/lab/API.md` §9.
 *
 * `track(name, props)` queues an event; nothing leaves the browser until the site's one admission
 * gate (`lib/admission.ts`) has admitted the tab. Then everything queued goes out to `/api/events`
 * in one batch, later events follow on a short debounce, and `sendBeacon` sends whatever is left
 * when the page is hidden. A tab that is never admitted sends nothing at all.
 *
 * No cookies, no identifiers, no third parties. Every name is on the list below, and every value
 * is a bucket from a closed set, never free text a reader typed. `path` is the page's own
 * pathname, which is already public, and `lead` is an id from the Lab's content.
 *
 * The same `parseEvent` runs on both sides: here, so a call site that passes a bad value finds
 * out in dev instead of sending it, and in the route, which refuses any batch that does not parse
 * whole. The server stores counters only (`eventFields`), never a row per event.
 */

import { browserGate, type Gate } from './admission.ts'

export const EVENT_NAMES = [
  'lab_view',
  'read_depth',
  'lead_use',
  'preview_open',
  'look_switch',
  'name_say',
  'player_start',
  'player_minutes',
  'share',
  'md_view',
  'agents_view',
  'back_to_desk',
] as const
export type EventName = (typeof EVENT_NAMES)[number]

/** Where a Lab visit came from, by referrer. */
export const SOURCES = ['linkedin', 'x', 'desk', 'site', 'direct'] as const
export const READ_DEPTHS = [25, 50, 75, 100] as const
export const MINUTE_BUCKETS = [1, 5, 15, 30, 60] as const
export const PAGE_KINDS = ['home', 'section', 'index', 'tag', 'glossary', 'study', 'series', 'chapter', 'note', 'build', 'experiment', 'essay'] as const

export interface EventProps {
  lab_view: { path: string; kind: (typeof PAGE_KINDS)[number]; source: (typeof SOURCES)[number] }
  read_depth: { path: string; depth: (typeof READ_DEPTHS)[number] }
  lead_use: { path: string; lead: string }
  preview_open: { via: 'hover' | 'focus' | 'tap' | 'click'; target: 'entry' | 'term' | 'tag' | 'ref' | 'out' }
  look_switch: { look: 'paper' | 'lab'; mode?: 'light' | 'dark' }
  name_say: Record<string, never>
  player_start: { source: 'station' | 'noise' | 'track' }
  player_minutes: { minutes: (typeof MINUTE_BUCKETS)[number] }
  share: { path: string; via: 'native' | 'copy' | 'x' | 'linkedin' }
  md_view: { path: string }
  agents_view: Record<string, never>
  back_to_desk: Record<string, never>
}

/** One event as it travels: `{ name, props }`, nothing else. */
export type LabEvent = { [N in EventName]: { name: N; props: EventProps[N] } }[EventName]

/* ------------------------------------------------------------------ parsing */

/**
 * A Lab page's pathname: `/lab`, then at most three lowercase slug segments.
 * The cap on depth and length is what keeps a forged path from becoming a long Redis field.
 */
const LAB_PATH = /^\/lab(?:\/[a-z0-9][a-z0-9-]{0,63}){0,3}$/
/** A `.md` twin of any page on the site (`/index.md`, `/work/konta.md`, `/lab/…/x.md`). */
const MD_PATH = /^(?:\/[a-z0-9][a-z0-9-]{0,63}){1,4}\.md$/
/** A lead's id, from the Lab's content. */
const LEAD_ID = /^[a-z0-9][a-z0-9-]{0,39}$/

type Check = (v: unknown) => boolean
const oneOf = (set: readonly unknown[]): Check => (v) => set.includes(v)
const matches = (re: RegExp): Check => (v) => typeof v === 'string' && re.test(v)

/** For each name: every prop it takes, and the test each value must pass. `?` marks optional. */
const SHAPES: { [N in EventName]: Record<string, Check> } = {
  lab_view: { path: matches(LAB_PATH), kind: oneOf(PAGE_KINDS), source: oneOf(SOURCES) },
  read_depth: { path: matches(LAB_PATH), depth: oneOf(READ_DEPTHS) },
  lead_use: { path: matches(LAB_PATH), lead: matches(LEAD_ID) },
  preview_open: { via: oneOf(['hover', 'focus', 'tap', 'click']), target: oneOf(['entry', 'term', 'tag', 'ref', 'out']) },
  look_switch: { look: oneOf(['paper', 'lab']), 'mode?': oneOf(['light', 'dark']) },
  name_say: {},
  player_start: { source: oneOf(['station', 'noise', 'track']) },
  player_minutes: { minutes: oneOf(MINUTE_BUCKETS) },
  share: { path: matches(LAB_PATH), via: oneOf(['native', 'copy', 'x', 'linkedin']) },
  md_view: { path: matches(MD_PATH) },
  agents_view: {},
  back_to_desk: {},
}

/** Props whose values are an open set (paths, lead ids). They are counted apart, and capped. */
const OPEN_PROPS = new Set(['path', 'lead'])

const isPlain = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype

const isName = (x: unknown): x is EventName => (EVENT_NAMES as readonly unknown[]).includes(x)

/**
 * Reads one event. Null for anything that is not exactly one: an unknown name, a missing prop, a
 * prop the name does not take, a value outside its bucket, or any key besides `name` and `props`.
 * Strict on purpose, because what passes becomes field names in a Redis hash.
 */
export function parseEvent(x: unknown): LabEvent | null {
  if (!isPlain(x)) return null
  const keys = Object.keys(x)
  if (keys.length !== 2 || !('name' in x) || !('props' in x)) return null
  const { name, props } = x
  if (!isName(name) || !isPlain(props)) return null
  const shape = SHAPES[name]
  const allowed = new Set(Object.keys(shape).map((k) => k.replace(/\?$/, '')))
  for (const k of Object.keys(props)) if (!allowed.has(k)) return null
  const out: Record<string, unknown> = {}
  for (const [spec, ok] of Object.entries(shape)) {
    const optional = spec.endsWith('?')
    const k = optional ? spec.slice(0, -1) : spec
    if (!(k in props)) {
      if (optional) continue
      return null
    }
    if (!ok(props[k])) return null
    out[k] = props[k]
  }
  return { name, props: out } as LabEvent
}

/** The most events one batch may carry. A reader does not produce more between two flushes. */
export const MAX_BATCH = 40

/** Reads a whole batch, `{ events: [...] }`. Null unless every event in it parses. */
export function parseBatch(body: unknown): LabEvent[] | null {
  if (!isPlain(body)) return null
  const keys = Object.keys(body)
  if (keys.length !== 1 || keys[0] !== 'events') return null
  const { events } = body
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_BATCH) return null
  const out: LabEvent[] = []
  for (const e of events) {
    const ok = parseEvent(e)
    if (!ok) return null
    out.push(ok)
  }
  return out
}

/**
 * The counters one event bumps.
 *
 * `counts` are bounded by construction: the name, and `name.prop:value` for each prop from a
 * closed set. `open` holds the open-ended ones, `name|path` and `lead_use.lead|id`; the store keeps
 * those in a daily hash with a field cap, so a flood of forged paths cannot grow it without end.
 * Each prop is counted on its own, never crossed with another, which keeps both small.
 */
export function eventFields(e: LabEvent): { counts: string[]; open: string[] } {
  const counts: string[] = [e.name]
  const open: string[] = []
  for (const [k, v] of Object.entries(e.props)) {
    if (k === 'path') open.push(`${e.name}|${v}`)
    else if (OPEN_PROPS.has(k)) open.push(`${e.name}.${k}|${v}`)
    else counts.push(`${e.name}.${k}:${v}`)
  }
  return { counts, open }
}

/* ------------------------------------------------------------------ the queue */

/** Quiet time after the last event before a batch goes out, once the tab is admitted. */
export const DEBOUNCE_MS = 4000

export interface TrackerEnv {
  gate: Gate
  /** Sends one batch body. `beacon` is true when the page is being hidden. */
  send(body: string, beacon: boolean): void
  later(fn: () => void, ms: number): unknown
  cancel(handle: unknown): void
  /** Calls `fn` when the page is being hidden: `pagehide`, or `visibilitychange` to hidden. */
  onHide(fn: () => void): void
  /** In dev, a call site that passes a bad event hears about it. */
  warn?(msg: string): void
}

export function createTracker(env: TrackerEnv) {
  let queue: LabEvent[] = []
  let timer: unknown = null
  let waiting = false
  let hooked = false

  const flush = (beacon: boolean) => {
    if (timer !== null) {
      env.cancel(timer)
      timer = null
    }
    if (!queue.length) return
    const body = JSON.stringify({ events: queue })
    queue = []
    try {
      env.send(body, beacon)
    } catch {
      /* counting is the least important thing on any page */
    }
  }

  return function track<N extends EventName>(name: N, props: EventProps[N]): void {
    const e = parseEvent({ name, props })
    if (!e) {
      env.warn?.(`track: ${String(name)} with ${JSON.stringify(props)} is not an allowlisted event; dropped`)
      return
    }
    // a page that somehow fires hundreds keeps the first batch's worth, and says nothing more
    if (queue.length >= MAX_BATCH) return
    queue.push(e)

    if (!hooked) {
      hooked = true
      // only an admitted tab sends on the way out; an unadmitted one just goes
      env.onHide(() => {
        if (env.gate.isAdmitted()) flush(true)
      })
    }

    if (env.gate.isAdmitted()) {
      if (timer !== null) env.cancel(timer)
      timer = env.later(() => flush(false), DEBOUNCE_MS)
    } else if (!waiting) {
      waiting = true
      // admission flushes everything queued so far, in one batch
      env.gate.whenAdmitted(() => {
        waiting = false
        flush(false)
      })
    }
  }
}

function sendToServer(body: string, beacon: boolean): void {
  // sendBeacon is the only send guaranteed to go out once the page is being torn down
  if (beacon && navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }))) return
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

let tracker: ReturnType<typeof createTracker> | null = null

/** Records one event. Safe to call anywhere: on the server it does nothing. */
export function track<N extends EventName>(name: N, props: EventProps[N]): void {
  if (!tracker) {
    const gate = browserGate()
    if (!gate) return
    tracker = createTracker({
      gate,
      send: sendToServer,
      later: (fn, ms) => setTimeout(fn, ms),
      cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      /*
       * `pagehide`, not `beforeunload`: beforeunload is ignored on mobile Safari and disables the
       * back-forward cache everywhere. `visibilitychange` covers tab switches, where a phone may
       * never fire pagehide at all.
       */
      onHide: (fn) => {
        addEventListener('pagehide', fn)
        addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && fn())
      },
      warn: process.env.NODE_ENV === 'production' ? undefined : (m) => console.warn(m),
    })
  }
  tracker(name, props)
}
