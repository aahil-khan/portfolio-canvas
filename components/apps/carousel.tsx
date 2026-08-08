'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useOpenCard } from '@/components/desktop/open-context'

export interface Slide {
  src: string
  width?: number
  height?: number
}

interface Props {
  slides: readonly Slide[]
  alt: string
  /** Opening a card when a slide is clicked. Omit for the full-size view itself. */
  cardId?: string
  /** Aspect ratio of the frame, measured from the first slide at build time. */
  ratio: number
  className?: string
}

/**
 * Image carousel for a project or role.
 *
 * One fixed frame, sized from the FIRST slide's real dimensions, with every image drawn
 * `contain`. Screenshots in a set are rarely identical shapes, and cropping them to match would
 * cut the subject out — the same mistake that reshaped a square archive image to 1.45:1. A
 * letterboxed edge is the honest trade.
 *
 * The frame is `box-sizing: content-box` so its border can't skew the aspect ratio, and the
 * height is known before any image loads, so the card measures correctly on the first pass.
 */
export function Carousel({ slides, alt, cardId, ratio, className }: Props) {
  const [index, setIndex] = useState(0)
  const openCard = useOpenCard()
  const frame = useRef<HTMLDivElement>(null)
  const count = slides.length

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  )

  /* --- arrow keys, but only while the carousel actually has focus --- */
  useEffect(() => {
    const el = frame.current
    if (!el || count < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(index + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(index - 1)
      }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [go, index, count])

  /* --- swipe --- */
  useEffect(() => {
    const el = frame.current
    if (!el || count < 2) return
    let startX = 0
    let dragging = false

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      dragging = true
      startX = e.clientX
      // the card body doesn't pan the canvas, but stop it reaching the card's own handlers
      e.stopPropagation()
    }
    const up = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      const dx = e.clientX - startX
      if (Math.abs(dx) > 40) {
        e.stopPropagation()
        go(index + (dx < 0 ? 1 : -1))
      }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', () => (dragging = false))
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
    }
  }, [go, index, count])

  const single = count === 1

  return (
    <div
      className={className ? `carousel ${className}` : 'carousel'}
      role="group"
      aria-roledescription="carousel"
      aria-label={alt}
    >
      <div
        ref={frame}
        className="carousel__frame"
        style={{ ['--ratio' as string]: `${ratio}` }}
        tabIndex={count > 1 ? 0 : -1}
      >
        <div
          className="carousel__track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((s, i) => (
            <div className="carousel__slide" key={s.src} aria-hidden={i !== index || undefined}>
              {cardId ? (
                <button
                  type="button"
                  className="carousel__open"
                  aria-label={`Open ${alt} full size`}
                  onClick={() => openCard(cardId)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- dimensions known */}
                  <img
                    src={s.src}
                    alt={`${alt} ${i + 1} of ${count}`}
                    width={s.width}
                    height={s.height}
                    loading={i === 0 ? undefined : 'lazy'}
                    draggable={false}
                  />
                </button>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- dimensions known
                <img
                  src={s.src}
                  alt={`${alt} ${i + 1} of ${count}`}
                  width={s.width}
                  height={s.height}
                  loading={i === 0 ? undefined : 'lazy'}
                  draggable={false}
                />
              )}
            </div>
          ))}
        </div>

        {!single ? (
          <>
            <button
              type="button"
              className="carousel__arrow carousel__arrow--prev"
              aria-label="Previous image"
              onClick={() => go(index - 1)}
            >
              <Chevron />
            </button>
            <button
              type="button"
              className="carousel__arrow carousel__arrow--next"
              aria-label="Next image"
              onClick={() => go(index + 1)}
            >
              <Chevron />
            </button>
            <span className="carousel__count" aria-live="polite">
              {index + 1} / {count}
            </span>
          </>
        ) : null}
      </div>

      {!single ? (
        <div className="carousel__dots">
          {slides.map((s, i) => (
            <button
              key={s.src}
              type="button"
              className={i === index ? 'is-on' : undefined}
              aria-label={`Image ${i + 1}`}
              aria-current={i === index || undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 6-6 6 6 6" />
    </svg>
  )
}
