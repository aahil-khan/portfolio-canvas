import { at } from './draw'
import { Inline, plain } from './text'

/**
 * A table from figure data: the spec's own tables (`spec-table`) and A-against-B (`compare`).
 * A real `<table>` with row headers, so a screen reader reads it as one. On a phone each row
 * becomes a small block, every cell labelled by its column (`data-col`), so nothing scrolls
 * sideways. Rows rise in on first view. Static: no client code at all.
 */
export function Table({ head, rows, num = [], chosen, kind }: { head: string[]; rows: string[][]; num?: number[]; chosen?: number; kind: 'spec-table' | 'compare' }) {
  const cls = (i: number) => [num.includes(i) ? 'n' : '', chosen === i ? 'chosen' : ''].filter(Boolean).join(' ') || undefined
  const hasCorner = !head[0]?.trim()
  return (
    <div className="lab-tbl-wrap">
      <table className="lab-tbl" data-kind={kind}>
        <thead>
          <tr>
            {head.map((h, i) =>
              i === 0 && hasCorner ? (
                <td key={i} aria-hidden="true" />
              ) : (
                <th key={i} scope="col" className={cls(i)}>
                  <Inline text={h} />
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, j) => (
            <tr key={j} data-draw="in" style={at(j + 1)}>
              {r.map((c, i) =>
                i === 0 ? (
                  <th key={i} scope="row" data-col={plain(head[0] ?? '') || undefined}>
                    <Inline text={c} />
                  </th>
                ) : (
                  <td key={i} className={cls(i)} data-col={plain(head[i] ?? '')}>
                    {/* one item beside the phone's column label, however many marks the words hold */}
                    <span>
                      <Inline text={c} />
                    </span>
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
