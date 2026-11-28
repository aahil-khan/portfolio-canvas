/**
 * Motion values, as code. `design/DIRECTION.md` owns them ("Motion" and "The Lab → Motion and
 * hover timing"); this file is their one TypeScript copy, so a component never types a duration.
 *
 * Every value is in milliseconds. Motion (motion.dev) takes seconds, so use `sec()` at the call
 * site rather than keeping a second table. Reduced motion is not decided here: ask
 * `lib/motion/reduced.ts`, then use `REDUCED` for what is left.
 */

/** The one easing for everything that decelerates. Measured from yevtam's dock. */
export const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
/** The same curve as Motion's cubic-bezier array. */
export const EASE_BEZIER = [0.16, 1, 0.3, 1] as const

/** Durations shared by every surface (DIRECTION "Motion"). */
export const SITE = {
  hover: 180,
  dockWidth: 450,
  windowOpen: 320,
} as const

/** The Lab's motion (DIRECTION "The Lab", from NEXT.md shortcut 3). */
export const LAB = {
  /** A preview window entering: rises 6px and scales from 0.98 at the link's corner. */
  windowIn: { duration: 180, opacity: 120, rise: 6, scale: 0.98 },
  /** A preview window leaving: opacity and 4px down, no scale. */
  windowOut: { duration: 120, drop: 4 },
  /** Buttons, chips and menus: in, out, the 1px lift on hover and the press on :active. */
  control: { in: 120, out: 180, lift: 1, press: 80 },
  /** A page change: scroll to top first (never animated), then the column fades and rises 8px. */
  page: { duration: 240, rise: 8 },
  /** Home band rows, the first time each band enters the viewport, once a visit. */
  bandStagger: 30,
  /** The rail's On this page accent bar sliding between headings. */
  tocSlide: 180,
  /** Share's "Link copied": the crossfade, and how long it stays before returning. */
  copied: { fade: 140, hold: 1800 },
  /** Leads and figures drawing on first view (PR 11). */
  lead: { duration: 450, stagger: 30 },
  /** A theme change crossfades colours. */
  look: 320,
  /** The bar sliding away and back. */
  bar: 280,
  /** The reading dot: how it follows the trail, blinks, and when it falls asleep. */
  dot: { follow: 320, blink: 4200, sleepAfter: 20_000 },
  /** The name's tooltip. */
  nameTip: { opacity: 140, transform: 180 },
  /** A reference row flashing when a citation jumps to it. */
  refFlash: 450,
} as const

/** Preview hover intent (NEXT.md shortcut 2; DIRECTION "The Lab"). */
export const INTENT = {
  /** Hover before a first preview opens. */
  open: 300,
  /** Hover before the next one opens, within the grace after a preview was open. */
  openInGrace: 90,
  /** How long after a preview was open the grace lasts. */
  grace: 600,
  /** Leaving before a preview closes; any re-entry cancels it. */
  close: 220,
} as const

/** Under reduced motion every animation is opacity only, and none runs longer than this. */
export const REDUCED = { maxDuration: 120 } as const

/** Milliseconds to the seconds Motion wants. */
export const sec = (ms: number): number => ms / 1000
