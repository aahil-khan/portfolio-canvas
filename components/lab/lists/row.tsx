import Link from 'next/link'

import { getLab, pathOf } from '@/lib/lab/content'
import { holdsWords, kidsOf } from '@/lib/lab/lists'
import type { Entry } from '@/lib/lab/types'
import { plainInline } from '@/lib/lab/text'
import { fill, formatDay, kindWords, pad2 } from '@/lib/lab/view'

export interface RowOptions {
  /** The day the year is judged against: a date in its year drops the year ("26 Nov"). */
  today: string
  /** The entry's lede under its title (section and tag pages). */
  lede?: boolean
  /** "A series · eight chapters": say what the entry holds (the home's bands). */
  holds?: boolean
  /** A chapter shows its number in place of its date (a series' chapters, under it). */
  number?: boolean
  /** Leave out the kind in words: rows under their series or study, where it goes without saying. */
  bare?: boolean
}

/** "A chapter from The Shopkeeper", "A series · eight chapters". */
export function rowKind(e: Entry, { holds = false }: { holds?: boolean } = {}): string {
  const lab = getLab()
  const { copy } = lab
  const parentId = 'parent' in e ? e.parent : undefined
  const parent = parentId ? lab.entries.find((x) => x.id === parentId) : undefined
  const kind = kindWords(copy, e, parent?.title)
  if (!holds) return kind
  const kids = holdsWords(copy, kidsOf(e, lab.entries))
  return kids ? fill(copy.listsWith, { kind, holds: kids }) : kind
}

/**
 * The inside of one list row: the handwritten date (or a chapter's number), the title as a plain
 * server-rendered link that previews the entry (API.md §5), its lede when asked for, and the kind
 * in words. The link stays inline in running text, so the row reads as a line of the list rather
 * than as a control; on a phone its hit area stretches over the whole row (lists.css).
 */
export function RowParts({ entry: e, today, lede = false, holds = false, number = false, bare = false }: { entry: Entry } & RowOptions) {
  const text = lede ? plainInline(e.lede ?? ('opening' in e ? e.opening : '') ?? '') : ''
  return (
    <>
      <span className="lab-lrow-when">
        {number && e.kind === 'chapter' ? (
          <span data-num>{pad2(e.order)}</span>
        ) : e.published ? (
          <time dateTime={e.published}>{formatDay(e.published, today)}</time>
        ) : null}
      </span>
      <span className="lab-lrow-main">
        <Link className="lab-lrow-title" href={pathOf(e)} data-preview={`entry:${e.id}`} data-row-title>
          {e.title}
        </Link>
        {text ? <span className="lab-lrow-lede">{text}</span> : null}
      </span>
      {bare ? null : <span className="lab-lrow-kind">{rowKind(e, { holds })}</span>}
    </>
  )
}

/** One row of a list, as an `<li>`. */
export function EntryRow(props: { entry: Entry } & RowOptions) {
  return (
    <li className="lab-lrow" data-kind={props.entry.kind}>
      <RowParts {...props} />
    </li>
  )
}
