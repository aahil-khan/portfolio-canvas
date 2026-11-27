import type { Ref } from '@/lib/lab/types'

/** References, numbered by first use, each with the id its citation jumps to (`#ref-<key>`). */
export function References({ title, order, refs }: { title: string; order: string[]; refs: Record<string, Ref> }) {
  if (!order.length) return null
  return (
    <section className="lab-refs" data-refs aria-labelledby="lab-refs-h">
      <h2 className="end-h" id="lab-refs-h">
        {title}
      </h2>
      <ol>
        {order.map((k) => {
          const r = refs[k]
          if (!r) return null
          return (
            <li key={k} id={`ref-${k}`}>
              {r.url ? (
                <a className="ref-title" href={r.url} data-preview={`out:${r.url}`}>
                  {r.title}
                </a>
              ) : (
                <span className="ref-title">{r.title}</span>
              )}
              <span className="meta">{` · ${r.site}`}</span>
              {r.line ? <span className="ref-line">{r.line}</span> : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
