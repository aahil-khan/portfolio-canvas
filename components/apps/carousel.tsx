'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { useMeasuring } from '@/components/desktop/measuring-context'

const EASE = 'cubic-bezier(.16,1,.3,1)'

/**
 * Screen-space FLIP: the transform that would put `from` exactly where `to` is. Same shape as
 * the card's dock-icon morph, minus the canvas scale — the viewer lives outside the transformed
 * world, so a screen pixel is a screen pixel here.
 */
function morph(from: DOMRect, to: DOMRect) {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  return `translate(${dx}px,${dy}px) scale(${to.width / from.width},${to.height / from.height})`
}

export interface Slide {
  src: string
  width?: number
  height?: number
  /** A line under the picture. Optional per slide — a set can caption some and not others. */
  caption?: string
}

interface Props {
  slides: readonly Slide[]
  alt: string
  /** Aspect ratio of the frame, measured from the first slide at build time. */
  ratio: number
  className?: string
  /**
   * Whether the full-size viewer can be opened. Default on.
   *
   * Project screenshots are the point of the card they sit in, so they always offer it. An
   * archive thumbnail is an aside next to a sentence, and most of them are not worth a viewer
   * that covers the screen — so there it is opt-in, per entry, via `fullscreen` in the content.
   */
  zoomable?: boolean
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
 *
 * Clicking a slide does nothing. Full size is an explicit button, which opens the viewer below
 * at the slide you were already on — the old behaviour promoted the shot to another card on the
 * canvas, so a click on an image spawned a window you then had to find and close.
 */
export function Carousel({ slides, alt, ratio, className, zoomable = true }: Props) {
  const measuring = useMeasuring()
  const [index, setIndex] = useState(0)
  const [full, setFull] = useState(false)
  const frame = useRef<HTMLDivElement>(null)
  const zoom = useRef<HTMLButtonElement>(null)
  const count = slides.length
  const captioned = slides.some((s) => s.caption)

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
              {/* eslint-disable-next-line @next/next/no-img-element -- dimensions known */}
              <img
                src={s.src}
                alt={`${alt} ${i + 1} of ${count}`}
                width={s.width}
                height={s.height}
                /*
                  * The first slide loads eagerly so opening a project does not flash an empty
                  * frame — but NOT inside the measurement rig, which renders every card that
                  * exists, off-screen, at boot. That was pulling every project's first
                  * screenshot down on the canvas home page for cards nobody had opened: 359KB
                  * of the 1.26MB first load. The frame is sized from build-time dimensions, so
                  * the rig still measures exactly the same height without the bytes.
                  */
                loading={i === 0 && !measuring ? undefined : 'lazy'}
                /* decode off the main thread, so a big screenshot cannot stall a pan frame */
                decoding="async"
                draggable={false}
              />
            </div>
          ))}
        </div>

        {zoomable ? (
          <button
            ref={zoom}
            type="button"
            className="carousel__zoom"
            aria-label={`View ${alt} full size`}
            onClick={() => setFull(true)}
          >
            <Expand />
          </button>
        ) : null}

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

      {/*
        * Captions reserve their line whether or not the current slide has one.
        *
        * Without that, paging between a captioned slide and a bare one changes the height of
        * the card underneath — and these heights are measured once at boot and reused for
        * collision avoidance and framing, so the card would disagree with what the canvas
        * believes about it for the rest of the session.
        */}
      {captioned ? (
        <p className="carousel__cap">{slides[index]?.caption ?? '\u00a0'}</p>
      ) : null}

      {full && zoomable ? (
        <Lightbox
          slides={slides}
          alt={alt}
          index={index}
          count={count}
          go={go}
          origin={frame}
          onClose={() => {
            setFull(false)
            // after the portal is gone, not during its teardown — React resets focus to the
            // body on its way out, which beat a restore issued from the viewer's own cleanup
            requestAnimationFrame(() => zoom.current?.focus())
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * Full-size viewer. Portalled to `document.body` on purpose: `position: fixed` inside the
 * transformed world resolves against the world rather than the screen, and the scrim's blur
 * would repaint on every pan frame. Out here it is a sibling of the dock, which is where the
 * only other glass in this build lives.
 */
function Lightbox({
  slides,
  alt,
  index,
  count,
  go,
  origin,
  onClose,
}: {
  slides: readonly Slide[]
  alt: string
  index: number
  count: number
  go: (next: number) => void
  /** The carousel frame this grew out of, re-measured on the way back in case the canvas moved. */
  origin: RefObject<HTMLDivElement | null>
  onClose: () => void
}) {
  const closeBtn = useRef<HTMLButtonElement>(null)
  const win = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLButtonElement>(null)
  const [closing, setClosing] = useState(false)
  const dismissed = useRef(false)

  /* Every dismissal — the ×, the scrim, Escape — goes through here, so the exit animation can
     never be skipped by one route or run twice by two. */
  const requestClose = useCallback(() => {
    if (dismissed.current) return
    dismissed.current = true
    setClosing(true)
  }, [])

  /* --- grow out of the thumbnail --- */
  useEffect(() => {
    const node = win.current
    if (!node || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    scrim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: EASE })
    const from = node.getBoundingClientRect()
    const to = origin.current?.getBoundingClientRect()
    node.animate(
      to && to.width > 0 && from.width > 0
        ? [
            { transform: morph(from, to), opacity: 0 },
            { transform: 'none', opacity: 1 },
          ]
        : [
            { transform: 'scale(.96)', opacity: 0 },
            { transform: 'none', opacity: 1 },
          ],
      { duration: 300, easing: EASE },
    )
  }, [origin])

  /*
   * Exit. The viewer can't just be dropped from state — that is what made closing feel abrupt.
   * It shrinks back into the thumbnail and only then tells the carousel to unmount it.
   *
   * `fill: 'forwards'` matters: without it the element snaps back to its own styles the instant
   * the animation ends, flashing at full opacity for a frame before React removes it.
   */
  useEffect(() => {
    if (!closing) return
    const node = win.current
    if (!node || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    const from = node.getBoundingClientRect()
    const to = origin.current?.getBoundingClientRect()
    const opts: KeyframeAnimationOptions = { duration: 260, easing: EASE, fill: 'forwards' }
    scrim.current?.animate([{ opacity: 1 }, { opacity: 0 }], opts)
    const anim = node.animate(
      to && to.width > 0 && from.width > 0
        ? [
            { transform: 'none', opacity: 1 },
            { transform: morph(from, to), opacity: 0 },
          ]
        : [
            { transform: 'none', opacity: 1 },
            { transform: 'scale(.96)', opacity: 0 },
          ],
      opts,
    )
    anim.onfinish = onClose
    anim.oncancel = onClose
  }, [closing, onClose, origin])

  /*
   * Escape closes, arrows page.
   *
   * Bound on `window` in the CAPTURE phase, which is the whole point: the desktop keeps a
   * bubble-phase `window` listener that closes the topmost card on Escape and pans/zooms the
   * canvas on `f`, `0` and `±`. Sharing a target means `stopPropagation` from a bubble listener
   * would be too late — Escape dismissed the viewer AND closed the card underneath it, which
   * took the button the viewer was supposed to hand focus back to. Capturing first and stopping
   * there is the only end that can win.
   */
  useEffect(() => {
    const CANVAS_KEYS = ['=', '+', '-', '_', '0', 'f']
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        requestClose()
      } else if (count > 1 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        e.stopPropagation()
        go(index + (e.key === 'ArrowRight' ? 1 : -1))
      } else if (!e.metaKey && !e.ctrlKey && CANVAS_KEYS.includes(e.key)) {
        // the world must not pan or zoom behind a viewer that covers it
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [go, index, count, requestClose])

  /* Focus moves in on open so the viewer can be driven from the keyboard. Sending it back out
     is the carousel's job — see `onClose`. */
  useEffect(() => {
    closeBtn.current?.focus()
  }, [])

  /*
   * Which way the last change went, and what is on its way out.
   *
   * Swapping `src` on one element is instant, and at this size instant reads as a glitch rather
   * than a change — the picture is most of the screen, so it has to be seen to move. The
   * outgoing frame is kept mounted for the length of the cross-fade and only then dropped.
   *
   * Adjusted during render rather than from an effect: it is state derived from `index`
   * changing, and an effect would paint one frame of the new picture before the fade started.
   */
  const [seen, setSeen] = useState(index)
  const [leaving, setLeaving] = useState<{ i: number; dir: number } | null>(null)
  if (index !== seen) {
    // paging past either end wraps, so the shorter way round is the direction it actually moved
    const raw = index - seen
    const dir = Math.abs(raw) > count / 2 ? -Math.sign(raw) : Math.sign(raw)
    setLeaving({ i: seen, dir })
    setSeen(index)
  }

  const single = count === 1
  const s = slides[index]
  const out = leaving ? slides[leaving.i] : null

  return createPortal(
    <div className="lb" role="dialog" aria-modal="true" aria-label={`${alt}, full size`}>
      <button
        ref={scrim}
        className="lb__scrim"
        aria-label="Close full size view"
        onClick={requestClose}
      />
      <div className="lb__win" ref={win}>
        <div className="lb__head">
          <span className="lb__title">{alt}</span>
          {!single ? (
            <span className="lb__count" aria-live="polite">
              {index + 1} / {count}
            </span>
          ) : null}
          <button
            ref={closeBtn}
            type="button"
            className="lb__x"
            aria-label="Close"
            onClick={requestClose}
          />
        </div>

        <div className="lb__stage">
          {/*
            * The outgoing picture is taken out of flow while it fades.
            *
            * Left in the grid cell it shares with the incoming one, the cell would size to
            * whichever of the two is larger and the window would jolt mid-transition — these
            * are screenshots and photos, so consecutive slides rarely share a shape.
            */}
          {out ? (
            // eslint-disable-next-line @next/next/no-img-element -- dimensions known
            <img
              key={`out-${leaving?.i}`}
              className="lb__img lb__img--out"
              src={out.src}
              alt=""
              aria-hidden
              width={out.width}
              height={out.height}
              style={{ ['--dx' as string]: `${(leaving?.dir ?? 1) * 34}px` }}
              onAnimationEnd={() => setLeaving(null)}
            />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element -- dimensions known */}
          <img
            key={`in-${index}`}
            className="lb__img"
            src={s.src}
            alt={`${alt} ${index + 1} of ${count}`}
            width={s.width}
            height={s.height}
            style={{ ['--dx' as string]: `${(leaving?.dir ?? 1) * 34}px` }}
          />
          {!single ? (
            <>
              <button
                type="button"
                className="lb__arrow lb__arrow--prev"
                aria-label="Previous image"
                onClick={() => go(index - 1)}
              >
                <Chevron />
              </button>
              <button
                type="button"
                className="lb__arrow lb__arrow--next"
                aria-label="Next image"
                onClick={() => go(index + 1)}
              >
                <Chevron />
              </button>
            </>
          ) : null}
        </div>

        {s.caption ? <p className="lb__cap">{s.caption}</p> : null}

        {!single ? (
          <div className="lb__dots">
            {slides.map((sl, i) => (
              <button
                key={sl.src}
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
    </div>,
    document.body,
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

function Expand() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
    </svg>
  )
}
