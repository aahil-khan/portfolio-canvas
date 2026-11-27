import type { MetadataRoute } from 'next'

import { projects } from '@/content'
import { getLab, routes as labRoutes } from '@/lib/lab/content'
import type { Entry, LabRoute } from '@/lib/lab/types'
import { labPublic } from '@/lib/lab/visibility'
import { SITE_URL } from '@/lib/site'

/*
 * Every indexable page, on `SITE_URL` (the host that serves, not one that redirects).
 *
 * `lastModified` is stated only where the data holds a date: the Lab's entries carry `published`
 * and `updated`. The site's own pages record a year at most, and a made-up date is worse than
 * none, since a crawler that learns to distrust it ignores it everywhere.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // `/` is now the scrolling front page — the primary surface for readers and crawlers alike
    { url: SITE_URL, changeFrequency: 'monthly', priority: 1 },
    // the canvas, now a deliberate side alley rather than the landing page
    { url: `${SITE_URL}/canvas`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/work`, changeFrequency: 'monthly', priority: 0.8 },
    /*
     * One entry per project. Before these existed the whole site was two URLs and every project
     * was invisible to a crawler — they only existed as cards inside one canvas page.
     */
    ...projects.map((p) => ({
      url: `${SITE_URL}/work/${p.slug}`,
      changeFrequency: 'yearly' as const,
      priority: 0.7,
    })),
    // the Lab, only once it is public (lib/lab/visibility.ts): while hidden, no URL of it is listed
    ...(labPublic ? lab() : []),
  ]
}

/** Every Lab route, dated by the newest entry it shows. */
function lab(): MetadataRoute.Sitemap {
  const entries = getLab().entries.filter((e) => e.published && !e.draft)
  const byId = new Map(entries.map((e) => [e.id, e]))
  const changed = (e: Entry) => e.updated ?? e.published ?? ''
  const newest = (list: readonly Entry[]) => list.map(changed).sort().at(-1)

  const shows = (r: LabRoute): readonly Entry[] => {
    switch (r.kind) {
      case 'entry':
        return byId.has(r.entry) ? [byId.get(r.entry)!] : []
      case 'section':
        return entries.filter((e) => e.section === r.section)
      case 'tag':
        return entries.filter((e) => e.tags?.includes(r.tag))
      case 'glossary':
        return []
      default:
        return entries
    }
  }

  return labRoutes().map((r) => {
    const day = newest(shows(r))
    return {
      url: `${SITE_URL}${r.path}`,
      ...(day ? { lastModified: day } : {}),
      changeFrequency: r.kind === 'entry' ? ('yearly' as const) : ('monthly' as const),
      priority: r.kind === 'home' ? 0.8 : r.kind === 'entry' ? 0.6 : 0.5,
    }
  })
}
