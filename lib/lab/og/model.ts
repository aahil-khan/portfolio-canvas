/**
 * What a share card says, worked out from the Lab's data: no drawing, no `next/og`, so `npm test`
 * holds it. The kinds of card are PR 3's approved six (`prototype/lab-v2b-extras`, "Share cards"):
 * the home (the line and its sections), a section (its name, thesis and what it holds), a chapter
 * (the series line, and its number as the outlined numeral), and every other entry, which shows its
 * image when it has one, fitted whole, never cropped (Aahil, round 2).
 *
 * Every word comes from `copy` or from the entry itself. Images are local files under `public/`
 * only, so drawing a card never fetches anything.
 *
 * Relative `.ts` imports, for Node.
 */
import fs from 'node:fs'
import path from 'node:path'

import profileJson from '../../../content/data/profile.json' with { type: 'json' }
import { SITE_URL } from '../../site.ts'
import { children, entryByPath, getLab, homeBands, readTime, routes, bodyOf } from '../content.ts'
import { plainInline, scanBody } from '../text.ts'
import { KINDS } from '../types.ts'
import type { Entry, Kind } from '../types.ts'
import { formatDay, kindWords, pad2, t } from '../view.ts'

export type CardKind = 'home' | 'section' | 'entry'

/** A picture for the card, as the data declares it: a file under `public/`. */
export interface CardImage {
  /** Its URL path, `/lab/…/x.webp`. */
  src: string
  /** Its file on disk. */
  file: string
  w: number
  h: number
}

export interface CardModel {
  kind: CardKind
  /** The address in the title bar, its last segment set bold: `aahil-khan.xyz/lab/` + `builds`. */
  address: { lead: string; last: string }
  eyebrow: string
  title: string
  /** The home's and a section's title is a size up (PR 3's `.og-title.xl`). */
  large: boolean
  lede: string
  /** The home's sections, as chips. */
  chips: string[]
  /** The handwritten date, with its year. */
  date: string | null
  /** The foot's words beside the date: a read time, or what a section holds. */
  meta: string
  /** A chapter's number, drawn as the outlined numeral. */
  numeral: string | null
  image: CardImage | null
  /** The card's alt text, for `og:image:alt`. */
  alt: string
  /** Who the card is by, at the foot's right. */
  by: string
}

/** The Lab's copy, as cards read it. */
type Copy = Record<string, string>

const RASTER = /\.(webp|png|jpe?g)$/i
/** Far enough back that `formatDay` always writes the year: a card outlives the year it was made in. */
const LONG_AGO = '0000-01-01'

/** `aahil-khan.xyz`: the site's host as a reader types it. */
export const displayHost = (url: string = SITE_URL) => new URL(url).host.replace(/^www\./, '')

export function address(pagePath: string, host = displayHost()): CardModel['address'] {
  const parts = pagePath.split('/').filter(Boolean)
  const last = parts.pop() ?? ''
  return { lead: `${host}/${parts.map((p) => `${p}/`).join('')}`, last }
}

/** A day with its year, as the card writes it. */
export const cardDay = (iso: string | null | undefined) => (iso ? formatDay(iso, LONG_AGO) : null)

/** `1 study, 1 series, 8 chapters`, in the order kinds are listed (`KINDS`). */
export function kindList(copy: Copy, counts: Partial<Record<Kind, number>>): string {
  return KINDS.filter((k) => counts[k])
    .map((k) => {
      const n = counts[k] ?? 0
      const [one, many = one] = (copy[`noun${k[0].toUpperCase()}${k.slice(1)}`] ?? k).split('|')
      return `${n} ${n === 1 ? one : many}`
    })
    .join(', ')
}

const count = (copy: Copy, n: number) => (n === 1 ? t(copy, 'countOne') : t(copy, 'countMany', { n }))

/**
 * The picture an entry's card shows: its lead's cover, its demo's still, its first screen, and for
 * an essay, which has no lead image, the first picture in its body (as PR 3's essay card did).
 * Only a raster file that exists under `public/`; anything else, and the card is text alone.
 */
export function imageOf(e: Entry, body: string, root: string = process.cwd()): CardImage | null {
  const lead = e.lead ?? {}
  const firstInBody = () => {
    const img = scanBody(body).images.find((i) => i.w && i.h)
    return img ? { src: img.src, w: img.w as number, h: img.h as number } : null
  }
  const pick =
    lead.cover ??
    (lead.demo ? { src: lead.demo.poster, w: lead.demo.w, h: lead.demo.h } : null) ??
    lead.images?.[0] ??
    (e.kind === 'essay' ? firstInBody() : null)
  if (!pick || !pick.src.startsWith('/') || pick.src.includes('..') || !RASTER.test(pick.src) || !(pick.w > 0 && pick.h > 0)) return null
  const file = path.join(root, 'public', pick.src)
  return fs.existsSync(file) ? { src: pick.src, file, w: pick.w, h: pick.h } : null
}

const by = (profileJson as { profile: { name: string } }).profile.name

/** The card for one Lab page, by its path (`/lab`, `/lab/<section>`, `/lab/<section>/<slug>`, …). `null` when the Lab has no such page. */
export function cardFor(pagePath: string, root?: string): CardModel | null {
  const { copy, entries, sections } = getLab()
  const route = routes().find((r) => r.path === pagePath)
  if (!route) return null
  const segs = pagePath.split('/').slice(2)
  const base = { address: address(pagePath), chips: [], numeral: null, image: null, by }

  if (route.kind === 'home') {
    const n = routes().filter((r) => r.kind === 'entry').length
    return {
      ...base,
      kind: 'home',
      eyebrow: t(copy, 'ogHomeKind'),
      title: t(copy, 'homeTitle'),
      large: true,
      lede: '',
      chips: homeBands().map((b) => b.section.title),
      date: null,
      meta: n ? count(copy, n) : '',
      alt: t(copy, 'ogAlt', { title: t(copy, 'homeTitle') }),
    }
  }

  if (route.kind === 'section') {
    const section = sections.find((s) => s.id === segs[0])
    if (!section) return null
    const inSection = routes()
      .filter((r) => r.kind === 'entry' && r.path.startsWith(`${pagePath}/`))
      .map((r) => entryByPath(r.path.split('/').slice(2)))
      .filter((e): e is Entry => !!e)
    const counts: Partial<Record<Kind, number>> = {}
    for (const e of inSection) counts[e.kind] = (counts[e.kind] ?? 0) + 1
    const newest = inSection.map((e) => e.published ?? '').sort().pop()
    return {
      ...base,
      kind: 'section',
      eyebrow: t(copy, 'ogSectionKind'),
      title: section.title,
      large: true,
      lede: plainInline(section.thesis),
      date: cardDay(newest),
      meta: t(copy, 'ogSectionMeta', { count: count(copy, inSection.length), kinds: kindList(copy, counts) }),
      alt: t(copy, 'ogAlt', { title: section.title }),
    }
  }

  if (route.kind !== 'entry') return null
  const e = entryByPath(segs)
  if (!e) return null
  const parent = 'parent' in e && e.parent ? entries.find((x) => x.id === e.parent) : undefined
  const chapter = e.kind === 'chapter'
  const lede = e.lede ?? (e.kind === 'essay' ? e.opening : 'keyLine' in e ? (e.keyLine ?? '') : '')
  return {
    ...base,
    kind: 'entry',
    eyebrow:
      chapter && parent
        ? t(copy, 'ogChapterKind', { series: parent.title, n: pad2(e.order), total: pad2(children(parent.id).length) })
        : kindWords(copy, e, parent?.title),
    title: e.title,
    large: false,
    lede: plainInline(lede),
    date: cardDay(e.published),
    meta: t(copy, 'readTime', { n: readTime(e.id) }),
    numeral: chapter ? pad2(e.order) : null,
    image: chapter ? null : imageOf(e, bodyOf(e.id), root),
    alt: t(copy, 'ogAlt', { title: e.title }),
  }
}
