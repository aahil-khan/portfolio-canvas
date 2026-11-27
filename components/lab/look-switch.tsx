'use client'

import { useSyncExternalStore } from 'react'

import { getLookServerSnapshot, getLookSnapshot, setLook, subscribeLook, toggleDark, type Look } from '@/lib/lab/look'
import { track } from '@/lib/events'

const useLook = () => useSyncExternalStore(subscribeLook, getLookSnapshot, getLookServerSnapshot)

export interface LookLabels {
  group: string
  paper: string
  lab: string
  toPaper: string
  toLab: string
}

/**
 * The look switch (rule 18): Paper | Lab theme, a segmented switch in the bar on desktop and one
 * button naming the other look on a phone. State is `lib/lab/look.ts`'s, read through
 * `useSyncExternalStore`, so the server's HTML and the first client render agree. Hidden with
 * JavaScript off (`data-needs-js`), where it could not work.
 */
export function LookSwitch({ labels }: { labels: LookLabels }) {
  const s = useLook()
  const pick = (look: Look) => {
    if (look === s.look) return
    setLook(look)
    track('look_switch', look === 'lab' ? { look, mode: s.mode } : { look })
  }
  const other: Look = s.look === 'paper' ? 'lab' : 'paper'
  return (
    <>
      <div className="lab-look" role="group" aria-label={labels.group} data-look-switch data-needs-js>
        <button type="button" data-look-option="paper" aria-pressed={s.look === 'paper'} onClick={() => pick('paper')}>
          {labels.paper}
        </button>
        <button type="button" data-look-option="lab" aria-pressed={s.look === 'lab'} onClick={() => pick('lab')}>
          {labels.lab}
        </button>
      </div>
      <button
        type="button"
        className="lab-ctl lab-look-phone"
        data-look-toggle
        data-needs-js
        aria-label={other === 'lab' ? labels.toLab : labels.toPaper}
        onClick={() => pick(other)}
      >
        {other === 'lab' ? labels.lab : labels.paper}
      </button>
    </>
  )
}

/** The one light/dark button: Light ⇄ Dark in the Lab theme, cream ⇄ tokyo-night in Paper. */
export function DarkToggle({ toDark, toLight }: { toDark: string; toLight: string }) {
  const s = useLook()
  return (
    <button
      type="button"
      className="lab-ctl lab-ctl-icon"
      data-dark-toggle
      data-needs-js
      aria-label={s.dark ? toLight : toDark}
      onClick={() => {
        toggleDark()
        if (s.look === 'lab') track('look_switch', { look: 'lab', mode: s.mode === 'dark' ? 'light' : 'dark' })
      }}
    >
      <svg className="lab-i-theme" viewBox="0 0 20 20" aria-hidden="true">
        <g className="sun">
          <circle cx="10" cy="10" r="3.6" />
          <path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" />
        </g>
        <path className="moon" d="M15.6 12.6A6.6 6.6 0 0 1 7.4 4.4a6.6 6.6 0 1 0 8.2 8.2z" />
      </svg>
    </button>
  )
}
