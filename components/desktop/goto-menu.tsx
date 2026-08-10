'use client'

import { useEffect, useRef, useState } from 'react'

import { AppIcon } from './app-icon'

export interface GotoItem {
  id: string
  label: string
  icon: string
  colour: string
}

/**
 * The "Go to" dropdown in the top pill: everything currently on the canvas, one click to pan to it.
 *
 * The canvas is infinite and cards get dragged, dealt randomly and flung about by arrangements,
 * so "where did Konta go" is a question the chrome could not answer without opening the command
 * palette and knowing it existed. This is that answer, in the place people already look.
 *
 * It reuses `.arrange`'s wrapper and menu classes deliberately — the open/close animation there
 * was worked out carefully (see the comment on `.arrange__menu`) and a second, subtly different
 * dropdown two buttons along would read as an accident.
 */
export function GotoMenu({
  items,
  onPick,
  tip,
}: {
  items: readonly GotoItem[]
  onPick: (id: string) => void
  tip?: string
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  const empty = items.length === 0

  // close on outside click or Escape, so it never strands itself over the canvas
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', away)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', key)
    }
  }, [open])


  return (
    <div className="arrange goto" ref={wrap}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Go to"
        className={open ? 'on' : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        Go to <span aria-hidden>▾</span>
      </button>
      {tip ? <span className="pill__tip">{tip}</span> : null}
      <div className="arrange__menu goto__menu" role="menu" data-open={open || undefined}>
        {/*
         * Always present, so an empty canvas gets a menu that explains itself rather than a bare
         * white box. `presentation` keeps it out of the menu's item list for a screen reader.
         */}
        <p className="goto__head" role="presentation">
          On the canvas
        </p>
        {empty ? <p className="goto__none">Nothing open yet.</p> : null}
        {items.map((i) => (
          <button
            key={i.id}
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onPick(i.id)
            }}
          >
            {/* the card's own colour, so the list is scannable the way the canvas is */}
            <span className="goto__ico" style={{ ['--c' as string]: i.colour }}>
              <AppIcon name={i.icon} size={13} />
            </span>
            <span className="arrange__label">{i.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
