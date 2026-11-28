import type { Metadata } from 'next'
import type { BreadcrumbList, WithContext } from 'schema-dts'

import { profile } from '@/content'
import { SITE_URL } from '@/lib/site'
import { entryByPath, getLab, pathOf, routes } from '@/lib/lab/content'
import { plainInline } from '@/lib/lab/text'
import type { Entry } from '@/lib/lab/types'
import { t } from '@/lib/lab/view'
import { LAB_ROBOTS_HIDDEN, labPublic } from '@/lib/lab/visibility'
import { articleLd } from '@/lib/seo/json-ld'
import { feedAlternate } from '@/lib/seo/meta'

/**
 * Every Lab page's metadata goes through here, so the hidden-until-done switch is applied in one
 * place: while `labPublic` is false (`lib/lab/visibility.ts`), every page carries
 * `<meta name="robots" content="noindex, nofollow">`. The header that covers everything else is
 * `next.config.ts`'s. Contract: `content/lab/API.md`, "Visibility".
 *
 * A page that names its path also gets its absolute canonical URL, and Open Graph and Twitter tags
 * naming the page itself: its title, its description, and its own share card (the
 * `opengraph-image` beside its route, `lib/lab/og`). The card is named outright, twice: Next
 * merges metadata shallowly, so a parent's image file is not inherited by a page that states its
 * own `openGraph`, and without it the root's `twitter-image` (the site's card) would stand in.
 * The tags exist while the Lab is hidden too; only the noindex and the switch keep them unread.
 *
 * Entry pages also render JSON-LD, an Article and a BreadcrumbList (`labJsonLd`), serialized by
 * `lib/seo/json-ld.ts`'s `jsonLd()`, which escapes `<` so no field can close the script.
 */
export interface LabPageMeta {
  /** The page's own title; the Lab's name is appended in the tab. Omit for the Lab's home. */
  title?: string
  description?: string
  /** The page's path, `/lab/…`. */
  path?: string
  /** `article` for an entry. */
  type?: 'website' | 'article'
  /** An entry's days, `YYYY-MM-DD`. */
  published?: string
  updated?: string
  /** An entry's tags, by title. */
  tags?: readonly string[]
}

export const LAB_TITLE = 'The Lab'
export const LAB_HOME = '/lab'

/** The card every Lab card is: 1200 × 630 PNG (`lib/lab/og/card.ts`, `OG_SIZE`). */
const CARD = { width: 1200, height: 630, type: 'image/png' } as const

export function canonicalUrl(path: string): string {
  return new URL(path, SITE_URL).toString().replace(/\/$/, '')
}

/** A Lab page's share card, absolute: the `opengraph-image` route beside the page. */
export const cardUrl = (path: string) => canonicalUrl(`${path.replace(/\/$/, '')}/opengraph-image`)

export function labMetadata({ title, description, path, type = 'website', published, updated, tags }: LabPageMeta = {}): Metadata {
  const robots = labPublic ? { index: true, follow: true } : LAB_ROBOTS_HIDDEN
  const tab = title ? `${title} · ${LAB_TITLE}` : LAB_TITLE
  if (!path) return { title: tab, ...(description ? { description } : {}), robots }

  const { copy } = getLab()
  const home = path === LAB_HOME
  const words = description ?? (home ? t(copy, 'homeTitle') : undefined)
  const shareTitle = title ?? t(copy, 'ogHomeKind')
  const url = canonicalUrl(path)
  const image = { url: cardUrl(path), ...CARD, alt: t(copy, 'ogAlt', { title: title ?? t(copy, 'homeTitle') }) }
  const article =
    type === 'article'
      ? {
          ...(published ? { publishedTime: published } : {}),
          ...((updated ?? published) ? { modifiedTime: updated ?? published } : {}),
          authors: [SITE_URL],
          ...(tags?.length ? { tags: [...tags] } : {}),
        }
      : {}
  return {
    title: tab,
    ...(words ? { description: words } : {}),
    alternates: { canonical: url, types: feedAlternate },
    openGraph: {
      type,
      url,
      title: shareTitle,
      ...(words ? { description: words } : {}),
      siteName: t(copy, 'ogSiteName'),
      locale: 'en_IN',
      images: [image],
      ...article,
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      ...(words ? { description: words } : {}),
      images: [image],
    },
    robots,
  }
}

/** The words a page and its card say under an entry's title: its lede, or an essay's opening, or a key line. */
export function entryDescription(e: Entry): string {
  return plainInline(e.lede ?? (e.kind === 'essay' ? e.opening : 'keyLine' in e ? (e.keyLine ?? '') : ''))
}

/** An entry page's metadata: the card, an article's Open Graph fields, and its tags. */
export function labEntryMetadata(e: Entry): Metadata {
  const { tags } = getLab()
  return labMetadata({
    title: e.title,
    description: entryDescription(e) || undefined,
    path: pathOf(e),
    type: 'article',
    published: e.published ?? undefined,
    updated: e.updated,
    tags: (e.tags ?? []).map((id) => tags.find((x) => x.id === id)?.title ?? id),
  })
}

/**
 * The trail to a Lab page, as schema.org reads it: the Lab, its section, a child's parent, the page.
 * Each step is a page `routes()` lists, by its title.
 */
export function labBreadcrumbLd(path: string): WithContext<BreadcrumbList> {
  const { sections } = getLab()
  const known = new Set(routes().map((r) => r.path))
  const segs = path.split('/').filter(Boolean).slice(1)
  const steps: { name: string; path: string }[] = [{ name: LAB_TITLE, path: LAB_HOME }]
  segs.forEach((_, i) => {
    const p = `${LAB_HOME}/${segs.slice(0, i + 1).join('/')}`
    if (!known.has(p)) return
    const name = i === 0 ? sections.find((s) => s.id === segs[0])?.title : entryByPath(segs.slice(0, i + 1))?.title
    if (name) steps.push({ name, path: p })
  })
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: steps.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, item: canonicalUrl(s.path) })),
  }
}

/** An entry's structured data: an Article (its card as the image) and its breadcrumbs. Render it with `jsonLd()`. */
export function labJsonLd(e: Entry): object[] {
  const { tags } = getLab()
  const path = pathOf(e)
  const description = entryDescription(e)
  return [
    articleLd({
      title: e.title,
      ...(description ? { description } : {}),
      url: canonicalUrl(path),
      published: e.published ?? '',
      ...(e.updated ? { updated: e.updated } : {}),
      image: cardUrl(path),
      keywords: (e.tags ?? []).map((id) => tags.find((x) => x.id === id)?.title ?? id),
      author: { name: profile.name, origin: SITE_URL },
    }),
    labBreadcrumbLd(path),
  ]
}
