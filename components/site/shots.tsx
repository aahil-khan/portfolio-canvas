'use client'

import { useCallback, useRef, useState } from 'react'

import { prefersReducedMotion } from '@/lib/site-motion'

/**
 * Project screenshots on a document page.
 *
 * A deliberately small carousel, not the canvas's. That one carries a portal, a FLIP-animated
 * full-screen viewer and the card-measuring context — machinery a static page has no use for.
 *
 * Built on `scroll-snap` rather than a transform, which means the thing works before any of this
 * JavaScript runs: with scripting off the track is still a swipeable, snapping strip of images.
 * The buttons and counter are progressive enhancement over a scroller that already functions.
 *
 * Every slide sits in the same fixed 16:10 frame and crops to fill it. Taking the shape from the
 * first image instead meant a set mixing a full-page capture with a viewport one produced a frame
 * that fitted one and stranded the other, and made the carousel a different height per project.
 */
export function Shots({ images, alt }: { images: readonly string[]; alt: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const many = images.length > 1

  /* index follows the scroller, so dragging the strip updates the counter too */
  const onScroll = useCallback(() => {
    const el = track.current
    if (!el) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }, [])

  const go = useCallback((to: number) => {
    const el = track.current
    if (!el) return
    const clamped = Math.max(0, Math.min(to, images.length - 1))
    el.scrollTo({
      left: clamped * el.clientWidth,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [images.length])

  return (
    <div className="shots">
      <div className="shots__track" ref={track} onScroll={onScroll}>
        {images.map((src, i) => (
          <div className="shots__slide" key={src}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static asset, cropped into a fixed frame */}
            <img
              src={src}
              alt={many ? `${alt} — ${i + 1} of ${images.length}` : alt}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          </div>
        ))}
      </div>

      {many ? (
        <div className="shots__bar">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous screenshot">
            <span aria-hidden>←</span>
          </button>

          <div className="shots__dots">
            {images.map((src, i) => (
              <button
                type="button"
                key={src}
                className="shots__dot"
                aria-label={`Screenshot ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
              />
            ))}
          </div>

          <span className="shots__count">
            {index + 1} / {images.length}
          </span>

          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === images.length - 1}
            aria-label="Next screenshot"
          >
            <span aria-hidden>→</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
