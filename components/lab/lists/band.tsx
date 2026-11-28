import Link from 'next/link'

import { BandRows } from '@/components/lab/lists/band-rows'
import { Arrow } from '@/components/lab/lists/head'
import { RowParts } from '@/components/lab/lists/row'
import type { Entry, Section } from '@/lib/lab/types'
import { fill } from '@/lib/lab/view'

/**
 * One section on the home (decision 1; rule H1): a framed band, the window frame of the theme,
 * with the section's title, thesis and count on the left and its first `min(5, n)` top-level
 * entries by date on the right, then "All N in <section>", N counting every entry. On a phone the
 * two halves stack. Nothing pinned, nothing counting progress, no time words (H2).
 */
export function Band({ section, entries, total, today, copy }: { section: Section; entries: Entry[]; total: number; today: string; copy: Record<string, string> }) {
  const href = `/lab/${section.id}`
  const titleId = `band-${section.id}`
  return (
    <section className="lab-band box" data-band={section.id} data-box aria-labelledby={titleId}>
      <div className="lab-band-head">
        <h3 id={titleId} className="lab-band-title">
          <Link className="quiet" href={href}>
            {section.title}
          </Link>
        </h3>
        <p className="lab-band-thesis">{section.thesis}</p>
        <p className="meta">{total === 1 ? copy.countOne : fill(copy.countMany, { n: total })}</p>
      </div>
      <div className="lab-band-list">
        <BandRows
          id={section.id}
          className="lab-lrows lab-lrows-band"
          rows={entries.map((e) => ({ key: e.id, kind: e.kind, node: <RowParts entry={e} today={today} holds /> }))}
        />
        <p className="lab-all">
          <Link href={href} data-band-all="">
            {fill(copy.homeSecAll, { n: total, section: section.title })}
            <Arrow />
          </Link>
        </p>
      </div>
    </section>
  )
}
