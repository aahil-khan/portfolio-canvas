'use client'

import { useSyncExternalStore } from 'react'

import { DEFAULT_THEME, themes } from '@/content/themes'
import { play } from '@/lib/audio'
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
} from '@/lib/theme'

/**
 * Light ↔ dark, in the top bar.
 *
 * The Themes card has all eighteen, but it is a card you have to know to open, and the one
 * thing people want at 1am is the switch — not a palette. So this is deliberately the crude
 * version and says where the real one lives.
 *
 * It remembers the last theme used on each side, so someone who chose Gruvbox Dark and flipped
 * to light gets Gruvbox Dark back rather than a default they never picked. That memory is
 * per-tab: writing two more keys to localStorage to remember a preference about a preference is
 * more machinery than the feature is worth.
 */

/*
 * The dark side of the switch when nothing has been chosen yet. Named rather than "the first
 * dark theme in the list", which silently meant Catppuccin Frappé because of array order. Change
 * this one line to change what the toggle lands on.
 */
const DARK_FALLBACK =
  themes.find((t) => t.id === 'tokyo-night')?.id ?? themes.find((t) => t.dark)?.id ?? DEFAULT_THEME
const LIGHT_FALLBACK = DEFAULT_THEME
const isDark = (id: string) => themes.find((t) => t.id === id)?.dark ?? false

let lastLight: string | null = null
let lastDark: string | null = null

const SUN = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </svg>
)

const MOON = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z" />
  </svg>
)

export function ThemeToggle() {
  const active = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot)
  const dark = isDark(active)

  const flip = () => {
    if (dark) {
      lastDark = active
      setTheme(lastLight ?? LIGHT_FALLBACK)
    } else {
      lastLight = active
      setTheme(lastDark ?? DARK_FALLBACK)
    }
    play('theme')
  }

  return (
    <button
      type="button"
      className="pill__theme"
      onClick={flip}
      /* the icon shows what you get, so the label has to say the same thing */
      aria-label={dark ? 'Switch to a light theme' : 'Switch to a dark theme'}
      title={`${dark ? 'Light' : 'Dark'} — all ${themes.length} themes are in the Themes card, in the dock`}
    >
      {dark ? SUN : MOON}
      {/* the dock's own label for this, so the two read as the same thing in two places */}
      Themes
    </button>
  )
}
