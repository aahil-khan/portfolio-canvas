import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    /*
     * /stats is token-gated and 404s without one, but it should not be crawled at all — a
     * disallowed path is also a hint not to try, and it keeps the URL out of any index.
     */
    rules: { userAgent: '*', allow: '/', disallow: '/stats' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
