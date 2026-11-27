/**
 * `validateLab(lab, bodies, fileExists)`: everything about the Lab's content that types cannot
 * say. Contract: `content/lab/API.md` §2; the rules are plan `plan-the-real-lab`, PR 2.
 *
 * One set of rules, three places, as for the site's content: `next build` (through
 * `content/validate.ts`), `npm run content:check`, and from PR 14 every `/edit` save. It runs over
 * **both** sets, the real one and the demo one, privacy denylist included, so the demo set can
 * never ship something the real one could not. The empty real set passes.
 *
 * Each issue names its rule (the check's ids: 1 privacy, 2 banned phrases, T terms, Q pull-quotes,
 * E endings, L links and ids, O links out; `S` schema, `D` data references, `I` images, `R` leads)
 * and a path into the set, like `entries.holt.pull` or `bodies.holt`.
 *
 * Plain TypeScript with relative `.ts` imports, so Node runs it with `--experimental-strip-types`.
 */
import { check, type Field } from '../edit/schema.ts'
import { ENTRY_FIELDS, figureField, refField, sectionField, studyField, tagField, termField, unfurlField } from '../../content/schema/lab.ts'
import { INSTRUMENT_SCHEMAS } from './instruments/schemas.ts'
import { plainInline, plainText, scanBody, scanInline, wordCount } from './text.ts'
import { KINDS, LEAD_CHAINS, MAX_TAGS, RESERVED_IDS } from './types.ts'
import type { Entry, Lab } from './types.ts'

export type LabRule = '1' | '2' | 'T' | 'Q' | 'E' | 'L' | 'O' | 'S' | 'D' | 'I' | 'R'
export interface LabIssue {
  rule: LabRule
  /** Where, as `entries.holt.pull`, `bodies.holt`, `terms.mcc`, `sections[2].id`. */
  path: string
  message: string
}

/**
 * Words that must never appear in the Lab, in any file, demo or real (plan, "Content, privacy"):
 * the companies and the hiring track the study's tracker holds, and its private phases and topics.
 */
export const PRIVACY: readonly RegExp[] = [
  /bolna/i, /cekura/i, /increff/i, /intern(?!al)/i, /interview/i, /role evidence/i, /starting point/i,
  /why it matters for the role/i, /what you.ll show/i, /\bT4[3-7]\b/, /phase 5/i, /recruit/i,
]
/** Phrases a reader should never meet (the mockup check's rule 2). */
export const BANNED: readonly string[] = [
  'welcome to', 'dive', 'journey', 'unlock', 'seamless', 'explore', 'in this post', "let's", 'let’s', 'passionate',
  'showcase', 'delve', 'robust', 'cutting-edge', 'game-changer', 'stay tuned', 'coming soon', 'without opening a repo',
  'the place where people',
]
/** Tracker output that must not leak into prose: logged hours, estimates. */
export const TRACKER: readonly RegExp[] = [/\d+(\.\d+)?\s?h(ours)?\s+(logged|planned|spent)/i, /est\.?\s?hrs/i]
/** Headings that name a slot instead of saying something (the mockup check's rule 15). */
export const SLOT_HEADINGS: readonly string[] = [
  'what it is', 'try it', "how it's built", 'how it’s built', 'code', 'what broke', 'what i measured', 'overview',
  'summary', 'introduction', 'conclusion', 'key takeaways', 'where this fits',
]
/** A long entry, which must carry a pull-quote: words of body plus opening. */
export const PULL_WORDS = 350

const DATE = /^\d{4}-\d{2}-\d{2}$/
const ID = /^[a-z0-9][a-z0-9-]*$/
const isDate = (s: unknown): s is string => typeof s === 'string' && DATE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))
const isPublicPath = (v: string) => /^\/\S+$/.test(v) && !v.split('/').includes('..')
const bannedRe = (p: string) => new RegExp(`(^|[^a-z])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
const BANNED_RE = BANNED.map((p) => [p, bannedRe(p)] as const)

/** Drops `null` values the schema vocabulary has no word for, and fields checked separately. */
function forSchema(v: Record<string, unknown>, drop: readonly string[] = []): Record<string, unknown> {
  return Object.fromEntries(Object.entries(v).filter(([k, x]) => x !== null && !drop.includes(k)))
}

export function validateLab(
  lab: Lab,
  bodies: Readonly<Record<string, string>>,
  fileExists: (publicPath: string) => boolean,
): LabIssue[] {
  const out: LabIssue[] = []
  const add = (rule: LabRule, path: string, message: string) => out.push({ rule, path, message })
  const schema = (field: Field, value: unknown, at: string) => {
    for (const i of check(field, value, '')) add('S', i.path ? `${at}.${i.path}` : at, i.message)
  }

  const byId = new Map<string, Entry>()
  const sectionIds = new Set(lab.sections.map((s) => s.id))
  const tagIds = new Set(lab.tags.map((t) => t.id))
  const termIds = new Set(lab.terms.map((t) => t.id))
  for (const e of lab.entries) byId.set(e.id, e)
  const isLive = (e: Entry | undefined) => !!e && !e.draft && e.published !== null
  const instrumentKnown = (name: string) => !Object.keys(INSTRUMENT_SCHEMAS).length || name in INSTRUMENT_SCHEMAS

  // ---------- schema ----------
  lab.sections.forEach((s, i) => schema(sectionField, s, `sections[${i}]`))
  lab.tags.forEach((t, i) => schema(tagField, t, `tags[${i}]`))
  lab.terms.forEach((t, i) => schema(termField, t, `terms[${i}]`))
  for (const e of lab.entries) {
    const at = `entries.${e.id}`
    if (!KINDS.includes(e.kind)) {
      add('S', `${at}.kind`, `kind must be one of: ${KINDS.join(', ')}`)
      continue
    }
    schema(ENTRY_FIELDS[e.kind], forSchema(e as unknown as Record<string, unknown>, ['refs']), at)
    for (const [k, r] of Object.entries(e.refs ?? {})) schema(refField, forSchema(r as unknown as Record<string, unknown>), `${at}.refs.${k}`)
    if (e.published === null && !e.draft) add('S', `${at}.published`, 'Published is empty, so it must be a draft')
    if (e.published !== null && e.published !== undefined && !isDate(e.published)) add('S', `${at}.published`, 'Published must be a date, YYYY-MM-DD')
    if (e.updated !== undefined && !isDate(e.updated)) add('S', `${at}.updated`, 'Updated must be a date, YYYY-MM-DD')
    if (isDate(e.updated) && isDate(e.published) && e.updated < e.published) add('S', `${at}.updated`, 'Updated is before Published')
  }
  for (const [k, f] of Object.entries(lab.figures)) {
    schema(figureField, { ...forSchema(f as unknown as Record<string, unknown>, ['data']), data: {} }, `figures.${k}`)
    if (!f.data || typeof f.data !== 'object' || Array.isArray(f.data)) add('S', `figures.${k}.data`, 'Data must be a group of fields')
    else for (const m of INSTRUMENT_SCHEMAS[f.instrument]?.(f.data) ?? []) add('S', `figures.${k}.data`, m)
    if (!instrumentKnown(f.instrument)) add('S', `figures.${k}.instrument`, `"${f.instrument}" is not a registered instrument`)
  }
  for (const [url, u] of Object.entries(lab.unfurls)) {
    if (!/^https?:\/\//.test(url)) add('S', `unfurls.${url}`, 'an unfurl is keyed by its http(s) URL')
    schema(unfurlField, u, `unfurls.${url}`)
  }
  for (const [k, s] of Object.entries(lab.studies)) {
    schema(studyField, { ...s, topics: s.topics.map((t) => forSchema(t as unknown as Record<string, unknown>)) }, `studies.${k}`)
    if (s.id !== k) add('D', `studies.${k}.id`, `the board for "${k}" says its id is "${s.id}"`)
    const st = byId.get(k)
    if (!st || st.kind !== 'study') add('D', `studies.${k}`, `"${k}" is not a study entry`)
    const seen = new Set<string>()
    for (const t of s.topics) {
      if (seen.has(t.id)) add('D', `studies.${k}.topics`, `topic ${t.id} is listed twice`)
      seen.add(t.id)
      if (!s.tracks.includes(t.track)) add('D', `studies.${k}.topics.${t.id}.track`, `"${t.track}" is not one of the board's tracks`)
      if (t.status === 'done' && !isDate(t.finished)) add('D', `studies.${k}.topics.${t.id}.finished`, 'a done topic needs the date it finished')
    }
  }

  // ---------- ids (L) ----------
  const ids = (what: string, list: readonly { id: string }[]) => {
    const seen = new Set<string>()
    list.forEach((x, i) => {
      const at = `${what}[${i}].id`
      if (typeof x.id !== 'string' || !ID.test(x.id)) add('L', at, `"${x.id}" is not an id: lowercase letters, digits and dashes`)
      if ((RESERVED_IDS as readonly string[]).includes(x.id)) add('L', at, `"${x.id}" is reserved (${RESERVED_IDS.join(', ')})`)
      if (seen.has(x.id)) add('L', at, `duplicate id "${x.id}"`)
      seen.add(x.id)
    })
  }
  ids('sections', lab.sections)
  ids('tags', lab.tags)
  ids('entries', lab.entries)
  ids('terms', lab.terms)
  if (lab.tags.length > MAX_TAGS) add('L', 'tags', `${lab.tags.length} tags; the Lab holds at most ${MAX_TAGS}`)

  // slugs: unique where they share a URL
  const urls = new Map<string, string>()
  for (const e of lab.entries) {
    const parent = 'parent' in e && e.parent ? byId.get(e.parent) : undefined
    if (!ID.test(e.slug ?? '')) add('L', `entries.${e.id}.slug`, `"${e.slug}" is not a URL segment: lowercase letters, digits and dashes`)
    const url = `${e.section}/${parent ? parent.slug + '/' : ''}${e.slug}`
    if (urls.has(url)) add('L', `entries.${e.id}.slug`, `"${e.id}" and "${urls.get(url)}" share the URL /lab/${url}`)
    urls.set(url, e.id)
  }

  // ---------- references between data (D) ----------
  for (const s of lab.sections)
    if (s.hero) {
      const h = byId.get(s.hero)
      if (!h) add('D', `sections.${s.id}.hero`, `"${s.hero}" is not an entry`)
      else if (h.section !== s.id) add('D', `sections.${s.id}.hero`, `"${s.hero}" is in ${h.section}, not ${s.id}`)
    }
  const chapterOrders = new Map<string, Set<number>>()
  for (const e of lab.entries) {
    const at = `entries.${e.id}`
    if (!sectionIds.has(e.section)) add('D', `${at}.section`, `"${e.section}" is not a section`)
    for (const t of e.tags ?? []) if (!tagIds.has(t)) add('L', `${at}.tags`, `"${t}" is not a tag`)
    for (const m of e.mentions ?? []) if (!byId.has(m)) add('L', `${at}.mentions`, `"${m}" is not an entry`)
    if (e.kind === 'chapter') {
      const p = byId.get(e.parent)
      if (!p || p.kind !== 'series') add('D', `${at}.parent`, `"${e.parent}" is not a series`)
      else if (p.section !== e.section) add('D', `${at}.section`, `a chapter sits in its series' section (${p.section})`)
      const seen = chapterOrders.get(e.parent) ?? new Set()
      if (seen.has(e.order)) add('D', `${at}.order`, `two chapters of "${e.parent}" are number ${e.order}`)
      seen.add(e.order)
      chapterOrders.set(e.parent, seen)
    }
    if (e.kind === 'note' && e.parent) {
      const p = byId.get(e.parent)
      if (!p || p.kind !== 'study') add('D', `${at}.parent`, `"${e.parent}" is not a study`)
      else if (p.section !== e.section) add('D', `${at}.section`, `a note sits in its study's section (${p.section})`)
    }
    if (e.kind === 'series' && e.study && byId.get(e.study)?.kind !== 'study') add('D', `${at}.study`, `"${e.study}" is not a study`)
  }
  for (const t of lab.terms)
    if (t.link && !/^https:\/\//.test(t.link) && !isLive(byId.get(t.link))) add('T', `terms.${t.id}.link`, `"${t.link}" is neither a published entry nor an https:// URL`)

  // ---------- terms complete (T) ----------
  for (const t of lab.terms) for (const k of ['name', 'def', 'source'] as const) if (!String(t[k] ?? '').trim()) add('T', `terms.${t.id}.${k}`, `the term "${t.id}" has no ${k}`)

  // ---------- links, refs, figures, images, pull-quotes, leads, endings ----------
  const slotSet = new Set(SLOT_HEADINGS)
  const linkOuts: { url: string; at: string; fallback: boolean }[] = []
  const images: { src: string; at: string }[] = []

  for (const e of lab.entries) {
    const at = `entries.${e.id}`
    const body = bodies[e.id] ?? ''
    const scan = scanBody(body)
    const where = (inBody: boolean) => (inBody ? `bodies.${e.id}` : at)
    const linkTargets = (s: ReturnType<typeof scanInline>, place: string) => {
      for (const id of s.entries) {
        const t = byId.get(id)
        if (!t) add('L', place, `[[${id}|…]] names no entry`)
        else if (!isLive(t)) add('L', place, `[[${id}|…]] links to a draft, which has no page`)
      }
      for (const id of s.terms) if (!termIds.has(id)) add('T', place, `[[t:${id}|…]] names no term`)
      for (const id of s.tags) if (!tagIds.has(id)) add('L', place, `[[tag:${id}|…]] names no tag`)
      for (const k of s.refs) if (!e.refs?.[k]) add('L', place, `[^${k}] is not one of its references`)
    }
    linkTargets(scan, where(true))
    const fields: [string, string | undefined][] = [
      ['lede', e.lede],
      ['keyLine', 'keyLine' in e ? e.keyLine : undefined],
      ['ending', 'ending' in e ? e.ending?.text : undefined],
      ['leadIntro', e.leadIntro],
    ]
    const fieldRefs: string[] = []
    for (const [k, v] of fields)
      if (v) {
        const s = scanInline(v)
        linkTargets(s, `${at}.${k}`)
        fieldRefs.push(...s.refs)
      }
    // every reference is cited
    const cited = new Set([...scan.refs, ...fieldRefs])
    for (const k of Object.keys(e.refs ?? {})) if (!cited.has(k)) add('L', `${at}.refs.${k}`, `[^${k}] is never cited`)

    for (const f of scan.figures) {
      const fig = lab.figures[f]
      if (!fig) add('L', where(true), `::figure{of="${f}"} names no figure`)
    }
    for (const h of scan.headings) if (slotSet.has(h.trim().toLowerCase())) add('L', where(true), `"${h}" names a slot instead of saying something`)
    for (const im of scan.images) {
      if (im.w === null || im.h === null) add('I', where(true), `the image ${im.src} does not declare its size ("w=… h=…")`)
      if (!im.alt.trim()) add('I', where(true), `the image ${im.src} has no description`)
      images.push({ src: im.src, at: where(true) })
    }
    for (const u of scan.outs) linkOuts.push({ url: u, at: where(true), fallback: false })
    for (const [k, r] of Object.entries(e.refs ?? {})) if (r.url) linkOuts.push({ url: r.url, at: `${at}.refs.${k}`, fallback: !!r.line?.trim() })
    if (e.kind === 'build') {
      if (e.repo) linkOuts.push({ url: e.repo, at: `${at}.repo`, fallback: false })
      if (e.live) linkOuts.push({ url: e.live, at: `${at}.live`, fallback: false })
    }
    const lead = e.lead ?? {}
    if (lead.demo) images.push({ src: lead.demo.src, at: `${at}.lead.demo` }, { src: lead.demo.poster, at: `${at}.lead.demo.poster` })
    for (const im of lead.images ?? []) images.push({ src: im.src, at: `${at}.lead.images` })
    if (lead.cover) images.push({ src: lead.cover.src, at: `${at}.lead.cover` })
    for (const name of [lead.instrument, lead.figure]) if (name && !instrumentKnown(name)) add('R', `${at}.lead`, `"${name}" is not a registered instrument`)
    if (lead.figure && !lab.figures[lead.of ?? e.id]) add('R', `${at}.lead.figure`, `its figure has no data under "${lead.of ?? e.id}" in the figures file`)
    if (lead.of && !lead.figure && !lead.instrument) add('R', `${at}.lead.of`, 'names figure data with no instrument or figure to read it')

    if (!isLive(e)) continue // a draft has no page: what follows is about pages

    // pull-quote (Q)
    const prose = plainText(body) + ' ' + ('opening' in e ? e.opening : '')
    const words = wordCount(prose)
    if (e.pull !== undefined) {
      if (!prose.replace(/\s+/g, ' ').includes(e.pull.trim())) add('Q', `${at}.pull`, `the pull-quote is not a sentence of its body, word for word: "${e.pull.slice(0, 60)}"`)
      else if (!/[.!?…”’"]$/.test(e.pull.trim())) add('Q', `${at}.pull`, 'the pull-quote must be a whole sentence')
    } else if (words >= PULL_WORDS) add('Q', `${at}.pull`, `${words} words and no pull-quote`)

    // the lead (R): the kind's chain must reach something that is there
    const has: Record<string, boolean> = {
      board: e.kind === 'study' && !!lab.studies[e.id],
      logline: e.kind === 'study' && !!e.log?.length,
      progress: e.kind === 'series' && (lab.entries.some((x) => x.kind === 'chapter' && x.parent === e.id) || !!e.premise?.trim()),
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
    const chain: readonly string[] = LEAD_CHAINS[e.kind]
    if (!chain.some((l) => has[l])) add('R', `${at}.lead`, `a ${e.kind} needs a lead: one of ${chain.join(', ')}`)

    // the ending (E)
    if (e.kind === 'build' || e.kind === 'experiment') {
      if (!e.ending?.text?.trim()) add('E', `${at}.ending`, `a ${e.kind} ends with "What I’d do now"`)
      if (!isDate(e.updated ?? e.published)) add('E', `${at}.ending`, 'the ending is dated by Updated or Published, and neither is a date')
    }
  }
  // a section's hero must be a page
  for (const s of lab.sections) if (s.hero && byId.has(s.hero) && !isLive(byId.get(s.hero))) add('D', `sections.${s.id}.hero`, `"${s.hero}" is a draft`)

  // ---------- images (I) and links out (O) ----------
  for (const [url, u] of Object.entries(lab.unfurls)) {
    if (u.img) {
      if (/^https?:/.test(u.img.src)) add('O', `unfurls.${url}.img`, 'an unfurl image must be a file on this site, never a remote URL')
      images.push({ src: u.img.src, at: `unfurls.${url}.img` })
    }
    if (u.icon) {
      if (/^https?:/.test(u.icon)) add('O', `unfurls.${url}.icon`, 'an unfurl icon must be a file on this site, never a remote URL')
      images.push({ src: u.icon, at: `unfurls.${url}.icon` })
    }
  }
  for (const { src, at } of images) {
    if (!isPublicPath(src)) add('I', at, `${src} must be a path under public/, like /lab/<entry>/one.webp`)
    else if (!fileExists(src)) add('I', at, `${src}: no such file in public/`)
  }
  for (const t of lab.terms) if (t.link && /^https:\/\//.test(t.link)) linkOuts.push({ url: t.link, at: `terms.${t.id}.link`, fallback: true })
  const seenOut = new Set<string>()
  for (const o of linkOuts) {
    if (lab.unfurls[o.url] || o.fallback || seenOut.has(o.at + o.url)) continue
    seenOut.add(o.at + o.url)
    add('O', o.at, `${o.url} has no unfurl and no stated fallback (an unfurl in the unfurls file, or a reference's "line")`)
  }

  // ---------- privacy (1), banned phrases (2) ----------
  const files: [string, string][] = [
    ['copy', JSON.stringify(lab.copy)],
    ['sections', JSON.stringify(lab.sections)],
    ['tags', JSON.stringify(lab.tags)],
    ['terms', JSON.stringify(lab.terms)],
    ['figures', JSON.stringify(lab.figures)],
    ['unfurls', JSON.stringify(lab.unfurls)],
    ...Object.entries(lab.studies).map(([k, s]): [string, string] => [`studies.${k}`, JSON.stringify(s)]),
    ...lab.entries.map((e): [string, string] => [`entries.${e.id}`, JSON.stringify(e)]),
    ...Object.entries(bodies).map(([k, b]): [string, string] => [`bodies.${k}`, b]),
  ]
  for (const [at, text] of files) {
    for (const re of PRIVACY) {
      const m = text.match(re)
      if (m) add('1', at, `private term "${m[0]}"`)
    }
    // what a reader sees in his words: not the never-rendered `source` lines, and not an unfurl,
    // which quotes another site's own title and description
    if (at === 'unfurls') continue
    const seen = at === 'terms' ? JSON.stringify(lab.terms.map((t) => ({ ...t, source: undefined }))) : at.startsWith('bodies.') ? plainInline(text) : text
    for (const [p, re] of BANNED_RE) if (re.test(seen)) add('2', at, `banned phrase "${p}"`)
    for (const re of TRACKER) if (re.test(seen)) add('2', at, `tracker output ${re}`)
  }
  return out
}
