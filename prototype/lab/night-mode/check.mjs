// prototype/lab/night-mode/check.mjs: what night mode claims, checked without a browser.
//
//   node prototype/lab/night-mode/check.mjs
//
// Loads the shared kit's content (pieces.js, body.js) and this mockup's pure parts (shelves.js,
// moon.js) in Node and checks, on the real 19 pieces:
//   1. the two shelf cards: both render, every piece exactly once, rows == pieces, each in its
//      own shelf and under its own kind label, WORK chips exactly on the pieces with a project
//   2. the 20th piece: pushing one adds exactly one row, to the right card and group, and leaves
//      every other row's markup, the other card and the card positions byte-for-byte alone
//   3. placement comes from code: centred on the night view, side by side on a desk screen, one
//      spot on a phone, independent of content; pieces.js holds no coordinates
//   4. the moon: phase in [0, 1), the dither is deterministic and draws a disc
//   5. the files: no per-piece stars or constellation anything, no backdrop-filter, no lorem, no
//      script from anywhere but here and ../shared/, rows are <button>s
// Exits 1 if anything fails.
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
globalThis.window = globalThis
for (const f of ['../shared/pieces.js', '../shared/body.js', 'shelves.js', 'moon.js']) require(join(here, f))
const { LAB, NIGHT } = globalThis
const S = NIGHT.shelves

let fails = 0
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++ }
const count = (html, re) => (html.match(re) || []).length
const slugsIn = (html) => [...html.matchAll(/data-open="([^"]+)"/g)].map((m) => m[1])
const render = (pieces) => Object.fromEntries(S.model(pieces).map((s) => [s.id, S.bodyHtml(s)]))

console.log('1. the two shelf cards')
const model = S.model(LAB.pieces), html = render(LAB.pieces)
ok(model.length === 2 && model[0].id === 'notes' && model[1].id === 'playground', `two cards, in order: ${model.map((s) => s.name).join(' · ')}`)
const all = Object.values(html).flatMap(slugsIn)
ok(LAB.pieces.length === 19 && all.length === LAB.pieces.length, `${all.length} rows for ${LAB.pieces.length} pieces`)
ok(new Set(all).size === all.length && LAB.pieces.every((p) => all.includes(p.slug)), 'every piece appears exactly once across the two cards')
ok(LAB.pieces.every((p) => slugsIn(html[p.shelf]).includes(p.slug)), 'each piece is on its own shelf\'s card')
ok(count(html.notes + html.playground, /<button type="button" class="desk-row shelf-row"/g) === all.length, 'every row is a <button> with the desk-row markup')
for (const s of model) {
  const groups = s.groups.map((g) => `${g.label} (${g.rows.length})`).join(', ')
  ok(s.groups.every((g) => g.rows.every((r) => LAB.pieces.find((p) => p.slug === r.slug).kind === g.kind)), `${s.name}: ${groups}`)
}
ok(model[0].groups.map((g) => g.label).join() === 'Write-ups,Essays', 'Notes & write-ups groups: Write-ups, then Essays')
ok(model[1].groups.map((g) => g.label).join() === 'Experiments,Scraps,Found,Arcade', 'Playground groups: Experiments, Scraps, Found, Arcade')
const arcade = model[1].groups.find((g) => g.kind === 'game')
ok(arcade && arcade.rows.length === 4 && arcade.rows.every((r) => LAB.pieces.find((p) => p.slug === r.slug).card === 'arcade'), 'the 4 Arcade games are rows under ARCADE, each opening the arcade card')
const chips = model.flatMap((s) => s.groups.flatMap((g) => g.rows)).filter((r) => r.work).map((r) => r.slug).sort()
ok(JSON.stringify(chips) === JSON.stringify(LAB.pieces.filter((p) => p.project).map((p) => p.slug).sort()), `WORK chip on exactly the pieces with a project (${chips.join(', ')})`)
ok(model.flatMap((s) => s.groups.flatMap((g) => g.rows)).every((r) => /^\d{4}$/.test(r.year) && r.title), 'every row has a year and a title')
ok(model[0].colour !== model[1].colour && ['#D9C2FF', '#FFD9A8'].includes(model[0].colour) && ['#D9C2FF', '#FFD9A8'].includes(model[1].colour), `distinct title-bar tints from apps.ts (${model[0].colour}, ${model[1].colour})`)

console.log('2. the 20th piece')
const extras = {
  'the brief\'s (playground experiment)': { slug: 'test-piece', title: 'Test piece', shelf: 'playground', kind: 'experiment', date: '2099-01' },
  'a notes essay': { slug: 'test-notes', title: 'Test notes', shelf: 'notes', kind: 'essay', date: '2099-01' },
  'an old scrap (sorts to the end)': { slug: 'test-old', title: 'Test old', shelf: 'playground', kind: 'scrap', date: '2001-01' },
}
const rowsOf = (h) => Object.fromEntries([...h.matchAll(/<button type="button" class="desk-row shelf-row" data-open="([^"]+)">[\s\S]*?<\/button>/g)].map((m) => [m[1], m[0]]))
for (const [what, p] of Object.entries(extras)) {
  const after = render([...LAB.pieces.map((x) => ({ ...x })), p])
  const other = p.shelf === 'notes' ? 'playground' : 'notes'
  const a = rowsOf(after[p.shelf]), b = rowsOf(html[p.shelf])
  const added = Object.keys(a).filter((s) => !b[s]), same = Object.keys(b).every((s) => a[s] === b[s])
  const group = S.model([...LAB.pieces, p]).find((s) => s.id === p.shelf).groups.find((g) => g.rows.some((r) => r.slug === p.slug))
  ok(added.length === 1 && added[0] === p.slug && same && after[other] === html[other] && group.kind === p.kind,
    `+ ${what}: 1 row in ${p.shelf} · ${group.label}, every other row identical, the other card untouched`)
}
const at = { x: 140, y: -60 }
ok(JSON.stringify(S.place(at, { phone: false })) === JSON.stringify((() => { LAB.pieces.push(extras['the brief\'s (playground experiment)']); const r = S.place(at, { phone: false }); LAB.pieces.pop(); return r })()), 'the cards\' spots do not move when a piece is added (placement never reads content)')

console.log('3. placement comes from code')
const desk = S.place(at, { phone: false }), phone = S.place(at, { phone: true, width: 390 })
const mid = (desk.notes.x + desk.playground.x + desk.playground.w) / 2
ok(Math.abs(mid - at.x) <= 1 && desk.notes.x + desk.notes.w < desk.playground.x && desk.notes.y === desk.playground.y, `desktop: side by side, centred on the night view (x ${desk.notes.x} and ${desk.playground.x}, centre ${mid})`)
ok(phone.notes.x === phone.playground.x && phone.notes.y === phone.playground.y && phone.notes.w === 366, 'phone: one spot for both (one shows at a time), full width less 12px gutters')
const fit = S.fit([{ x: -548, y: -320, w: 1096, h: 640 }], { vw: 1440, vh: 900, top: 88, bottom: 124, side: 40 })
ok(fit.s === 1, `the desktop fit holds both 640px cards at 100% on 1440×900 (s ${fit.s})`)
ok(!/\b[xy]\s*:\s*-?\d/.test(readFileSync(join(here, '../shared/pieces.js'), 'utf8')), 'pieces.js holds no coordinates')

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
ok(!files.includes('stars.js') && !files.includes('labels.js'), 'the star chart and its label placer are gone')
ok(files.every((f) => !/constellation|\.star\b|'star'|\bplate\b|sky\.(render|focus|filter)|LAB\.layout|wander/i.test(code(text[f]))), 'no per-piece star, constellation, plate, filter or wander code in any rule or script')
ok(files.every((f) => !/backdrop-filter/i.test(code(text[f]))), 'no backdrop-filter in any rule or script')
ok(files.every((f) => !/lorem|ipsum/i.test(text[f])), 'no lorem ipsum')
const scripts = [...text['index.html'].matchAll(/<script[^>]*src="([^"]+)"/g)].map((x) => x[1])
ok(scripts.every((s) => !/^https?:|^\/\//.test(s)), `no script from a CDN (${scripts.length} local scripts)`)
ok(['../shared/pieces.js', '../shared/desk.js', '../shared/sky.js', '../shared/body.js', 'shelves.js'].every((s) => scripts.includes(s)), 'built on the shared kit (pieces, desk, sky, body) plus shelves.js')
ok(!/style\.transform\s*=/.test(code(text['night.js']).replace(/el\.blind\.style\.transform|d\.l\.style\.transform/g, '')), 'night.js writes no world transform of its own (the camera goes through DESK.flyTo)')
ok(/class="desk-card shelf"|'desk-card shelf'/.test(text['shelves.js']) && /desk-row__yr/.test(text['shelves.js']) && /desk-chip desk-row__tag/.test(text['shelves.js']), 'the shelves are desk.css cards with desk.js row markup')

console.log(fails ? `\n${fails} check(s) failed` : '\nnight mode: all checks pass')
process.exit(fails ? 1 : 0)
