/**
 * The Lab's loaders. Contract: `content/lab/API.md` §2, "Demo mode" and "The empty Lab".
 *
 * Every function reads **the active set**: the demo set while `labDemo` is on, the real set
 * (`content/data/lab*.json`, `content/data/studies/`, bodies under `content/lab/`) while it is
 * off. Nothing that calls them knows which it has. `copy` always comes from the real
 * `content/data/lab.json`: the chrome's words are real either way. `LAB_FIXTURE=kinds`, read only
 * here, adds the test-only fixture (`content/lab/fixture/`) to whichever set is active.
 *
 * Server only: it reads the filesystem at build. It is not marked `server-only` because Node
 * loads it directly (`content:check`, the tests, `scripts/lab-routes.ts`); `node:fs` keeps it
 * out of any client chunk all the same. Relative imports with `.ts` extensions, for Node.
 *
 * `loadSet()` and `createLab()` are the pure halves, exported so the tests can build either set,
 * or one from plain objects, without the switch.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { plainText, plainInline, wordCount } from './text.ts'
import { TOP_LEVEL_KINDS, WORDS_PER_MINUTE } from './types.ts'
import type { Entry, Figure, Kind, Lab, LabContent, LabRoute, Section, StudyData, Term, Unfurl } from './types.ts'
import { DEMO_CONTENT, labDemo } from './visibility.ts'

/** The repo root: from this file when Node runs it in place, from the cwd when it is bundled. */
const ROOT = (() => {
  try {
    const here = fileURLToPath(import.meta.url)
    if (here.endsWith(path.join('lib', 'lab', 'content.ts'))) return path.resolve(path.dirname(here), '../..')
  } catch {
    /* bundled: import.meta.url is not a file */
  }
  return process.cwd()
})()

export type SetName = 'real' | 'demo'

/** Where one set's files live, relative to the repo root. */
export interface SetPaths {
  /** `LabContent` (`sections`, `tags`, `entries`). For the real set, also the switches and `copy`. */
  content: string
  terms: string
  figures: string
  unfurls: string
  /** A directory of `StudyData` files, `<id>.json`. */
  studies: string
  /** The directory bodies sit under: `<section>/<slug>.md`, `<section>/<parent-slug>/<slug>.md`. */
  bodies: string
}

export const REAL_PATHS: SetPaths = {
  content: 'content/data/lab.json',
  terms: 'content/data/lab-terms.json',
  figures: 'content/data/lab-figures.json',
  unfurls: 'content/data/lab-unfurls.json',
  studies: 'content/data/studies',
  bodies: 'content/lab',
}
export const DEMO_PATHS: SetPaths = {
  content: `${DEMO_CONTENT}/lab.json`,
  terms: `${DEMO_CONTENT}/lab-terms.json`,
  figures: `${DEMO_CONTENT}/lab-figures.json`,
  unfurls: `${DEMO_CONTENT}/lab-unfurls.json`,
  studies: `${DEMO_CONTENT}/studies`,
  bodies: DEMO_CONTENT,
}
const FIXTURE_DIR = 'content/lab/fixture'
const FIXTURE_PATHS: SetPaths = {
  content: `${FIXTURE_DIR}/lab.json`,
  terms: `${FIXTURE_DIR}/lab-terms.json`,
  figures: `${FIXTURE_DIR}/lab-figures.json`,
  unfurls: `${FIXTURE_DIR}/lab-unfurls.json`,
  studies: `${FIXTURE_DIR}/studies`,
  bodies: FIXTURE_DIR,
}
export const SET_PATHS: Record<SetName, SetPaths> = { real: REAL_PATHS, demo: DEMO_PATHS }

/** One set, loaded: the `Lab`, its bodies by entry id, and where each body file is. */
export interface LabSet {
  name: SetName
  lab: Lab
  bodies: Record<string, string>
  /** Each entry's body file, relative to the repo root, whether or not it exists. */
  bodyFiles: Record<string, string>
}

function readJson<T>(root: string, rel: string, fallback: T): T {
  const f = path.join(root, rel)
  if (!fs.existsSync(f)) return fallback
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8')) as T
  } catch (e) {
    throw new Error(`${rel}: not valid JSON (${(e as Error).message})`)
  }
}

function readStudies(root: string, rel: string): Record<string, StudyData> {
  const dir = path.join(root, rel)
  if (!fs.existsSync(dir)) return {}
  const out: Record<string, StudyData> = {}
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const s = readJson<StudyData>(root, path.posix.join(rel, f), { id: '', tracks: [], topics: [] })
    out[s.id || f.replace(/\.json$/, '')] = s
  }
  return out
}

/** An entry's body file, relative to its set's body directory. */
export function bodyPath(e: Entry, byId: ReadonlyMap<string, Entry>): string {
  const parentId = 'parent' in e ? e.parent : undefined
  const parent = parentId ? byId.get(parentId) : undefined
  return path.posix.join(e.section, ...(parent ? [parent.slug] : []), `${e.slug}.md`)
}

function readParts(root: string, p: SetPaths) {
  const content = readJson<Partial<LabContent>>(root, p.content, {})
  return {
    sections: content.sections ?? [],
    tags: content.tags ?? [],
    entries: content.entries ?? [],
    terms: readJson<Term[]>(root, p.terms, []),
    figures: readJson<Record<string, Figure>>(root, p.figures, {}),
    unfurls: readJson<Record<string, Unfurl>>(root, p.unfurls, {}),
    studies: readStudies(root, p.studies),
  }
}

/**
 * Reads one set from disk. `fixture` adds `content/lab/fixture/` on top. Missing files read as
 * empty, so the empty real set is a valid set.
 */
export function loadSet(name: SetName, { root = ROOT, fixture = false }: { root?: string; fixture?: boolean } = {}): LabSet {
  const real = readJson<{ copy?: Record<string, string> }>(root, REAL_PATHS.content, {})
  const parts = [{ paths: SET_PATHS[name], ...readParts(root, SET_PATHS[name]) }]
  if (fixture) parts.push({ paths: FIXTURE_PATHS, ...readParts(root, FIXTURE_PATHS) })
  const lab: Lab = {
    copy: real.copy ?? {},
    sections: parts.flatMap((x) => x.sections),
    tags: parts.flatMap((x) => x.tags),
    entries: parts.flatMap((x) => x.entries),
    terms: parts.flatMap((x) => x.terms),
    figures: Object.assign({}, ...parts.map((x) => x.figures)),
    unfurls: Object.assign({}, ...parts.map((x) => x.unfurls)),
    studies: Object.assign({}, ...parts.map((x) => x.studies)),
  }
  const bodies: Record<string, string> = {}
  const bodyFiles: Record<string, string> = {}
  for (const part of parts) {
    const byId = new Map(lab.entries.map((e) => [e.id, e]))
    for (const e of part.entries) {
      const rel = path.posix.join(part.paths.bodies, bodyPath(e, byId))
      bodyFiles[e.id] = rel
      const f = path.join(root, rel)
      if (fs.existsSync(f)) bodies[e.id] = fs.readFileSync(f, 'utf8')
    }
  }
  return { name, lab, bodies, bodyFiles }
}

/** Every loader of API.md §2, over one set. */
export interface LabApi {
  getLab(): Lab
  routes(): LabRoute[]
  entryByPath(segments: readonly string[]): Entry | null
  pathOf(entry: Entry): string
  bodyOf(id: string): string
  children(id: string): Entry[]
  related(id: string): Entry[]
  backlinks(id: string): Entry[]
  readTime(id: string): number
  homeBands(): { section: Section; entries: Entry[]; total: number }[]
  latest(n?: number): Entry[]
  newHere(section?: string): { counts: Partial<Record<Kind, number>>; start: Entry } | null
}

/** Where "where to begin" looks first: the highest-ranked kind present wins (API.md §2). */
const BEGIN_RANK: readonly Kind[] = ['study', 'series', 'build', 'experiment', 'essay', 'note']

const newestFirst = (a: Entry, b: Entry) => (b.published ?? '').localeCompare(a.published ?? '')
const oldestFirst = (a: Entry, b: Entry) => (a.published ?? '').localeCompare(b.published ?? '')

/** Builds the loaders over one set's data. Pure: no filesystem, no switches. */
export function createLab(lab: Lab, bodies: Readonly<Record<string, string>> = {}): LabApi {
  const byId = new Map(lab.entries.map((e) => [e.id, e]))
  const termById = new Map(lab.terms.map((t) => [t.id, t]))
  const isPublished = (e: Entry | undefined): e is Entry => !!e && !e.draft && e.published !== null
  const published = lab.entries.filter(isPublished)
  const parentOf = (e: Entry) => ('parent' in e && e.parent ? byId.get(e.parent) : undefined)
  const isTop = (e: Entry) => TOP_LEVEL_KINDS.includes(e.kind) && !parentOf(e)
  const shownSections = lab.sections.filter((s) => published.some((e) => e.section === s.id && isTop(e)))

  const pathOf = (e: Entry): string => {
    const parent = parentOf(e)
    return `/lab/${e.section}/${parent ? `${parent.slug}/` : ''}${e.slug}`
  }

  /** Entries this one links to: body links (terms that point at an entry count), then mentions. */
  const linkCache = new Map<string, string[]>()
  const linksFrom = (e: Entry): string[] => {
    const hit = linkCache.get(e.id)
    if (hit) return hit
    const text = [bodies[e.id] ?? '', e.lede ?? '', 'keyLine' in e ? (e.keyLine ?? '') : '', 'ending' in e ? e.ending.text : ''].join('\n\n')
    const out: string[] = []
    const add = (id: string | undefined) => {
      if (id && id !== e.id && isPublished(byId.get(id)) && !out.includes(id)) out.push(id)
    }
    // in order of first appearance, entry and term links interleaved as written
    for (const m of text.matchAll(/\[\[(?:(t):)?([\w-]+)\|/g)) add(m[1] ? termById.get(m[2])?.link : m[2])
    for (const id of e.mentions ?? []) add(id)
    linkCache.set(e.id, out)
    return out
  }
  const ids = (xs: readonly string[]) => xs.map((id) => byId.get(id)!).filter(isPublished)

  const api: LabApi = {
    getLab: () => lab,

    routes() {
      const tagsUsed = new Set(published.flatMap((e) => e.tags ?? []))
      return [
        { kind: 'home', path: '/lab' },
        ...shownSections.map((s): LabRoute => ({ kind: 'section', path: `/lab/${s.id}`, section: s.id })),
        ...published.map((e): LabRoute => ({ kind: 'entry', path: pathOf(e), entry: e.id, entryKind: e.kind })),
        { kind: 'index', path: '/lab/index' },
        ...lab.tags.filter((t) => tagsUsed.has(t.id)).map((t): LabRoute => ({ kind: 'tag', path: `/lab/tags/${t.id}`, tag: t.id })),
        { kind: 'glossary', path: '/lab/glossary' },
      ]
    },

    entryByPath(segments) {
      const want = `/lab/${segments.join('/')}`
      return published.find((e) => pathOf(e) === want) ?? null
    },

    pathOf,

    bodyOf: (id) => bodies[id] ?? '',

    children(id) {
      const e = byId.get(id)
      if (!e) return []
      const kids = lab.entries.filter((x) => 'parent' in x && x.parent === id)
      if (e.kind === 'series') return kids.filter((x) => x.kind === 'chapter').sort((a, b) => (a.kind === 'chapter' && b.kind === 'chapter' ? a.order - b.order : 0))
      if (e.kind === 'study')
        return kids.filter((x) => x.kind === 'note').sort((a, b) => (a.published === null ? 1 : b.published === null ? -1 : oldestFirst(a, b)))
      return []
    },

    related(id) {
      const e = byId.get(id)
      if (!e) return []
      const out: string[] = []
      const add = (x: string) => {
        if (x !== id && !out.includes(x)) out.push(x)
      }
      linksFrom(e).forEach(add)
      const mine = new Set(e.tags ?? [])
      published
        .filter((x) => x.id !== id && (x.tags ?? []).some((t) => mine.has(t)))
        .map((x) => ({ x, n: (x.tags ?? []).filter((t) => mine.has(t)).length }))
        .sort((a, b) => b.n - a.n || newestFirst(a.x, b.x))
        .forEach(({ x }) => add(x.id))
      published.filter((x) => x.section === e.section).sort(newestFirst).forEach((x) => add(x.id))
      // never empty while there are two entries: anything else, newest first
      if (!out.length) published.filter((x) => isTop(x)).sort(newestFirst).forEach((x) => add(x.id))
      if (!out.length) [...published].sort(newestFirst).forEach((x) => add(x.id))
      return ids(out)
    },

    backlinks(id) {
      return published.filter((x) => x.id !== id && linksFrom(x).includes(id))
    },

    readTime(id) {
      const e = byId.get(id)
      if (!e) return 1
      const words =
        wordCount(plainInline(e.lede ?? '')) +
        wordCount('opening' in e ? e.opening : '') +
        wordCount(plainInline('keyLine' in e ? (e.keyLine ?? '') : '')) +
        wordCount(plainText(bodies[id] ?? '')) +
        wordCount(plainInline('ending' in e ? e.ending.text : ''))
      return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
    },

    homeBands() {
      return shownSections.map((section) => {
        const all = published.filter((e) => e.section === section.id)
        return { section, entries: all.filter(isTop).sort(newestFirst).slice(0, 5), total: all.length }
      })
    },

    latest(n = 6) {
      return [...published].sort(newestFirst).slice(0, n)
    },

    newHere(section) {
      const pool = published.filter((e) => !section || e.section === section)
      if (!pool.length) return null
      const counts: Partial<Record<Kind, number>> = {}
      for (const e of pool) counts[e.kind] = (counts[e.kind] ?? 0) + 1
      for (const k of BEGIN_RANK) {
        const of = pool.filter((e) => e.kind === k && (k !== 'note' || isTop(e))).sort(oldestFirst)
        if (of.length) return { counts, start: of[0] }
      }
      return { counts, start: [...pool].sort(oldestFirst)[0] }
    },
  }
  return api
}

// ---------- the active set ----------

let active: { set: LabSet; api: LabApi } | null = null
/** The active set: demo or real, by `labDemo`, plus the fixture under `LAB_FIXTURE=kinds`. */
export function activeSet(): LabSet {
  if (!active) {
    const set = loadSet(labDemo ? 'demo' : 'real', { fixture: process.env.LAB_FIXTURE === 'kinds' })
    active = { set, api: createLab(set.lab, set.bodies) }
  }
  return active.set
}
const a = (): LabApi => (activeSet(), active!.api)

export const getLab = (): Lab => a().getLab()
export const routes = (): LabRoute[] => a().routes()
export const entryByPath = (segments: readonly string[]): Entry | null => a().entryByPath(segments)
export const pathOf = (entry: Entry): string => a().pathOf(entry)
export const bodyOf = (id: string): string => a().bodyOf(id)
export const children = (id: string): Entry[] => a().children(id)
export const related = (id: string): Entry[] => a().related(id)
export const backlinks = (id: string): Entry[] => a().backlinks(id)
export const readTime = (id: string): number => a().readTime(id)
export const homeBands = (): { section: Section; entries: Entry[]; total: number }[] => a().homeBands()
export const latest = (n = 6): Entry[] => a().latest(n)
export const newHere = (section?: string): { counts: Partial<Record<Kind, number>>; start: Entry } | null => a().newHere(section)
