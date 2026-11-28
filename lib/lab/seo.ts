import type { Metadata } from 'next'

import { SITE_URL } from '@/lib/site'
import { LAB_ROBOTS_HIDDEN, labPublic } from '@/lib/lab/visibility'

/**
 * Every Lab page's metadata goes through here, so the hidden-until-done switch is applied in one
 * place: while `labPublic` is false (`lib/lab/visibility.ts`), every page carries
 * `<meta name="robots" content="noindex, nofollow">`. The header that covers everything else is
 * `next.config.ts`'s. Contract: `content/lab/API.md`, "Visibility".
 *
 * PR 13 adds OG and Twitter tags and the JSON-LD here; until then a page has its title, its
 * description and its absolute canonical URL.
 */
export interface LabPageMeta {
  /** The page's own title; the Lab's name is appended. Omit for the Lab's home. */
  title?: string
  description?: string
  /** The page's path, `/lab/…`. */
  path?: string
}

export const LAB_TITLE = 'The Lab'

export function canonicalUrl(path: string): string {
  return new URL(path, SITE_URL).toString().replace(/\/$/, '')
}

export function labMetadata({ title, description, path }: LabPageMeta = {}): Metadata {
  return {
    title: title ? `${title} · ${LAB_TITLE}` : LAB_TITLE,
    ...(description ? { description } : {}),
    ...(path ? { alternates: { canonical: canonicalUrl(path) } } : {}),
    robots: labPublic ? { index: true, follow: true } : LAB_ROBOTS_HIDDEN,
  }
}
