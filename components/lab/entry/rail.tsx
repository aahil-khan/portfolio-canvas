'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import type { TocItem } from '@/components/lab/entry/body'
import { prefersReducedMotion } from '@/lib/motion/reduced'
import { LAB } from '@/lib/motion/tokens'

/**
 * The rail (decision 6, NEXT.md shortcut 5; DIRECTION "Layout"). From 1200px it is a sticky column
 * beside the text, centred with it, scrolling on its own when taller than the screen; below that,
 * a block after the text without On this page or its copy of Share (CSS does both).
 *
 * It waits for the first scroll: `data-waiting` until the reader is a quarter of a screen down,
 * found by an IntersectionObserver on a sentinel 25vh tall at the top of the page, so a short
 * entry's first screen stays the lead and the text (rules 5 and 7). A page too short to scroll
 * that far shows it at once. With JavaScript off the attribute is inert (its CSS needs
 * `scripting: enabled`), so the rail is simply there.
 *
 * On this page marks the heading being read (`aria-current="location"`): the last heading to pass a
 * line just under the bar, found by an IntersectionObserver on the headings. Its accent bar slides
 * between them in 180ms.
 */
export function Rail({ label, toc, children }: { label: string; toc: TocItem[]; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  // waiting for the first quarter-screen of scroll
  useEffect(() => {
    const rail = ref.current
    const sentinel = document.querySelector('[data-rail-sentinel]')
    if (!rail) return
    const reveal = (on: boolean) => rail.toggleAttribute('data-waiting', !on)
    const short = () => document.documentElement.scrollHeight - window.innerHeight < window.innerHeight * LAB.rail.after
    if (!sentinel || short()) {
      // a page too short to scroll: the rail shows at once, without its copy of Share, since the
      // one at the end is on the same screen (mockup README, "The entry rail")
      rail.toggleAttribute('data-short', true)
      reveal(true)
      return
    }
    const io = new IntersectionObserver(([e]) => reveal(!e.isIntersecting || short()))
    io.observe(sentinel)
    return () => io.disconnect()
  }, [])

  // On this page: the heading being read
  useEffect(() => {
    const rail = ref.current
    if (!rail || toc.length < 2) return
    const heads = toc.map((t) => document.getElementById(t.id)).filter((h): h is HTMLElement => !!h)
    const links = [...rail.querySelectorAll<HTMLAnchorElement>('[data-toc] a')]
    const bar = rail.querySelector<HTMLElement>('[data-toc-bar]')
    let current = -2
    /** The reading line: just under the bar. The heading being read is the last one above it. */
    const lineY = () => (document.querySelector('[data-bar]')?.getBoundingClientRect().bottom ?? 56) + 32
    const mark = () => {
      const line = lineY() + 1
      let cur = -1
      heads.forEach((h, i) => {
        if (h.getBoundingClientRect().top <= line) cur = i
      })
      if (cur === current) return
      current = cur
      links.forEach((a, i) => (i === cur ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')))
      if (bar) {
        const a = links[cur]
        bar.style.opacity = a ? '1' : '0'
        if (a) {
          bar.style.height = `${a.offsetHeight}px`
          bar.style.transform = `translateY(${a.offsetTop}px)`
        }
      }
    }
    // Observers say when a heading crosses the reading line (one watches below it, one the strip above
    // it); rects are read then, never per scroll frame. A jump far enough to carry a heading past the
    // whole screen crosses neither, so the end of any scroll marks once more.
    const line = Math.round(lineY())
    const below = new IntersectionObserver(mark, { rootMargin: `-${line}px 0px 0px 0px` })
    const above = new IntersectionObserver(mark, { rootMargin: `0px 0px -${Math.max(0, window.innerHeight - line)}px 0px` })
    heads.forEach((h) => (below.observe(h), above.observe(h)))
    window.addEventListener('scrollend', mark)
    mark()
    // a jump from the list scrolls the heading clear of the bar
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('[data-toc] a')
      if (!a) return
      const h = document.getElementById(a.getAttribute('href')!.slice(1))
      if (!h) return
      e.preventDefault()
      const y = h.getBoundingClientRect().top + window.scrollY - 72
      if (window.__lenis && !prefersReducedMotion()) window.__lenis.scrollTo(y)
      else window.scrollTo({ top: y, behavior: 'instant' })
      history.replaceState(null, '', `#${h.id}`)
    }
    rail.addEventListener('click', onClick)
    return () => {
      below.disconnect()
      above.disconnect()
      window.removeEventListener('scrollend', mark)
      rail.removeEventListener('click', onClick)
    }
  }, [toc])

  return (
    <aside ref={ref} className="lab-rail" data-rail data-waiting="" data-lenis-prevent aria-label={label}>
      {children}
    </aside>
  )
}

/** On this page: the entry's headings, when it has two or more. Desktop only (CSS). */
export function Toc({ title, toc }: { title: string; toc: TocItem[] }) {
  if (toc.length < 2) return null
  return (
    <nav className="lab-toc lab-rail-wide" data-toc aria-labelledby="lab-toc-h">
      <h2 className="end-h" id="lab-toc-h">
        {title}
      </h2>
      <div style={{ position: 'relative' }}>
        <span className="lab-toc-bar" data-toc-bar aria-hidden="true" />
        <ol>
          {toc.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`}>{t.text}</a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}
