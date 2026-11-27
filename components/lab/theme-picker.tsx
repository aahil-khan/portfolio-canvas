'use client'

import { useSyncExternalStore } from 'react'

import { BarPanel, useBarPanel } from '@/components/lab/bar-panel'
import { labThemes, themes, type Theme } from '@/content/themes'
import { track } from '@/lib/events'
import { getLookServerSnapshot, getLookSnapshot, setLabTheme, subscribeLook } from '@/lib/lab/look'

export interface ThemeLabels {
  label: string
  light: string
  dark: string
  close: string
}

/** Light, then Dark, as the canvas's Themes window lists them; the Lab's own palette leads each. */
const GROUPS: { key: 'light' | 'dark'; list: readonly Theme[] }[] = [
  { key: 'light', list: [...labThemes.filter((t) => !t.dark), ...themes.filter((t) => !t.dark)] },
  { key: 'dark', list: [...labThemes.filter((t) => t.dark), ...themes.filter((t) => t.dark)] },
]

/**
 * The theme picker (rule 18): one control in the bar, opening every palette the site has plus the
 * Lab's two, in Light and Dark groups with a swatch each, like the canvas's Themes window. The
 * Lab keeps its own choice (`lab.theme`, Lab Dark by default, `lib/lab/look.ts`), so nothing here
 * touches `canvas.theme`. The bar's button shows a swatch of the live tokens, which is right from
 * the first paint. Hidden with JavaScript off (`data-needs-js`), where it could not work.
 */
export function ThemePicker({ labels }: { labels: ThemeLabels }) {
  const s = useSyncExternalStore(subscribeLook, getLookSnapshot, getLookServerSnapshot)
  const { open, setOpen, button, panel } = useBarPanel()

  const pick = (t: Theme) => {
    if (t.id === s.theme) return
    setLabTheme(t.id)
    track('look_switch', { look: t.labOnly ? 'lab' : 'paper', mode: t.dark ? 'dark' : 'light' })
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className="lab-ctl lab-theme-btn"
        data-theme-open
        data-needs-js
        aria-expanded={open}
        aria-controls="lab-theme"
        aria-label={labels.label}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="lab-swatch lab-swatch-live" aria-hidden="true">
          <i />
          <i />
        </span>
        <span className="lab-theme-word" aria-hidden="true">
          {labels.label}
        </span>
      </button>
      <BarPanel
        id="lab-theme"
        title={labels.label}
        closeLabel={labels.close}
        open={open}
        onClose={() => setOpen(false)}
        panel={panel}
        button={button}
        data-theme-panel
      >
        {GROUPS.map((g) => (
          <div key={g.key} className="lab-themes-group" role="group" aria-labelledby={`lab-theme-${g.key}`}>
            <h3 className="end-h" id={`lab-theme-${g.key}`}>
              {labels[g.key]} <span>{g.list.length}</span>
            </h3>
            <div className="lab-themes">
              {g.list.map((t) => (
                <button key={t.id} type="button" className="lab-theme" data-theme-option={t.id} aria-pressed={s.theme === t.id} onClick={() => pick(t)}>
                  <span className="lab-swatch" data-swatch aria-hidden="true" style={{ background: t.tokens.canvas, borderColor: t.tokens.border }}>
                    <i style={{ background: t.tokens.accent }} />
                    <i style={{ background: t.tokens.ink }} />
                    <i style={{ background: t.tokens.inkSubtle }} />
                  </span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </BarPanel>
    </>
  )
}
