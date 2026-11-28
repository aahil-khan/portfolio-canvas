'use client'

import { AnimatePresence, type Variants } from 'motion/react'
import * as m from 'motion/react-m'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'

import { direction, swipeStep, wrap, type ViewerCopy, type ViewerItem } from '@/lib/lab/viewer'
import { fill } from '@/lib/lab/view'
import { useReducedMotion } from '@/lib/motion/reduced'
import { EASE_BEZIER, LAB, REDUCED, sec } from '@/lib/motion/tokens'

export interface ViewerProps {
  items: ViewerItem[]
  start: number
  copy: ViewerCopy
  /** Called once the viewer has left the screen; the opener gives focus back to its image. */
  onClose: () => void
}

const FOCUSABLE = 'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'

/**
 * Below this width, previous and next leave the picture for a row under it, with the count between
 * them: on a phone the picture is the whole width and buttons on it cover what it shows. The viewer
 * renders only in the browser, after a click, so reading the width here cannot mismatch the server.
 */
const NARROW = '(max-width: 599.98px)'
const subscribeNarrow = (f: () => void) => {
  const q = window.matchMedia(NARROW)
  q.addEventListener('change', f)
  return () => q.removeEventListener('change', f)
}
const useNarrow = () =>
  useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  )

/**
 * The Lab's full-size image viewer, loaded on the first open (`zoom.tsx`). The canvas's viewer
 * (`Lightbox` in `components/apps/carousel.tsx`) in the Lab's frame language: a scrim, a window with
 * a title bar (the image's alt, the count, Close), the picture as large as fits but never past its
 * own pixels, and previous and next when the entry has more than one.
 *
 * Esc, Close and the scrim close it. Arrow keys, the buttons and a one-finger swipe page through
 * every image of the entry, wrapping at the ends; a pinch is left to the browser. While it is open
 * the page under it cannot scroll (Lenis stops), is inert, and keeps its place.
 *
 * It is portalled into the Lab's root, outside the reading column (which a page change transforms),
 * so `position: fixed` is the screen's and every Lab token applies.
 */
export function Viewer({ items, start, copy, onClose }: ViewerProps) {
  const reduced = useReducedMotion()
  const narrow = useNarrow()
  const n = items.length
  const [index, setIndex] = useState(() => wrap(start, n))
  const [dir, setDir] = useState<-1 | 0 | 1>(0)
  const [closing, setClosing] = useState(false)
  /** Image pixels as the browser decoded them, when they differ from the declared `w`/`h`. */
  const [natural, setNatural] = useState<Record<string, { w: number; h: number }>>({})
  const root = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const [host] = useState(() => document.querySelector<HTMLElement>('[data-lab]') ?? document.body)

  const close = useCallback(() => setClosing(true), [])
  const go = useCallback(
    (step: 1 | -1) => {
      if (n < 2) return
      const to = wrap(index + step, n)
      setDir(direction(index, to, n))
      setIndex(to)
    },
    [index, n],
  )
  const next = useCallback(() => go(1), [go])
  const prev = useCallback(() => go(-1), [go])

  /*
   * The page underneath: no scrolling (Lenis too), inert, and the same place when it comes back.
   * Released the moment the exit ends, before `onClose`, so the opener can take focus at once: an
   * inert page refuses it, and an unmount's cleanup can run a frame too late.
   */
  const release = useRef<(() => void) | null>(null)
  useEffect(() => {
    const html = document.documentElement
    const was = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter }
    html.style.scrollbarGutter = 'stable'
    html.style.overflow = 'hidden'
    window.__lenis?.stop()
    const others = [...host.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !c.hasAttribute('data-lab-viewer') && !c.inert)
    for (const o of others) o.inert = true
    const undo = () => {
      release.current = null
      for (const o of others) o.inert = false
      html.style.overflow = was.overflow
      html.style.scrollbarGutter = was.gutter
      window.__lenis?.start()
    }
    release.current = undo
    return () => release.current?.()
  }, [host])
  const done = useCallback(() => {
    release.current?.()
    onClose()
  }, [onClose])

  /* Focus moves in on open; Tab stays inside. Giving it back is the opener's (zoom.tsx). */
  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true })
  }, [])

  /*
   * Esc closes and the arrows page, in the capture phase on window, so nothing under the viewer
   * (a bar panel, a preview) also takes the key.
   */
  useEffect(() => {
    if (closing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.altKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()
        if (e.key === 'ArrowRight') next()
        else prev()
      } else if (e.key === 'Tab') {
        const list = [...(root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
        if (!list.length) return
        const at = list.indexOf(document.activeElement as HTMLElement)
        const to = e.shiftKey ? (at <= 0 ? list.length - 1 : at - 1) : at === list.length - 1 || at < 0 ? 0 : at + 1
        e.preventDefault()
        list[to]?.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [closing, close, next, prev])

  /* The neighbours load while this one is looked at, so paging never waits on the network. */
  useEffect(() => {
    if (n < 2) return
    for (const i of new Set([wrap(index + 1, n), wrap(index - 1, n)])) {
      const pre = new Image()
      pre.decoding = 'async'
      pre.src = items[i].src
    }
  }, [index, items, n])

  /* A one-finger sideways swipe pages; two fingers are a pinch, and a pinch-zoomed page pans. */
  const touch = useRef<{ x: number; y: number; fingers: number } | null>(null)
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    if (touch.current) touch.current.fingers = Math.max(touch.current.fingers, e.touches.length)
    else if (t) touch.current = { x: t.clientX, y: t.clientY, fingers: e.touches.length }
  }
  const onTouchMove = (e: TouchEvent) => {
    if (touch.current) touch.current.fingers = Math.max(touch.current.fingers, e.touches.length)
  }
  const onTouchEnd = (e: TouchEvent) => {
    const s = touch.current
    const t = e.changedTouches[0]
    if (!s || !t || e.touches.length) return
    touch.current = null
    const step = swipeStep({ dx: t.clientX - s.x, dy: t.clientY - s.y, fingers: s.fingers, scale: window.visualViewport?.scale ?? 1 })
    if (step > 0) next()
    else if (step < 0) prev()
  }

  const item = items[index]
  const size = natural[item.src] ?? { w: item.w, h: item.h }
  const title = item.alt || copy.untitled
  const captioned = items.some((x) => x.caption)

  const t = (ms: number) => sec(reduced ? Math.min(ms, REDUCED.maxDuration) : ms)
  const shell: Variants = {
    hidden: { opacity: 0 },
    shown: { opacity: 1, transition: { duration: t(LAB.windowIn.opacity), ease: EASE_BEZIER } },
    gone: { opacity: 0, transition: { duration: t(LAB.windowOut.duration), ease: EASE_BEZIER } },
  }
  const win: Variants = reduced
    ? { hidden: {}, shown: {}, gone: {} }
    : {
        hidden: { y: LAB.windowIn.rise },
        shown: { y: 0, transition: { duration: sec(LAB.windowIn.duration), ease: EASE_BEZIER } },
        gone: { y: LAB.windowOut.drop, transition: { duration: sec(LAB.windowOut.duration), ease: EASE_BEZIER } },
      }

  const count = (
    <span className="lab-viewer-count" data-viewer-count data-num aria-hidden="true">
      {fill(copy.count, { i: index + 1, n })}
    </span>
  )
  const prevBtn = (
    <button type="button" className="lab-viewer-arrow lab-viewer-prev" data-viewer-prev aria-label={copy.prev} title={copy.prev} onClick={prev}>
      <Chevron />
    </button>
  )
  const nextBtn = (
    <button type="button" className="lab-viewer-arrow lab-viewer-next" data-viewer-next aria-label={copy.next} title={copy.next} onClick={next}>
      <Chevron />
    </button>
  )
  const winClass = ['lab-viewer-win', captioned ? 'has-cap' : '', n > 1 && narrow ? 'has-foot' : ''].filter(Boolean).join(' ')

  return createPortal(
    <AnimatePresence onExitComplete={done}>
      {closing ? null : (
        <m.div
          key="viewer"
          ref={root}
          className="lab-viewer"
          data-lab-viewer=""
          data-lenis-prevent
          role="dialog"
          aria-modal="true"
          aria-labelledby="lab-viewer-title"
          variants={shell}
          initial="hidden"
          animate="shown"
          exit="gone"
        >
          <button type="button" className="lab-viewer-scrim" data-viewer-scrim aria-label={copy.scrim} tabIndex={-1} onClick={close} />
          <m.div className={winClass} data-viewer-win variants={win}>
            <div className="lab-window-bar lab-viewer-bar">
              <h2 id="lab-viewer-title" className="lab-viewer-title" title={title}>
                {title}
              </h2>
              {n > 1 && !narrow ? count : null}
              <button ref={closeBtn} type="button" className="lab-viewer-close" data-viewer-close aria-label={copy.close} title={copy.close} onClick={close}>
                <Cross />
              </button>
            </div>
            <div className="lab-viewer-stage" data-viewer-stage onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={() => (touch.current = null)}>
              <m.img
                key={item.src}
                className="lab-viewer-img"
                data-viewer-img
                src={item.src}
                alt={item.alt}
                width={size.w}
                height={size.h}
                decoding="async"
                draggable={false}
                style={{ '--w': size.w, '--h': size.h } as CSSProperties}
                onLoad={(e) => {
                  const el = e.currentTarget
                  if (el.naturalWidth && (el.naturalWidth !== size.w || el.naturalHeight !== size.h))
                    setNatural((x) => ({ ...x, [item.src]: { w: el.naturalWidth, h: el.naturalHeight } }))
                }}
                initial={dir === 0 ? false : reduced ? { opacity: 0 } : { opacity: 0, x: dir * 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: t(LAB.windowIn.duration), ease: EASE_BEZIER, opacity: { duration: t(LAB.windowIn.opacity) } }}
              />
              {n > 1 && !narrow ? (
                <>
                  {prevBtn}
                  {nextBtn}
                </>
              ) : null}
            </div>
            {captioned ? <p className="lab-viewer-cap">{item.caption ?? '\u00a0'}</p> : null}
            {n > 1 && narrow ? (
              <div className="lab-viewer-foot" data-viewer-foot>
                {prevBtn}
                {count}
                {nextBtn}
              </div>
            ) : null}
            <p className="lab-viewer-live" aria-live="polite">
              {n > 1 ? fill(copy.pos, { i: index + 1, n, alt: title }) : ''}
            </p>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    host,
  )
}

function Cross() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
