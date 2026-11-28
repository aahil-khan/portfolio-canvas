/**
 * The pure logic behind the Lab's list pages (PR 9: the home, section pages, the index, tag pages
 * and the glossary), worked out from the data with no DOM, no React and no filesystem, so the
 * pages stay markup and `npm test` can hold the rest.
 *
 *   counted(copy, n, kind)        "eight chapters", "one study", "14 notes"
 *   listJoin(copy, xs)            "a, b and c"
 *   kindCounts(entries)           how many of each kind, in the Lab's reading order
 *   holdsWords(copy, kids)        "eight chapters", "two notes and one series"
 *   sectionGroups(entries, …)     a section's list: each top-level entry with its own entries under it
 *   byYear(entries)               the index: newest year first, each year newest first
 *   stripOf(entries, n)           a section's three newest top-level entries
 *   lettersOf(terms)              the glossary, grouped by first letter
 *   splitLink(template)           "Begin with [[{link}]]…" split around its link
 *
 * Words come from the Lab's copy (`content/data/lab.json`), never from here. Plain TypeScript with
 * relative `.ts` imports, so Node runs it with `--experimental-strip-types`.
 */
import { TOP_LEVEL_KINDS } from './types.ts'
import type { Entry, Kind, Term } from './types.ts'
import { fill } from './view.ts'

type Copy = Readonly<Record<string, string>>

/** The order kinds are named in: the kinds that hold others first, the parts they hold last. */
export const KIND_ORDER: readonly Kind[] = ['study', 'series', 'build', 'experiment', 'essay', 'note', 'chapter']

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The singular and plural of a kind's noun, from `copy.noun<Kind>` ("chapter|chapters"). */
export function noun(copy: Copy, kind: Kind | 'entry', n: number): string {
  const key = `noun${cap(kind)}`
  const [one, many = one] = (copy[key] ?? kind).split('|')
  return n === 1 ? one : many
}

/** The plural noun, capitalised: a filter's label ("Chapters"). */
export function kindLabel(copy: Copy, kind: Kind): string {
  return cap(noun(copy, kind, 2))
}

/** A number in words where the copy has one (`copy.listsNumbers`, "no|one|two|…"), else digits. */
export function numberWord(copy: Copy, n: number): string {
  const words = (copy.listsNumbers ?? '').split('|').filter(Boolean)
  return words[n] ?? String(n)
}

/** "eight chapters", "one study". */
export function counted(copy: Copy, n: number, kind: Kind | 'entry'): string {
  return `${numberWord(copy, n)} ${noun(copy, kind, n)}`
}

/** "a", "a and b", "a, b and c", with the copy's word for "and". */
export function listJoin(copy: Copy, xs: readonly string[]): string {
  if (xs.length < 2) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} ${copy.listsAnd ?? 'and'} ${xs[xs.length - 1]}`
}

/** How many of each kind, in `KIND_ORDER`, kinds with none left out. */
export function kindCounts(entries: readonly Entry[]): { kind: Kind; n: number }[] {
  return KIND_ORDER.map((kind) => ({ kind, n: entries.filter((e) => e.kind === kind).length })).filter((x) => x.n > 0)
}

/** What an entry's own entries come to, in words: "eight chapters", "two notes". Empty when none. */
export function holdsWords(copy: Copy, kids: readonly Entry[]): string {
  return listJoin(
    copy,
    kindCounts(kids).map(({ kind, n }) => counted(copy, n, kind)),
  )
}

/** "It holds one study, one series, two notes and eight chapters." */
export function holdsLine(copy: Copy, entries: readonly Entry[]): string {
  return fill(copy.secHolds, { list: holdsWords(copy, entries) })
}

/** Newest first; on the same day, a series' chapters in their order, else by title. */
const newestFirst = (a: Entry, b: Entry) =>
  (b.published ?? '').localeCompare(a.published ?? '') ||
  (a.kind === 'chapter' && b.kind === 'chapter' && a.parent === b.parent ? a.order - b.order : a.title.localeCompare(b.title))
const oldestFirst = (a: Entry, b: Entry) => (a.published ?? '').localeCompare(b.published ?? '')
const isOut = (e: Entry) => !e.draft && e.published !== null

/** Top-level by the contract (API.md §1): every kind but a chapter, and a note only without a parent. */
export function isTopLevel(e: Entry, byId: ReadonlyMap<string, Entry>): boolean {
  const parent = 'parent' in e && e.parent ? byId.get(e.parent) : undefined
  return TOP_LEVEL_KINDS.includes(e.kind) && !parent
}

/** An entry's own published entries: a series' chapters by order, a study's notes by date. */
export function kidsOf(e: Entry, entries: readonly Entry[]): Entry[] {
  const kids = entries.filter((x) => isOut(x) && 'parent' in x && x.parent === e.id)
  if (e.kind === 'series') return kids.filter((x) => x.kind === 'chapter').sort((a, b) => (a.kind === 'chapter' && b.kind === 'chapter' ? a.order - b.order : 0))
  return kids.sort(oldestFirst)
}

/**
 * A section page's list: every top-level entry, newest first, each with its own entries under it
 * (a series' chapters, a study's notes), so every entry in the section is listed exactly once.
 */
export function sectionGroups(entries: readonly Entry[], section: string): { entry: Entry; kids: Entry[] }[] {
  const byId = new Map(entries.map((e) => [e.id, e]))
  const pub = entries.filter((e) => isOut(e) && e.section === section)
  return pub
    .filter((e) => isTopLevel(e, byId))
    .sort(newestFirst)
    .map((entry) => ({ entry, kids: kidsOf(entry, pub) }))
}

/** A section's newest `n` top-level entries: the strip a section with no hero of its own shows. */
export function stripOf(entries: readonly Entry[], section: string, n = 3): Entry[] {
  return sectionGroups(entries, section)
    .slice(0, n)
    .map((g) => g.entry)
}

/** The index: published entries grouped by the year they were written, newest year first. */
export function byYear(entries: readonly Entry[]): { year: string; entries: Entry[] }[] {
  const out: { year: string; entries: Entry[] }[] = []
  for (const e of entries.filter(isOut).sort(newestFirst)) {
    const year = (e.published ?? '').slice(0, 4)
    const group = out.find((g) => g.year === year)
    if (group) group.entries.push(e)
    else out.push({ year, entries: [e] })
  }
  return out
}

/** Every published entry with this tag, newest first. */
export function tagged(entries: readonly Entry[], tag: string): Entry[] {
  return entries.filter((e) => isOut(e) && (e.tags ?? []).includes(tag)).sort(newestFirst)
}

/** The letter a term files under: its first letter or digit, upper case. */
export function letterOf(name: string): string {
  const m = /[\p{L}\p{N}]/u.exec(name)
  return m ? m[0].toLocaleUpperCase('en') : '#'
}

/** The glossary: terms by name, case-insensitively, grouped by first letter. */
export function lettersOf(terms: readonly Term[]): { letter: string; terms: Term[] }[] {
  const key = (t: Term) => t.name.replace(/^[^\p{L}\p{N}]+/u, '')
  const sorted = [...terms].sort((a, b) => key(a).localeCompare(key(b), 'en', { sensitivity: 'base' }) || a.name.localeCompare(b.name, 'en'))
  const out: { letter: string; terms: Term[] }[] = []
  for (const t of sorted) {
    const letter = letterOf(t.name)
    const group = out.find((g) => g.letter === letter)
    if (group) group.terms.push(t)
    else out.push({ letter, terms: [t] })
  }
  return out
}

/**
 * A copy string with one link in it, `[[{link}]]`, split around it: `{ before, after }`. A string
 * with no link comes back whole in `before`.
 */
export function splitLink(template: string): { before: string; after: string; hasLink: boolean } {
  const i = template.indexOf('[[{link}]]')
  if (i < 0) return { before: template, after: '', hasLink: false }
  return { before: template.slice(0, i), after: template.slice(i + '[[{link}]]'.length), hasLink: true }
}

/** The `?kind=` an index link carries, if it names a kind the index lists. */
export function kindParam(value: string | null | undefined, kinds: readonly Kind[]): Kind | 'all' {
  return value && (kinds as readonly string[]).includes(value) ? (value as Kind) : 'all'
}
