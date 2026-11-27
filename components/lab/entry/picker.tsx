'use client'

import * as m from 'motion/react-m'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { useReducedMotion } from '@/lib/motion/reduced'
import { EASE_BEZIER, LAB, sec } from '@/lib/motion/tokens'

export interface PickerChapter {
  order: number
  title: string
  href: string | null
  current: boolean
}

/**
 * The chapter picker (decision 12): a disclosure drop-down framed like a window, over the page, so
 * opening it moves nothing. A native `<details>`, so it opens and closes with JavaScript off too;
 * with it, Esc or a press outside closes it and Esc returns focus to the summary. The panel enters
 * in 120ms. Choosing a chapter asks the sound lane for its page-turn cue (API.md §7).
 */
export function Picker({
  series,
  of,
  title,
  all,
  seriesHref,
  chapters,
}: {
  series: string
  of: string
  title: string
  all: string
  seriesHref: string
  chapters: PickerChapter[]
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  const [opened, setOpened] = useState(0)
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()
  const current = chapters.find((c) => c.current)
  const pad = (n: number) => String(n).padStart(2, '0')

  useEffect(() => {
    if (!open) return
    const d = ref.current
    const close = (focus: boolean) => {
      if (!d) return
      d.open = false
      if (focus) d.querySelector('summary')?.focus()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(true)
    const onDown = (e: PointerEvent) => d && !d.contains(e.target as Node) && close(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open])

  return (
    <details
      ref={ref}
      className="lab-picker"
      data-picker
      onToggle={(e) => {
        const on = (e.currentTarget as HTMLDetailsElement).open
        setOpen(on)
        if (on) setOpened((n) => n + 1)
      }}
    >
      <summary>
        <span>{series}</span>
        <span>
          <span data-num>{pad(current?.order ?? 0)}</span> {of} <span data-num>{pad(chapters.length)}</span>
        </span>
        <span className="lab-ticks" aria-hidden="true">
          {chapters.map((c) => (
            <i key={c.order} data-on={c.current ? '' : undefined} />
          ))}
        </span>
        <span className="lab-chev" aria-hidden="true" />
      </summary>
      <m.div
        key={opened}
        className="lab-picker-panel"
        data-picker-panel
        initial={opened ? { opacity: 0, y: reduced ? 0 : -4 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: sec(LAB.control.in), ease: EASE_BEZIER }}
      >
        <div className="lab-window-bar">{title}</div>
        <ol className="lab-chapters">
          {chapters.map((c) => (
            <li key={c.order}>
              <span data-num>{pad(c.order)}</span>
              {c.current ? (
                <span aria-current="page">{c.title}</span>
              ) : c.href ? (
                <Link href={c.href} onClick={() => document.dispatchEvent(new CustomEvent('lab:cue', { detail: { name: 'turn' } }))}>
                  {c.title}
                </Link>
              ) : (
                <span className="meta">{c.title}</span>
              )}
            </li>
          ))}
        </ol>
        <p className="lab-picker-all">
          <Link href={seriesHref}>{all}</Link>
        </p>
      </m.div>
    </details>
  )
}
