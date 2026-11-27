import { Feed } from 'feed'

import { posts, profile } from '@/content'
import { getLab, pathOf } from '@/lib/lab/content'
import { plainInline } from '@/lib/lab/text'
import { TOP_LEVEL_KINDS } from '@/lib/lab/types'
import type { Entry } from '@/lib/lab/types'
import { labPublic } from '@/lib/lab/visibility'
import { feedItems, lastChange } from '@/lib/seo/feed-items'
import type { LabItemInput } from '@/lib/seo/feed-items'
import { FEED_PATH } from '@/lib/seo/meta'
import { SITE_URL } from '@/lib/site'

/*
 * `/feed.xml`: RSS 2.0, built at build time from content.
 *
 * What it lists is decided in `lib/seo/feed-items.ts` (tested there): the writing posts, plus the
 * Lab's top-level entries only while `labPublic`. While the Lab is hidden, no Lab URL is in here
 * (check-lab rule I). How it is written is the `feed` package's job, which may be imported from a
 * route handler and nowhere else (CLAUDE.md, the import table), so it never reaches a client chunk.
 */

export const dynamic = 'force-static'

/** The Lab's top-level, published entries, reduced to what an item shows. */
function labItems(): LabItemInput[] {
  const { entries } = getLab()
  const ids = new Set(entries.map((e) => e.id))
  const top = (e: Entry) => TOP_LEVEL_KINDS.includes(e.kind) && !('parent' in e && e.parent && ids.has(e.parent))
  return entries
    .filter((e) => top(e) && e.published && !e.draft)
    .map((e) => ({
      id: e.id,
      title: plainInline(e.title),
      url: `${SITE_URL}${pathOf(e)}`,
      description: plainInline(e.lede ?? (e.kind === 'essay' ? e.opening : '') ?? ''),
      published: e.published!,
      ...(e.updated ? { updated: e.updated } : {}),
    }))
}

export function GET() {
  const items = feedItems({ posts, lab: labPublic ? labItems() : [], labPublic })
  const self = `${SITE_URL}${FEED_PATH}`

  const feed = new Feed({
    id: SITE_URL,
    link: SITE_URL,
    title: profile.name,
    description: profile.intro,
    language: 'en',
    // the newest item's date, so a rebuild with nothing new does not tell readers something changed
    updated: lastChange(items) ?? undefined,
    generator: false,
    feedLinks: { rss: self },
    author: { name: profile.name, link: SITE_URL },
    copyright: profile.name,
  })

  for (const it of items)
    feed.addItem({
      id: it.id,
      guid: it.id,
      title: it.title,
      link: it.link,
      description: it.description,
      date: it.updated ?? it.date,
      published: it.date,
    })

  return new Response(feed.rss2(), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
