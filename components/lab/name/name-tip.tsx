'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

import { playClip, prepareClip } from '@/lib/audio'
import { track } from '@/lib/events'
import { INTENT } from '@/lib/motion/tokens'

/** Take 1, Kokoro `am_michael` (Apache 2.0): DIRECTION, "Sound". */
const CLIP = '/audio/name.opus'

/*
 * The two scripts' fonts, subset to the name's own glyphs (3.8 and 2.5 KB, OFL, licences beside
 * them). Registered through the FontFace API the first time the tooltip opens, so no page's
 * stylesheet declares them and nothing fetches them on load.
 */
const FONTS: readonly { family: string; url: string; weight: string }[] = [
  { family: 'Lab Name Devanagari', url: '/fonts/lab-name/tiro-devanagari-hindi-name.woff2', weight: '400' },
  { family: 'Lab Name Arabic', url: '/fonts/lab-name/noto-naskh-arabic-name.woff2', weight: '500' },
]
let primed = false
/** The first open: the two fonts and the clip start loading, once per page life. */
function prime(): void {
  if (primed) return
  primed = true
  prepareClip(CLIP)
  if (typeof FontFace === 'undefined') return
  for (const f of FONTS) {
    const face = new FontFace(f.family, `url(${f.url}) format("woff2")`, { weight: f.weight, display: 'block' })
    document.fonts.add(face)
    face.load().catch(() => {
      /* the system's Devanagari and Arabic stand in */
    })
  }
}

const subscribeNothing = () => () => {}
/** False on the server and while hydrating, true after: the name is a button only where it can work. */
const useHydrated = () =>
  useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  )

/** Space kept between the name and the tooltip, and from the screen's edges. */
const GAP = 10
const EDGE = 8
/** How far left of the name the tooltip starts, so its first script sits over the name. */
const LEAD = 14

export interface NameLabels {
  tip: string
  devanagari: string
  arabic: string
  say: string
  sayLabel: string
}

/**
 * The name and its tooltip (Aahil's decisions, 22–28 Nov). Hovering or focusing the
 * double-underlined name opens one line: आहिल · اءحل and a voice bubble. Only a press on the
 * bubble (a click, a tap, Enter or Space) plays the clip, never a hover, and the bubble's dots move
 * for exactly as long as it sounds. A Mute the reader set silences it (`lib/audio.ts` decides).
 *
 * The tooltip sits above the name, or below it where the bar leaves no room, and slides sideways to
 * stay on screen; it never covers the name. It closes on Escape, on a press outside, on focus
 * leaving, and when the pointer leaves, after a short grace so the pointer can cross to the bubble.
 * On touch: a tap on the name opens and closes it, a tap on the bubble plays, a tap outside closes.
 *
 * Without JavaScript, and until hydration, it is the plain double-underlined word.
 */
export function NameTip({ word, labels }: { word: string; labels: NameLabels }) {
  const hydrated = useHydrated()
  const id = useId()
  const tipId = `${id}-tip`
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const name = useRef<HTMLButtonElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pointer = useRef<string>('mouse')
  /** What opened it: a keyboard-opened tooltip stays while focus is inside, whatever the pointer does. */
  const by = useRef<'pointer' | 'focus' | 'tap'>('pointer')
  /** Set while Escape hands focus back to the name, so that focus does not reopen it. */
  const returning = useRef(false)

  const cancelClose = () => clearTimeout(closing.current)
  const show = useCallback(() => {
    clearTimeout(closing.current)
    prime()
    setOpen(true)
  }, [])
  const hide = useCallback(() => {
    clearTimeout(closing.current)
    setOpen(false)
  }, [])

  // place it: above the name unless the bar is in the way, slid sideways to stay on screen
  const place = useCallback(() => {
    const t = tip.current
    const n = name.current
    if (!t || !n) return
    const r = n.getBoundingClientRect()
    const bar = document.querySelector('[data-bar]')?.getBoundingClientRect()
    const ceiling = Math.max(0, bar && bar.bottom > 0 ? bar.bottom : 0)
    const above = r.top - GAP - t.offsetHeight >= ceiling + EDGE
    const vw = document.documentElement.clientWidth
    const left = Math.min(Math.max(EDGE, r.left - LEAD), vw - t.offsetWidth - EDGE)
    t.dataset.side = above ? 'above' : 'below'
    t.style.setProperty('--tip-x', `${Math.round(left - r.left)}px`)
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const inside = wrap.current?.contains(document.activeElement)
      hide()
      if (inside) {
        returning.current = true
        name.current?.focus({ preventScroll: true })
        returning.current = false
      }
    }
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) hide()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', place)
    }
  }, [open, hide, place])

  useEffect(() => () => clearTimeout(closing.current), [])

  if (!hydrated) return <span className="lab-name">{word}</span>

  return (
    <span
      ref={wrap}
      className="lab-name-wrap"
      data-name-wrap
      data-open={open || undefined}
      onPointerDown={(e) => {
        pointer.current = e.pointerType
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === 'touch') return
        if (!open) by.current = 'pointer'
        show()
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'touch' || by.current !== 'pointer') return
        cancelClose()
        closing.current = setTimeout(hide, INTENT.close)
      }}
      onFocus={(e) => {
        // a keyboard reaching the name opens it; a tap's focus leaves that to the tap
        if (returning.current || open || !e.target.matches(':focus-visible')) return
        by.current = 'focus'
        show()
      }}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node | null)) hide()
      }}
    >
      <button
        ref={name}
        type="button"
        className="lab-name"
        data-name
        aria-expanded={open}
        aria-controls={tipId}
        onClick={(e) => {
          // a tap, or Enter and Space, toggle it; a mouse is already showing it by hovering
          const tap = pointer.current === 'touch'
          const key = e.detail === 0
          pointer.current = 'mouse'
          if ((tap || key) && open) hide()
          else {
            if (!open) by.current = tap ? 'tap' : key ? 'focus' : 'pointer'
            show()
          }
        }}
      >
        {word}
      </button>
      <span ref={tip} id={tipId} className="lab-name-tip" data-name-tip role="group" aria-label={labels.tip} hidden={!open}>
        <span className="lab-name-dev" lang="hi">
          {labels.devanagari}
        </span>
        <span className="lab-name-sep" aria-hidden="true">
          ·
        </span>
        <span className="lab-name-ar" lang="ar" dir="rtl">
          {labels.arabic}
        </span>
        <button
          type="button"
          className="lab-name-say"
          data-name-say
          data-playing={playing || undefined}
          aria-label={labels.sayLabel}
          title={labels.say}
          onClick={() => {
            const ok = playClip(CLIP, {
              onPlaying: () => setPlaying(true),
              onDone: () => setPlaying(false),
            })
            if (ok) track('name_say', {})
          }}
        >
          <span className="lab-name-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span aria-hidden="true">{labels.say}</span>
        </button>
      </span>
    </span>
  )
}
