/**
 * A study tracker (.xlsx) → the study's board (`StudyData`) and its log lines, by a **column
 * allowlist, never by position** (plan PR 2). Contract: `content/lab/API.md` §1.
 *
 *   node --experimental-strip-types --no-warnings scripts/lab-import-study.ts \
 *     --id=<study entry id> [--xlsx=<tracker.xlsx>] [--out=<board.json>]
 *
 * Defaults: the tracker in ~/projects/scratch/lab-sources/, and the real set's `content/data/studies/<id>.json`. The log lines are printed (JSON), for the study
 * entry's `log` in `content/data/lab.json`; nothing else is touched.
 *
 * What it reads, and nothing more (plan, "Content, privacy"):
 *   - sheet `Topics`: the columns in TOPIC_COLUMNS, found by their header text;
 *   - sheet `Log`: the columns in LOG_COLUMNS, the same way.
 * Every other column (the role column, the starting point, Level, Priority, Notes, Resource,
 * Proof of work…) and every other sheet (Summary and its notes, Role evidence, Portfolio, Sources)
 * stays out. "What to learn" is kept only for a topic that is done, as the mockup did: a plan for
 * a topic not yet studied stays in the tracker. The Interview prep track and topics T43–T47 are dropped; Phase 5 topics show as
 * "later" (T21, T22 and T41 today). The result goes through the privacy denylist before anything
 * is written, and a hit refuses the import.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

import { PRIVACY } from '../lib/lab/rules.ts'
import type { StudyData, Topic } from '../lib/lab/types.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Field → header text on the Topics sheet. */
export const TOPIC_COLUMNS = {
  id: 'ID',
  track: 'Track',
  topic: 'Topic',
  learn: 'What to learn',
  phase: 'Phase',
  est: 'Est. hrs',
  spent: 'Hours spent',
  status: 'Status',
  finished: 'Finished on',
} as const
/** Field → header text on the Log sheet. */
export const LOG_COLUMNS = { date: 'Date', topic: 'Topic ID', did: 'What you did' } as const

const HIDDEN_TRACKS = new Set(['Interview prep'])
const HIDDEN_IDS = new Set(['T43', 'T44', 'T45', 'T46', 'T47'])
/** Phase 4 is relabelled; Phase 5 topics show only as "later". */
const phaseOf = (p: string) => p.replace(/^Phase 4 · .*/, 'Phase 4 · Hardening').replace(/^Phase 5 · .*/, 'later')
const trackOf = (t: string) => (t === 'FDE & deployment' ? 'Deployment' : t)
const excelDate = (n: string) => (n ? new Date(Date.UTC(1899, 11, 30) + Number(n) * 864e5).toISOString().slice(0, 10) : null)

type Rows = string[][]

/** Picks the allowlisted columns of a sheet by their header text. A missing header is an error. */
function pick<K extends string>(rows: Rows, cols: Record<K, string>, sheet: string): Record<K, string>[] {
  const names = Object.values(cols) as string[]
  const head = rows.findIndex((r) => names.every((n) => r.includes(n)))
  if (head < 0) throw new Error(`${sheet}: no header row with ${names.join(', ')}`)
  const at = Object.fromEntries(Object.entries(cols).map(([k, n]) => [k, rows[head].indexOf(n as string)])) as Record<K, number>
  return rows.slice(head + 1).map((r) => Object.fromEntries(Object.entries(at).map(([k, i]) => [k, String(r[i as number] ?? '').trim()])) as Record<K, string>)
}

/** The board and log from the two sheets' rows. Pure, for the tests. */
export function fromSheets(id: string, topicsRows: Rows, logRows: Rows): { board: StudyData; log: { date: string; topic: string; did: string }[] } {
  const topics: Topic[] = pick(topicsRows, TOPIC_COLUMNS, 'Topics')
    .filter((t) => /^T\d+$/.test(t.id) && !HIDDEN_IDS.has(t.id) && !HIDDEN_TRACKS.has(t.track))
    .map((t) => {
      const phase = phaseOf(t.phase)
      const status: Topic['status'] =
        t.status === 'Done' ? 'done' : t.status === 'In progress' ? 'doing' : /^Parked/.test(t.phase) ? 'parked' : phase === 'later' ? 'later' : 'todo'
      return { id: t.id, track: trackOf(t.track), topic: t.topic, phase, est: Number(t.est) || 0, spent: Number(t.spent) || 0, status, finished: excelDate(t.finished), ...(t.learn && status === 'done' ? { learn: t.learn } : {}) }
    })
  const tracks = [...new Set(topics.map((t) => t.track))]
  const shown = new Set(topics.map((t) => t.id))
  const log = pick(logRows, LOG_COLUMNS, 'Log')
    .filter((l) => l.topic && shown.has(l.topic))
    .map((l) => ({ date: excelDate(l.date)!, topic: l.topic, did: l.did }))
  const board = { id, tracks, topics }
  const hits = PRIVACY.map((re) => JSON.stringify({ board, log }).match(re)?.[0]).filter(Boolean)
  if (hits.length) throw new Error(`refused: the import would publish private words (${hits.join(', ')}); add them to the drops above`)
  return { board, log }
}

// ---------- a small .xlsx reader: the zip's central directory, shared strings, sheets ----------

function unzip(buf: Buffer): Map<string, Buffer> {
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('not an .xlsx (no zip directory)')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = new Map<string, Buffer>()
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extra = buf.readUInt16LE(p + 30)
    const comment = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(start, start + size)
    files.set(name, method === 8 ? inflateRawSync(raw) : raw)
    p += 46 + nameLen + extra + comment
  }
  return files
}
const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(+n)).replace(/&amp;/g, '&')
const colIndex = (ref: string) => [...ref.match(/^[A-Z]+/)![0]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

/** The named sheets only, every cell as text. */
export function readSheets(file: string, wanted: readonly string[]): Record<string, Rows> {
  const files = unzip(fs.readFileSync(file))
  const text = (n: string) => files.get(n)?.toString('utf8') ?? ''
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')))
  const rels = Object.fromEntries(
    [...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*>/g)].map((m) => [m[0].match(/Id="([^"]+)"/)![1], m[0].match(/Target="([^"]+)"/)![1]]),
  )
  const out: Record<string, Rows> = {}
  for (const m of text('xl/workbook.xml').matchAll(/<sheet [^>]*>/g)) {
    const name = decode(m[0].match(/name="([^"]+)"/)![1])
    if (!wanted.includes(name)) continue
    const target = rels[m[0].match(/r:id="([^"]+)"/)![1]].replace(/^\/?(xl\/)?/, 'xl/')
    const rows: Rows = []
    for (const r of text(target).matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
      const row: string[] = []
      for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const type = c[1].match(/t="([^"]+)"/)?.[1]
        const body = c[2] ?? ''
        let v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        if (type === 's') v = shared[Number(v)]
        else if (type === 'inlineStr') v = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decode(t[1])).join('')
        else if (v != null) v = decode(v)
        row[colIndex(c[1].match(/r="([A-Z]+\d+)"/)![1])] = v ?? ''
      }
      rows.push(Array.from(row, (x) => x ?? ''))
    }
    out[name] = rows
  }
  for (const w of wanted) if (!out[w]) throw new Error(`${file}: no sheet "${w}"`)
  return out
}

function main() {
  const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
  const xlsx = arg('xlsx') ?? path.join(os.homedir(), 'projects/scratch/lab-sources/agent-reliability-study-tracker.xlsx')
  const id = arg('id')
  if (!id) throw new Error('--id=<study entry id> is required')
  const out = arg('out') ?? path.join(ROOT, 'content/data/studies', `${id}.json`)
  const sheets = readSheets(xlsx, ['Topics', 'Log'])
  const { board, log } = fromSheets(id, sheets.Topics, sheets.Log)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(board, null, 2) + '\n')
  console.error(`${path.relative(ROOT, out)}: ${board.topics.length} topics in ${board.tracks.length} tracks. The study entry's log:`)
  console.log(JSON.stringify(log, null, 2))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
