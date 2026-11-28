import type { Metadata } from 'next'

import { profile } from '@/content'

import { SITE_URL } from '../site.ts'

/** Where the feed is served (`app/feed.xml/route.ts`). */
export const FEED_PATH = '/feed.xml'

/** The site's share cards, served by `app/opengraph-image.tsx` and `app/twitter-image.tsx`. */
const OG_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: profile.name }
const TWITTER_IMAGE = { url: '/twitter-image', width: 1200, height: 630, alt: profile.name }

/** The feed as an alternate, which every page with its own `alternates` must repeat. */
export const feedAlternate = { 'application/rss+xml': FEED_PATH }

/**
 * The metadata every indexable page needs, in one shape: an absolute canonical, the feed link,
 * and Open Graph and Twitter tags that name the page itself.
 *
 * Next merges metadata **shallowly**: a page that sets `alternates`, `openGraph` or `twitter`
 * replaces the layout's whole object, not just the fields it names. So a page that set only a
 * canonical lost the layout's feed link, and one that set only `openGraph.title` lost its type.
 * Building all three here means no page can set half of one.
 *
 * The images default to the site's card (`app/opengraph-image.tsx`, `app/twitter-image.tsx`). A
 * parent's file-based image is **not** inherited by a page that states its own `openGraph`, so
 * without naming it here `/canvas` and `/work` had no share image at all. Named images also beat a
 * segment's own image file, so a page that has one (`/work/<slug>`) passes `ownImage`.
 */
export function pageMeta({
  path,
  title,
  description,
  shareTitle = title,
  type = 'website',
  ownImage = false,
}: {
  /** The page's path, `/` or `/work/konta`. */
  path: string
  /** The tab title. */
  title: string
  description: string
  /** The title on a share card, where there is room for more than the tab has. */
  shareTitle?: string
  type?: 'website' | 'article' | 'profile'
  /** The page's segment has its own `opengraph-image` and `twitter-image` files. */
  ownImage?: boolean
}): Metadata {
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`
  return {
    title,
    description,
    alternates: { canonical: url, types: feedAlternate },
    openGraph: { type, url, title: shareTitle, description, siteName: profile.name, ...(ownImage ? {} : { images: [OG_IMAGE] }) },
    twitter: { card: 'summary_large_image', title: shareTitle, description, ...(ownImage ? {} : { images: [TWITTER_IMAGE] }) },
  }
}
