// prototype/lab/notebook/tools/import-tracker.mjs: the study tracker's public parts → study.js
//
//   node prototype/lab/notebook/tools/import-tracker.mjs [tracker.xlsx] [--check]
//   (default: ~/projects/scratch/lab-sources/agent-reliability-study-tracker.xlsx; the .xlsx never
//   enters the repo. --check writes nothing and exits 1 if study.js would change.)
//
// AN ALLOWLIST, NOT A BLOCKLIST. Only the columns named in KEEP leave the spreadsheet, so a column
// added to the sheet later stays private until someone adds it here. Everything else in the book
// (the "why it matters for the role" column, the resume and level columns, Priority, the Role
// evidence and Sources sheets, the Summary's notes) is never read.
//
// What Aahil decided on 2026-11-21 (the brief): the FDE & deployment track (T39–T42), T21 and T22
// are shown; Phase 4 is labelled "Phase 4 · Hardening"; T14 is shown as written. Still private:
// the Interview prep track (T43–T47), Phase 5 · Interviews (its topics are shown with no phase),
// and every resource that is a job posting (T12, T22, T33, T39–T42). Every item carries `visibility`, public unless
// listed in HIDDEN: the switch the React build's /edit will expose per item.
//
// The same code becomes scripts/lab-study.mjs (npm run lab:study) in the React build.
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { readBook, isoDate } from './xlsx.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'study.js')
export const SOURCE = join(homedir(), 'projects/scratch/lab-sources/agent-reliability-study-tracker.xlsx')

// header text in the sheet → field name. Nothing else is read.
const KEEP = {
  Topics: { ID: 'id', Track: 'track', Topic: 'title', 'What to learn': 'learn', Phase: 'phase', 'Est. hrs': 'est_h', Status: 'status', 'Planned start': 'start', 'Target finish': 'target', 'Finished on': 'finished', Resource: 'resource', 'Proof of work': 'proof', Notes: 'notes' },
  Log: { Date: 'date', 'Topic ID': 'id', Hours: 'h', 'What you did': 'did' },
  Portfolio: { Code: 'id', Project: 'title', 'What you ship': 'ship', 'Topics covered': 'topics', 'Target phase': 'phase', 'Target finish': 'target', Status: 'status', Link: 'link' },
}
// rows that never leave: the Interview prep track
export const PRIVATE_IDS = ['T43', 'T44', 'T45', 'T46', 'T47']
const PRIVATE_TRACKS = ['Interview prep']
// phases: the private one is dropped (its topics keep no phase), one is renamed
export const PHASES = {
  'Phase 1 · Evals core': 'Phase 1 · Evals core',
  'Phase 2 · Tracing, latency, voice basics': 'Phase 2 · Tracing, latency, voice basics',
  'Phase 3 · Voice harness': 'Phase 3 · Voice harness',
  'Phase 4 · Hardening + interview prep': 'Phase 4 · Hardening',
  'Ongoing · OSS': 'Ongoing · OSS',
  'Parked (P2)': 'Parked',
}
// a resource that is a job posting is dropped (T12, T22, T33, T39–T42 today): it names a target
export const JOB_POSTING = /careers\.|\/jobs\//i
// rows kept in the data but not shown (none today): the per-item switch
const HIDDEN = []
// The private-term scan. `allow` lists the exact places a term may appear because Aahil chose to
// show them (T14's "What to learn" names HoneyHive). check.mjs runs the same scan over the notes.
export const TERMS = ['bolna', 'cekura', 'smallest.ai', 'honeyhive', 'phonely', 'lemma', 'raindrop', 'sendbird', 'timepay', 'increff', 'interview', 'role evidence', 'starting point', ...PRIVATE_IDS]
export const ALLOW = [{ term: 'honeyhive', where: 'T14.learn' }]

const STATUS = { Done: 'done', 'In progress': 'progress', 'Not started': 'planned' }
const TRACK = {
  'Evals & error analysis': 'evals', 'Observability & tracing': 'observability', 'Reliability engineering': 'reliability',
  'Latency & performance': 'latency', 'Voice agents': 'voice', 'Guardrails & security': 'guardrails', 'FDE & deployment': 'fde', 'Open source': 'open-source',
}

function table(rows, keep) {
  const hi = rows.findIndex((r) => r && Object.keys(keep).every((k) => r.includes(k)))
  if (hi < 0) throw new Error(`import-tracker: header row not found (${Object.keys(keep).join(', ')})`)
  const head = rows[hi]
  const idx = Object.entries(keep).map(([h, f]) => [head.indexOf(h), f])
  return rows.slice(hi + 1).filter((r) => r && r[idx[0][0]] !== '' && r[idx[0][0]] != null).map((r) => Object.fromEntries(idx.map(([i, f]) => [f, r[i] ?? ''])))
}
const list = (s) => String(s || '').split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean)
const round = (n) => Math.round(n * 100) / 100

export function importBook(path = SOURCE) {
  const book = readBook(path)
  const log = table(book.Log, KEEP.Log).filter((r) => typeof r.date === 'number').map((r) => ({ date: isoDate(r.date), id: r.id, h: +r.h, did: String(r.did) }))
    .filter((r) => !PRIVATE_IDS.includes(r.id))
  const spent = {}
  for (const r of log) spent[r.id] = round((spent[r.id] || 0) + r.h)
  const topics = table(book.Topics, KEEP.Topics)
    .filter((r) => /^T\d\d$/.test(r.id) && !PRIVATE_IDS.includes(r.id) && !PRIVATE_TRACKS.includes(r.track))
    .map((r) => {
      const t = {
        id: r.id, title: String(r.title), track: TRACK[r.track] || 'other', trackName: String(r.track), learn: String(r.learn),
        phase: PHASES[r.phase] || '', parked: r.phase === 'Parked (P2)', status: STATUS[r.status] || 'planned',
        est_h: +r.est_h || 0, spent_h: spent[r.id] || 0, start: isoDate(r.start), target: isoDate(r.target), finished: isoDate(r.finished),
        resource: String(r.resource || ''), proof: list(r.proof), notes: String(r.notes || ''), visibility: HIDDEN.includes(r.id) ? 'hidden' : 'public',
      }
      if (JOB_POSTING.test(t.resource)) t.resource = ''
      return t
    })
  const stages = table(book.Portfolio, KEEP.Portfolio).filter((r) => /^PW\d$/.test(r.id)).map((r) => ({
    id: r.id, title: String(r.title), ship: String(r.ship), topics: list(r.topics).filter((x) => !PRIVATE_IDS.includes(x)),
    phase: PHASES[r.phase] || '', target: isoDate(r.target), status: STATUS[r.status] || 'planned', link: String(r.link || ''),
    visibility: HIDDEN.includes(r.id) ? 'hidden' : 'public',
  }))
  // the Portfolio sheet's own line above its table: what the Shopkeeper is
  const portfolioLine = String((book.Portfolio[1] || [])[0] || '').replace(/\s*Update Status and Link \(shaded\)\.\s*$/, '')
  // phases: name, start, end from the Summary's plan, renamed or dropped as above
  const phases = []
  for (const r of book.Summary) {
    if (r && PHASES[r[0]] && typeof r[1] === 'number') phases.push({ name: PHASES[r[0]], start: isoDate(r[1]), end: isoDate(r[2]) })
  }
  return { source: 'agent-reliability-study-tracker.xlsx', portfolioLine, phases, topics, stages, log }
}

// every string in the data, with where it came from: what the term scan reads
export function* strings(v, where = '') {
  if (typeof v === 'string') yield [where, v]
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${where}[${i}]`)
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* strings(x, v.id && k !== 'id' ? `${v.id}.${k}` : where ? `${where}.${k}` : k)
}
export function scan(text, where) {
  const low = text.toLowerCase(), hits = []
  for (const term of TERMS) {
    const re = /^T\d\d$/.test(term) ? new RegExp(`\\b${term}\\b`, 'i') : null
    if (re ? re.test(text) : low.includes(term)) if (!ALLOW.some((a) => a.term === term && a.where === where)) hits.push(`${term} in ${where}`)
  }
  return hits
}

export function render(data) {
  return `/*
 * prototype/lab/notebook/study.js: GENERATED by tools/import-tracker.mjs from the study tracker
 * (${data.source}). Do not edit: change the spreadsheet, then run the importer.
 * Only the importer's allowlisted columns are here; see its header for what stays private.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NB = (root_.NB = root_.NB || {})
  NB.study = ${JSON.stringify(data, null, 1)}
})()
`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), check = args.includes('--check'), src = args.find((a) => !a.startsWith('--')) || SOURCE
  if (!existsSync(src)) { console.log(`SKIP import-tracker: ${src} is not on this machine`); process.exit(0) }
  const data = importBook(src)
  const hits = [...strings(data)].flatMap(([w, s]) => scan(s, w))
  if (hits.length) { console.error('import-tracker: private terms found:\n  ' + hits.join('\n  ')); process.exit(1) }
  const js = render(data)
  if (check) { const same = existsSync(OUT) && readFileSync(OUT, 'utf8') === js; console.log(same ? 'study.js is current' : 'study.js is STALE'); process.exit(same ? 0 : 1) }
  writeFileSync(OUT, js)
  console.log(`study.js: ${data.topics.length} topics, ${data.stages.length} stages, ${data.log.length} log rows, ${data.phases.length} phases`)
}
