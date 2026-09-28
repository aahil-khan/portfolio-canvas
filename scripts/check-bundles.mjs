#!/usr/bin/env node
/**
 * Proves the two bundle-isolation promises in CLAUDE.md, after `npm run build`:
 *
 *   1. gsap/lenis load on `/` and never on `/canvas`.
 *   2. The content editor's code loads on neither `/` nor `/canvas`.
 *
 * A chunk counts as "loaded by a page" when the page's prerendered HTML names it. Exits 1 on any
 * broken promise.
 */
import fs from 'node:fs'
import path from 'node:path'

const CHUNKS = '.next/static/chunks'
const PAGES = [
  ['/', '.next/server/app/index.html'],
  ['/canvas', '.next/server/app/canvas.html'],
]

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
const js = walk(CHUNKS).filter((f) => f.endsWith('.js'))
const matching = (re) => js.filter((f) => re.test(fs.readFileSync(f, 'utf8')))
const loads = (html, chunks) => chunks.some((c) => html.includes(path.basename(c)))

const gsap = matching(/ScrollTrigger|lenis|gsap/i)
// strings that exist only in the editor's own code
const editor = matching(/ed-card__title|\/api\/edit\/content|Edited-via: \/edit/)

let failed = false
for (const [route, file] of PAGES) {
  const html = fs.readFileSync(file, 'utf8')
  const g = loads(html, gsap)
  const e = loads(html, editor)
  const gsapOk = route === '/' ? g : !g
  console.log(`${route.padEnd(8)} gsap: ${g ? 'LOADS' : 'clean'}${gsapOk ? '' : '  ✗'}   editor: ${e ? 'LOADS  ✗' : 'clean'}`)
  if (!gsapOk || e) failed = true
}
if (!editor.length) {
  console.log('✗ found no editor chunk at all — the marker strings are stale')
  failed = true
}
process.exit(failed ? 1 : 0)
