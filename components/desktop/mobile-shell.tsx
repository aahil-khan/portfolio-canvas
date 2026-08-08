'use client'

import { type ReactNode, useCallback, useEffect, useState } from 'react'

import { play } from '@/lib/audio'

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
export function MobileShell({ cards, dock, externals, hero }: Props) {
  /** Card ids, deepest last. Empty means the hero is showing. */
  const [stack, setStack] = useState<string[]>([])
  const byId = new Map(cards.map((c) => [c.id, c]))
  const current = stack.length ? byId.get(stack[stack.length - 1]) : undefined

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
          <SoundMenu />
        </header>

        <div className="m-hero">{hero}</div>

        {/*
          * Kept mounted so it can animate both ways, same reasoning as the desktop menus:
          * unmounting removes the node before an exit transition can run.
          */}
        <div className="m-sheet" data-open={current ? true : undefined} aria-hidden={!current}>
          <div className="m-sheet__head" style={current ? { ['--c' as string]: current.colour } : undefined}>
            {stack.length > 1 ? (
              <button type="button" className="m-sheet__back" onClick={back} aria-label="Back">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                  strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
            ) : (
              <span className="m-sheet__ico">
                {current ? <AppIcon name={current.icon} size={16} /> : null}
              </span>
            )}
            <span className="m-sheet__title">{current?.label}</span>
            <button type="button" className="card__x" onClick={closeAll} aria-label="Close" />
          </div>
          <div className="m-sheet__body" key={current?.id}>
            {current?.body}
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
