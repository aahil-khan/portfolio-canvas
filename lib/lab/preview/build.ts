/**
 * Builds `/lab/previews.json` (see `data.ts`) from a set: only what a card renders. No drafts, no
 * term's `source` (never rendered), and only the unfurls of links a published page or a term
 * actually makes. Pure, so the test builds it from the demo set directly; the route passes the
 * active set's loaders.
 */
import { scanBody } from '../text.ts'
import type { Entry, Lab } from '../types.ts'
import { fill, formatDay, kindWords } from '../view.ts'
import { CARD_COPY, type PreviewData, type TagCard, type TermCard } from './data.ts'

export interface BuildInput {
  lab: Lab
  pathOf(e: Entry): string
  bodyOf(id: string): string
  today: string
}

/** How many of a tag's entries its card lists. */
export const TAG_CARD_ENTRIES = 4

const isUrl = (s: string) => /^https?:\/\//.test(s)

export function buildPreviewData({ lab, pathOf, bodyOf, today }: BuildInput): PreviewData {
  const { copy } = lab
  const byId = new Map(lab.entries.map((e) => [e.id, e]))
  const published = lab.entries.filter((e) => !e.draft && e.published !== null)
  const parentTitle = (e: Entry) => ('parent' in e && e.parent ? byId.get(e.parent)?.title : undefined)
  const kind = (e: Entry) => kindWords(copy, e, parentTitle(e))
  const isOut = (id: string) => published.some((e) => e.id === id)
  const newestFirst = (a: Entry, b: Entry) => (b.published ?? '').localeCompare(a.published ?? '') || a.title.localeCompare(b.title)

  const terms: Record<string, TermCard> = {}
  for (const t of lab.terms) {
    const card: TermCard = { name: t.name, def: t.def }
    if (/^\w+_\w+$/.test(t.name)) card.code = true
    if (t.link && isUrl(t.link)) card.more = { href: t.link, label: copy.cardSource, preview: `out:${t.link}` }
    else if (t.link && isOut(t.link)) {
      const e = byId.get(t.link)!
      card.more = { href: pathOf(e), label: fill(copy.cardRead, { title: e.title }), preview: `entry:${e.id}` }
    }
    terms[t.id] = card
  }

  const tags: Record<string, TagCard> = {}
  for (const g of lab.tags) {
    const with_ = published.filter((e) => e.tags?.includes(g.id)).sort(newestFirst)
    if (!with_.length) continue
    tags[g.id] = {
      title: g.title,
      ...(g.about ? { about: g.about } : {}),
      count: with_.length === 1 ? copy.countOne : fill(copy.countMany, { n: with_.length }),
      href: `/lab/tags/${g.id}`,
      entries: with_.slice(0, TAG_CARD_ENTRIES).map((e) => ({ title: e.title, href: pathOf(e), preview: `entry:${e.id}`, kind: kind(e) })),
    }
  }

  const entries: PreviewData['entries'] = {}
  for (const e of published) {
    const date = e.updated ?? e.published!
    entries[e.id] = { kind: kind(e), date, dateText: formatDay(date, today) }
  }

  // the links out a reader can meet: in published bodies and references, builds' own links, terms
  const used = new Set<string>()
  for (const e of published) {
    for (const u of scanBody(bodyOf(e.id)).outs) used.add(u)
    for (const r of Object.values(e.refs ?? {})) if (r.url) used.add(r.url)
    if ('repo' in e && e.repo) used.add(e.repo)
    if ('live' in e && e.live) used.add(e.live)
  }
  for (const t of lab.terms) if (t.link && isUrl(t.link)) used.add(t.link)
  const unfurls: PreviewData['unfurls'] = {}
  for (const [url, u] of Object.entries(lab.unfurls)) if (used.has(url)) unfurls[url] = u

  const cardCopy: Record<string, string> = {}
  for (const k of CARD_COPY) if (copy[k] !== undefined) cardCopy[k] = copy[k]
  return { copy: cardCopy, terms, tags, entries, unfurls }
}
