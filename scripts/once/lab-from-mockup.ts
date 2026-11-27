/**
 * Converts the approved mockup's content (`prototype/lab-v2b/content/*.js`) into the Lab's **demo
 * set**, once. Committed so the conversion can be reviewed; deleted in PR 14.
 *
 *   node --experimental-strip-types --no-warnings scripts/once/lab-from-mockup.ts
 *
 * Aahil, 27 Nov: "dont pre populate lab with content ill add eveyrhting acc to me later, for now,
 * have a demo mode with pre populated contetnt". So nothing here lands in the real set: every
 * entry, section, tag, term, figure, unfurl, study and body goes under `DEMO_CONTENT`, and every
 * image under `public` + `DEMO_PUBLIC` (both from `lib/lab/visibility.ts`). The one exception is
 * the chrome's copy, which is real either way (API.md, "Demo mode"): it is merged into
 * `content/data/lab.json` → `copy`, keys camelCased, without touching any key already there.
 *
 * What it writes, all of it regenerated on every run:
 *   <DEMO_CONTENT>/lab.json            sections, tags, entries (LabContent)
 *   <DEMO_CONTENT>/lab-terms.json      Term[]
 *   <DEMO_CONTENT>/lab-figures.json    Record<id, Figure>: body figures and lead instruments' data
 *   <DEMO_CONTENT>/lab-unfurls.json    Record<url, Unfurl>, images re-pointed at public/
 *   <DEMO_CONTENT>/studies/<id>.json   StudyData (the board); its log moves onto the study entry
 *   <DEMO_CONTENT>/<section>/…/*.md    bodies (API.md §4)
 *   public<DEMO_PUBLIC>/<entry>/*      lead and body images
 *   public<DEMO_PUBLIC>/unfurl/*       unfurl images and favicons
 *   content/lab/fixture/               the test-only fixture (`LAB_FIXTURE=kinds`), from fixture-kinds.js
 *
 * Mockup body blocks become Markdown like this (inline markup is already the Lab's, unchanged):
 *   { h2 } / { h3 }           ## text / ### text
 *   { p }                     a paragraph
 *   { list, ordered }         - item / 1. item
 *   { quote }                 > text
 *   { code }                  a fenced block, language `text`
 *   { side, sideHead }        :::side[Heading] … :::
 *   { img }                   ![alt](src "w=W h=H | caption")
 *   { figure, of }            ::figure{of="<figure id>"}
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- a one-off over the mockup's untyped data */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { DEMO_CONTENT, DEMO_PUBLIC } from '../../lib/lab/visibility.ts'
import { DEMO_RENAMES, loadMockup, MOCK, txt, type Any } from './mockup.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, DEMO_CONTENT)
const PUB = path.join(ROOT, 'public', DEMO_PUBLIC.replace(/^\//, ''))
const FIXTURE = path.join(ROOT, 'content/lab/fixture')

const deep = (v: any): any =>
  Array.isArray(v) ? v.map(deep) : v && typeof v === 'object' ? ('text' in v && typeof v.text === 'string' && Object.keys(v).every((k) => ['text', 'proposal', 'where', 'reason', 'source'].includes(k)) ? v.text : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]))) : v
const camel = (k: string) => k.replace(/[.\-_]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase())
const write = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n')
}
const prune = <T extends Any>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

// ---------- the chrome's copy ----------

/**
 * Copy keys that are an entry's or an instrument's words, not the chrome's. They go into the demo
 * set (entry fields, section theses, figure data), so the clean-up removes them with it.
 */
const CONTENT_COPY = /^(sec\.(studies|builds|experiments|writing)|study\.lede|series\.lede|ch05\.|t0\d\.|holt\.|datesheet\.|haggle\.|cmp\.|scn\.|sch\.|passk\.)/
/** Instruments' copy by key prefix: it travels in that instrument's figure data. */
const INSTRUMENT_COPY: Record<string, RegExp> = {
  haggle: /^haggle\./,
  scenarios: /^scn\./,
  schedule: /^sch\./,
  passk: /^passk\./,
  datesheet: /^datesheet\./,
}

function chromeCopy(L: Any): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(L.copy as Any)) {
    if (CONTENT_COPY.test(k)) continue
    let t = txt(v) as string
    // Chrome copy is plain text: it can't link a term, because the real set may have none.
    t = t.replace(/\[\[(?:t:|tag:)?[\w-]+\|([^\]]+)\]\]/g, '$1')
    out[camel(k)] = t
  }
  return out
}

// ---------- images ----------

const copied = new Map<string, string>()
/** Copies a mockup asset under public<DEMO_PUBLIC>/<dir>/ and returns its URL. */
function asset(src: string, dir: string): string {
  if (!src.startsWith('assets/')) throw new Error(`unexpected asset path ${src}`)
  const key = `${dir}/${src}`
  if (copied.has(key)) return copied.get(key)!
  const name = path.basename(src)
  const to = path.join(PUB, dir, name)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(path.join(MOCK, src), to)
  const url = `${DEMO_PUBLIC}/${dir}/${name}`
  copied.set(key, url)
  return url
}
async function size(src: string) {
  const m = await sharp(path.join(MOCK, src)).metadata()
  return { w: m.width!, h: m.pageHeight ?? m.height! }
}

// ---------- bodies ----------

const one = (s: string) => {
  if (/\n/.test(s)) throw new Error(`a multi-line text block: ${s.slice(0, 60)}`)
  return s.trim()
}
/** A paragraph that starts like a list, a heading or a quote is escaped, so it stays a paragraph. */
const para = (s: string) => one(s).replace(/^(\d+)([.)])(\s)/, '$1\\$2$3').replace(/^([#>+*-])(\s)/, '\\$1$2')

/** One mockup body's blocks → Markdown. Figures are registered through `figure()`. */
function markdown(entryId: string, blocks: Any[], figure: (inst: string, of: string | undefined) => string): string {
  const out: string[] = []
  for (const b of blocks) {
    const keys = Object.keys(b).filter((k) => b[k] != null)
    if (b.h2) out.push(`## ${one(txt(b.h2))}`)
    else if (b.h3) out.push(`### ${one(txt(b.h3))}`)
    else if (b.p) out.push(para(txt(b.p)))
    else if (b.list) out.push(b.list.map((i: unknown, n: number) => `${b.ordered ? `${n + 1}.` : '-'} ${one(txt(i))}`).join('\n'))
    else if (b.quote) {
      if (b.cite) throw new Error(`${entryId}: a quote with a cite`)
      out.push(`> ${one(txt(b.quote))}`)
    } else if (b.code) out.push('```text\n' + b.code + '\n```')
    else if (b.side) out.push(`:::side${b.sideHead ? `[${one(txt(b.sideHead))}]` : ''}\n${one(txt(b.side))}\n:::`)
    else if (b.img) {
      const m = b.img
      const src = asset(m.src, entryId)
      const cap = m.caption ? ` | ${one(txt(m.caption))}` : ''
      if (/"/.test(cap) || /[\[\]]/.test(m.alt)) throw new Error(`${entryId}: an image whose alt or caption needs escaping`)
      out.push(`![${m.alt}](${src} "w=${m.w} h=${m.h}${cap}")`)
    } else if (b.figure) out.push(`::figure{of="${figure(b.figure, b.of)}"}`)
    else throw new Error(`${entryId}: unknown block ${JSON.stringify(keys)}`)
    for (const k of keys) if (!['h2', 'h3', 'p', 'list', 'ordered', 'quote', 'code', 'side', 'sideHead', 'img', 'figure', 'of'].includes(k)) throw new Error(`${entryId}: unknown block key ${k}`)
  }
  return out.join('\n\n') + '\n'
}

// ---------- the set ----------

interface Converted {
  content: { sections: Any[]; tags: Any[]; entries: Any[] }
  terms: Any[]
  figures: Record<string, Any>
  unfurls: Record<string, Any>
  studies: Record<string, Any>
  bodies: Map<string, { file: string; md: string }>
}

/** Where an entry's body lives, relative to its set's body root (API.md, "Where things live"). */
function bodyFile(e: Any, byId: Map<string, Any>): string {
  const parent = e.parent && byId.get(e.parent)
  return path.join(e.section, ...(parent ? [parent.slug] : []), `${e.slug}.md`)
}

async function convert(L: Any, { sections, entries }: { sections: Any[]; entries: Any[] }, dirFor: (id: string) => string): Promise<Converted> {
  const copy = L.copy as Any
  const bodies = (L.bodies ?? {}) as Any
  const figures: Record<string, Any> = {}
  const instCopy = (inst: string) => {
    const re = INSTRUMENT_COPY[inst]
    if (!re) return undefined
    const o = Object.fromEntries(Object.entries(copy).filter(([k]) => re.test(k)).map(([k, v]) => [camel(k.replace(re, '')), txt(v)]))
    return Object.keys(o).length ? o : undefined
  }

  const outSections = sections.map((s) =>
    prune({ id: s.id, title: s.title, thesis: s.thesis ?? txt(copy[s.thesisKey]), hero: s.hero }),
  )

  const byId = new Map(entries.map((e) => [e.id, e]))
  const outEntries: Any[] = []
  const outBodies = new Map<string, { file: string; md: string }>()

  for (const src of entries) {
    const b: Any = bodies[src.id] ?? {}
    const meta = deep(b.meta ?? {})
    const e: Any = { ...src, ...meta }
    if (meta.published) e.draft = false
    const lede = meta.lede ?? (src.ledeKey ? txt(copy[src.ledeKey]) : src.lede)
    const keyLine = meta.keyLine ?? (src.keyLineKey ? txt(copy[src.keyLineKey]) : src.keyLine)

    // the lead: images get sizes and public paths, instruments get their data as figures
    const lead: Any | undefined = e.lead ? { ...e.lead } : undefined
    if (lead?.demo) {
      const d = lead.demo
      lead.demo = { src: asset(d.src, dirFor(e.id)), poster: asset(d.poster, dirFor(e.id)), w: d.w, h: d.h, alt: d.alt }
    }
    if (lead?.images) {
      const alts = src.imagesAltKey ? String(txt(copy[src.imagesAltKey])).split('|') : []
      lead.images = lead.images.map((im: Any, i: number) => prune({ src: asset(im.src, dirFor(e.id)), w: im.w, h: im.h, alt: im.alt ?? alts[i]?.trim() ?? alts[0] }))
      for (const im of lead.images) if (!im.alt) throw new Error(`${e.id}: a lead image with no alt`)
    }
    const inst = lead?.instrument ?? lead?.figure
    if (inst && inst !== 'board') {
      const data: Any = {}
      if (inst === 'haggle') data.items = deep(L.data.items)
      if (inst === 'scenarios') Object.assign(data, deep(L.scenarios))
      if (inst === 'schedule') data.item = 'CHG-20W'
      if (inst === 'schedule') data.items = deep(L.data.items)
      const c = instCopy(inst)
      if (c) data.copy = c
      figures[e.id] = prune({ instrument: inst, caption: txt(b.leadCaption), data })
    } else if (b.leadCaption) throw new Error(`${e.id}: a lead caption with no instrument to carry it`)

    const figure = (fi: string, of: string | undefined) => {
      const key = of ?? e.id
      const id = `${fi}-${key}`
      const table: Any = fi === 'compare' ? L.compares : fi === 'chart' ? L.charts : fi === 'spec-table' ? L.specTables : null
      if (!table?.[key]) throw new Error(`${e.id}: figure ${fi} of ${key} has no data`)
      const data = deep(table[key])
      const caption = data.caption
      delete data.caption
      figures[id] = prune({ instrument: fi, caption, data })
      return id
    }

    const refs = b.refs ? Object.fromEntries(Object.entries(b.refs as Any).map(([k, r]: [string, Any]) => [k, prune({ title: r.title, site: r.site, line: txt(r.line), url: r.url ?? null })])) : undefined

    const out: Any = prune({
      id: e.id,
      slug: e.slug,
      section: e.section,
      kind: e.kind,
      title: e.title,
      lede,
      published: e.draft ? null : e.published,
      updated: e.updated,
      draft: e.draft ? true : undefined,
      tags: e.tags,
      mentions: e.mentions,
      refs,
      pull: txt(b.pull),
      leadIntro: txt(b.leadIntro),
      lead,
    })
    if (e.kind === 'study' && (e.log ?? (L.data.study?.id === e.id ? L.data.study.log : undefined)))
      out.log = deep(e.log ?? L.data.study.log)
    if (e.kind === 'series') Object.assign(out, prune({ study: e.study, premise: e.premise }))
    if (e.kind === 'chapter') Object.assign(out, prune({ parent: e.parent, order: e.order, keyLine }))
    if (e.kind === 'note') Object.assign(out, prune({ parent: e.parent, topic: e.topic, keyLine }))
    if (e.kind === 'build' || e.kind === 'experiment') {
      Object.assign(out, prune({ install: e.install, repo: e.repo, live: e.live, result: e.result }))
      if (b.ending) Object.assign(out, { ending: { text: [b.ending].flat().map(txt).join('\n\n') }, endingKind: b.endingKind })
    }
    if (e.kind === 'essay') Object.assign(out, prune({ opening: e.opening, canonical: refs?.medium?.url ?? undefined }))
    outEntries.push(out)

    if (b.blocks?.length) outBodies.set(e.id, { file: bodyFile(out, byId), md: markdown(dirFor(e.id), b.blocks, figure) })
  }

  // tags: every tag a public entry carries, titled as the mockup shows them
  const tagIds = [...new Set(outEntries.filter((e) => !e.draft).flatMap((e) => e.tags ?? []))].sort()
  const tags = tagIds.map((id) => ({ id, title: id }))

  const terms = (L.terms ?? []).map((t: Any) => prune({ id: t.id, name: t.name, def: t.def, link: t.link, source: t.source }))

  const unfurls: Record<string, Any> = {}
  for (const [url, u] of Object.entries((L.unfurls ?? {}) as Any)) {
    const img = u.img ? { src: asset(u.img, 'unfurl'), ...(await size(u.img)), alt: '' } : undefined
    unfurls[url] = prune({ title: u.title, description: u.description, site: u.site, domain: u.domain, img, icon: u.icon ? asset(u.icon, 'unfurl') : undefined, standIn: u.standIn ? true : undefined })
  }

  const studies: Record<string, Any> = {}
  if (L.data.study) {
    const s = deep(L.data.study)
    studies[s.id] = { id: s.id, tracks: s.tracks, topics: s.topics }
  }
  return { content: { sections: outSections, tags, entries: outEntries }, terms, figures, unfurls, studies, bodies: outBodies }
}

/**
 * Holt's verdicts, as a term, so the source of their names is on record (plan PR 2, Done when).
 * The Holt build's body names all six; its link to this term changes none of its words.
 */
const HOLT_VERDICTS = {
  id: 'holt-verdict',
  name: 'Holt’s verdicts',
  def: 'The six answers Holt gives about a repository: worth your time, a long shot, not worth your time, not enough evidence, a personal project, or a list rather than code.',
  link: 'https://githolt.com',
  source:
    'Checked 27 Nov 2026. githolt.com, section 06, names four: “Worth your time.”, “Long shot.”, “Not worth your time.”, “Not enough evidence.”. The other two, “Personal project” and “A list, not code”, are not on githolt.com or githolt.com/how-it-works; they are in the verdict list Holt’s own MCP server publishes, which names all six.',
}

/** Applies `DEMO_RENAMES` to the mockup's data, in place, before anything is converted. */
function rename(L: Any) {
  const sec = (id: string) => DEMO_RENAMES.sections[id] ?? id
  const tag = (id: string) => DEMO_RENAMES.tags[id] ?? id
  for (const s of L.data.sections) s.id = sec(s.id)
  for (const e of L.data.entries) {
    e.section = sec(e.section)
    if (e.tags) e.tags = e.tags.map(tag)
  }
  // `[[tag:desktop|…]]` in any text: bodies, copy, terms
  const re = new RegExp(`\\[\\[tag:(${Object.keys(DEMO_RENAMES.tags).join('|')})\\|`, 'g')
  const walk = (v: any): any => (typeof v === 'string' ? v.replace(re, (_, t: string) => `[[tag:${tag(t)}|`) : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? (Object.keys(v).forEach((k) => (v[k] = walk(v[k]))), v) : v)
  walk(L.bodies)
  walk(L.copy)
  walk(L.terms)
}

async function main() {
  const L = loadMockup(false)
  rename(L)

  // --- the demo set
  // everything generated goes; the demo set's own tests and its id renames stay
  for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) if (!f.endsWith('.test.ts') && f !== 'renames.json') fs.rmSync(path.join(OUT, f), { recursive: true, force: true })
  fs.rmSync(PUB, { recursive: true, force: true })
  const set = await convert(L, { sections: L.data.sections, entries: L.data.entries }, (id) => id)
  set.terms.push(HOLT_VERDICTS)
  // found by its words, not its id: only the demo directory names a demo id
  const VERDICTS = 'gives one of six verdicts, in words:'
  const withVerdicts = [...set.bodies.values()].filter((b) => b.md.includes(VERDICTS))
  if (withVerdicts.length !== 1) throw new Error('the verdicts sentence moved; link the holt-verdict term by hand')
  withVerdicts[0].md = withVerdicts[0].md.replace(VERDICTS, 'gives one of six [[t:holt-verdict|verdicts]], in words:')

  write(path.join(OUT, 'lab.json'), set.content)
  write(path.join(OUT, 'lab-terms.json'), set.terms)
  write(path.join(OUT, 'lab-figures.json'), set.figures)
  write(path.join(OUT, 'lab-unfurls.json'), set.unfurls)
  for (const [id, s] of Object.entries(set.studies)) write(path.join(OUT, 'studies', `${id}.json`), s)
  for (const { file, md } of set.bodies.values()) write(path.join(OUT, file), md)

  // --- the chrome's copy, into the real lab.json, never overwriting a key already there
  const labFile = path.join(ROOT, 'content/data/lab.json')
  const lab = JSON.parse(fs.readFileSync(labFile, 'utf8'))
  lab.copy = { ...chromeCopy(L), ...lab.copy }
  write(labFile, lab)

  // --- the fixture: its own set of sections and entries, ids `fx-…`
  const F = loadMockup(true)
  const fx = F.fixture
  const fxSet = await convert({ ...F, bodies: fx.bodies, terms: [], unfurls: {}, data: { ...F.data, study: null } }, { sections: fx.sections, entries: fx.entries }, (id) => id)
  // every fixture entry in a fixture section, so the fixture works over either set, plus an empty one
  for (const e of fxSet.content.entries) if (!e.section.startsWith('fx-')) e.section = 'fx-voice'
  fxSet.content.sections.push({ id: 'fx-empty', title: 'Fixture empty section', thesis: 'A section with no entries, which must never be shown.' })
  fxSet.content.tags = []
  fs.rmSync(FIXTURE, { recursive: true, force: true })
  write(path.join(FIXTURE, 'lab.json'), fxSet.content)
  for (const { file, md } of fxSet.bodies.values()) write(path.join(FIXTURE, file.replace(/^experiments\//, 'fx-voice/')), md)

  console.log(
    `demo: ${set.content.sections.length} sections, ${set.content.entries.length} entries, ${set.content.tags.length} tags, ${set.terms.length} terms, ` +
      `${Object.keys(set.figures).length} figures, ${Object.keys(set.unfurls).length} unfurls, ${set.bodies.size} bodies, ${copied.size} images; ` +
      `copy: ${Object.keys(lab.copy).length} keys; fixture: ${fxSet.content.entries.length} entries`,
  )
}

await main()
