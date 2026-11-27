'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Soft navigation for links inside entry bodies. Bodies are rendered on the server to plain `<a>`
 * elements (API.md §5: every link is a real, server-rendered `<a>` with an `href`), so one
 * delegated listener turns a plain left click on a link to another Lab page into a client
 * navigation, which keeps the bar, the Sound menu and the reading state, and lets the column
 * transition run. Everything else (new tab, modifiers, links out, `#` jumps) is left to the browser.
 * Pages are prefetched on the first hover or focus.
 *
 * PR 10's preview controller listens on the same links; on touch it takes the first tap itself and
 * calls `preventDefault()`, which this listener respects.
 */
export function SoftNav() {
  const router = useRouter()
  useEffect(() => {
    const prefetched = new Set<string>()
    const internal = (t: EventTarget | null): HTMLAnchorElement | null => {
      const a = t instanceof Element ? t.closest('a[href]') : null
      if (!(a instanceof HTMLAnchorElement)) return null
      if (a.target && a.target !== '_self') return null
      if (a.hasAttribute('download')) return null
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin || !/^\/lab(?:\/|$)/.test(url.pathname)) return null
      return a
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = internal(e.target)
      if (!a) return
      const url = new URL(a.href)
      if (url.pathname === location.pathname && url.search === location.search) return // a jump within the page
      e.preventDefault()
      router.push(url.pathname + url.search + url.hash, { scroll: false })
    }
    const onIntent = (e: Event) => {
      const a = internal(e.target)
      if (!a) return
      const path = new URL(a.href).pathname
      if (path === location.pathname || prefetched.has(path)) return
      prefetched.add(path)
      router.prefetch(path)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('pointerover', onIntent, { passive: true })
    document.addEventListener('focusin', onIntent)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('pointerover', onIntent)
      document.removeEventListener('focusin', onIntent)
    }
  }, [router])
  return null
}
