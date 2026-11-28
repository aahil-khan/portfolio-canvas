import { ListHead } from '@/components/lab/lists/head'
import { KindFilter } from '@/components/lab/lists/kind-filter'
import { EntryRow } from '@/components/lab/lists/row'
import { ColumnTransition } from '@/components/lab/motion/column-transition'
import { getLab } from '@/lib/lab/content'
import { byYear, kindCounts, kindLabel } from '@/lib/lab/lists'
import { labMetadata } from '@/lib/lab/seo'
import { fill } from '@/lib/lab/view'

export function generateMetadata() {
  const { copy, entries } = getLab()
  const n = entries.filter((e) => !e.draft && e.published !== null).length
  return labMetadata({ title: copy.indexTitle, description: n ? fill(copy.indexLede, { n }) : copy.listsIndexEmpty, path: '/lab/index' })
}

/**
 * Every entry, by year (plan PR 9): newest year first, newest entry first within it. The kind
 * filter is a client island over the server-rendered list; with JavaScript off it is not shown
 * and every entry is listed. With nothing written, one line from the copy says so.
 */
export default function IndexPage() {
  const { copy, entries } = getLab()
  const years = byYear(entries)
  const n = years.reduce((s, y) => s + y.entries.length, 0)
  const kinds = kindCounts(years.flatMap((y) => y.entries)).map((k) => k.kind)
  return (
    <ColumnTransition className="lab-list lab-index">
      <div data-lists="index" data-index="">
        <ListHead lab={copy.secEyebrow} title={copy.indexTitle} lede={n ? fill(copy.indexLede, { n }) : copy.listsIndexEmpty}>
          {kinds.length > 1 ? (
            <KindFilter
              label={copy.indexFilter}
              kinds={[['all', copy.indexAll], ...kinds.map((k): [string, string] => [k, kindLabel(copy, k)])]}
              shown={{ template: copy.listsShown, one: copy.countOne, many: copy.countMany }}
            />
          ) : null}
        </ListHead>
        <div className="lab-years" data-years="">
          {years.map(({ year, entries: rows }) => (
            <section key={year} className="lab-lblock lab-year" data-year={year} aria-labelledby={`y-${year}`}>
              <h2 id={`y-${year}`} className="lab-lblock-title lab-year-title">
                {year}
              </h2>
              <ul className="lab-lrows">
                {rows.map((e) => (
                  <EntryRow key={e.id} entry={e} today={`${year}-01-01`} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </ColumnTransition>
  )
}
