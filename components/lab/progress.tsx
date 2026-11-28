'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { track } from '@/lib/events'
import { dotX, progress } from '@/lib/lab/view'
import { prefersReducedMotion } from '@/lib/motion/reduced'
import { EASE, LAB } from '@/lib/motion/tokens'

/** Where the dot rests before the trail reaches it: clear of the mark and the word "Lab". */
const DOT_MIN = { phone: 104, desktop: 120 }
const PHONE = 760
const DEPTHS = [25, 50, 75, 100] as const

/**
 * The reading progress: the trail and the dot (NEXT.md shortcut 1 and decision 13; DIRECTION, "The
 * reading progress").
 *
 *   p = clamp((scrollY − bodyTop) / (bodyEnd − innerHeight − bodyTop), 0, 1)   (lib/lab/view.ts)
 *
 * measured from the article's own top to `[data-body-end]`, which sits after the body and before
 * References, so finishing the text fills the trail exactly. The trail is `transform: scaleX(p)`
 * on a full-width element, written in one rAF per scroll frame (no layout per frame), and the dot
 * rides its end, following in 320ms. The dot blinks, looks toward the pointer, falls asleep after
 * 20s still, and hops into the footer only once p = 1 and the footer is in view. Under reduced
 * motion it stays still and never hops (rule 19). The same loop marks the bar as scrolled and, on a
 * phone, slides it away while reading down.
 *
 * Pages without an entry (the home, lists) show no trail; the dot rests.
 */
export function Progress() {
  const trailRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const trail = trailRef.current
    const dot = dotRef.current
    if (!trail || !dot) return
    const reduced = prefersReducedMotion()
    const bar = document.querySelector<HTMLElement>('[data-bar]')
    const path = location.pathname
    const sent = new Set<number>()
    let raf = 0
    let lastY = window.scrollY
    let lastX = -1
    let lastSquash = 0
    let away = false
    let inFooter = false
    let sleepTimer: ReturnType<typeof setTimeout> | undefined

    const flag = (el: Element | null, name: string, on: boolean) => {
      if (el) el.toggleAttribute(name, on)
    }
    const wake = () => {
      flag(dot, 'data-asleep', false)
      clearTimeout(sleepTimer)
      if (!reduced) sleepTimer = setTimeout(() => flag(dot, 'data-asleep', true), LAB.dot.sleepAfter)
    }

    const hop = (toFooter: boolean, line: Element | null) => {
      const from = dot.getBoundingClientRect()
      inFooter = toFooter
      if (toFooter && line) {
        const host = (dot.offsetParent as HTMLElement | null) ?? document.body
        const h = host.getBoundingClientRect()
        const r = line.getBoundingClientRect()
        dot.style.top = `${r.top - h.top - 11}px`
        dot.style.left = `${r.right - h.left - 22}px`
        dot.style.setProperty('--dot-x', '0px')
      } else {
        dot.style.top = ''
        dot.style.left = ''
      }
      flag(dot, 'data-in-footer', toFooter)
      const to = dot.getBoundingClientRect()
      dot.animate([{ translate: `${from.left - to.left}px ${from.top - to.top}px` }, { translate: '0 0' }], { duration: LAB.lead.duration, easing: EASE })
    }

    const measure = () => {
      raf = 0
      const y = window.scrollY
      const vh = window.innerHeight
      const w = document.documentElement.clientWidth
      const article = document.querySelector('article[data-entry]')
      const end = document.querySelector('[data-body-end]')
      let p = 0
      if (article && end) {
        const top = article.getBoundingClientRect().top + y
        const bottom = end.getBoundingClientRect().top + y
        // nothing is read before the first scroll, even on a page short enough to end on screen
        p = y > 4 ? progress(y, top, bottom, vh) : 0
      }
      trail.style.transform = `scaleX(${p})`
      flag(trail, 'data-on', !!article && p > 0)
      flag(bar, 'data-scrolled', y > 4)

      // a phone's bar slides away while reading down, and comes back on any scroll up; never while
      // one of its panels is open, since a sheet is the bar's own
      const phone = w <= PHONE
      if (!phone || y < 120 || bar?.querySelector('[aria-expanded="true"]')) away = false
      else if (y > lastY + 2) away = true
      else if (y < lastY - 2) away = false
      flag(bar, 'data-away', away)
      flag(trail, 'data-away', away)
      if (y !== lastY) wake()
      lastY = y

      if (article) for (const d of DEPTHS) if (p * 100 >= d && !sent.has(d)) {
        sent.add(d)
        track('read_depth', { path, depth: d })
      }

      if (reduced) {
        flag(dot, 'data-away', away)
        dot.style.setProperty('--dot-still', `${phone ? DOT_MIN.phone : DOT_MIN.desktop}px`)
        return
      }
      const line = document.querySelector('[data-footer] [data-foot-line]')
      const footIn = !!line && line.getBoundingClientRect().top < vh - 32
      const want = !!article && p >= 1 && footIn
      if (want !== inFooter) hop(want, line)
      flag(dot, 'data-away', away && !inFooter)
      if (inFooter) return
      const x = dotX(p, w, phone ? DOT_MIN.phone : DOT_MIN.desktop)
      dot.style.setProperty('--dot-x', `${x}px`)
      const now = performance.now()
      if (lastX >= 0 && Math.abs(x - lastX) > 3 && now - lastSquash > LAB.dot.follow) {
        lastSquash = now
        dot.querySelector('svg')?.animate([{ transform: 'scale(1.16, .84)' }, { transform: 'scale(1)' }], { duration: LAB.dot.follow, easing: EASE })
      }
      lastX = x
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }

    // the eyes follow a fine pointer
    const eyes = dot.querySelector<SVGGElement>('.look-at')
    let lookRaf = 0
    const onPointer = (e: PointerEvent) => {
      wake()
      if (reduced || !eyes || e.pointerType !== 'mouse' || lookRaf) return
      lookRaf = requestAnimationFrame(() => {
        lookRaf = 0
        const r = dot.getBoundingClientRect()
        const dx = e.clientX - (r.left + 11)
        const dy = e.clientY - (r.top + 11)
        const d = Math.hypot(dx, dy) || 1
        eyes.style.transform = `translate(${((dx / d) * 1.3).toFixed(2)}px, ${((dy / d) * 1.1).toFixed(2)}px)`
      })
    }

    const ro = new ResizeObserver(schedule)
    const article = document.querySelector('article[data-entry]')
    if (article) ro.observe(article)
    ro.observe(document.documentElement)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('pointermove', onPointer, { passive: true })
    if (inFooter) hop(false, null)
    measure()
    wake()
    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(lookRaf)
      clearTimeout(sleepTimer)
      ro.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pointermove', onPointer)
      // a soft navigation puts the dot back in the bar for the next page
      flag(dot, 'data-in-footer', false)
      dot.style.top = ''
      dot.style.left = ''
    }
  }, [pathname])

  return (
    <>
      <div ref={trailRef} className="lab-trail" data-trail aria-hidden="true" />
      <div ref={dotRef} className="lab-dot" data-reading-dot aria-hidden="true">
        <svg viewBox="0 0 22 22">
          <circle className="body" cx="11" cy="11" r="9.5" />
          <g className="look-at">
            <g className="eyes">
              <circle className="eye" cx="7.8" cy="10" r="1.45" />
              <circle className="eye" cx="14.2" cy="10" r="1.45" />
            </g>
          </g>
          <circle className="cheek" cx="5.6" cy="13.6" r="1.6" />
          <circle className="cheek" cx="16.4" cy="13.6" r="1.6" />
        </svg>
        <span data-dot>z</span>
      </div>
    </>
  )
}
