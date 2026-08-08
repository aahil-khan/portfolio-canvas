'use client'

import { useSyncExternalStore } from 'react'

/**
 * Is this a phone-shaped, touch-driven viewport?
 *
 * An infinite canvas needs a pointer that can hover and a viewport wide enough to pan around
 * in. Neither holds on a phone, so the site serves a different shell there rather than a
 * squeezed version of this one.
 *
 * `pointer: coarse` is the outer gate, and it does the heavy lifting: it means touch is the
 * primary input, which excludes both a narrow desktop window and a touchscreen laptop (whose
 * trackpad still reports `fine`). On its own it would catch tablets, so a size test narrows it
 * to phones.
 *
 * That size test needs *either* dimension, because a phone turned sideways is short rather than
 * narrow. A landscape iPhone is 844×390 — well past the 760px width gate, which is why it used
 * to fall through to the canvas. 520px sits in the gap between the tallest landscape phone
 * (~430px) and the shortest landscape tablet (768px), so tablets keep the canvas either way up.
 */
export const MOBILE_QUERY = '((max-width: 760px) or (max-height: 520px)) and (pointer: coarse)'

/**
 * Runs in <head> before first paint and stamps `data-mobile` on <html>.
 *
 * React can't know the viewport during SSR, so the first client render must match the server's
 * (desktop) markup or hydration breaks. This attribute lets CSS hide the canvas chrome
 * immediately, so the moment before React swaps shells shows an empty page rather than a
 * broken 717px-wide dock jammed into a 390px screen.
 */
export const mobileBootScript = `
(function(){try{
  if (matchMedia(${JSON.stringify(MOBILE_QUERY)}).matches)
    document.documentElement.dataset.mobile = '1';
}catch(e){}})();
`

function subscribe(onChange: () => void): () => void {
  const mq = matchMedia(MOBILE_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

const getSnapshot = () => matchMedia(MOBILE_QUERY).matches

/**
 * False during SSR and hydration, then correct. `useSyncExternalStore` re-renders with the real
 * value straight after hydration, which is the supported way to do this without a mismatch.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
