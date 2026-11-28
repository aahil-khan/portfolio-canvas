/**
 * Hover intent for the Lab's previews, as a pure timing machine (NEXT.md shortcut 2; DIRECTION
 * "Motion and hover timing"; plan PR 10). It knows nothing of the DOM: the controller tells it what
 * the pointer and focus are doing, with timestamps, and it says when to open and close. The clock
 * and the timers are injected, so the tests drive it with a fake clock.
 *
 *   - A first open waits `INTENT.open` (300ms) of hover or focus.
 *   - While a window is open, or within `INTENT.grace` (600ms) of one closing, the next opens after
 *     `INTENT.openInGrace` (90ms).
 *   - Leaving closes the hover-opened windows above where the pointer now is after `INTENT.close`
 *     (220ms). Any re-entry cancels it, and so does every move inside the safe triangle: the
 *     triangle from where the pointer left a link to the near corners of the window that link
 *     opened. A pointer that stops in the triangle closes 220ms after its last move.
 *   - At most `MAX_STACK` (3) windows. A link inside window i opens window i + 1, replacing what was
 *     there; Esc closes the top one only; a press inside window i closes the ones above it.
 *   - Focus-, tap- and click-opened windows never close on a pointer leaving; focus-opened ones
 *     close 220ms after focus leaves the stack.
 */
import { INTENT } from '../../motion/tokens.ts'

export type Via = 'hover' | 'focus' | 'tap' | 'click'

export const MAX_STACK = 3

export interface Point {
  x: number
  y: number
}
export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** One open window, as the machine sees it: what opened it and how. */
export interface Opened<T> {
  trigger: T
  level: number
  via: Via
}

export interface IntentHost<T> {
  now(): number
  schedule(fn: () => void, ms: number): unknown
  cancel(handle: unknown): void
  /** Open a window for `trigger` at `level`. Everything at `level` and above is already closed. */
  open(o: Opened<T>): void
  /** Close the windows from `level` up. */
  close(level: number): void
  /** The window at `level`'s rect on screen, for the safe triangle. */
  rectOf(level: number): Rect | null
}

export interface IntentTiming {
  open: number
  openInGrace: number
  grace: number
  close: number
}

/** Whether `p` lies in the triangle a–b–c (edges included). */
export function inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const s = (p1: Point, p2: Point, p3: Point) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
  const d1 = s(p, a, b)
  const d2 = s(p, b, c)
  const d3 = s(p, c, a)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}

/**
 * The safe zone from `from` (where the pointer left the link) toward `rect` (the window): the
 * triangle from the point to the window's two near corners, on whichever side faces the point.
 * A point inside the window itself is not "in the triangle": the window keeps itself open.
 */
export function inSafeTriangle(p: Point, from: Point, rect: Rect): boolean {
  let a: Point
  let b: Point
  if (from.y <= rect.top) [a, b] = [{ x: rect.left, y: rect.top }, { x: rect.right, y: rect.top }]
  else if (from.y >= rect.bottom) [a, b] = [{ x: rect.left, y: rect.bottom }, { x: rect.right, y: rect.bottom }]
  else if (from.x <= rect.left) [a, b] = [{ x: rect.left, y: rect.top }, { x: rect.left, y: rect.bottom }]
  else [a, b] = [{ x: rect.right, y: rect.top }, { x: rect.right, y: rect.bottom }]
  // a few pixels of slack around the point itself, for the jitter of a hand starting to move
  const slack = 4
  if (Math.abs(p.x - from.x) <= slack && Math.abs(p.y - from.y) <= slack) return true
  // the bridge: the strip between the link and the window, as wide as the window (Floating UI's
  // safePolygon has the same), so a hand drifting sideways along the gap is still on its way
  if (p.x >= rect.left && p.x <= rect.right) {
    if (from.y <= rect.top && p.y >= from.y - slack && p.y <= rect.top) return true
    if (from.y >= rect.bottom && p.y <= from.y + slack && p.y >= rect.bottom) return true
  }
  return inTriangle(p, from, a, b)
}

export class Intent<T> {
  private stack: Opened<T>[] = []
  private pending: { trigger: T; level: number; via: Via; at: number; handle: unknown } | null = null
  private closing: { level: number; at: number; handle: unknown } | null = null
  private focusClosing: unknown = null
  private safe: { from: Point; level: number } | null = null
  /** The last `at()` found the pointer moving through the safe triangle. */
  private holding = false
  /** When the stack last became empty, for the grace. */
  private emptiedAt = -Infinity
  private readonly host: IntentHost<T>
  private readonly timing: IntentTiming

  constructor(host: IntentHost<T>, timing: IntentTiming = INTENT) {
    this.host = host
    this.timing = timing
  }

  /** The open windows, bottom first. */
  get opened(): readonly Opened<T>[] {
    return this.stack
  }

  /** The delay a hover or focus started at `t` waits before opening. */
  delayAt(t: number): number {
    return this.stack.length || t - this.emptiedAt <= this.timing.grace ? this.timing.openInGrace : this.timing.open
  }

  /** The pointer (or focus) arrived on `trigger`, a link at `level` (0 on the page, i + 1 inside window i). */
  enter(trigger: T, level: number, via: 'hover' | 'focus', t = this.host.now()): void {
    if (level >= MAX_STACK) return
    // on its way to a window, the hand may cross other links: they don't open (Floating UI's
    // safePolygon blocks them the same way). Call `at()` first with the same move.
    if (via === 'hover' && this.holding && this.safe && level <= this.safe.level && this.stack[this.safe.level]?.trigger !== trigger) return
    const here = this.stack[level]
    if (here && here.trigger === trigger) {
      this.cancelPending()
      // back on the link of an open window: nothing above it is closing on its account
      if (this.closing && this.closing.level <= level) this.cancelClosing()
      return
    }
    if (this.pending && this.pending.trigger === trigger && this.pending.level === level) return
    this.cancelPending()
    const at = t + this.delayAt(t)
    const handle = this.host.schedule(() => {
      this.pending = null
      this.openNow(trigger, level, via)
    }, Math.max(0, at - this.host.now()))
    this.pending = { trigger, level, via, at, handle }
  }

  /** The pointer left `trigger` at `point`. */
  leave(trigger: T, point: Point | null): void {
    if (this.pending && this.pending.trigger === trigger && this.pending.via === 'hover') this.cancelPending()
    const i = this.stack.findIndex((o) => o.trigger === trigger)
    this.safe = i >= 0 && point ? { from: point, level: i } : null
  }

  /**
   * Where the pointer is now: `keep` is the deepest window it is on, or whose link it is on (-1 for
   * the page). Hover-opened windows above `keep` close after the close delay, unless the pointer is
   * moving through the safe triangle toward one of them.
   */
  at(keep: number, point: Point | null, t = this.host.now()): void {
    this.holding = false
    if (this.safe && point && keep < this.safe.level) {
      const r = this.host.rectOf(this.safe.level)
      if (r && inSafeTriangle(point, this.safe.from, r)) {
        // moving toward the window: each move pushes the close back, so it closes only once the
        // hand stops (or leaves the triangle), 220ms after its last move inside
        this.holding = true
        this.armClose(this.firstHoverAbove(keep), t, true)
        return
      }
      this.safe = null
    }
    this.holding = false
    if (this.safe && keep >= this.safe.level) this.safe = null
    this.armClose(this.firstHoverAbove(keep), t, false)
  }

  /**
   * Focus moved to something that is not a window or a window's link: focus-opened windows close.
   * `except` is where focus went when that is itself a link with an open pending: it stays pending.
   */
  blur(except?: T): void {
    if (this.pending?.via === 'focus' && this.pending.trigger !== except) this.cancelPending()
    const i = this.stack.findIndex((o) => o.via === 'focus')
    if (i < 0) return
    this.host.cancel(this.focusClosing)
    this.focusClosing = this.host.schedule(() => {
      this.focusClosing = null
      this.closeFrom(i)
    }, this.timing.close)
  }

  /** Focus is inside the stack, or on a window's link: nothing closes on its account. */
  focusKept(): void {
    this.host.cancel(this.focusClosing)
    this.focusClosing = null
  }

  /** A tap or a click opened `trigger` at `level`, now. */
  press(trigger: T, level: number, via: 'tap' | 'click'): void {
    if (level >= MAX_STACK) return
    this.cancelPending()
    const here = this.stack[level]
    if (here && here.trigger === trigger) {
      here.via = via
      return
    }
    this.openNow(trigger, level, via)
  }

  /** A press landed at `keep` (the deepest window it is in, -1 for the page): close what is above. */
  down(keep: number): void {
    this.cancelPending()
    if (keep + 1 < this.stack.length) this.closeFrom(keep + 1)
  }

  /** Esc: the top window only. Returns what it closed. */
  escape(): Opened<T> | null {
    this.cancelPending()
    const top = this.stack[this.stack.length - 1]
    if (!top) return null
    this.closeFrom(top.level)
    return top
  }

  /** Close the windows from `level` up, now. */
  closeFrom(level: number): void {
    if (level >= this.stack.length) return
    if (this.closing && this.closing.level >= level) this.cancelClosing()
    if (this.safe && this.safe.level >= level) this.safe = null
    this.stack.length = level
    if (!this.stack.length) {
      this.emptiedAt = this.host.now()
      this.host.cancel(this.focusClosing)
      this.focusClosing = null
    }
    this.host.close(level)
  }

  closeAll(): void {
    this.cancelPending()
    this.closeFrom(0)
  }

  // ---------- inside ----------

  private openNow(trigger: T, level: number, via: Via): void {
    if (level > this.stack.length) return // its parent closed in the meantime
    if (level < this.stack.length) this.closeFrom(level)
    if (this.closing) this.cancelClosing()
    this.safe = null
    const o = { trigger, level, via }
    this.stack.push(o)
    this.host.open(o)
  }

  private firstHoverAbove(keep: number): number {
    for (let i = keep + 1; i < this.stack.length; i++) if (this.stack[i].via === 'hover') return i
    return -1
  }

  /** Arm the close of `level` and up (none when -1). `rearm` pushes an armed close back to t + delay. */
  private armClose(level: number, t: number, rearm: boolean): void {
    if (level < 0) {
      this.cancelClosing()
      return
    }
    if (this.closing && this.closing.level === level && !rearm) return
    this.cancelClosing()
    const at = t + this.timing.close
    const handle = this.host.schedule(() => {
      this.closing = null
      this.closeFrom(level)
    }, Math.max(0, at - this.host.now()))
    this.closing = { level, at, handle }
  }

  private cancelPending(): void {
    if (!this.pending) return
    this.host.cancel(this.pending.handle)
    this.pending = null
  }

  private cancelClosing(): void {
    if (!this.closing) return
    this.host.cancel(this.closing.handle)
    this.closing = null
  }
}
