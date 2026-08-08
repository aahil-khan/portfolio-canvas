'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { DEFAULT_THEME, themes } from '@/content/themes'
import { play } from '@/lib/audio'
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
} from '@/lib/theme'

/**
 * The Theme dropdown in the top pill.
 *
 * Light and dark are the two choices anyone actually wants from the chrome; the full palette is
 * a card, and the third row is how you get to it rather than something you have to already know
 * about. Reuses `.arrange`'s wrapper, menu and open/close animation, like Go to does — a third
 * subtly different dropdown in the same bar would read as an accident.
 *
 * Picking a side restores the last theme used on it, so someone who chose Gruvbox Dark, went
 * light, and came back gets Gruvbox Dark rather than a default they never picked. That memory is
 * per-tab: two more localStorage keys to remember a preference about a preference is more
 * machinery than this is worth.
 */

const LIGHT = themes.filter((t) => !t.dark)
const DARK = themes.filter((t) => t.dark)

/*
 * Named, not "the first of each in the list" — that silently meant Catppuccin Frappé for dark,
 * purely because of array order. Change these two lines to move where the switch lands.
 */
const DARK_DEFAULT = DARK.find((t) => t.id === 'tokyo-night')?.id ?? DARK[0]?.id ?? DEFAULT_THEME
const LIGHT_DEFAULT = LIGHT.find((t) => t.id === DEFAULT_THEME)?.id ?? LIGHT[0]?.id ?? DEFAULT_THEME

const nameOf = (id: string) => themes.find((t) => t.id === id)?.label ?? id
const isDark = (id: string) => themes.find((t) => t.id === id)?.dark ?? false

const icon = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true } as const

const SUN = (
  <svg {...icon} strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </svg>
)
const MOON = (
  <svg {...icon} strokeLinejoin="round">
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z" />
  </svg>
)
const SWATCHES = (
  <svg {...icon} strokeLinejoin="round">
    <circle cx="9" cy="9" r="5" />
    <circle cx="15.5" cy="15" r="5" />
  </svg>
)

export function ThemeMenu({ onOpenThemes }: { onOpenThemes: () => void }) {
  const active = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot)
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  /*
   * State, not refs: these two are rendered as the hint under each row, and a ref read during
   * render is a value React never re-renders for — the hint would keep naming the theme you
   * left three switches ago.
   */
  const [lastLight, setLastLight] = useState<string | null>(null)
  const [lastDark, setLastDark] = useState<string | null>(null)

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

  const dark = isDark(active)

  const pick = (wantDark: boolean) => {
    // remember where we were, before leaving this side
    if (dark) setLastDark(active)
    else setLastLight(active)

    setOpen(false)
    const next = wantDark ? (lastDark ?? DARK_DEFAULT) : (lastLight ?? LIGHT_DEFAULT)
    if (next === active) return
    setTheme(next)
    play('theme')
  }

  const row = (glyph: typeof SUN, label: string, hint: string) => (
    <>
      <span className="theme-menu__row">
        {glyph}
        <span className="arrange__label">{label}</span>
      </span>
      <span className="arrange__hint">{hint}</span>
    </>
  )

  return (
    <div className="arrange theme-menu" ref={wrap}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        className={open ? 'on' : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {dark ? MOON : SUN} Theme <span aria-hidden>▾</span>
      </button>

      <div className="arrange__menu theme-menu__menu" role="menu" data-open={open || undefined}>
        {/* radios, not plain items: these two are one either/or choice and a reader should hear that */}
        <button type="button" role="menuitemradio" aria-checked={!dark} onClick={() => pick(false)}>
          {row(SUN, 'Light', nameOf(lastLight ?? LIGHT_DEFAULT))}
        </button>
        <button type="button" role="menuitemradio" aria-checked={dark} onClick={() => pick(true)}>
          {row(MOON, 'Dark', nameOf(lastDark ?? DARK_DEFAULT))}
        </button>

        <div className="arrange__reset">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenThemes()
            }}
          >
            {row(SWATCHES, 'All', `every theme in a card — ${themes.length} of them`)}
          </button>
        </div>
      </div>
    </div>
  )
}
