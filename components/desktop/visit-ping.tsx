'use client'

import { useEffect } from 'react'

import { noteReferrer } from '@/lib/opens'
import { markVisit } from '@/lib/visits'

/**
 * Records one visit, then renders nothing.
 *
 * This lives at page level rather than inside the Visitors card on purpose: a card only mounts
 * when someone opens it, so counting from there would count "people who found the Visitors
 * card", not people who came to the site.
 *
 * A visit is counted on the first physical input — a pointer press, a key, a wheel tick or a
 * touch — not on page load. The user-agent filter on the server catches crawlers that say what
 * they are, but a scraper driving a real browser sends a real UA and a real Referer, and the
 * counter was two months into tallying a fleet of them as readers. What none of them produce is
 * input: `window.scrollTo` fires `scroll`, never `wheel`, so programmatic scrolling for lazy
 * content does not count either. That is why `scroll` is deliberately not in the list.
 *
 * The listeners are on `window`, capture phase, so nothing that stops propagation (the smooth
 * scroller takes wheel events) can starve them. `once` is not used because any one of them
 * firing must remove all of them.
 *
 * The module-level flag, not a ref, is what makes it exactly once — React's dev StrictMode runs
 * every effect twice, and a ref is per-instance, so it would not have caught it.
 */
let armed = false

const INPUT = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

export function VisitPing() {
  useEffect(() => {
    if (armed) return
    armed = true
    // the personal counter is local and costs nothing, so it still runs on load
    markVisit()

    const opts = { capture: true, passive: true } as const
    const fire = () => {
      for (const type of INPUT) removeEventListener(type, fire, opts)
      noteReferrer()
      // keepalive so the request survives someone bouncing straight back off the page
      fetch('/api/visitors', { method: 'POST', keepalive: true }).catch(() => {
        /* counting is the least important thing on this page */
      })
    }
    for (const type of INPUT) addEventListener(type, fire, opts)
  }, [])

  return null
}
