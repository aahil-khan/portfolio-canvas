'use client'

import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { AA_SIZES, getLookServerSnapshot, getLookSnapshot, setAa, subscribeLook, type AaMeasure } from '@/lib/lab/look'
import { fill } from '@/lib/lab/view'
import { useReducedMotion } from '@/lib/motion/reduced'
import { EASE_BEZIER, LAB, sec } from '@/lib/motion/tokens'

export interface AaLabels {
  label: string
  measure: string
  wide: string
  comfortable: string
  size: string
  /** `{n}px` */
  px: string
}

/**
 * Aa: the line length (wide 96ch, comfortable 72ch) and the body size (16, 17, 19px), owned by
 * `lib/lab/look.ts`. A small panel under the bar; Esc or a press outside closes it and focus goes
 * back to the button. It enters in 120ms and leaves in 180ms (controls, DIRECTION).
 */
export function Aa({ labels }: { labels: AaLabels }) {
  const [open, setOpen] = useState(false)
  const s = useSyncExternalStore(subscribeLook, getLookSnapshot, getLookServerSnapshot)
  const reduced = useReducedMotion()
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btn.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open])

  const measures: [AaMeasure, string][] = [
    ['wide', labels.wide],
    ['comfortable', labels.comfortable],
  ]
  const lift = reduced ? 0 : -4
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="lab-ctl lab-ctl-icon"
        data-aa
        data-needs-js
        aria-expanded={open}
        aria-controls="lab-aa"
        aria-label={labels.label}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="lab-i-aa" aria-hidden="true">
          Aa
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            ref={pop}
            id="lab-aa"
            className="lab-pop"
            data-aa-panel
            data-lenis-prevent
            role="group"
            aria-label={labels.label}
            initial={{ opacity: 0, y: lift }}
            animate={{ opacity: 1, y: 0, transition: { duration: sec(LAB.control.in), ease: EASE_BEZIER } }}
            exit={{ opacity: 0, y: lift, transition: { duration: sec(reduced ? LAB.control.in : LAB.control.out), ease: EASE_BEZIER } }}
          >
            <div className="lab-pop-row">
              <p className="lab-pop-label meta">{labels.measure}</p>
              <div className="lab-seg">
                {measures.map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={s.aa.measure === v} onClick={() => setAa({ measure: v })}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="lab-pop-row">
              <p className="lab-pop-label meta">{labels.size}</p>
              <div className="lab-seg">
                {AA_SIZES.map((n) => (
                  <button key={n} type="button" aria-pressed={s.aa.size === n} onClick={() => setAa({ size: n })}>
                    {fill(labels.px, { n })}
                  </button>
                ))}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
