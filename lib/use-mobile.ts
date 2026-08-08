'use client'

import { useSyncExternalStore } from 'react'

/**
 * Is this a phone-shaped, touch-driven viewport?
 *
 * An infinite canvas needs a pointer that can hover and a viewport wide enough to pan around
 * in. Neither holds on a phone, so the site serves a different shell there rather than a
 * squeezed version of this one.
 *
 * Both conditions matter. Width alone would catch a narrow desktop window, where the canvas is
 * still perfectly usable with a mouse; `pointer: coarse` alone would catch a large tablet or a
 * touchscreen laptop, where it is also fine. Only when the viewport is *both* narrow and
 * touch-only is panning genuinely a bad idea.
 */
export const MOBILE_QUERY = '(max-width: 760px) and (pointer: coarse)'

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
