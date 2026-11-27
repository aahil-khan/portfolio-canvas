import type { Article, CreativeWork, ItemList, Person, WithContext } from 'schema-dts'

/**
 * Structured data, typed by `schema-dts` (types only: nothing of it reaches a bundle).
 *
 * Every builder takes plain data and returns a `WithContext<…>`, so the pages decide what to
 * describe and this file decides how. `jsonLd()` is the only way a page turns one into the text
 * of a `<script type="application/ld+json">`: it is rendered with `dangerouslySetInnerHTML`, so
 * a field holding `</script>` would otherwise end the script early and turn the rest of the
 * field into markup. Content is edited at `/edit`, so that field is one save away.
 *
 * Node-importable (`--experimental-strip-types`): relative imports only, no `@/` alias, no
 * content import. The pages pass the content in.
 */

/**
 * JSON for a `<script type="application/ld+json">` body. `<`, `>` and `&` become `<`,
 * `>` and `&`, which JSON reads back as the same characters, so no field can close
 * the script, open a comment or start an entity. U+2028 and U+2029 are escaped too: they are
 * valid in JSON but end a line in older JavaScript parsers.
 */
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

/** What `personLd` needs to know about the site's owner. */
export interface PersonInput {
  name: string
  /** The canonical origin, which is the person's home page. */
  url: string
  jobTitle?: string
  description?: string
  /** An absolute image URL. */
  image?: string
  /** A place, as written: "Bareilly, India". */
  location?: string
  /** Profiles elsewhere. Anything that is not http(s) (a `mailto:`) is left out. */
  sameAs?: readonly string[]
}

const web = (href: string) => /^https?:\/\//.test(href)

/** The site's owner, for `/`. The node's `@id` lets the other builders point at it. */
export function personLd(p: PersonInput): WithContext<Person> {
  const sameAs = (p.sameAs ?? []).filter(web)
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${p.url}/#person`,
    name: p.name,
    url: p.url,
    ...(p.jobTitle ? { jobTitle: p.jobTitle } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(p.image ? { image: p.image } : {}),
    ...(p.location ? { homeLocation: { '@type': 'Place', name: p.location } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }
}

/** The author of anything on the site: the owner, by name, URL and `@id`. */
const author = (name: string, origin: string): Person => ({
  '@type': 'Person',
  '@id': `${origin}/#person`,
  name,
  url: origin,
})

/** One project's page, `/work/<slug>`. */
export interface ProjectInput {
  name: string
  tagline: string
  lede: string
  year: number
  stack: readonly string[]
  award?: string
  /** The page's absolute URL. */
  url: string
  /** Absolute image URLs. */
  images?: readonly string[]
  author: { name: string; origin: string }
}

export function projectLd(p: ProjectInput): WithContext<CreativeWork> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: p.name,
    headline: p.tagline,
    description: p.lede,
    dateCreated: String(p.year),
    url: p.url,
    mainEntityOfPage: p.url,
    author: author(p.author.name, p.author.origin),
    keywords: p.stack.join(', '),
    ...(p.images?.length ? { image: [...p.images] } : {}),
    ...(p.award ? { award: p.award } : {}),
  }
}

/** A list of pages, in order: `/work`. */
export function itemListLd(items: readonly { name: string; url: string }[]): WithContext<ItemList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: it.url, name: it.name })),
  }
}

/**
 * A piece of writing: a Lab entry (PR 13 uses it), or anything else with a date and a body.
 * `published` and `updated` are `YYYY-MM-DD` days.
 */
export interface ArticleInput {
  title: string
  description?: string
  /** The page's absolute URL. */
  url: string
  published: string
  updated?: string
  /** An absolute image URL: the share card. */
  image?: string
  keywords?: readonly string[]
  author: { name: string; origin: string }
}

export function articleLd(a: ArticleInput): WithContext<Article> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    ...(a.description ? { description: a.description } : {}),
    url: a.url,
    mainEntityOfPage: a.url,
    datePublished: a.published,
    dateModified: a.updated ?? a.published,
    author: author(a.author.name, a.author.origin),
    ...(a.image ? { image: a.image } : {}),
    ...(a.keywords?.length ? { keywords: a.keywords.join(', ') } : {}),
  }
}
