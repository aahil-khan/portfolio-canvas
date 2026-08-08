'use client'

import { useEffect } from 'react'

import { noteReferrer } from '@/lib/opens'
import { markVisit } from '@/lib/visits'

/**
 * Records one page load, then renders nothing.
 *
 * This lives at page level rather than inside the Visitors card on purpose: a card only mounts
 * when someone opens it, so counting from there would count "people who found the Visitors
 * card", not people who came to the site.
 *
 * The module-level flag, not a ref, is what makes it exactly once — React's dev StrictMode runs
 * every effect twice, and a ref is per-instance, so it would not have caught it.
 */
let pinged = false

export function VisitPing() {
  useEffect(() => {
    if (pinged) return
    pinged = true
    markVisit()
    noteReferrer()
    // keepalive so the request survives someone bouncing straight back off the page
    fetch('/api/visitors', { method: 'POST', keepalive: true }).catch(() => {
      /* counting is the least important thing on this page */
    })
  }, [])

  return null
}
