'use client'

/**
 * Queues "this card was opened" and flushes it in batches.
 *
 * One request per card open would be a request every time someone clicks the dock, on a canvas
 * whose whole point is that clicking things is cheap. So opens accumulate in a Set and go out
 * together — on a short debounce, and again with `sendBeacon` when the page is being hidden,
 * which is the only send that survives a tab close.
 *
 * A Set, not an array: opening the same card six times in one visit says the same thing as
 * opening it once, and counting the fidget would make the numbers useless.
 */

const queue = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false

function send(useBeacon: boolean): void {
  if (!queue.size) return
  const body = JSON.stringify({ opens: [...queue] })
  queue.clear()
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  try {
    // sendBeacon is the only thing guaranteed to go out once the page is being torn down
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/opens', new Blob([body], { type: 'application/json' }))
      return
    }
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

export function noteOpen(id: string): void {
  if (typeof window === 'undefined' || !id) return
  queue.add(id)

  if (!listening) {
    listening = true
    /*
     * `pagehide`, not `beforeunload`: beforeunload is ignored on mobile Safari and disables the
     * back-forward cache everywhere. `visibilitychange` covers tab switches, where a phone may
     * never fire pagehide at all.
     */
    addEventListener('pagehide', () => send(true))
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') send(true)
    })
  }

  if (timer) clearTimeout(timer)
  timer = setTimeout(() => send(false), 4000)
}

/** The referring site, once per visit. Same-origin and direct traffic are not referrers. */
export function noteReferrer(): void {
  if (typeof window === 'undefined') return
  try {
    if (!document.referrer) return
    const host = new URL(document.referrer).hostname
    if (!host || host === location.hostname) return
    void fetch('/api/opens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: host }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* a malformed referrer is not worth an exception */
  }
}
