'use client'

import { useEffect, useRef, useSyncExternalStore, type ElementType, type ReactNode } from 'react'

import { track } from '@/lib/events'
import { prefersReducedMotion, useReducedMotion } from '@/lib/motion/reduced'
import { EASE_BEZIER, LAB, REDUCED, sec } from '@/lib/motion/tokens'

/**
 * What every instrument's client island shares.
 *
 * **The draw.** A lead draws once, on first view, in 450ms with a 30ms stagger
 * (DIRECTION, "Motion and hover timing"). The draw is CSS (`instruments.css`, `[data-draw]`),
 * gated on `(scripting: enabled) and (prefers-reduced-motion: no-preference)`, so it runs from the
 * first paint, before hydration: a lead on the first screen never flashes drawn and then undrawn,
 * nothing is ever stuck undrawn where this island never hydrates (a page fetched into a preview
 * window), and with JavaScript off or reduced motion the lead is simply there. A figure in the body
 * does not draw. `Drawn` adds the "on first view" half for a lead that is not on the screen when
 * the page hydrates (a page restored scrolled down): its draw is rewound and paused, and plays the
 * first time a fifth of it scrolls into view.
 *
 * **Enters and exits** inside an instrument (a new line in the haggle, a scenario swapped in) are
 * Motion's (`m`, under the Lab's `LazyMotion`), on `enter()`'s values: a preview window's 180ms
 * rise of 6px, out in 120ms and 4px down; under reduced motion, opacity only, in 120ms.
 */

/** Nothing changes it, but React reads the snapshot again once subscribed, after hydration. */
const onceAfterHydration = (changed: () => void) => {
  queueMicrotask(changed)
  return () => {}
}
const yes = () => true
const no = () => false

/** False on the server and the first client render, true once hydrated: for things only JavaScript can do. */
export function useReady(): boolean {
  return useSyncExternalStore(onceAfterHydration, yes, no)
}

/** API.md §7: a cue for the sound lane (PR 12), which plays it if sound is on. */
export function cue(name: 'counter' | 'deal' | 'turn'): void {
  document.dispatchEvent(new CustomEvent('lab:cue', { detail: { name } }))
}

/** `lead_use`, once per instrument per page view, the first time a reader works it. */
export function useLeadUse(lead: string): () => void {
  const used = useRef(false)
  return () => {
    if (used.current) return
    used.current = true
    track('lead_use', { path: location.pathname.replace(/\/$/, '') || '/lab', lead })
  }
}

/** Motion's props for something entering and leaving inside an instrument. */
export function useEnter() {
  const reduced = useReducedMotion()
  if (reduced) {
    const t = { duration: sec(REDUCED.maxDuration), ease: EASE_BEZIER }
    return { initial: { opacity: 0 }, animate: { opacity: 1, transition: t }, exit: { opacity: 0, transition: t } }
  }
  const w = LAB.windowIn
  return {
    initial: { opacity: 0, y: w.rise },
    animate: {
      opacity: 1,
      y: 0,
      transition: { y: { duration: sec(w.duration), ease: EASE_BEZIER }, opacity: { duration: sec(w.opacity), ease: EASE_BEZIER } },
    },
    exit: { opacity: 0, y: LAB.windowOut.drop, transition: { duration: sec(LAB.windowOut.duration), ease: EASE_BEZIER } },
  }
}

/** How much of a figure must be in view before it draws. */
const IN_VIEW = 0.2

/**
 * A lead that draws on first view. Server-rendered as a plain element holding its
 * children; the only thing the client adds is the pause-until-seen described above.
 */
export function Drawn({ as: Tag = 'div', className, children, ...rest }: { as?: ElementType; className?: string; children: ReactNode } & Record<`data-${string}`, string | undefined>) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return
    const anims = () => root.getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation && a.animationName.startsWith('lab-draw'))
    const r = root.getBoundingClientRect()
    const seen = r.top < innerHeight && r.bottom > 0
    if (seen) return
    const list = anims()
    if (!list.length) return
    for (const a of list) {
      a.pause()
      a.currentTime = 0
    }
    root.setAttribute('data-draw-wait', '')
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        root.removeAttribute('data-draw-wait')
        for (const a of list) a.play()
      },
      { threshold: IN_VIEW },
    )
    io.observe(root)
    return () => io.disconnect()
  }, [])
  return (
    <Tag ref={ref} className={className} data-drawn="" {...rest}>
      {children}
    </Tag>
  )
}

/** The clipboard, and the old selection trick where the async API is missing or refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}
