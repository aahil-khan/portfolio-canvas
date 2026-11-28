'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import type { TocItem } from '@/components/lab/entry/body'
import { prefersReducedMotion } from '@/lib/motion/reduced'

/**
 * The rail (decision 6, revised 27 Nov; DIRECTION "Layout"). From 1200px in the Side panel layout it
 * is a column beside the text, centred with it and there from the first screen: one sticky box as
 * tall as the room under the bar, whose sections (On this page, Share, Links to this page, Related,
 * Tags) each keep their heading and scroll their own list when it is long (CSS). Below 1200px, and
 * in the Centred layout, it is a block after the text, without On this page or its copy of Share.
 *
 * On this page marks the heading being read (`aria-current="location"`): the last heading to pass a
 * line just under the bar, found by an IntersectionObserver on the headings. Its accent bar slides
 * between them in 180ms, and its list scrolls to keep the marked heading in view.
 */
export function Rail({ label, toc, children }: { label: string; toc: TocItem[]; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  // each scrolling list says whether there is more below or above it (`data-more`, `data-less`), so
  // CSS can fade that edge: a reader sees a list continues even where scrollbars are hidden
  useEffect(() => {
    const rail = ref.current
    if (!rail) return
    const lists = [...rail.querySelectorAll<HTMLElement>('[data-rail-list]')]
    const edge = (l: HTMLElement) => {
      l.toggleAttribute('data-more', l.scrollTop + l.clientHeight < l.scrollHeight - 2)
      l.toggleAttribute('data-less', l.scrollTop > 2)
    }
    const ro = new ResizeObserver(() => lists.forEach(edge))
    const onScroll = (e: Event) => edge(e.currentTarget as HTMLElement)
    for (const l of lists) {
      ro.observe(l)
      if (l.firstElementChild) ro.observe(l.firstElementChild)
      l.addEventListener('scroll', onScroll, { passive: true })
      edge(l)
    }
    return () => {
      ro.disconnect()
      for (const l of lists) l.removeEventListener('scroll', onScroll)
    }
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
      const a = links[cur]
      if (bar) {
        bar.style.opacity = a ? '1' : '0'
        if (a) {
          bar.style.height = `${a.offsetHeight}px`
          bar.style.transform = `translateY(${a.offsetTop}px)`
        }
      }
      // keep the marked heading in view inside its own list, never by scrolling the page
      const list = a?.closest<HTMLElement>('[data-rail-list]')
      if (a && list && list.scrollHeight > list.clientHeight) {
        const lr = list.getBoundingClientRect()
        const ar = a.getBoundingClientRect()
        if (ar.top < lr.top) list.scrollTop -= lr.top - ar.top + 8
        else if (ar.bottom > lr.bottom) list.scrollTop += ar.bottom - lr.bottom + 8
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
    <aside ref={ref} className="lab-rail" data-rail aria-label={label}>
      <div className="lab-rail-in" data-rail-in>
        {children}
      </div>
    </aside>
  )
}

/** On this page: the entry's headings, when it has two or more. Desktop only (CSS). */
export function Toc({ title, toc }: { title: string; toc: TocItem[] }) {
  if (toc.length < 2) return null
  return (
    <nav className="lab-toc lab-rail-wide lab-rail-sec" data-toc data-rail-section="toc" aria-labelledby="lab-toc-h">
      <h2 className="end-h" id="lab-toc-h">
        {title}
      </h2>
      <RailList>
        <div className="lab-toc-track">
          <span className="lab-toc-bar" data-toc-bar aria-hidden="true" />
          <ol>
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`}>{t.text}</a>
              </li>
            ))}
          </ol>
        </div>
      </RailList>
    </nav>
  )
}

/** A rail section's list: from 1200px it scrolls on its own when long (CSS), apart from the page. */
export function RailList({ children }: { children: ReactNode }) {
  return (
    <div className="lab-rail-list" data-rail-list data-lenis-prevent>
      {children}
    </div>
  )
}
