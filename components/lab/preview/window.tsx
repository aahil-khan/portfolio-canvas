'use client'

import { autoUpdate, FloatingFocusManager, useFloating, type Middleware } from '@floating-ui/react'
import { useIsPresent } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import type { Rect, Via } from '@/lib/lab/preview/intent'
import type { PreviewData } from '@/lib/lab/preview/data'
import { adoptEntry, entryArticle } from '@/lib/lab/preview/fetch-entry'
import { CARD_WIDTH, place, WINDOW_WIDTH, windowMaxHeight, type Placement } from '@/lib/lab/preview/place'
import type { Target } from '@/lib/lab/preview/target'
import { EASE_BEZIER, LAB, REDUCED, sec } from '@/lib/motion/tokens'
import { fill } from '@/lib/lab/view'

import { cardContent, type RefLine } from './card'

/** One open preview, as the stack holds it. */
export interface Win {
  /** Unique for the visit; also the id prefix's number (`w<n>-`). */
  n: number
  level: number
  trigger: HTMLAnchorElement
  target: Target
  via: Via
  /** A sheet pinned to the bottom (touch) rather than a window by its link. */
  sheet: boolean
  /** The line of the link the pointer was on, for where the window starts. */
  anchor: Rect | null
  /** The link's own words. */
  words: string
  /** A reference's line, read from its scope when it opened. */
  ref: RefLine | null
}

export const prefixOf = (w: Pick<Win, 'n'>) => `w${w.n}-`

/** The bar's bottom edge: windows never rise above it. 0 while the bar has slid away. */
function roof(): number {
  const b = document.querySelector('header[data-bar]')?.getBoundingClientRect()
  return Math.max(0, b && b.bottom > 0 ? b.bottom : 0) + 8
}

const rectOf = (r: DOMRect): Rect => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })

/**
 * The placement as Floating UI middleware: the pure `place()` fed with every client rect of the
 * link and the window's natural height (its body's full scroll height, whatever cap it has now),
 * re-run by `autoUpdate` on scroll, resize and the window's own growth.
 */
function labPlace(win: Win, parent: () => HTMLElement | null): Middleware {
  return {
    name: 'labPlace',
    fn({ elements }) {
      const f = elements.floating as HTMLElement
      const body = f.querySelector<HTMLElement>('[data-pv-body]')
      const natural = body ? f.offsetHeight - body.clientHeight + body.scrollHeight : f.offsetHeight
      const rects = [...win.trigger.getClientRects()].map(rectOf)
      const vh = window.innerHeight
      const vw = document.documentElement.clientWidth
      const top = roof()
      const full = win.target.kind === 'entry'
      const p = place({
        rects,
        anchor: win.anchor ?? undefined,
        height: natural,
        width: full ? WINDOW_WIDTH : CARD_WIDTH,
        maxHeight: full ? windowMaxHeight(vh) : undefined,
        viewport: { width: vw, height: vh },
        roof: top,
        parent: parent() ? rectOf(parent()!.getBoundingClientRect()) : null,
      })
      // the link scrolled off the screen (or under the bar): the window has nothing to point at
      const hidden = !rects.length || rects.every((r) => r.bottom <= top - 8 || r.top >= vh)
      return { x: p.x, y: p.y, data: { ...p, hidden, vh } }
    },
  }
}

/** An entry's whole page, copied into the window once fetched. */
function EntryBody({ win, data }: { win: Win; data: PreviewData | null }) {
  const holder = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  useLayoutEffect(() => {
    let live = true
    entryArticle(win.trigger.href).then((a) => {
      if (!live) return
      if (!a || !holder.current) return setState('failed')
      holder.current.replaceChildren(adoptEntry(a, prefixOf(win), win.trigger.href))
      setState('ready')
    })
    return () => {
      live = false
    }
  }, [win])
  const c = data?.copy ?? {}
  return (
    <>
      <div ref={holder} className="lab-pv-entry" data-pv-entry-holder />
      {state === 'loading' ? (
        <p className="lab-pv-text lab-pv-wait" role="status">
          {c.pvLoading}
        </p>
      ) : null}
      {state === 'failed' ? (
        <p className="lab-pv-text">
          {c.pvFailed} <a href={win.trigger.href}>{c.pvOpenPage ?? win.words}</a>
        </p>
      ) : null}
    </>
  )
}

export function PreviewWindow({
  win,
  data,
  parent,
  register,
  onClose,
  onHidden,
  reduced,
}: {
  win: Win
  data: PreviewData | null
  parent: () => HTMLElement | null
  register: (n: number, el: HTMLElement | null) => void
  onClose: (level: number) => void
  onHidden: (level: number) => void
  reduced: boolean
}) {
  const full = win.target.kind === 'entry'
  const c = data?.copy ?? {}
  // a window on its way out takes no pointer: the one replacing it, or the page, gets the hover
  const present = useIsPresent()
  const body = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement | null>(null)
  const { refs, floatingStyles, middlewareData, isPositioned, update, context } = useFloating({
    open: true,
    strategy: 'fixed',
    placement: 'bottom-start',
    transform: false,
    elements: { reference: win.trigger },
    middleware: win.sheet ? [] : [labPlace(win, parent)],
    whileElementsMounted: win.sheet ? undefined : (r, f, u) => autoUpdate(r, f, u, { elementResize: true, ancestorScroll: true, ancestorResize: true }),
  })
  const p = middlewareData.labPlace as (Placement & { hidden: boolean; vh: number }) | undefined

  // the content growing (the entry arriving, an image loading) re-places it, even past a height cap
  useEffect(() => {
    if (win.sheet || !body.current) return
    const ro = new ResizeObserver(() => update())
    for (const el of [body.current, ...body.current.children]) ro.observe(el)
    const mo = new MutationObserver(() => {
      for (const el of body.current?.querySelectorAll('[data-pv-entry-holder] > *') ?? []) ro.observe(el)
      update()
    })
    mo.observe(body.current, { childList: true, subtree: false })
    const holder = body.current.querySelector('[data-pv-entry-holder]')
    if (holder) mo.observe(holder, { childList: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [win.sheet, update])

  useEffect(() => {
    if (p?.hidden) onHidden(win.level)
  }, [p?.hidden, onHidden, win.level])

  // the wheel never scrolls the page: inside the body it scrolls the body (contained); over the
  // title bar it scrolls the body too; over a card with nothing to scroll it does nothing
  useEffect(() => {
    const f = frame.current
    if (!f) return
    const onWheel = (e: WheelEvent) => {
      const b = body.current
      if (!b) return
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * b.clientHeight : e.deltaY
      if (!b.contains(e.target as Node)) {
        b.scrollTop += dy
        e.preventDefault()
      } else if (b.scrollHeight <= b.clientHeight + 1) e.preventDefault()
    }
    f.addEventListener('wheel', onWheel, { passive: false })
    return () => f.removeEventListener('wheel', onWheel)
  }, [])

  // a sheet: as tall as it may be (a card up to 55vh in CSS; a whole entry up to 92vh, short
  // enough that the tapped words still show above it), and the page scrolled so they do
  useLayoutEffect(() => {
    const f = frame.current
    if (!win.sheet || !f) return
    const vh = window.innerHeight
    if (full) {
      const r = win.trigger.getBoundingClientRect()
      f.style.height = `${Math.round(Math.min(vh * 0.92, vh - roof() - Math.min(r.height, 64) - 16))}px`
    }
    if (win.level > 0) return
    const lab = document.querySelector<HTMLElement>('[data-lab]')
    const h = f.offsetHeight
    // room under the last line of the page, so even the footer's links can be scrolled clear
    if (lab) lab.style.paddingBottom = `${h}px`
    const r = win.trigger.getBoundingClientRect()
    const sheetTop = vh - h
    const top = roof()
    let dy = 0
    if (r.bottom > sheetTop - 12) dy = r.bottom - sheetTop + 16
    else if (r.top < top) dy = r.top - top - 8
    if (dy) {
      if (window.__lenis) window.__lenis.scrollTo(window.scrollY + dy, { immediate: true, force: true })
      else window.scrollBy({ top: dy, behavior: 'instant' })
    }
    return () => {
      if (lab) lab.style.paddingBottom = ''
    }
  }, [win, full])

  const card = full ? null : cardContent({ target: win.target, trigger: win.trigger, data, ref: win.ref, words: win.words })
  const head = full ? data?.entries[win.target.id] : undefined
  const label = full ? win.words : card!.label
  const bar: ReactNode = full ? (
    <>
      <span className="lab-pv-bar-title">{head ? fill(c.winEntry, { kind: head.kind }) : win.words}</span>
      {head ? <time dateTime={head.date}>{head.dateText}</time> : null}
    </>
  ) : (
    card!.bar
  )

  // motion (DIRECTION "Motion and hover timing"): in over 180ms, rising 6px and scaling from 0.98 at
  // the link's corner, opacity over the first 120ms; a cascaded window enters from the side it steps
  // to; out over 120ms, 4px down, no scale. Reduced motion: opacity only, 120ms.
  const step = p?.step ?? null
  const from = win.sheet
    ? `translate(0px, ${LAB.windowIn.rise}px) scale(1)`
    : step
      ? `translate(${step === 'right' ? LAB.windowIn.rise : -LAB.windowIn.rise}px, 0px) scale(${LAB.windowIn.scale})`
      : `translate(0px, ${LAB.windowIn.rise}px) scale(${LAB.windowIn.scale})`
  const originX = p && win.anchor ? Math.max(0, Math.min(p.width, win.anchor.left - p.x)) : 0
  const origin = win.sheet ? '50% 100%' : step === 'left' ? '100% 0%' : `${Math.round(originX)}px ${p?.side === 'above' ? '100%' : '0%'}`
  const shown = win.sheet || isPositioned
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, transform: from }
  const visible = reduced ? { opacity: 1 } : { opacity: 1, transform: 'translate(0px, 0px) scale(1)' }
  const transition = reduced
    ? { duration: sec(REDUCED.maxDuration), ease: EASE_BEZIER }
    : { duration: sec(LAB.windowIn.duration), ease: EASE_BEZIER, opacity: { duration: sec(LAB.windowIn.opacity), ease: EASE_BEZIER } }
  const exit = reduced
    ? { opacity: 0, transition: { duration: sec(REDUCED.maxDuration), ease: EASE_BEZIER } }
    : { opacity: 0, transform: `translate(0px, ${LAB.windowOut.drop}px) scale(1)`, transition: { duration: sec(LAB.windowOut.duration), ease: EASE_BEZIER } }

  const style = win.sheet
    ? { zIndex: 35 + win.level, ...(present ? {} : { pointerEvents: 'none' as const }) }
    : {
        ...(present ? {} : { pointerEvents: 'none' as const }),
        ...floatingStyles,
        // above its link it hangs from its bottom edge: content arriving grows it upward, away from the link
        ...(p?.side === 'above' && p.bottom != null ? { top: 'auto', bottom: p.vh - p.bottom } : {}),
        zIndex: 35 + win.level,
        transformOrigin: origin,
        visibility: shown ? undefined : ('hidden' as const),
        ...(p?.maxHeight != null ? { maxHeight: p.maxHeight } : {}),
      }

  const node = (
    <m.div
      ref={(el: HTMLDivElement | null) => {
        frame.current = el
        refs.setFloating(el)
        register(win.n, el)
      }}
      className={`lab-pv${full ? ' is-full' : ' is-card'}${win.sheet ? ' is-sheet' : ''}`}
      role="dialog"
      aria-modal={win.sheet ? true : undefined}
      aria-label={fill(win.sheet ? c.pvSheetLabel : c.pvWindowLabel, { title: label }) || label}
      tabIndex={-1}
      data-preview-window={win.target.kind}
      data-level={win.level}
      data-for={win.trigger.getAttribute('data-preview') ?? ''}
      data-via={win.via}
      data-state={present ? 'open' : 'closing'}
      data-side={win.sheet ? 'sheet' : (p?.side ?? '')}
      data-step={step ?? ''}
      data-lenis-prevent=""
      style={style}
      initial={hidden}
      animate={shown ? visible : hidden}
      exit={exit}
      transition={transition}
    >
      <div className="lab-pv-bar lab-window-bar">
        {bar}
        <button type="button" className="lab-pv-close" data-pv-close onClick={() => onClose(win.level)}>
          {c.cardClose}
        </button>
      </div>
      <div ref={body} className="lab-pv-body" data-pv-body>
        {full ? <EntryBody win={win} data={data} /> : <div className="lab-pv-card">{card!.body}</div>}
      </div>
    </m.div>
  )

  return win.sheet ? (
    <FloatingFocusManager context={context} modal initialFocus={frame} returnFocus={false} closeOnFocusOut={false}>
      {node}
    </FloatingFocusManager>
  ) : (
    node
  )
}
