'use client'

import { useSyncExternalStore } from 'react'

import { BarPanel, useBarPanel } from '@/components/lab/bar-panel'
import {
  AA_SIZE,
  getLookServerSnapshot,
  getLookSnapshot,
  isDefaultAa,
  resetAa,
  setAa,
  subscribeLook,
  type Aa as AaState,
} from '@/lib/lab/look'
import { fill } from '@/lib/lab/view'

export interface AaLabels {
  label: string
  close: string
  size: string
  smaller: string
  larger: string
  /** `{n}px` */
  px: string
  font: string
  fontGrotesk: string
  fontSerif: string
  fontSystem: string
  leading: string
  tight: string
  normal: string
  relaxed: string
  measure: string
  narrow: string
  comfortable: string
  wide: string
  layout: string
  side: string
  centred: string
  reset: string
}

/**
 * Aa, the reader settings (`lib/lab/look.ts` owns them and applies them before first paint):
 *
 *   Text size     14–22px in 1px steps, − and + around the value
 *   Font          Space Grotesk, a reading serif (Literata, loaded only once chosen), the system's sans
 *   Line spacing  tight, normal, relaxed
 *   Line length   narrow ≈ 62ch, comfortable ≈ 72ch, wide ≈ 96ch (offered from 700px)
 *   Layout        Side panel (the text and the rail) or Centred (the text alone, the rail after
 *                 it); offered from 1200px, the only widths with a side panel
 *   Reset         every setting back to its default
 *
 * A popover under the bar, or a sheet on a phone (`BarPanel`). Hidden with JavaScript off.
 */
export function Aa({ labels }: { labels: AaLabels }) {
  const s = useSyncExternalStore(subscribeLook, getLookSnapshot, getLookServerSnapshot)
  const { open, setOpen, button, panel } = useBarPanel()
  const aa = s.aa

  const seg = <K extends keyof AaState>(key: K, title: string, options: [AaState[K], string][]) => (
    <div className="lab-aa-row" data-aa-row={key}>
      <p className="lab-aa-label meta" id={`lab-aa-${key}`}>
        {title}
      </p>
      <div className="lab-seg" role="group" aria-labelledby={`lab-aa-${key}`}>
        {options.map(([v, l]) => (
          <button key={String(v)} type="button" data-aa-option={`${key}:${v}`} aria-pressed={aa[key] === v} onClick={() => setAa({ [key]: v } as Partial<AaState>)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={button}
        type="button"
        className="lab-ctl lab-ctl-icon"
        data-aa
        data-needs-js
        aria-expanded={open}
        aria-controls="lab-aa"
        aria-label={labels.label}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="lab-i-aa" aria-hidden="true">
          Aa
        </span>
      </button>
      <BarPanel id="lab-aa" title={labels.label} closeLabel={labels.close} open={open} onClose={() => setOpen(false)} panel={panel} button={button} data-aa-panel>
        <div className="lab-aa-row" data-aa-row="size">
          <p className="lab-aa-label meta" id="lab-aa-size">
            {labels.size}
          </p>
          <div className="lab-step" role="group" aria-labelledby="lab-aa-size">
            <button type="button" data-aa-smaller data-autofocus aria-label={labels.smaller} disabled={aa.size <= AA_SIZE.min} onClick={() => setAa({ size: aa.size - 1 })}>
              <svg viewBox="0 0 14 14" aria-hidden="true">
                <path d="M2 7h10" />
              </svg>
            </button>
            <output data-aa-size-value aria-live="polite">
              {fill(labels.px, { n: aa.size })}
            </output>
            <button type="button" data-aa-larger data-autofocus aria-label={labels.larger} disabled={aa.size >= AA_SIZE.max} onClick={() => setAa({ size: aa.size + 1 })}>
              <svg viewBox="0 0 14 14" aria-hidden="true">
                <path d="M2 7h10M7 2v10" />
              </svg>
            </button>
          </div>
        </div>
        {seg('font', labels.font, [
          ['grotesk', labels.fontGrotesk],
          ['serif', labels.fontSerif],
          ['system', labels.fontSystem],
        ])}
        {seg('leading', labels.leading, [
          ['tight', labels.tight],
          ['normal', labels.normal],
          ['relaxed', labels.relaxed],
        ])}
        {seg('measure', labels.measure, [
          ['narrow', labels.narrow],
          ['comfortable', labels.comfortable],
          ['wide', labels.wide],
        ])}
        {seg('layout', labels.layout, [
          ['side', labels.side],
          ['centred', labels.centred],
        ])}
        <div className="lab-aa-foot">
          <button
            type="button"
            className="lab-aa-reset"
            data-aa-reset
            disabled={isDefaultAa(aa)}
            onClick={() => {
              resetAa()
              // Reset disables itself; keep focus in the panel rather than dropping it to the page
              panel.current?.querySelector<HTMLElement>('[data-autofocus]:not(:disabled)')?.focus()
            }}
          >
            {labels.reset}
          </button>
        </div>
      </BarPanel>
    </>
  )
}
