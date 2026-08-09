'use client'

import { type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { play } from '@/lib/audio'
import { mobile as mobileCopy } from '@/content'

import { AppIcon } from './app-icon'
import type { CardDef } from './card'
import type { DockItem } from './dock'
import { OpenCardContext } from './open-context'
import { SoundMenu } from './sound-menu'

interface Props {
  cards: readonly CardDef[]
  dock: readonly DockItem[]
  externals: readonly DockItem[]
  hero: ReactNode
  /** Back to the plain résumé, which is where a phone started. */
  onLeave: () => void
}

/**
 * The phone shell.
 *
 * Not a squeezed canvas — a different shape for the same content. There is no panning, no
 * zooming and no dragging, because none of them work with a thumb on a 390px screen. What
 * survives is the metaphor: a dock along the bottom, and cards that open from it.
 *
 * Cards open as a full-height sheet, one at a time, and drilling in (Work → a project → its
 * screenshot) pushes onto a stack so Back means what it says. That mirrors what the canvas does
 * with spawned cards, without needing space to put them side by side.
 *
 * Every card body is the same server-rendered node the canvas uses, so the two shells can never
 * disagree about content.
 */
export function MobileShell({ cards, dock, externals, hero, onLeave }: Props) {
  /** Card ids, deepest last. Empty means the hero is showing. */
  const [stack, setStack] = useState<string[]>([])
  /** Whether the "how do I get the desktop version" note is showing. */
  const [desktopHelp, setDesktopHelp] = useState(false)
  const byId = new Map(cards.map((c) => [c.id, c]))
  const current = stack.length ? byId.get(stack[stack.length - 1]) : undefined

  /*
   * What the sheet paints, which is not the same as what is open.
   *
   * Closing empties the stack, and the sheet takes 260ms to slide away. Painting `current`
   * directly meant that for the whole of those 260ms there was nothing to paint: the title
   * emptied, the icon vanished, `--c` fell back so the header lost the card's colour, and the
   * keyed body unmounted — so the thing sliding off the bottom of the screen was a blank white
   * rectangle. Holding the last card through the exit is what makes it look like the card
   * leaving rather than a card being erased and then leaving.
   *
   * Adjusted during render rather than from an effect: this is state derived from another piece
   * of state changing, which React documents as a render-time adjustment. An effect would paint
   * one frame of the blank sheet before correcting itself, which is the whole bug again.
   */
  const [painted, setPainted] = useState<CardDef | undefined>(undefined)
  if (current && current !== painted) setPainted(current)
  const shown = current ?? painted

  const push = useCallback(
    (id: string) => {
      setStack((s) => (s[s.length - 1] === id ? s : [...s, id]))
      play('open')
    },
    [],
  )

  const back = useCallback(() => {
    setStack((s) => s.slice(0, -1))
    play('close')
  }, [])

  const closeAll = useCallback(() => {
    setStack([])
    play('close')
  }, [])

  /** A dock tap starts a fresh stack rather than deepening the current one. */
  const openFromDock = useCallback((id: string) => {
    setStack([id])
    play('click')
  }, [])

  /* ---------- swipe down to dismiss ---------- */

  const sheetRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  /** Null until a press turns into a drag; `armed` is the pre-threshold state. */
  const drag = useRef<{ id: number; y0: number; x0: number; t0: number; dy: number; armed: boolean } | null>(
    null,
  )

  /**
   * Cancel the browser's own gesture for this drag.
   *
   * `touch-action: none` on the head is not sufficient, which is worth knowing: with it alone,
   * Chrome still recognises a quick downward swipe as a fling. The fling scrolls nothing here —
   * there is nothing under the sheet to scroll — but it stays live for the best part of a
   * second, and a tap that lands during a fling is spent stopping it instead of becoming a
   * click. The visible symptom was the dock ignoring the first tap after every swipe-dismiss:
   * `pointerdown` and `pointerup` both arrived on the right button and no `click` ever followed.
   *
   * Only `preventDefault` on a non-passive `touchmove` suppresses the gesture, and React's
   * synthetic `onTouchMove` is passive, so this has to be a native listener.
   */
  useEffect(() => {
    const el = headRef.current
    if (!el) return
    const stopGesture = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchmove', stopGesture, { passive: false })
    return () => el.removeEventListener('touchmove', stopGesture)
  }, [])

  /**
   * Follows the thumb by writing `transform` straight to the node — the drag never enters React
   * state, for the same reason the canvas keeps its camera in a ref: a re-render per pointermove
   * is what makes a gesture feel like it is lagging behind the finger.
   */
  const onGrabDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { id: e.pointerId, y0: e.clientY, x0: e.clientX, t0: e.timeStamp, dy: 0, armed: true }
  }, [])

  const onGrabMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    const el = sheetRef.current
    if (!d || !el || d.id !== e.pointerId) return

    const dy = e.clientY - d.y0
    if (d.armed) {
      /*
       * Nothing is captured until the press is clearly a downward drag. Capturing on pointerdown
       * would retarget the pointerup to the sheet head, and the Back and Close buttons inside it
       * would stop firing their click — the gesture would eat the two controls it sits between.
       */
      if (dy < 6 || Math.abs(dy) <= Math.abs(e.clientX - d.x0)) return
      d.armed = false
      el.style.transition = 'none'
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    d.dy = Math.max(0, dy)
    el.style.transform = `translateY(${d.dy}px)`
  }, [])

  const onGrabUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = drag.current
      const el = sheetRef.current
      if (!d || !el || d.id !== e.pointerId) return
      drag.current = null
      if (d.armed) return // never became a drag; let the click through

      // restoring the empty string hands the transition back to CSS, which is also where
      // reduced motion is honoured — under `reduce` that computes to `none` and this is instant
      el.style.transition = ''

      const velocity = d.dy / Math.max(1, e.timeStamp - d.t0)
      const dismiss = d.dy > el.offsetHeight * 0.28 || (velocity > 0.5 && d.dy > 24)

      if (dismiss) {
        /*
         * Animate to the closed position explicitly rather than clearing the inline transform.
         * Clearing it would settle the sheet back to 0 for the frame before React drops
         * `data-open`, so the sheet would snap up and only then slide away.
         */
        el.style.transform = 'translateY(100%)'
        closeAll()
        window.setTimeout(() => {
          if (el) el.style.transform = ''
        }, 300)
      } else {
        el.style.transform = ''
      }
    },
    [closeAll],
  )

  // the sheet is the top layer, so Escape and the hardware/browser back gesture should dismiss it
  useEffect(() => {
    if (!stack.length) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stack.length, back])

  // while a sheet is up, the page behind it must not scroll
  useEffect(() => {
    if (!stack.length) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [stack.length])

  return (
    <OpenCardContext.Provider value={push}>
      <div className="m-shell">
        <header className="m-bar">
          {/* the way back to what a phone opens on, since this shell replaced it wholesale */}
          <button
            type="button"
            className="m-bar__back"
            onClick={onLeave}
            aria-label={mobileCopy.backToResumeLabel}
          >
            <span aria-hidden>← </span>
            {mobileCopy.backToResume}
          </button>
          <div className="m-bar__end">
            {/*
              * The way to the real canvas. Next to the exit rather than buried in the dock,
              * because "is this the cut-down version?" is a question you have on arrival, and
              * the answer should be reachable from where you are when you ask it.
              */}
            <button
              type="button"
              className="m-bar__mode"
              onClick={() => setDesktopHelp((v) => !v)}
              aria-label={mobileCopy.desktopModeLabel}
              aria-expanded={desktopHelp}
            >
              {mobileCopy.desktopMode}
              <span aria-hidden>?</span>
            </button>
            <SoundMenu />
          </div>
        </header>

        {/*
          * How to get the desktop version, which is a browser setting rather than a mode of ours.
          *
          * This used to hand the phone the real canvas directly, and the cost of doing that was
          * the tell: it had to override the guard that keeps a 717px dock off a 390px screen,
          * re-pin the control pill so "Fit all" could be reached at all, and add a fixed escape
          * button because the canvas offers no exit a thumb can drive. Every browser already has
          * this switch and implements it properly.
          */}
        {desktopHelp ? (
          <p className="m-help" role="note">
            {mobileCopy.desktopHelp}
            <button type="button" className="m-help__x" onClick={() => setDesktopHelp(false)}>
              {mobileCopy.desktopHelpDismiss}
            </button>
          </p>
        ) : null}

        <div className="m-hero">{hero}</div>

        {/*
          * Kept mounted so it can animate both ways, same reasoning as the desktop menus:
          * unmounting removes the node before an exit transition can run.
          */}
        {/*
          * `--c` and `--c-soft` belong on the sheet, not the header.
          *
          * The canvas sets both on the card root, so every rule inside a card body can mix
          * against the card's own colour — 28 of them do, from the contribution ramp to the
          * theme swatches to the terminal. Setting them on the header alone left the body with
          * `--c` undefined, and each of those mixes silently collapsed: the contribution graph
          * rendered a full year of grey, which is what a broken theme looks like from outside.
          */}
        <div
          className="m-sheet"
          ref={sheetRef}
          data-open={current ? true : undefined}
          aria-hidden={!current}
          style={
            shown
              ? { ['--c' as string]: shown.colour, ['--c-soft' as string]: shown.tint }
              : undefined
          }
        >
          <div
            className="m-sheet__head"
            ref={headRef}
            onPointerDown={onGrabDown}
            onPointerMove={onGrabMove}
            onPointerUp={onGrabUp}
            onPointerCancel={onGrabUp}
          >
            <span className="m-sheet__grab" aria-hidden />
            {stack.length > 1 ? (
              <button type="button" className="m-sheet__back" onClick={back} aria-label="Back">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                  strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
            ) : (
              <span className="m-sheet__ico">
                {shown ? <AppIcon name={shown.icon} size={16} /> : null}
              </span>
            )}
            <span className="m-sheet__title">{shown?.label}</span>
            <button type="button" className="card__x" onClick={closeAll} aria-label="Close" />
          </div>
          <div className="m-sheet__body" key={shown?.id}>
            {shown?.body}
          </div>
        </div>

        <nav className="m-dock" aria-label="Open a card">
          <div className="m-dock__scroll">
            {dock.map((item) => (
              <button
                key={item.id}
                type="button"
                className="m-dock__item"
                data-app-id={item.id}
                aria-label={item.label}
                data-open={stack[0] === item.id || undefined}
                onClick={() => openFromDock(item.id)}
              >
                <span className="dock__icon" style={{ ['--c' as string]: item.colour }}>
                  <AppIcon name={item.icon} size={20} />
                </span>
                <span className="m-dock__label">{item.label}</span>
              </button>
            ))}
            <span className="m-dock__sep" aria-hidden />
            {externals.map((item) => (
              <a
                key={item.id}
                className="m-dock__item"
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
              >
                <span className="dock__icon" style={{ ['--c' as string]: item.colour }}>
                  <AppIcon name={item.icon} size={20} />
                </span>
                <span className="m-dock__label">{item.label}</span>
              </a>
            ))}
          </div>
        </nav>
      </div>
    </OpenCardContext.Provider>
  )
}
