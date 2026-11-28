import { fill } from '@/lib/lab/view'

import { at } from './draw'

/**
 * A series' lead (`progress`): one tick per chapter, filled once it is out, and how many are
 * written; before any chapter is out, the premise instead. The ticks draw in, left to right.
 */
export function SeriesProgress({ chapters, label }: { chapters: { order: number; title: string; out: boolean }[]; label: string }) {
  const done = chapters.filter((c) => c.out).length
  return (
    <div className="lab-series-progress">
      <div className="lab-progress" aria-hidden="true">
        {chapters.map((c, i) => (
          <i key={c.order} data-on={c.out ? '' : undefined} data-draw="pop" style={at(i)} />
        ))}
      </div>
      <p className="meta">{fill(label, { done, total: chapters.length })}</p>
    </div>
  )
}
