// prototype/lab/night-mode/check.mjs: what night mode claims, checked without a browser.
//
//   node prototype/lab/night-mode/check.mjs
//
// Loads the shared kit and this mockup's pure parts (labels.js, moon.js, stars.js) in Node and
// checks, on the real 19 pieces:
//   1. append-stable: a 20th piece (and two other kinds) moves no star, in landscape or portrait
//   2. every piece is placed, as a star, in the shelf → constellation → date order
//   3. labels: at the fitted camera on a 1440×900 and a 390×844 screen, no two placed words
//      overlap, none covers a star, every shelf and constellation is named and inside the screen
//      (word sizes estimated from Space Grotesk's advance, a little generously)
//   4. the moon: phase in [0, 1), the dither is deterministic and draws a disc
//   5. the files: no backdrop-filter, no lorem, no script from anywhere but ../shared/
// Exits 1 on the first failure.
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
globalThis.window = globalThis
for (const f of ['../shared/pieces.js', '../shared/layout.js', 'labels.js', 'moon.js', 'stars.js']) require(join(here, f))
const { LAB, NIGHT } = globalThis
const sky = NIGHT.sky

let fails = 0
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++ }
const clone = () => LAB.pieces.map((p) => ({ ...p }))

console.log('1. append-stable')
const extra = {
  'the brief\'s 20th (hardware, linked)': { slug: 'test-piece', title: 'Test piece', shelf: 'playground', kind: 'experiment', date: '2099-01', constellation: 'hardware', links: ['usb-camera'] },
  'a loose playground scrap': { slug: 'test-loose', title: 'Test loose', shelf: 'playground', kind: 'scrap', date: '2099-01' },
  'a notes write-up in Hackathons': { slug: 'test-notes', title: 'Test notes', shelf: 'notes', kind: 'write-up', date: '2099-01', constellation: 'hackathons', links: ['sop-opera'] },
}
for (const portrait of [false, true]) {
  const before = sky.geometry(clone(), portrait).stars
  for (const [what, p] of Object.entries(extra)) {
    const after = sky.geometry([...clone(), p], portrait).stars
    const moved = Object.keys(before).filter((s) => Math.hypot(before[s].x - after[s].x, before[s].y - after[s].y) > 0.5)
    ok(after[p.slug] && moved.length === 0, `${portrait ? 'portrait' : 'landscape'}: + ${what} → placed, ${moved.length} of ${Object.keys(before).length} moved`)
  }
}

console.log('2. every piece is a star, in order')
const g = sky.geometry(LAB.pieces, false), m = sky.model(g, LAB.pieces)
ok(m.list.length === LAB.pieces.length && LAB.pieces.length === 19, `${m.list.length} stars for ${LAB.pieces.length} pieces`)
const shelfOrder = m.list.map((s) => s.piece.shelf)
ok(shelfOrder.lastIndexOf('notes') < shelfOrder.indexOf('playground'), 'Notes & write-ups come first in the Tab order, then Playground')
ok(new Set(m.list.map((s) => s.rank)).size === m.list.length, 'every star has its own place in the evening (date rank)')
ok(!/\b[xy]\s*:\s*-?\d/.test(readFileSync(join(here, '../shared/pieces.js'), 'utf8')), 'pieces.js holds no coordinates')

console.log('3. labels at the fitted camera')
// Space Grotesk advances, roughly: 0.6em per character for 500-weight labels, uppercase wider
const est = (text, px, upper, max) => {
  const per = px * (upper ? 0.72 : 0.58), raw = text.length * per
  if (!max || raw <= max) return { w: Math.ceil(raw) + 2, h: Math.ceil(px * 1.3) }
  const lines = Math.ceil(raw / max)
  return { w: max, h: Math.ceil(px * 1.25 * lines) }
}
const conName = (id) => LAB.constellations.find((c) => c.id === id).name
for (const [label, vw, vh, portrait, bar, bottom, side, titleMax, font] of [
  ['desktop 1440×900', 1440, 900, false, 76, 132, 64, 150, 12],
  ['phone 390×844', 390, 844, true, 104, 96, 22, 120, 11],
]) {
  const geo = sky.geometry(LAB.pieces, portrait), model = sky.model(geo, LAB.pieces)
  const b = geo.bounds, top = bar + (portrait ? 68 : 80)
  const s = Math.min(1, (vw - side * 2) / b.w, (vh - top - bottom) / b.h)
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2 - (top - bottom) / 2 / s
  const cam = { s, x: vw / 2 - cx * s, y: vh / 2 - cy * s }
  const sizeOf = (id) => {
    if (id.startsWith('shelf:')) { const sh = id.slice(6); return { w: est(LAB.shelves.find((x) => x.id === sh).name, 12, true).w + 60, h: 28 } }
    if (id.startsWith('name:')) return est(conName(id.split('/')[1]), 11, true)
    return est(LAB.pieces.find((p) => p.slug === id.slice(5)).title, font, false, titleMax)
  }
  const chrome = [{ x: vw / 2 - 310, y: 0, w: 620, h: bar }, { x: vw / 2 - 410, y: vh - bottom + 20, w: 820, h: bottom - 20 }]
  const { placed } = sky.planLabels(model, cam, { sizeOf, obstacles: chrome, viewport: { x: 8, y: 8, w: vw - 16, h: vh - 16 } })
  const words = Object.fromEntries(Object.entries(placed).filter(([, v]) => v))
  const bad = NIGHT.overlaps(words)
  ok(bad.length === 0, `${label}: ${Object.keys(words).length} words placed, ${bad.length} overlapping${bad.length ? ' ' + JSON.stringify(bad) : ''}`)
  const marks = model.list.map((st) => { const p = { x: st.x * s + cam.x, y: st.y * s + cam.y }; return { slug: st.slug, x: p.x - st.r, y: p.y - st.r, w: st.r * 2, h: st.r * 2 } })
  const covering = Object.entries(words).filter(([id, w]) => marks.some((mk) => 'star:' + mk.slug !== id && w.x < mk.x + mk.w && mk.x < w.x + w.w && w.y < mk.y + mk.h && mk.y < w.y + w.h))
  ok(covering.length === 0, `${label}: no word covers a star${covering.length ? ' ' + covering.map(([id]) => id).join(', ') : ''}`)
  const required = Object.keys(placed).filter((id) => !id.startsWith('star:'))
  ok(required.every((id) => placed[id] && !placed[id].forced), `${label}: all ${required.length} shelf and constellation names placed where they fit`)
  const inside = required.every((id) => { const w = placed[id]; return w.x >= 0 && w.y >= bar && w.x + w.w <= vw && w.y + w.h <= vh - bottom + 20 })
  ok(inside, `${label}: every name sits on screen, clear of the bar and dock`)
  const titles = Object.keys(placed).filter((id) => id.startsWith('star:'))
  console.log(`         ${titles.filter((id) => placed[id]).length} of ${titles.length} titles shown at fit; the rest appear on focus`)
}

console.log('4. the moon')
const ph = NIGHT.moonPhase(new Date(Date.UTC(2026, 10, 20)))
ok(ph >= 0 && ph < 1, `phase on 2026-11-20 is ${ph.toFixed(3)}`)
ok(Math.abs(NIGHT.moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)))) < 1e-9, 'the reference new moon is phase 0')
const full = NIGHT.moonBits(64, 0.5), dark = NIGHT.moonBits(64, 0), again = NIGHT.moonBits(64, 0.5)
const lit = (bits) => bits.reduce((n, v) => n + v, 0)
ok(lit(full) > 64 * 64 * 0.45 && lit(dark) < lit(full) / 6, `full moon lights ${lit(full)} px, new moon ${lit(dark)} (earthshine only)`)
ok(full.every((v, i) => v === again[i]), 'the dither is deterministic')
ok(full[0] === 0 && full[64 * 32 + 32] === 1, 'a disc: corners dark, centre lit at full')

console.log('5. the files')
const files = readdirSync(here).filter((f) => /\.(html|css|js|mjs)$/.test(f) && f !== 'check.mjs')
const text = Object.fromEntries(files.map((f) => [f, readFileSync(join(here, f), 'utf8')]))
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '')
ok(files.every((f) => !/backdrop-filter/i.test(code(text[f]))), 'no backdrop-filter in any rule or script')
ok(files.every((f) => !/lorem|ipsum/i.test(text[f])), 'no lorem ipsum')
const scripts = [...text['index.html'].matchAll(/<script[^>]*src="([^"]+)"/g)].map((x) => x[1])
ok(scripts.every((s) => !/^https?:|^\/\//.test(s)), `no script from a CDN (${scripts.length} local scripts)`)
ok(['../shared/pieces.js', '../shared/layout.js', '../shared/desk.js', '../shared/sky.js', '../shared/body.js'].every((s) => scripts.includes(s)), 'built on the shared kit: pieces, layout, desk, sky, body')
ok(/h\('button', 'star'\)/.test(text['stars.js']), 'stars are <button>s')
ok(!/style\.transform\s*=/.test(code(text['night.js']).replace(/el\.blind\.style\.transform|d\.l\.style\.transform/g, '')), 'night.js writes no world transform of its own (the camera goes through DESK.flyTo)')

console.log(fails ? `\n${fails} check(s) failed` : '\nnight mode: all checks pass')
process.exit(fails ? 1 : 0)
