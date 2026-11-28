/**
 * What the previews' cards are made of: `/lab/previews.json`, built at `next build` by
 * `app/lab/previews.json/route.ts` from the active set (`lib/lab/preview/build.ts`), and fetched by
 * the controller once, on a reader's first intent, never on load. Same-origin, so a hover makes no
 * cross-origin request: unfurl images and favicons are committed files under `public/`.
 *
 * Entry windows don't come from here: they fetch the entry's own page (`fetch-entry.ts`).
 * Reference cards don't either: a reference is on the page (or in the window) that cites it.
 *
 * Only types and the client's loader live here, so the controller's chunk carries no data.
 */
import type { Unfurl } from '../types.ts'

export interface CardLink {
  href: string
  label: string
  /** What the link previews in turn (`entry:<id>`, `out:<url>`), when it does. */
  preview?: string
}

export interface TermCard {
  name: string
  /** The name is an identifier (`evaluate_offer`): set in code. */
  code?: true
  def: string
  /** Where the term leads on: an entry, or its source. */
  more?: CardLink
}

export interface TagCard {
  title: string
  about?: string
  /** "4 entries" */
  count: string
  href: string
  /** The newest few entries with the tag. */
  entries: { title: string; href: string; preview: string; kind: string }[]
}

export interface EntryHead {
  /** "A chapter from The Shopkeeper" */
  kind: string
  /** The day it last changed, ISO, and as a reader sees it. */
  date: string
  dateText: string
}

export interface PreviewData {
  /** The words the cards use, from `lab.json` → `copy`. */
  copy: Record<string, string>
  terms: Record<string, TermCard>
  tags: Record<string, TagCard>
  entries: Record<string, EntryHead>
  unfurls: Record<string, Unfurl>
}

/** The data's own URL. */
export const PREVIEW_DATA_PATH = '/lab/previews.json'

/** The copy keys the cards use; the route sends these and no others. */
export const CARD_COPY = [
  'cardTerm',
  'cardTag',
  'cardRef',
  'cardExt',
  'cardVisit',
  'cardSource',
  'cardRefs',
  'cardGlossary',
  'cardTagged',
  'cardClose',
  'winEntry',
  'pvLoading',
  'pvFailed',
  'pvOpenPage',
  'pvWindowLabel',
  'pvSheetLabel',
] as const

let loading: Promise<PreviewData | null> | null = null

/** The cards' data, fetched once per visit. `null` when it could not be had: the cards fall back to the link's own words. */
export function previewData(): Promise<PreviewData | null> {
  loading ??= fetch(PREVIEW_DATA_PATH, { credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<PreviewData>) : null))
    .catch(() => {
      loading = null
      return null
    })
  return loading
}
