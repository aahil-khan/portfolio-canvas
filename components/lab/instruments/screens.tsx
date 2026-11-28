'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { fill } from '@/lib/lab/view'
import type { Image } from '@/lib/lab/types'
import { prefersReducedMotion } from '@/lib/motion/reduced'

import { useLeadUse, useReady } from './live'

export interface ScreensLabels {
  label: string
  prev: string
  next: string
  pos: string
}

/**
 * A build's screenshots (`screens`). One renders as a plain frame. Several are a carousel: one
 * framed track that snaps a screen at a time, which scrolls by touch or trackpad, and with JavaScript
 * off by the arrow keys too (the track is then a tab stop). With it on, each screen is a button that
 * opens the viewer, and there are Previous and Next and a "Screen 1
 * of 3" that follows the track. Only the first image loads with the page; the rest load as the
 * track nears them.
 */
export function Screens({ images, labels }: { images: Image[]; labels: ScreensLabels }) {
  const track = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(0)
  const used = useLeadUse('screens')
  // the track is a tab stop only without JavaScript, where it is the one way to scroll it from the
  // keyboard; with it, the slides are buttons (the viewer) and Previous and Next move between them
  const ready = useReady()
  const n = images.length

  useEffect(() => {
    const el = track.current
    if (!el || n < 2) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setI(Number((e.target as HTMLElement).dataset.slide))
      },
      { root: el, threshold: 0.6 },
    )
    for (const s of el.querySelectorAll('[data-slide]')) io.observe(s)
    return () => io.disconnect()
  }, [n])

  const img = (im: Image, k: number) => (
    // pre-sized WebP with its size declared (API.md §4); next/image would add a resizer the Lab does not need
    // eslint-disable-next-line @next/next/no-img-element
    <img src={im.src} width={im.w} height={im.h} alt={im.alt} loading={k ? 'lazy' : undefined} fetchPriority={k ? undefined : 'high'} decoding="async" />
  )
  if (n === 1)
    return (
      <figure className="lab-shot" data-draw="in" style={{ '--ar': images[0].w / images[0].h } as CSSProperties}>
        {img(images[0], 0)}
        {images[0].caption ? <figcaption className="lab-caption">{images[0].caption}</figcaption> : null}
      </figure>
    )

  const go = (to: number) => {
    const el = track.current
    if (!el) return
    used()
    const j = Math.max(0, Math.min(n - 1, to))
    el.scrollTo({ left: j * el.clientWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }
  return (
    <div className="lab-car" role="group" aria-roledescription="carousel" aria-label={labels.label} data-draw="in" style={{ '--ar': images[0].w / images[0].h } as CSSProperties}>
      <div className="lab-car-track lab-shot" ref={track} tabIndex={ready ? undefined : 0} data-lenis-prevent>
        {images.map((im, k) => (
          <figure key={im.src} className="lab-car-slide" data-slide={k} aria-label={fill(labels.pos, { i: k + 1, n })}>
            {img(im, k)}
          </figure>
        ))}
      </div>
      <div className="lab-car-nav">
        <span className="meta" aria-live="polite">
          {fill(labels.pos, { i: i + 1, n })}
        </span>
        <span className="lab-car-btns" data-needs-js>
          <button type="button" className="lab-chip" aria-label={labels.prev} onClick={() => go(i - 1)} disabled={i === 0} />
          <button type="button" className="lab-chip" aria-label={labels.next} onClick={() => go(i + 1)} disabled={i === n - 1} />
        </span>
      </div>
    </div>
  )
}
