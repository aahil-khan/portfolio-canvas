'use client'

/**
 * The one owner of "should this page move?" for the `/` route.
 *
 * DIRECTION.md: *"Reduced motion collapses all of it to opacity-only... One owner. Not a branch
 * scattered per component — that is how the last build produced a hydration mismatch (React
 * #418)."* The same rule applies here, and the failure mode is the same: a component that reads
 * `matchMedia` while rendering produces different markup on the server (where the query cannot
 * be evaluated) than on the client.
 *
 * So nothing on this page reads `prefers-reduced-motion` directly. `components/site/motion.tsx`
 * asks these functions from inside `useGSAP`, which runs only on the client and only after
 * hydration, and the answer decides whether Lenis starts at all and which `gsap.matchMedia()`
 * branch builds animations.
 */

/** Breakpoint below which the page drops the sticky index and the two-column rows. */
export const SITE_NARROW = 900

/**
 * Media queries handed to `gsap.matchMedia()`.
 *
 * Given to matchMedia as a conditions object rather than checked by hand, because matchMedia
 * reverts every tween and ScrollTrigger created under a condition the moment that condition
 * stops matching — which is the teardown we would otherwise have to write, and get wrong, for
 * a window dragged across the breakpoint or a preference toggled mid-session.
 */
export const SITE_MEDIA = {
  motion: '(prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
} as const

/**
 * Call from an effect or an event handler — never during render.
 *
 * Used for the things `gsap.matchMedia()` cannot own because they are not GSAP objects: whether
 * to construct a Lenis instance at all, and whether the hero's cursor light should track.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia(SITE_MEDIA.reduce).matches
}

/** True only where a real pointer can hover — the cursor dot and the hero light need one. */
export function hasFinePointer(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}
