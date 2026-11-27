/**
 * The Lab's content model, as types. Contract: `content/lab/API.md` §1.
 *
 * Written before any content exists (PR 1), so every later PR builds on the same shapes. The data
 * itself is JSON (`content/data/lab*.json`, `content/data/studies/*.json`) and the bodies are
 * Markdown (`content/lab/<section>/…/<slug>.md`); `lib/lab/content.ts` loads them into a `Lab`,
 * and `lib/lab/rules.ts` (`validateLab`) refuses what types cannot.
 *
 * Plain types and constants only, so Node runs this file with `--experimental-strip-types` too.
 */

/** `YYYY-MM-DD`. Dates are days, never instants: the Lab's clock is Bareilly's. */
export type IsoDate = string

/** The seven kinds of entry. Each has its own template and its own lead chain. */
export const KINDS = ['study', 'series', 'chapter', 'note', 'build', 'experiment', 'essay'] as const
export type Kind = (typeof KINDS)[number]

/**
 * Kinds that can stand at the top level: on the home's bands, in a section's list, in Latest.
 * A chapter always has a series above it. A note may hang under a study or stand alone.
 */
export const TOP_LEVEL_KINDS: readonly Kind[] = ['study', 'series', 'note', 'build', 'experiment', 'essay']

/**
 * Ids no section, entry, tag or term may take: the first three are routes under `/lab`, and the
 * last two are directories beside the bodies under `content/lab/`. (`demo` leaves with the demo
 * set; see API.md, "Demo mode".)
 */
export const RESERVED_IDS = ['index', 'tags', 'glossary', 'demo', 'fixture'] as const

/** At most this many tags across the whole Lab. */
export const MAX_TAGS = 8

/** Words a minute, for `readTime()`. */
export const WORDS_PER_MINUTE = 220

export interface Section {
  id: string
  title: string
  /** One or two sentences under the section's title, and on its home band. */
  thesis: string
  /** An entry id to lead the section page. Without one, the page shows its three newest. */
  hero?: string
}

export interface Tag {
  id: string
  title: string
  /** One line on the tag's own page. */
  about?: string
}

/** A numbered reference, cited in a body as `[^key]` and numbered by first use. */
export interface Ref {
  title: string
  /** Publisher and date as one line, e.g. "Anthropic Engineering · 9 Jan 2026". */
  site: string
  /** Why it is cited: a quote or one plain line. */
  line?: string
  /** `null` for a source that is not published (it says so on its card). */
  url: string | null
}

/** A glossary term, written `[[t:<id>|words]]` in a body. */
export interface Term {
  id: string
  /** How the term is written in its card's title. */
  name: string
  /** One plain line: what it means. */
  def: string
  /** An entry id, or an `https://` URL the card links on to. */
  link?: string
  /** Where the definition comes from. Never rendered; kept for review. */
  source: string
}

/** An image with its size declared, so nothing shifts as it loads. Paths are under `public/`. */
export interface Image {
  src: string
  w: number
  h: number
  alt: string
  caption?: string
}

/** A looping demo: an animated WebP with a still poster for reduced motion and JS off. */
export interface Demo extends Image {
  poster: string
}

/**
 * The data that picks an entry's lead. Which fields count depends on the kind: see `LEAD_CHAINS`.
 * `instrument` and `figure` name an entry in the instrument registry
 * (`lib/lab/instruments/schemas.ts`, PR 11), whose data is in `lab-figures.json` under `of`, or
 * under the entry's own id when `of` is absent.
 */
export interface LeadData {
  instrument?: string
  figure?: string
  of?: string
  demo?: Demo
  images?: Image[]
  cover?: Image
}

/**
 * The lead each kind falls back through, first match wins. Every chain ends in something the
 * kind always has, so no entry is ever without a lead (`validateLab` checks the last step is
 * really there: a build with no demo, images, figure or install line fails).
 *
 *   instrument  `lead.instrument`, a registered instrument
 *   board       the study's board, from `studies/<id>.json`
 *   logline     the study's newest `log` line
 *   keyline     `keyLine`
 *   progress    the series' chapters, as ticks
 *   demo        `lead.demo`         screens  `lead.images`      figure  `lead.figure`
 *   install     `install`           result   `result`
 *   cover       `lead.cover`        opening  `opening`
 */
export const LEAD_CHAINS = {
  study: ['board', 'logline'],
  series: ['progress'],
  chapter: ['instrument', 'keyline'],
  note: ['instrument', 'keyline'],
  build: ['demo', 'screens', 'figure', 'install'],
  experiment: ['figure', 'result'],
  essay: ['cover', 'opening'],
} as const satisfies Record<Kind, readonly string[]>
export type LeadName = (typeof LEAD_CHAINS)[Kind][number]

/** How "What I'd do now" is framed at the end of a build or an experiment. */
export const ENDING_KINDS = ['do', 'use', 'measure'] as const
export type EndingKind = (typeof ENDING_KINDS)[number]

/** Fields every kind shares. */
interface EntryBase {
  /** Unique across the Lab. Links say `[[<id>|words]]`. */
  id: string
  /** The URL segment. Unique within its section, or within its parent for a child. */
  slug: string
  section: string
  title: string
  /** One or two sentences under the title, and on every list row. */
  lede?: string
  /** `null` only while `draft` is true. */
  published: IsoDate | null
  updated?: IsoDate
  /** Listed as "later", never rendered as a page of its own. */
  draft?: boolean
  /** Tag ids. */
  tags?: string[]
  /** Entry ids this one names in data rather than in its body; they count as links. */
  mentions?: string[]
  /** Its references, by the key the body cites. */
  refs?: Record<string, Ref>
  /** A verbatim sentence of the body, set as the pull-quote. Long entries must have one. */
  pull?: string
  /** The bold line over an interactive lead. */
  leadIntro?: string
  lead?: LeadData
}

export interface Study extends EntryBase {
  kind: 'study'
  /** Dated lines of what was done; the newest is the lead when there is no board. */
  log?: { date: IsoDate; did: string }[]
}

export interface Series extends EntryBase {
  kind: 'series'
  /** The study it belongs to, if any. */
  study?: string
  /** One line the lead shows before any chapter is out. */
  premise?: string
}

export interface Chapter extends EntryBase {
  kind: 'chapter'
  /** The series' id. */
  parent: string
  /** 1-based, unique within the series. */
  order: number
  keyLine?: string
}

export interface Note extends EntryBase {
  kind: 'note'
  /** The study's id, or absent for a standalone note. */
  parent?: string
  /** The study topic it writes up, e.g. "T02". */
  topic?: string
  keyLine?: string
}

export interface Build extends EntryBase {
  kind: 'build'
  install?: string
  repo?: string
  live?: string
  result?: { value: string; baseline?: string }
  ending: { text: string }
  endingKind: EndingKind
}

export interface Experiment extends EntryBase {
  kind: 'experiment'
  result: { question: string; setup: string; value: string; baseline?: string }
  ending: { text: string }
  endingKind: EndingKind
}

export interface Essay extends EntryBase {
  kind: 'essay'
  /** The first paragraph, set at lede size as the lead. The body starts after it. */
  opening: string
  /** Where it first ran, if elsewhere. */
  canonical?: string
}

export type Entry = Study | Series | Chapter | Note | Build | Experiment | Essay
export type EntryOf<K extends Kind> = Extract<Entry, { kind: K }>

/** A link out's card, fetched at build time by `scripts/lab-unfurl.mjs` (PR 7), keyed by URL. */
export interface Unfurl {
  title: string
  description?: string
  site: string
  domain: string
  /** Same-origin, under `public/lab/unfurl/`. */
  img?: Image
  icon?: string
  /** Built by hand from his own copy, because the site refuses scripts (Medium). */
  standIn?: true
}

/** One topic on a study's board (`content/data/studies/<id>.json`). */
export interface Topic {
  id: string
  track: string
  topic: string
  phase: string
  est: number
  spent: number
  status: 'done' | 'doing' | 'todo' | 'parked' | 'later'
  finished: IsoDate | null
  learn?: string
}

export interface StudyData {
  id: string
  tracks: string[]
  topics: Topic[]
}

/** Figure data for the instrument registry (`content/data/lab-figures.json`), keyed by id. */
export interface Figure {
  instrument: string
  caption?: string
  data: Record<string, unknown>
}

/** `content/data/lab.json`. The two switches live here and are read only by `lib/lab/visibility.ts`. */
export interface LabFile {
  /** Hidden until PR 17. Read only by `lib/lab/visibility.ts`. */
  public: boolean
  /** Serve the demo set instead of this file's own content. Read only by `lib/lab/visibility.ts`. */
  demo: boolean
  /** The Lab's chrome copy: every sentence that is not an entry's. */
  copy: Record<string, string>
  sections: Section[]
  tags: Tag[]
  entries: Entry[]
}

/** The content half of a set: what the demo directory mirrors. */
export type LabContent = Pick<LabFile, 'sections' | 'tags' | 'entries'>

/** What `getLab()` returns: one set (real or demo), loaded and indexed. Bodies load by id. */
export interface Lab {
  copy: Record<string, string>
  sections: Section[]
  tags: Tag[]
  entries: Entry[]
  terms: Term[]
  figures: Record<string, Figure>
  unfurls: Record<string, Unfurl>
  studies: Record<string, StudyData>
}

/** Every page under `/lab`, as `routes()` lists them. */
export type LabRoute =
  | { kind: 'home'; path: '/lab' }
  | { kind: 'section'; path: string; section: string }
  | { kind: 'entry'; path: string; entry: string; entryKind: Kind }
  | { kind: 'index'; path: '/lab/index' }
  | { kind: 'tag'; path: string; tag: string }
  | { kind: 'glossary'; path: '/lab/glossary' }

/** What a `[data-preview]` link points at (API.md §5). */
export type PreviewTarget = `entry:${string}` | `term:${string}` | `tag:${string}` | `ref:${string}` | `out:${string}`
