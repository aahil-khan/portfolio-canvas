/**
 * The image viewer's decisions, apart from its markup so they can be tested
 * (`components/lab/viewer/**` renders them).
 *
 * Which images open: a body image (`img[data-zoom]`, marked by the Markdown pipeline) and a lead's
 * images (`[data-lead] img`: a build's screens, a demo's poster, an essay's cover), inside the
 * page's own entry. Never an image inside a link (the link wins), and never one too small to be
 * worth a screen (an icon that a lead might one day carry).
 */

/** What may open in the viewer, as one selector, in document order: the lead's first, then the body's. */
export const ZOOM_SELECTOR = '[data-lead] img, img[data-zoom]'

/** Smaller than this on its longer side, an image is an icon, not a picture. */
export const MIN_ZOOM_SIDE = 96

/** One picture in the viewer. `w` and `h` are its size in image pixels, never upscaled past. */
export interface ViewerItem {
  src: string
  alt: string
  w: number
  h: number
  /** The figure's caption as text, when it has one. */
  caption?: string
}

/** The copy the viewer shows, from `content/data/lab.json` → `copy`, the `viewer*` keys. */
export interface ViewerCopy {
  /** The image's own label once it opens the viewer: `{alt}` is the image's alt. */
  open: string
  /** The hover affordance on the image. */
  hint: string
  close: string
  scrim: string
  prev: string
  next: string
  /** The visible count, `{i} / {n}`. */
  count: string
  /** What a screen reader hears on paging, `{i}`, `{n}` and `{alt}`. */
  pos: string
  /** The title when an image has no alt. */
  untitled: string
}

/** The viewer's copy keys, in the order they sit in `lab.json`. */
export const VIEWER_KEYS = {
  open: 'viewerOpen',
  hint: 'viewerHint',
  close: 'viewerClose',
  scrim: 'viewerScrim',
  prev: 'viewerPrev',
  next: 'viewerNext',
  count: 'viewerCount',
  pos: 'viewerPos',
  untitled: 'viewerUntitled',
} as const satisfies Record<keyof ViewerCopy, string>

/** The viewer's copy, picked out of the Lab's, so a page sends only these strings to the client. */
export function viewerCopy(copy: Record<string, string>): ViewerCopy {
  const out = {} as ViewerCopy
  for (const [k, key] of Object.entries(VIEWER_KEYS)) out[k as keyof ViewerCopy] = copy[key] ?? key
  return out
}

/** Paging wraps: one past the last is the first. */
export const wrap = (i: number, n: number): number => (n > 0 ? ((i % n) + n) % n : 0)

/**
 * Which way a change of picture went, for the incoming picture's drift: +1 forward, −1 back, 0 none.
 * Paging past either end wraps, so the shorter way round is the way it moved.
 */
export function direction(from: number, to: number, n: number): -1 | 0 | 1 {
  if (from === to || n < 2) return 0
  const raw = to - from
  const s = Math.abs(raw) > n / 2 ? -Math.sign(raw) : Math.sign(raw)
  return s > 0 ? 1 : -1
}

/** How far a finger must travel sideways to page, in CSS pixels. */
export const SWIPE_MIN = 48

/**
 * A finished touch as a page step: −1 (swiped right: previous), +1 (swiped left: next) or 0.
 *
 * Only a one-finger, mostly sideways stroke counts. A pinch is two fingers, and while the page is
 * pinch-zoomed in (`scale` > 1) a one-finger drag pans the zoomed picture, so neither may page.
 */
export function swipeStep(t: { dx: number; dy: number; fingers: number; scale: number }): -1 | 0 | 1 {
  if (t.fingers !== 1 || t.scale > 1.01) return 0
  if (Math.abs(t.dx) < SWIPE_MIN || Math.abs(t.dx) < Math.abs(t.dy) * 1.5) return 0
  return t.dx < 0 ? 1 : -1
}

/** Whether an image of this rendered or declared size is worth opening full size. */
export const bigEnough = (w: number, h: number): boolean => Math.max(w, h) >= MIN_ZOOM_SIDE

/** A positive whole number from an attribute, or `fallback`. */
export function px(v: string | null | undefined, fallback: number): number {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
