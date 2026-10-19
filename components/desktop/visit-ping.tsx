'use client'

import { useEffect } from 'react'

import { noteReferrer } from '@/lib/opens'
import { INPUT_TYPES, type Ping } from '@/lib/ping'
import { markVisit } from '@/lib/visits'

/**
 * Records one visit, then renders nothing.
 *
 * This lives at page level rather than inside the Visitors card on purpose: a card only mounts
 * when someone opens it, so counting from there would count "people who found the Visitors
 * card", not people who came to the site.
 *
 * What counts as a visit has been tightened twice, each time against a fleet of scrapers that
 * arrive from github.com at a flat ~130 a day across a hundred countries. A user-agent filter on
 * the server caught the crawlers that say what they are. Waiting for the first physical input —
 * a pointer press, a key, a wheel tick or a touch — was meant to catch the rest, and did not
 * move the daily number at all: whatever drives those browsers scrolls and clicks through the
 * DevTools protocol, which arrives as trusted input exactly like a hand would.
 *
 * So a visit is now: trusted input, from a browser that does not admit to being automated, that
 * is still here `DWELL_MS` after it loaded. A script grabs the page and leaves in a second or
 * two. A person who leaves inside eight seconds was not reading either. And every ping carries a
 * few coarse facts about the session, so when this is wrong again the stats page can show how
 * instead of leaving it to be guessed a third time.
 *
 * `scroll` is deliberately not an input: `window.scrollTo` for lazy content fires it, and a
 * wheel never does. `isTrusted` is checked because `dispatchEvent` can fake any of the four.
 *
 * The listeners are on `window`, capture phase, so nothing that stops propagation (the smooth
 * scroller takes wheel events) can starve them. `once` is not used because any one of them
 * firing must remove all of them.
 *
 * The module-level flag, not a ref, is what makes it exactly once — React's dev StrictMode runs
 * every effect twice, and a ref is per-instance, so it would not have caught it.
 */
let armed = false

/** How long someone has to stay before they count. */
const DWELL_MS = 8000

export function VisitPing() {
  useEffect(() => {
    if (armed) return
    armed = true
    // the personal counter is local and costs nothing, so it still runs on load
    markVisit()

    const t0 = performance.now()
    const opts = { capture: true, passive: true } as const

    const fire = (e: Event) => {
      if (!e.isTrusted) return
      for (const type of INPUT_TYPES) removeEventListener(type, fire, opts)
      const input = Math.round(performance.now() - t0)

      const send = () => {
        // the listener only ever sees the four types in INPUT_TYPES
        const ping: Ping = {
          via: e.type as Ping['via'],
          input,
          webdriver: navigator.webdriver === true,
          width: innerWidth,
          focus: document.hasFocus(),
        }
        noteReferrer()
        // keepalive so the request survives someone bouncing straight back off the page
        fetch('/api/visitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ping),
          keepalive: true,
        }).catch(() => {
          /* counting is the least important thing on this page */
        })
      }

      const left = DWELL_MS - (performance.now() - t0)
      if (left <= 0) send()
      else setTimeout(send, left)
    }

    for (const type of INPUT_TYPES) addEventListener(type, fire, opts)
  }, [])

  return null
}
