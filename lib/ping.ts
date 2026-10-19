/**
 * The visit ping: what the browser sends once a visit is worth counting, and the aggregate
 * buckets the server turns it into.
 *
 * Pure and dependency-free so it can be shared by the client that builds the body, the route
 * that reads it, and a test. Nothing here identifies anyone: every field is a coarse fact about
 * the session (which kind of input, roughly how soon, roughly how wide), and the server only
 * ever stores how many pings fell in each bucket. That is what makes the stats page able to say
 * "most of the traffic arrives on a 800px viewport with focus and touches nothing for a second"
 * without there being a row anywhere that describes one person.
 */

export const INPUT_TYPES = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
export type InputType = (typeof INPUT_TYPES)[number]

export interface Ping {
  /** Which kind of physical input unlocked the count. */
  via: InputType
  /** Milliseconds from page load to that input. */
  input: number
  /** `navigator.webdriver`: true in a browser that admits to being driven by automation. */
  webdriver: boolean
  /** Viewport width in CSS pixels. */
  width: number
  /** Whether the document had focus when the ping went out. */
  focus: boolean
}

/** Why a ping was not counted. Each becomes a `rej:<reason>` counter. */
export type Rejection = 'ua' | 'body' | 'webdriver' | 'rate'

const isInput = (x: unknown): x is InputType => (INPUT_TYPES as readonly unknown[]).includes(x)

/** A finite, non-negative number no larger than `max`; anything else is not worth storing. */
const isCount = (x: unknown, max: number): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max

/**
 * Reads a ping body. Null for anything that is not one.
 *
 * Strict on purpose: this becomes field names in a Redis hash, so a field the client did not
 * send in the agreed shape must not reach it. A request with no body at all is also null — an
 * older page could still send one for a short while after a deploy, and a replayed POST with no
 * body is exactly the thing a counter should not count.
 */
export function parsePing(body: unknown): Ping | null {
  if (!body || typeof body !== 'object') return null
  const { via, input, webdriver, width, focus } = body as Record<string, unknown>
  if (!isInput(via)) return null
  // an hour is already absurd for time-to-first-input; past that it is a clock, not a person
  if (!isCount(input, 3_600_000)) return null
  if (typeof webdriver !== 'boolean') return null
  // 16k is wider than any display; it only exists to keep a nonsense number out of the hash
  if (!isCount(width, 16_000)) return null
  if (typeof focus !== 'boolean') return null
  return { via, input: Math.round(input), webdriver, width: Math.round(width), focus }
}

/** Time-to-first-input, in the four bands that separate a reader from a script. */
export function inputBand(ms: number): string {
  if (ms < 1000) return '<1s'
  if (ms < 3000) return '1-3s'
  if (ms < 10_000) return '3-10s'
  return '10s+'
}

/**
 * The counters one counted ping bumps.
 *
 * Width is rounded to the nearest hundred so the hash holds a few dozen fields, not one per
 * device, and because the question it answers is "is everyone on one suspicious size", which
 * does not need the last pixel.
 */
export function pingBuckets(p: Ping): string[] {
  return [
    `via:${p.via}`,
    `input:${inputBand(p.input)}`,
    `width:${Math.round(p.width / 100) * 100}`,
    `focus:${p.focus ? 'yes' : 'no'}`,
  ]
}
