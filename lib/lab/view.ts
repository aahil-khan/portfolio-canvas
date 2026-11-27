/**
 * The pure logic behind the Lab's pages: what a page shows, worked out from the data, with no
 * DOM, no React and no filesystem, so the entry pages (PR 6), the lists (PR 9) and the previews
 * (PR 10) can share it and `npm test` can hold it.
 *
 *   fill(template, vars)        a copy string with its {placeholders} filled
 *   formatDay(iso, today)       "26 Nov" this year, "14 Nov 2025" before; a no-break space inside
 *   resolveLead(entry, …)       which step of the kind's lead chain (LEAD_CHAINS) the entry reaches
 *   kindWords(entry, …)         "A chapter from The Shopkeeper", from copy
 *   pad2(n)                     "05"
 *   progress(…)                 reading progress, 0 to 1, ending exactly at the body's end
 *
 * Plain TypeScript with relative `.ts` imports, so Node runs it with `--experimental-strip-types`.
 */
import { LEAD_CHAINS } from './types.ts'
import type { Entry, LeadName, StudyData } from './types.ts'

/** Fills `{name}` placeholders. A placeholder with no value is left as written, so it shows. */
export function fill(template: string | undefined, vars: Record<string, string | number> = {}): string {
  return (template ?? '').replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

/** The copy string for `key`, filled. A missing key returns the key, so a gap is visible in review. */
export function t(copy: Record<string, string>, key: string, vars?: Record<string, string | number>): string {
  return fill(copy[key] ?? key, vars)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NBSP = ' '

/**
 * A day as the Lab writes it, handwritten: "26 Nov", or "14 Nov 2025" when it is not the year
 * `today` falls in. No-break spaces, so a date never splits across lines (rule D).
 */
export function formatDay(iso: string, today: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const [, y, mo, d] = m
  const day = `${Number(d)}${NBSP}${MONTHS[Number(mo) - 1]}`
  return y === today.slice(0, 4) ? day : `${day}${NBSP}${y}`
}

/** Today in Bareilly, `YYYY-MM-DD`: the Lab's clock (types.ts, `IsoDate`). */
export function bareillyToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** The time in Bareilly, `HH:MM`, 24-hour. */
export function bareillyTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
}

export const pad2 = (n: number): string => String(n).padStart(2, '0')

/** What the lead chain needs to know beyond the entry itself. */
export interface LeadContext {
  studies: Readonly<Record<string, StudyData>>
  /** How many chapters the series has (only read for a series). */
  chapters: number
}

/**
 * The first step of the entry's lead chain it actually has (API.md §1, `LEAD_CHAINS`), mirroring
 * `validateLab`'s check, which guarantees one exists for every published entry. `null` only for
 * data that failed validation, which never reaches a build.
 */
export function resolveLead(e: Entry, ctx: LeadContext): LeadName | null {
  const lead = e.lead ?? {}
  const has: Record<string, boolean> = {
    board: e.kind === 'study' && !!ctx.studies[e.id],
    logline: e.kind === 'study' && !!e.log?.length,
    progress: e.kind === 'series' && (ctx.chapters > 0 || !!e.premise?.trim()),
    instrument: !!lead.instrument,
    keyline: 'keyLine' in e && !!e.keyLine?.trim(),
    demo: !!lead.demo,
    screens: !!lead.images?.length,
    figure: !!lead.figure,
    install: e.kind === 'build' && !!e.install?.trim(),
    result: e.kind === 'experiment' && !!e.result?.value,
    cover: !!lead.cover,
    opening: e.kind === 'essay' && !!e.opening?.trim(),
  }
  const chain: readonly LeadName[] = LEAD_CHAINS[e.kind]
  return chain.find((l) => has[l]) ?? null
}

/** The copy key for a kind's words ("A study", "A chapter from {parent}"). */
export function kindKey(e: Entry): string {
  return `kind${e.kind[0].toUpperCase()}${e.kind.slice(1)}`
}

/** "A chapter from The Shopkeeper", "A note from …", "A build". */
export function kindWords(copy: Record<string, string>, e: Entry, parentTitle?: string): string {
  if ((e.kind === 'note' || e.kind === 'chapter') && !parentTitle) return t(copy, 'kindNote', { parent: '' }).replace(/\s+from\s*$/, '').trim()
  return t(copy, kindKey(e), { parent: parentTitle ?? '' })
}

/**
 * Reading progress (NEXT.md shortcut 1; DIRECTION "The reading progress"):
 *
 *   p = clamp((scrollY − bodyTop) / (bodyEnd − innerHeight − bodyTop), 0, 1)
 *
 * where `bodyTop` and `bodyEnd` are document offsets of the article's top and of `[data-body-end]`.
 * p reaches exactly 1 when the body's end meets the viewport's bottom edge, and is 0 at the top.
 * A body short enough to end on the screen as soon as it starts reads 1 whenever its end is in view.
 */
export function progress(scrollY: number, bodyTop: number, bodyEnd: number, innerHeight: number): number {
  const span = bodyEnd - innerHeight - bodyTop
  if (span <= 0) return scrollY + innerHeight >= bodyEnd ? 1 : 0
  return Math.min(1, Math.max(0, (scrollY - bodyTop) / span))
}

/** Where the reading dot sits: centred on the trail's end, kept clear of the mark and the edge. */
export function dotX(p: number, width: number, minX: number, size = 22, edge = 8): number {
  const x = p * width - size / 2
  return Math.round(Math.min(width - size - edge, Math.max(minX, x)))
}

/** The canonical URL a share sends: absolute on the site's origin, no trailing slash. */
export function shareUrls(url: string, title: string): { x: string; linkedin: string } {
  const u = encodeURIComponent(url)
  return {
    x: `https://x.com/intent/post?url=${u}&text=${encodeURIComponent(title)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
  }
}
