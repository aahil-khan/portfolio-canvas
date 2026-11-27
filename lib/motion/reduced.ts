import { useSyncExternalStore } from 'react'

/**
 * The one owner of reduced motion.
 *
 * DIRECTION.md: "Reduced motion collapses all of it to opacity-only, and kills pan momentum. One
 * owner." The last build read the media query inside components during render, which made the
 * server and the client produce different markup, and that is React #418. So the query string
 * lives here and nowhere else in TypeScript, and the three ways to ask it are all safe:
 *
 *   - `prefersReducedMotion()`: from an effect or an event handler, never during render;
 *   - `useReducedMotion()`: during render, through `useSyncExternalStore` with a fixed server
 *     snapshot, so the first client render agrees with the server's HTML;
 *   - `REDUCED_QUERY` / `MOTION_QUERY`: for APIs that take a media query themselves, such as
 *     `gsap.matchMedia()` on `/` and Motion's `MotionConfig` in the Lab.
 *
 * CSS keeps its own `@media (prefers-reduced-motion: reduce)` blocks; those are not JavaScript and
 * cannot mismatch. `check:lab` rule 4 greps for any other reader. The canvas's seven effect-time
 * calls predate this file and are allowlisted there by path and count.
 *
 * No 'use client' directive: the server imports the query strings, and the functions below touch
 * `window` only when called.
 */

export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
export const MOTION_QUERY = '(prefers-reduced-motion: no-preference)'

/**
 * What the server assumes. "Reduced" is the honest answer when the question cannot be asked: a
 * server-rendered page that moves less than it might for one frame is harmless, and one that
 * starts an animation a reader asked not to see is not.
 */
const SERVER_SNAPSHOT = true

function query(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(REDUCED_QUERY)
}

/** Call from an effect or an event handler, never during render. True on the server. */
export function prefersReducedMotion(): boolean {
  return query()?.matches ?? SERVER_SNAPSHOT
}

/** Subscribes to changes of the preference, for `useSyncExternalStore` or a long-lived effect. */
export function subscribeReducedMotion(listener: () => void): () => void {
  const q = query()
  if (!q) return () => {}
  q.addEventListener('change', listener)
  return () => q.removeEventListener('change', listener)
}

const getServerSnapshot = () => SERVER_SNAPSHOT

/**
 * Reduced motion during render. Hydrates with the server's answer (`true`), then re-renders with
 * the reader's, so nothing about the first render depends on the browser.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, getServerSnapshot)
}
