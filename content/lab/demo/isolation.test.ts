/**
 * The demo set stays in its directories (API.md, "Demo mode"), so deleting it is one PR that
 * removes `content/lab/demo/`, `public/lab/demo/` and a few lines of `lib/lab/visibility.ts`.
 *
 * No code outside those names a demo id (an entry, section or tag of the demo set's `lab.json`,
 * quoted or between slashes) or a demo path (`DEMO_CONTENT`, `DEMO_PUBLIC`, written out). The
 * same test as check-lab rule 4, run with the unit tests so it fails before any build.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { DEMO_CONTENT, DEMO_PUBLIC } from '../../../lib/lab/visibility.ts'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const DIRS = ['app', 'components', 'lib', 'content', 'scripts']
const ALLOWED = (f: string) => f.startsWith(DEMO_CONTENT + '/') || f.startsWith('public' + DEMO_PUBLIC + '/') || f === 'lib/lab/visibility.ts'

const walk = (d: string): string[] =>
  fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []
/** Comments removed, as rule 4 does: prose about a thing is not naming it. */
const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1')
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const set = JSON.parse(fs.readFileSync(path.join(ROOT, DEMO_CONTENT, 'lab.json'), 'utf8'))
const ids: string[] = [...set.entries, ...set.sections, ...set.tags].map((x: { id: string }) => x.id)
const files = DIRS.flatMap((d) => walk(path.join(ROOT, d)))
  .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
  .filter((f) => /\.(?:[cm]?[jt]sx?)$/.test(f) && !ALLOWED(f))

test('the demo set has ids to look for', () => {
  assert.ok(ids.length >= 20, `${ids.length} ids`)
})

test('no code outside the demo directories names a demo id', () => {
  const hits: string[] = []
  for (const f of files) {
    const t = code(fs.readFileSync(path.join(ROOT, f), 'utf8'))
    for (const id of ids) if (new RegExp(`['"\`/]${esc(id)}['"\`/]`).test(t)) hits.push(`${f}: "${id}"`)
  }
  assert.deepEqual(hits, [])
})

test('no code outside them writes out a demo path: it asks lib/lab/visibility.ts', () => {
  const hits: string[] = []
  for (const f of files) {
    const t = code(fs.readFileSync(path.join(ROOT, f), 'utf8'))
    for (const p of [DEMO_CONTENT, DEMO_PUBLIC]) if (new RegExp(`['"\`]${esc(p)}(?:['"\`/])`).test(t)) hits.push(`${f}: ${p}`)
  }
  assert.deepEqual(hits, [])
})
