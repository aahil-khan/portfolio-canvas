import type { CSSProperties } from 'react'

import { at } from './draw'
import { Inline } from './text'

export interface ChartRow {
  label: string
  lo: number
  hi?: number
  base?: boolean
  note?: string
}

const pct = (v: number, max: number) => `${((100 * Math.max(0, Math.min(v, max))) / max).toFixed(2)}%`

/**
 * Bars against a baseline, on a 0–`max` scale (`chart`): each row's value in ink, a range from
 * `lo` to `hi` in the accent, a baseline row (`base`) quieter. Each bar is a list item whose words
 * carry its value, so the figure reads the same without the bars. Bars grow from the left on
 * first view.
 */
export function Chart({ rows, max }: { rows: ChartRow[]; max: number }) {
  return (
    <ul className="lab-chart">
      {rows.map((r, i) => {
        const hi = r.hi ?? r.lo
        return (
          <li key={r.label} className="lab-chart-row" data-base={r.base ? '' : undefined}>
            <span className="lab-chart-label">
              <Inline text={r.label} />
            </span>
            <span className="lab-chart-track" aria-hidden="true">
              <span className="lab-chart-fill" data-draw="x" style={{ ...at(i * 3), width: pct(r.lo, max) }} />
              {hi > r.lo ? (
                <span className="lab-chart-range" data-draw="x" style={{ ...at(i * 3 + 2), left: pct(r.lo, max), width: `calc(${pct(hi, max)} - ${pct(r.lo, max)})` } as CSSProperties} />
              ) : null}
            </span>
            <span className="lab-chart-value" data-num>
              {hi > r.lo ? `${r.lo}–${hi}` : String(r.lo)}
            </span>
            {r.note ? (
              <span className="lab-chart-note meta">
                <Inline text={r.note} />
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
