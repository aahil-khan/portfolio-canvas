import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'monthly', priority: 1 },
    // the résumé is the crawlable surface, so it is worth as much as the canvas
    { url: `${SITE_URL}/resume`, changeFrequency: 'monthly', priority: 0.9 },
  ]
}
