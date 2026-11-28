import { notFound } from 'next/navigation'

import { ListHead } from '@/components/lab/lists/head'
import { EntryRow } from '@/components/lab/lists/row'
import { ColumnTransition } from '@/components/lab/motion/column-transition'
import { getLab, routes } from '@/lib/lab/content'
import { counted, tagged } from '@/lib/lab/lists'
import { labMetadata } from '@/lib/lab/seo'
import { bareillyToday, fill } from '@/lib/lab/view'

/** One tag: `/lab/tags/<tag>` (API.md §3), for every tag at least one entry carries. */
export const dynamicParams = false

const tagRoutes = () => routes().filter((r) => r.kind === 'tag')

export function generateStaticParams() {
  return tagRoutes().map((r) => ({ tag: r.path.split('/')[3] }))
}

type Params = Promise<{ tag: string }>

const tagOf = (id: string) => (tagRoutes().some((r) => r.path === `/lab/tags/${id}`) ? getLab().tags.find((t) => t.id === id) : undefined)

/** "Three entries tagged evals, by date written." */
function lede(copy: Record<string, string>, n: number, tag: string) {
  const words = counted(copy, n, 'entry')
  return fill(copy.tagLede, { n: words.charAt(0).toUpperCase() + words.slice(1), tag })
}

export async function generateMetadata({ params }: { params: Params }) {
  const { tag } = await params
  const t = tagOf(tag)
  if (!t) return labMetadata()
  const { copy, entries } = getLab()
  return labMetadata({ title: t.title, description: t.about ?? lede(copy, tagged(entries, t.id).length, t.title), path: `/lab/tags/${t.id}` })
}

/**
 * A tag's page (plan PR 9): every entry carrying it, newest first, each with its lede, then the
 * other tags. Tag links preview the tag's page (API.md §5).
 */
export default async function TagPage({ params }: { params: Params }) {
  const { tag: id } = await params
  const tag = tagOf(id)
  if (!tag) notFound()
  const { copy, entries, tags } = getLab()
  const today = bareillyToday()
  const rows = tagged(entries, tag.id)
  const used = new Set(tagRoutes().map((r) => r.path.split('/')[3]))
  const others = tags.filter((t) => t.id !== tag.id && used.has(t.id))
  const rest = copy.tagEyebrow.startsWith(copy.secEyebrow) ? copy.tagEyebrow.slice(copy.secEyebrow.length) : ''
  return (
    <ColumnTransition className="lab-list lab-tag">
      <div data-lists="tag" data-tag={tag.id}>
        <ListHead lab={copy.secEyebrow} eyebrow={rest} title={tag.title} lede={lede(copy, rows.length, tag.title)}>
          {tag.about ? <p className="lab-lhead-new">{tag.about}</p> : null}
        </ListHead>
        <ul className="lab-lrows lab-lrows-tag">
          {rows.map((e) => (
            <EntryRow key={e.id} entry={e} today={today} lede />
          ))}
        </ul>
        {others.length ? (
          <p className="lab-other-tags">
            <span className="meta">{copy.tagOthers}</span>{' '}
            {others.map((t, i) => (
              <span key={t.id}>
                {i ? ', ' : null}
                <a href={`/lab/tags/${t.id}`} data-preview={`tag:${t.id}`}>
                  {t.title}
                </a>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </ColumnTransition>
  )
}
