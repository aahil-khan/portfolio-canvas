'use client'

import { useState, useSyncExternalStore } from 'react'

import { site } from '@/content'
import { DEFAULT_THEME, themes } from '@/content/themes'
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
} from '@/lib/theme'

/**
 * Light / dark, and nothing else.
 *
 * The full 18-theme palette belongs on the canvas, where picking a theme is part of the toy.
 * This page is the one a recruiter or a parent lands on, and a two-column menu of Catppuccin
 * variants is a decision nobody came here to make. One button, two states.
 *
 * It still writes through `lib/theme.ts` — the same external store the canvas uses — so the
 * choice carries across both surfaces, and a theme picked on the canvas is honoured here.
 *
 * `useSyncExternalStore`, not `useState` + an effect: the live value is the `data-theme`
 * attribute an inline script sets before first paint, and reading it during render on the server
 * is a hydration mismatch. The server snapshot is the default, so first paint matches the markup.
 */

const isDark = (id: string) => themes.find((t) => t.id === id)?.dark ?? false

/* Named rather than "first of each kind" — array order silently decided this once already. */
const LIGHT_ID = DEFAULT_THEME
const DARK_ID = themes.find((t) => t.id === 'tokyo-night')?.id ?? DEFAULT_THEME

export function ThemeToggle() {
  const active = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot)
  const dark = isDark(active)

  /*
   * Remembers the theme last seen on each side, so someone who chose Gruvbox Dark on the canvas
   * and toggles to light and back gets Gruvbox Dark again rather than this page's default. One
   * button either way — the memory only stops the toggle quietly discarding their choice.
   */
  const [lastLight, setLastLight] = useState<string | null>(null)
  const [lastDark, setLastDark] = useState<string | null>(null)

  const toggle = () => {
    if (dark) {
      setLastDark(active)
      setTheme(lastLight ?? LIGHT_ID)
    } else {
      setLastLight(active)
      setTheme(lastDark ?? DARK_ID)
    }
  }

  return (
    <button
      type="button"
      className="themepick"
      onClick={toggle}
      /* the label names what pressing it does, not what is currently showing */
      aria-label={dark ? site.theme.toLight : site.theme.toDark}
      title={dark ? site.theme.toLight : site.theme.toDark}
    >
      {dark ? MOON : SUN}
    </button>
  )
}

const icon = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  'aria-hidden': true,
} as const

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
