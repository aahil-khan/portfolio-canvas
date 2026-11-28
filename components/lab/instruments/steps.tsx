import type { CSSProperties } from 'react'

import { schedule, type Item } from '@/lib/lab/haggle'
import { fill } from '@/lib/lab/view'

import { at } from './draw'
import { rupees } from './text'

export interface StepsCopy {
  list: string
  counter: string
  label: string
  floor: string
}

/**
 * The concession steps (`schedule`, chapter 04's lead): an item's list price, then each counter
 * the spec's rules 1–3 allow, as columns over a scale that starts under the floor, with the floor
 * drawn as a dashed line no counter reaches. The numbers are worked out by `lib/lab/haggle.ts`,
 * the same module the haggle runs, never typed in. Each column is a list item whose words say its
 * price and its step, so it reads the same as text. Columns rise from the base on first view.
 */
export function Steps({ item, copy }: { item: Pick<Item, 'list' | 'floor'>; copy: StepsCopy }) {
  const prices = schedule(item.list)
  // a scale from a round ₹50 under the floor to the list price, so every column has some height
  const lo = Math.floor(item.floor / 50) * 50 - 50
  const span = item.list - lo
  const h = (v: number) => ((v - lo) / span).toFixed(4)
  return (
    <div className="lab-steps" style={{ '--floor': h(item.floor) } as CSSProperties}>
      <ol className="lab-steps-cols" aria-label={copy.label}>
        {prices.map((p, i) => (
          <li key={i} className="lab-steps-col" data-first={i === 0 ? '' : undefined}>
            <span className="lab-steps-bar" data-draw="y" style={{ ...at(i * 2), '--h': h(p) } as CSSProperties}>
              <span className="lab-steps-v" data-num>
                {rupees(p)}
              </span>
            </span>
            <span className="lab-steps-label">{i === 0 ? copy.list : fill(copy.counter, { n: i })}</span>
            <span className="lab-steps-step meta" data-num aria-hidden={i === 0 ? 'true' : undefined}>
              {i === 0 ? '' : `−${prices[i - 1] - p}`}
            </span>
          </li>
        ))}
      </ol>
      <p className="lab-steps-floor">
        <span>{fill(copy.floor, { f: item.floor })}</span>
      </p>
    </div>
  )
}
