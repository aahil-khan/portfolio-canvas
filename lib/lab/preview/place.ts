/**
 * Where a preview goes (decision 10; DIRECTION "Windows, cards and the sheet"): below its link when
 * it fits, else above, else on the roomier of the two with its height capped to the room there.
 * **Never over its link**: the window clears every line the link wraps onto, so the link stays
 * clickable. A window opened from inside another steps sideways from its parent (32px to the
 * right, or to the left where the right has no room), so both its link and the window under it
 * still show: the stack cascades.
 *
 * Pure: rects in, a position out. The controller feeds it from Floating UI's `autoUpdate`, which
 * re-runs it on scroll, on resize and when the window's own content grows.
 */
import type { Rect } from './intent.ts'

export interface PlaceInput {
  /** Every client rect of the link (one per line it wraps onto). */
  rects: readonly Rect[]
  /** The rect the pointer was on, or the first; sets the horizontal start. */
  anchor?: Rect
  /** The window's natural height, uncapped. */
  height: number
  /** Its width before the viewport's cap (360 for a card, 460 for an entry). */
  width: number
  /** The largest height it may take anywhere (the entry window's `min(60vh, 500px)`). */
  maxHeight?: number
  viewport: { width: number; height: number }
  /** The lowest y it may reach up to: under the bar. */
  roof: number
  /** The window this one opened from, if any. */
  parent?: Rect | null
}

export interface Placement {
  x: number
  y: number
  width: number
  /** Set when the room on the chosen side is less than the window's height. */
  maxHeight: number | null
  side: 'below' | 'above'
  /** Which way a cascaded window stepped from its parent; null on the page. */
  step: 'right' | 'left' | null
}

/** A card's width and a whole entry's window's (decision 11), before the viewport's cap. */
export const CARD_WIDTH = 360
export const WINDOW_WIDTH = 460
/** A whole entry's window is at most `min(60vh, 500px)` tall, and scrolls inside. */
export const windowMaxHeight = (vh: number): number => Math.min(vh * 0.6, 500)

/** The viewport's side margin, and the gap between a link and its window. */
export const EDGE = 16
export const GAP = 8
/** How far a window steps from the one it opened from. */
export const STEP = 32
/** The bottom margin. */
const FLOOR = 8

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

export function place(o: PlaceInput): Placement {
  const vw = o.viewport.width
  const vh = o.viewport.height
  const width = Math.min(o.width, vw - 2 * EDGE)
  const rects = o.rects.length ? o.rects : o.anchor ? [o.anchor] : []
  const top = Math.min(...rects.map((r) => r.top))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  const anchor = o.anchor ?? rects[0]

  let x: number
  let step: Placement['step'] = null
  if (o.parent) {
    const right = o.parent.left + STEP
    if (right + width <= vw - EDGE) {
      x = Math.max(right, Math.min(anchor.left, vw - EDGE - width))
      step = 'right'
    } else {
      x = clamp(o.parent.left - STEP, EDGE, vw - EDGE - width)
      step = 'left'
    }
  } else x = clamp(anchor.left, EDGE, vw - EDGE - width)

  const h = Math.min(o.height, o.maxHeight ?? Infinity)
  const roomBelow = vh - FLOOR - (bottom + GAP)
  const roomAbove = top - GAP - o.roof
  let y: number
  let side: Placement['side']
  let maxHeight: number | null = null
  if (h <= roomBelow) {
    side = 'below'
    y = bottom + GAP
  } else if (h <= roomAbove) {
    side = 'above'
    y = top - GAP - h
  } else if (roomBelow >= roomAbove) {
    side = 'below'
    y = bottom + GAP
    maxHeight = Math.max(0, Math.floor(roomBelow))
  } else {
    side = 'above'
    maxHeight = Math.max(0, Math.floor(roomAbove))
    y = top - GAP - maxHeight
  }
  return { x: Math.round(x), y: Math.round(y), width, maxHeight, side, step }
}

/** Whether two rects overlap (touching edges do not). */
export function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}
