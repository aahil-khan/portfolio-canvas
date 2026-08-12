import type { MetadataRoute } from 'next'

import { projects } from '@/content'
import { SITE_URL } from '@/lib/site'

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
  ]
}
