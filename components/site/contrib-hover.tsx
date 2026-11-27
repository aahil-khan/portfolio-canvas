'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

import { cellAt, CELL, STEP } from '@/lib/contrib-grid'

/*
 * The calendar's hover, as GitHub's: a dark tooltip above the square, and a ring on it.
 *
 * An enhancement over a calendar that is already complete: with JavaScript off each square's
 * `<title>` is the native tooltip, and this renders exactly the same markup until it mounts.
 * Mounted, it sets `data-hover`, which turns the squares' own pointer events off (site.css) so the
 * native tooltip no longer doubles the styled one, and listens on the SVG alone, finding the
 * square under the pointer by arithmetic (`cellAt`) rather than with a listener per square. The
 * sentence it shows is read from that square's `<title>`, so the two can never disagree.
 *
 * Positions are written to the DOM directly: React renders once on mount, not per square.
 */

/** The gap between the square's top and the tooltip's caret. */
const LIFT = 8

export function ContribHover({ weeks, children }: { weeks: number; children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    const root = body.current
    const svg = root?.querySelector('svg')
    const scroll = root?.querySelector('.contrib__scroll')
    const t = tip.current
    const r = ring.current
    if (!root || !svg || !scroll || !t || !r) return

    // week,day → the square's sentence; padding slots have no square, so no entry
    const said = new Map<string, string>()
    for (const rect of svg.querySelectorAll('rect')) {
      const week = Math.floor(Number(rect.getAttribute('x')) / STEP)
      const day = Math.floor(Number(rect.getAttribute('y')) / STEP)
      said.set(`${week},${day}`, rect.querySelector('title')?.textContent ?? '')
    }

    let shown: string | null = null
    const hide = () => {
      shown = null
      t.hidden = true
      r.hidden = true
    }

    const show = (e: PointerEvent) => {
      const s = svg.getBoundingClientRect()
      // CSS scales the SVG to fill the block: rendered px per SVG unit
      const k = s.width / svg.viewBox.baseVal.width
      const at = cellAt((e.clientX - s.left) / k, (e.clientY - s.top) / k, weeks)
      // in a gap, keep the last square: moving between neighbours should not flicker
      if (!at) return
      const key = `${at.week},${at.day}`
      const text = said.get(key)
      if (text === undefined) return hide()
      if (key === shown) return
      shown = key

      const b = root.getBoundingClientRect()
      const x = s.left - b.left + at.week * STEP * k
      const y = s.top - b.top + at.day * STEP * k
      r.style.width = r.style.height = `${CELL * k}px`
      r.style.transform = `translate(${x}px, ${y}px)`
      r.hidden = false

      t.textContent = text
      t.hidden = false
      // centred on the square, then held inside the block so it never clips at either end
      const w = t.offsetWidth
      const mid = x + (CELL * k) / 2
      const left = Math.min(Math.max(0, mid - w / 2), Math.max(0, b.width - w))
      t.style.transform = `translate(${left}px, ${y - t.offsetHeight - LIFT}px)`
      t.style.setProperty('--caret', `${mid - left}px`)
    }

    const onDown = (e: PointerEvent) => {
      // a tap shows the day and leaves it up until the next tap or a scroll
      if (e.pointerType !== 'mouse') show(e)
    }
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hide()
    }
    const onOutside = (e: PointerEvent) => {
      if (shown && !svg.contains(e.target as Node)) hide()
    }

    svg.addEventListener('pointermove', show)
    svg.addEventListener('pointerdown', onDown)
    svg.addEventListener('pointerleave', onLeave)
    scroll.addEventListener('scroll', hide, { passive: true })
    document.addEventListener('pointerdown', onOutside)
    setOn(true)
    return () => {
      svg.removeEventListener('pointermove', show)
      svg.removeEventListener('pointerdown', onDown)
      svg.removeEventListener('pointerleave', onLeave)
      scroll.removeEventListener('scroll', hide)
      document.removeEventListener('pointerdown', onOutside)
    }
  }, [weeks])

  return (
    <div className="contrib__body" ref={body} data-hover={on ? '' : undefined}>
      {children}
      {/* mouse-only decoration: the summary and each `<title>` carry the same words */}
      <div className="contrib__ring" ref={ring} aria-hidden hidden />
      <div className="contrib__tip" ref={tip} aria-hidden hidden />
    </div>
  )
}
