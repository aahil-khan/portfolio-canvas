import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    /*
     * /stats is token-gated and 404s without one, but it should not be crawled at all — a
     * disallowed path is also a hint not to try, and it keeps the URL out of any index. The same
     * goes for the content editor, which 404s unless it is configured.
     *
     * There is no /lab line here, on purpose, in either of the Lab's states. While it is hidden it
     * stays out of search by `noindex` (a meta tag and an `X-Robots-Tag` header, both from
     * lib/lab/visibility.ts) and by being listed nowhere. A Disallow would publish the path in the
     * one file every crawler reads, and it would stop them fetching the pages at all, so they
     * would never see the `noindex` and could still index the bare URL from a link elsewhere.
     * check-lab rule I fails on a /lab Disallow.
     */
    rules: { userAgent: '*', allow: '/', disallow: ['/stats', '/edit', '/api/edit'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
