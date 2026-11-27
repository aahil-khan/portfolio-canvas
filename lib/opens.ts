'use client'

/**
 * Queues "this card was opened" and flushes it in batches, once the tab is admitted.
 *
 * One request per card open would be a request every time someone clicks the dock, on a canvas
 * whose whole point is that clicking things is cheap. So opens accumulate in a Set and go out
 * together — on a short debounce, and again with `sendBeacon` when the page is being hidden,
 * which is the only send that survives a tab close.
 *
 * Nothing goes out before the site's admission gate (`lib/admission.ts`) has let the tab in:
 * trusted input, no webdriver, eight seconds of dwell. Before that gate, this posted on the first
 * card open, so the scraper fleet the visit gate was built against filled this table too. Opens
 * queued before admission go out in one batch the moment it arrives; a tab that is never
 * admitted sends none.
 *
 * A Set, not an array: opening the same card six times in one visit says the same thing as
 * opening it once, and counting the fidget would make the numbers useless.
 */

import { isAdmitted, whenAdmitted } from './admission.ts'

const queue = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false
let waiting = false

function post(body: string, useBeacon: boolean): void {
  try {
    // sendBeacon is the only thing guaranteed to go out once the page is being torn down
    if (useBeacon && navigator.sendBeacon?.('/api/opens', new Blob([body], { type: 'application/json' }))) return
    void fetch('/api/opens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* counting is the least important thing on this page */
  }
}

function send(useBeacon: boolean): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!queue.size) return
  const body = JSON.stringify({ opens: [...queue] })
  queue.clear()
  post(body, useBeacon)
}

export function noteOpen(id: string): void {
  if (typeof window === 'undefined' || !id) return
  queue.add(id)

  if (!listening) {
    listening = true
    /*
     * `pagehide`, not `beforeunload`: beforeunload is ignored on mobile Safari and disables the
     * back-forward cache everywhere. `visibilitychange` covers tab switches, where a phone may
     * never fire pagehide at all. Only an admitted tab sends on the way out.
     */
    const hide = () => {
      if (isAdmitted()) send(true)
    }
    addEventListener('pagehide', hide)
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') hide()
    })
  }

  if (isAdmitted()) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => send(false), 4000)
  } else if (!waiting) {
    waiting = true
    whenAdmitted(() => {
      waiting = false
      send(false)
    })
  }
}

/**
 * The referring site, once per counted visit. Same-origin and direct traffic are not referrers.
 * Sent by `<VisitPing/>` when its page load is admitted, so the two tallies count the same people.
 */
export function noteReferrer(): void {
  if (typeof window === 'undefined') return
  try {
    if (!document.referrer) return
    const host = new URL(document.referrer).hostname
    if (!host || host === location.hostname) return
    post(JSON.stringify({ ref: host }), false)
  } catch {
    /* a malformed referrer is not worth an exception */
  }
}
