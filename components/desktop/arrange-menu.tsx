'use client'

import { useEffect, useRef, useState } from 'react'

import { arrangements } from '@/lib/canvas/arrange'

/** The Arrange dropdown in the top pill. */
export function ArrangeMenu({
  onPick,
  onReset,
}: {
  onPick: (id: string) => void
  onReset: () => void
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

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
    <div className="arrange" ref={wrap}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        className={open ? 'on' : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        Arrange <span aria-hidden>▾</span>
      </button>
      <div className="arrange__menu" role="menu" data-open={open || undefined}>
          {arrangements.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onPick(a.id)
              }}
            >
              <span className="arrange__label">{a.label}</span>
              <span className="arrange__hint">{a.hint}</span>
            </button>
          ))}
          {/* the saved layout is sticky by design, so there has to be a way back to a fresh deal */}
          <div className="arrange__reset">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onReset()
              }}
            >
              <span className="arrange__label">Reset layout</span>
              <span className="arrange__hint">forget saved positions, deal again</span>
            </button>
          </div>
      </div>
    </div>
  )
}
