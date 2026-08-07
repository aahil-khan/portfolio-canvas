'use client'

import { useRef } from 'react'

import { play } from '@/lib/audio'

import { AppIcon } from './app-icon'

export interface DockItem {
  id: string
  label: string
  icon: string
  colour: string
  href?: string
}

interface Props {
  items: readonly DockItem[]
  externals: readonly DockItem[]
  openIds: ReadonlySet<string>
  onOpen: (id: string, origin: DOMRect) => void
  onHover: () => void
}

/**
 * Hover lifts the icon and shows its label. No macOS magnification — the neighbours staying
 * still is the point; magnification makes a nine-item dock feel like it's squirming.
 */
export function Dock({ items, externals, openIds, onOpen, onHover }: Props) {
  const refs = useRef(new Map<string, HTMLButtonElement>())

  /** Bounces the icon, not the button — the button's box must not move or hover flickers. */
  const bounce = (button: HTMLElement) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = button.querySelector<HTMLElement>('.dock__icon') ?? button
    el.animate(
      [
        { transform: 'translateY(-10px) scale(1)' },
        { transform: 'translateY(-14px) scale(1.06)', offset: 0.35 },
        { transform: 'translateY(-8px) scale(.98)', offset: 0.7 },
        { transform: 'translateY(-10px) scale(1)' },
      ],
      { duration: 400, easing: 'cubic-bezier(.16,1,.3,1)' },
    )
  }

  const render = (item: DockItem) => (
    <button
      key={item.id}
      ref={(n) => {
        if (n) refs.current.set(item.id, n)
        else refs.current.delete(item.id)
      }}
      type="button"
      className="dock__item"
      aria-label={item.label}
      /* the closing card finds its dock icon by this, to shrink back into it */
      data-app-id={item.id}
      data-open={openIds.has(item.id) || undefined}
      onMouseEnter={onHover}
      onClick={(e) => {
        const el = e.currentTarget
        bounce(el)
        play('click')
        if (item.href) {
          window.open(item.href, '_blank', 'noopener,noreferrer')
          return
        }
        onOpen(item.id, el.getBoundingClientRect())
      }}
    >
      <span className="dock__icon" style={{ ['--c' as string]: item.colour }}>
        <AppIcon name={item.icon} size={22} />
      </span>
      <span className="dock__tip">{item.label}</span>
    </button>
  )

  return (
    <nav id="dock" aria-label="Open a card">
      <div className="dock__panel">
        {items.map(render)}
        <span className="dock__sep" aria-hidden />
        {externals.map(render)}
      </div>
    </nav>
  )
}
