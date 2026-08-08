'use client'

import { useSyncExternalStore } from 'react'

import { play as playSound } from '@/lib/audio'
import {
  getFoldersServerSnapshot,
  getFoldersSnapshot,
  subscribeFolders,
  toggleFolder,
} from '@/lib/dock'

import { AppIcon } from './app-icon'

export interface DockItem {
  id: string
  label: string
  icon: string
  colour: string
  href?: string
}

/** A dock tile is either one app or a folder holding several, resolved from `dockLayout`. */
export type DockEntry =
  | { kind: 'app'; app: DockItem }
  | { kind: 'folder'; id: string; label: string; icon: string; colour: string; apps: readonly DockItem[] }

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
 * you read rather than scanned. They expand IN PLACE rather than into a popover, and the open
 * set is remembered — an expanded folder is a preference, not a transient menu, so someone who
 * lives in the arcade finds it open tomorrow.
 */
export function Dock({ entries, externals, openIds, onOpen, onHover }: Props) {
  const openFolders = useSyncExternalStore(
    subscribeFolders,
    getFoldersSnapshot,
    getFoldersServerSnapshot,
  )

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

  const appTile = (item: DockItem, inFolder = false) => (
    <button
      key={item.id}
      type="button"
      className={inFolder ? 'dock__item dock__item--in' : 'dock__item'}
      aria-label={item.label}
      /* the closing card finds its dock icon by this, to shrink back into it */
      data-app-id={item.id}
      data-open={openIds.has(item.id) || undefined}
      onMouseEnter={onHover}
      onClick={(e) => {
        const el = e.currentTarget
        bounce(el)
        playSound('click')
        if (item.href) {
          window.open(item.href, '_blank', 'noopener,noreferrer')
          return
        }
        onOpen(item.id, el.getBoundingClientRect())
      }}
    >
      <span className="dock__icon" style={{ ['--c' as string]: item.colour }}>
        <AppIcon name={item.icon} size={inFolder ? 19 : 22} />
      </span>
      <span className="dock__tip">{item.label}</span>
    </button>
  )

  const folder = (entry: Extract<DockEntry, { kind: 'folder' }>) => {
    const isOpen = openFolders.includes(entry.id)
    const anyOpen = entry.apps.some((a) => openIds.has(a.id))
    return (
      <div className="dock__folder" key={entry.id} data-open={isOpen || undefined}>
        <button
          type="button"
          className="dock__item dock__item--folder"
          aria-label={`${entry.label} — ${entry.apps.length} cards`}
          aria-expanded={isOpen}
          data-folder-id={entry.id}
          /* lit when something inside is on the canvas, so the dot still means "this is out" */
          data-open={anyOpen || undefined}
          onMouseEnter={onHover}
          onClick={(e) => {
            bounce(e.currentTarget)
            playSound('click')
            toggleFolder(entry.id)
          }}
        >
          <span className="dock__icon" style={{ ['--c' as string]: entry.colour }}>
            <AppIcon name={entry.icon} size={22} />
            {/*
              * A disclosure chevron, because the dashed border alone was not reading as "this
              * one opens". It points right when closed and down when open, which is the one
              * convention everybody already knows.
              */}
            <span className="dock__caret" aria-hidden>
              <svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 2.5 8 6l-4 3.5" />
              </svg>
            </span>
          </span>
          <span className="dock__tip">
            {entry.label} · {entry.apps.length}
          </span>
        </button>

        {/*
          * The expanding tray.
          *
          * Its open width is computed from the number of tiles rather than left intrinsic. The
          * usual `grid-template-columns: 0fr -> 1fr` trick cannot work here: the inner element
          * has to clip while it animates, which drops its min-content to zero, so the column
          * resolved against nothing and the dock grew 41px for a four-card folder. Every tile in
          * a tray is one fixed size, so the arithmetic is exact and animates honestly.
          */}
        <div
          className="dock__tray"
          aria-hidden={!isOpen}
          /* every tile in here is a fixed size, so the open width is arithmetic, not a measurement */
          style={{ ['--n' as string]: entry.apps.length }}
        >
          <div className="dock__tray-inner">
            {entry.apps.map((a) => appTile(a, true))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <nav id="dock" aria-label="Open a card">
      {/*
        * A scroll box around the panel, not on it. Three expanded folders make the dock 1189px,
        * which runs off a 1180px viewport and puts tiles somewhere you cannot click. The wrapper
        * carries tall padding cancelled by a negative margin, so the hover lift and the tooltips
        * still have room inside the scrolling box instead of being clipped by it.
        */}
      <div className="dock__scroll">
        <div className="dock__panel">
          {entries.map((e) => (e.kind === 'app' ? appTile(e.app) : folder(e)))}
          <span className="dock__sep" aria-hidden />
          {externals.map((x) => appTile(x))}
        </div>
      </div>
    </nav>
  )
}
