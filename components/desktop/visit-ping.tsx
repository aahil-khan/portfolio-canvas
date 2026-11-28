'use client'

import { useEffect } from 'react'

import { onDecision } from '@/lib/admission'
import { noteReferrer } from '@/lib/opens'
import type { Ping } from '@/lib/ping'
import { markVisit } from '@/lib/visits'

/**
 * Records one visit, then renders nothing. Mounted on `/` and `/canvas`.
 *
 * This lives at page level rather than inside the Visitors card on purpose: a card only mounts
 * when someone opens it, so counting from there would count "people who found the Visitors
 * card", not people who came to the site.
 *
 * What counts as a visit has been tightened twice, each time against a fleet of scrapers that
 * arrive from github.com at a flat ~130 a day across a hundred countries. A user-agent filter on
 * the server caught the crawlers that say what they are. Waiting for the first physical input was
 * meant to catch the rest, and did not move the daily number at all: whatever drives those
 * browsers scrolls and clicks through the DevTools protocol, which arrives as trusted input
 * exactly like a hand would. So a visit is trusted input, from a browser that does not admit to
 * being automated, that is still here eight seconds after it loaded.
 *
 * That rule now lives in `lib/admission.ts`, the gate every counter shares, and this component
 * only reports its decision for this page load. A refused one (webdriver) is still reported, so
 * the server's `rej:webdriver` counter on /stats keeps counting; the server turns it away.
 *
 * The module-level flag, not a ref, is what makes it exactly once per page load: React's dev
 * StrictMode runs every effect twice, and a client navigation from `/` to `/canvas` mounts this
 * again in the same document.
 */
let armed = false

export function VisitPing() {
  useEffect(() => {
    if (armed) return
    armed = true
    // the personal counter is local and costs nothing, so it still runs on load
    markVisit()

    onDecision((d) => {
      const ping: Ping = {
        via: d.via,
        input: d.input,
        webdriver: d.webdriver,
        width: innerWidth,
        focus: document.hasFocus(),
      }
      if (d.admitted) noteReferrer()
      // keepalive so the request survives someone bouncing straight back off the page
      fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ping),
        keepalive: true,
      }).catch(() => {
        /* counting is the least important thing on this page */
      })
    })
  }, [])

  return null
}
