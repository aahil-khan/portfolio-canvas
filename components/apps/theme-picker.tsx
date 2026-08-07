'use client'

import { useSyncExternalStore } from 'react'

import { type Theme, themes } from '@/content/themes'
import { play } from '@/lib/audio'
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
} from '@/lib/theme'

/**
 * The theme card.
 *
 * Split into Light and Dark rather than one flat grid: eighteen equal rows is a wall, and the
 * first thing anyone actually wants to narrow by is whether it's light or dark. Each swatch
 * previews its own palette using that theme's own tokens, so the button shows you what the
 * page becomes.
 */
export function ThemePicker() {
  const active = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot)

  const group = (label: string, list: readonly Theme[]) => (
    <section className="theme-group" key={label}>
      <h3>
        {label} <span>{list.length}</span>
      </h3>
      <div className="themes">
        {list.map((t) => (
          <button
            key={t.id}
            type="button"
            className="theme"
            aria-pressed={active === t.id}
            onClick={() => {
              setTheme(t.id)
              play('theme')
            }}
          >
            <span
              className="theme__chip"
              style={{ background: t.tokens.canvas, borderColor: t.tokens.border }}
            >
              <span className="theme__bar" style={{ background: t.tokens.accent }} />
              <span className="theme__bar theme__bar--thin" style={{ background: t.tokens.ink }} />
              <span
                className="theme__bar theme__bar--thin"
                style={{ background: t.tokens.inkSubtle }}
              />
            </span>
            <span className="theme__name">{t.label}</span>
          </button>
        ))}
      </div>
    </section>
  )

  return (
    <>
      {group('Light', themes.filter((t) => !t.dark))}
      {group('Dark', themes.filter((t) => t.dark))}
    </>
  )
}
