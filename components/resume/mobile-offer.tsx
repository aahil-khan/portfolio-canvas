'use client'

import { useEnterInteractive } from '@/components/desktop/mobile-mode'
import { mobile } from '@/content'

/**
 * The offer, above the résumé on a phone.
 *
 * Stated plainly rather than sold: the canvas is genuinely better with a pointer, and a visitor
 * who taps through after being told that is choosing it, not being ambushed by it. It sits at the
 * top so it is the first thing read and then scrolls away, instead of holding screen space for
 * the whole document.
 */
export function MobileOffer() {
  const enter = useEnterInteractive()

  return (
    <aside className="m-offer">
      <p className="m-offer__title">{mobile.offerTitle}</p>
      <p className="m-offer__body">{mobile.offerBody}</p>
      <button type="button" className="m-offer__go" onClick={enter}>
        {mobile.offerAction}
        <span aria-hidden> →</span>
      </button>
    </aside>
  )
}
