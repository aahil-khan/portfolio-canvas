import Link from 'next/link'

import { mobile } from '@/content'

import '@/app/desk-only.css'

/**
 * What `/canvas` shows on a phone.
 *
 * Two earlier answers to "what does a touch device get here?" are gone. It used to land on the
 * résumé with an offer to try the canvas anyway, and behind that offer was a cut-down touch
 * shell — a dock and full-height sheets standing in for the canvas. The scrolling site at `/` is
 * the honest version of the first, and the second was never finished; a half-built canvas is a
 * worse answer than a clear no.
 *
 * So: one screen, no shell, nothing mounted. The way in is the browser's own desktop-site switch,
 * which works better than anything reimplemented here — it gives the real canvas at a real
 * viewport width rather than an approximation of it.
 *
 * A server component with no JavaScript of its own: a phone that cannot use the canvas should not
 * be made to download it.
 */
export function DeskOnly() {
  return (
    <div data-scroll-page>
      <div className="deskonly">
        <p className="deskonly__eyebrow">{mobile.heroNote}</p>
        <h1>{mobile.onlyDesktopTitle}</h1>
        <p className="deskonly__body">{mobile.onlyDesktopBody}</p>
        <p className="deskonly__try">{mobile.onlyDesktopTry}</p>
        <Link className="deskonly__back" href="/">
          <span aria-hidden>←</span> {mobile.onlyDesktopBack}
        </Link>
      </div>
    </div>
  )
}
