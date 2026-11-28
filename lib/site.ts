/**
 * The canonical origin, in one place.
 *
 * The previous site drifted between `aahil-khan.xyz` and a `.tech` domain that never resolved,
 * and shipped 301s pointing at the dead one. One constant, imported everywhere.
 *
 * It is the host that actually serves the site. The apex answers `308 → https://www.aahil-khan.xyz`
 * (Vercel's primary domain is `www`), so an apex canonical would point every canonical, sitemap
 * and OG URL at a redirect. If the apex is ever made primary in Vercel's domain settings, this
 * flips back, and nothing else needs to change.
 */
export const SITE_URL = 'https://www.aahil-khan.xyz'
