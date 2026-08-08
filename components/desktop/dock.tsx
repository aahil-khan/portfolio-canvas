'use client'

import { useEffect, useRef, useState } from 'react'

import { play } from '@/lib/audio'

import { AppIcon } from './app-icon'

export interface DockItem {
  id: string
  label: string
  icon: string
  colour: string
  href?: string
}

/** A dock tile is either one app or a folder holding several, resolved from `dockLayout`. */
export type DockEntry = { kind: 'app'; app: DockItem } | { kind: 'folder'; id: string; label: string; apps: readonly DockItem[] }

interface Props {
  entries: readonly DockEntry[]
  externals: readonly DockItem[]
  openIds: ReadonlySet<string>
  onOpen: (id: string, origin: DOMRect) => void
  onHover: () => void
}

/**
 * Hover lifts the icon and shows its label. No macOS magnification — the neighbours staying
 * still is the point; magnification makes a nine-item dock feel like it's squirming.
 *
 * Folders exist because fifteen loose tiles plus two externals had turned this into a colour bar
 * you read rather than scanned. A folder tile previews the colours it holds, so it reads as a
 * container instead of another app, and opens a labelled list — the same shape as the Go to and
 * Theme menus in the top pill, because it answers the same kind of question.
 */
export function Dock({ entries, externals, openIds, onOpen, onHover }: Props) {
  const [openFolder, setOpenFolder] = useState<string | null>(null)
  const wrap = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!openFolder) return
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpenFolder(null)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenFolder(null)
    }
    window.addEventListener('pointerdown', away)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', key)
    }
  }, [openFolder])

  /** Bounces the icon, not the button — the button's box must not move or hover flickers. */
  const bounce = (button: HTMLElement) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = button.querySelector<HTMLElement>('.dock__icon, .dock__fold') ?? button
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

  const openApp = (item: DockItem, el: HTMLElement) => {
    if (item.href) {
      window.open(item.href, '_blank', 'noopener,noreferrer')
      return
    }
    onOpen(item.id, el.getBoundingClientRect())
  }

  const appTile = (item: DockItem) => (
    <button
      key={item.id}
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
        setOpenFolder(null)
        openApp(item, el)
      }}
    >
      <span className="dock__icon" style={{ ['--c' as string]: item.colour }}>
        <AppIcon name={item.icon} size={22} />
      </span>
      <span className="dock__tip">{item.label}</span>
    </button>
  )

  const folderTile = (entry: Extract<DockEntry, { kind: 'folder' }>) => {
    const shown = entry.apps.slice(0, 4)
    const isOpen = openFolder === entry.id
    const anyOpen = entry.apps.some((a) => openIds.has(a.id))
    return (
      <div className="dock__folder" key={entry.id}>
        <button
          type="button"
          className="dock__item"
          aria-label={entry.label}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          data-folder-id={entry.id}
          /* lit when something inside is on the canvas, so the dot still means "this is out" */
          data-open={anyOpen || undefined}
          onMouseEnter={onHover}
          onClick={(e) => {
            bounce(e.currentTarget)
            play('click')
            setOpenFolder((f) => (f === entry.id ? null : entry.id))
          }}
        >
          {/* a preview of what is inside, so the tile reads as a container and not another app */}
          <span className="dock__fold" data-n={shown.length}>
            {shown.map((a) => (
              <i key={a.id} style={{ ['--c' as string]: a.colour }} />
            ))}
          </span>
          <span className="dock__tip">{entry.label}</span>
        </button>

        <div className="dock__pop" role="menu" aria-label={entry.label} data-open={isOpen || undefined}>
          {entry.apps.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              /* the FLIP origin still has to be a real dock rect, so this carries the id too */
              data-app-id={a.id}
              data-open={openIds.has(a.id) || undefined}
              onClick={(e) => {
                play('click')
                setOpenFolder(null)
                openApp(a, e.currentTarget)
              }}
            >
              <span className="dock__pop-ico" style={{ ['--c' as string]: a.colour }}>
                <AppIcon name={a.icon} size={15} />
              </span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <nav id="dock" aria-label="Open a card" ref={wrap}>
      <div className="dock__panel">
        {entries.map((e) => (e.kind === 'app' ? appTile(e.app) : folderTile(e)))}
        <span className="dock__sep" aria-hidden />
        {externals.map(appTile)}
      </div>
    </nav>
  )
}
