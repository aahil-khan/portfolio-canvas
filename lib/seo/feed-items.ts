/**
 * What `/feed.xml` lists, decided apart from how it is written, so it can be tested without the
 * `feed` package (which may only be imported from route handlers: CLAUDE.md, the import table).
 *
 * Two sources:
 *   - the writing posts (`content/data/writing.json`), always;
 *   - the Lab's top-level entries, only while `labPublic` (`lib/lab/visibility.ts`).
 *
 * A post that is also a Lab entry names it in its `lab` field, and while the Lab is public the
 * Lab entry is the one listed: it is the copy on this site. They are matched by that field and
 * never by title, because a title can be reworded on either side and a match on words would
 * silently start listing the piece twice. While the Lab is hidden, the post is listed as before.
 *
 * Node-importable: no imports at all.
 */

export interface FeedItem {
  /** Stable across rebuilds: the item's URL. */
  id: string
  title: string
  link: string
  description: string
  /** When it was published. */
  date: Date
  /** When it last changed, if after `date`. */
  updated?: Date
}

/** A writing post, as `content/data/writing.json` holds it. */
export interface PostInput {
  slug: string
  title: string
  blurb: string
  year: number
  href: string
  /** The Lab entry this post also is, by id. */
  lab?: string
}

/** A top-level Lab entry, already reduced to what the feed shows. */
export interface LabItemInput {
  id: string
  title: string
  /** Absolute. */
  url: string
  description: string
  /** `YYYY-MM-DD`. */
  published: string
  updated?: string
}

/**
 * A `YYYY-MM-DD` day at noon UTC, so the date reads the same in every time zone a reader is in.
 */
const day = (iso: string) => new Date(`${iso}T12:00:00Z`)

/**
 * A post is dated by year only (that is all `writing.json` records), so it takes 1 January of
 * that year. Readers sort by it; nothing shows the day.
 */
const yearDate = (year: number) => new Date(Date.UTC(year, 0, 1, 12))

export function feedItems({
  posts,
  lab,
  labPublic,
}: {
  posts: readonly PostInput[]
  lab: readonly LabItemInput[]
  labPublic: boolean
}): FeedItem[] {
  const labItems = labPublic ? lab : []
  const inLab = new Set(labItems.map((e) => e.id))

  const items: FeedItem[] = [
    ...labItems.map((e) => ({
      id: e.url,
      title: e.title,
      link: e.url,
      description: e.description,
      date: day(e.published),
      ...(e.updated && e.updated > e.published ? { updated: day(e.updated) } : {}),
    })),
    ...posts
      .filter((p) => !(p.lab && inLab.has(p.lab)))
      .map((p) => ({ id: p.href, title: p.title, link: p.href, description: p.blurb, date: yearDate(p.year) })),
  ]

  // newest first; ties keep their order (Lab entries before posts, posts as the file lists them)
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => b.it.date.getTime() - a.it.date.getTime() || a.i - b.i)
    .map(({ it }) => it)
}

/** The newest change among the items: the feed's own `updated`. `null` when it is empty. */
export function lastChange(items: readonly FeedItem[]): Date | null {
  let max: number | null = null
  for (const it of items) {
    const t = (it.updated ?? it.date).getTime()
    if (max === null || t > max) max = t
  }
  return max === null ? null : new Date(max)
}
