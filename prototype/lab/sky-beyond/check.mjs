// prototype/lab/sky-beyond/check.mjs: the sky's maths, proven without a browser.
//   node prototype/lab/sky-beyond/check.mjs
// Loads the kit's pieces.js and layout.js and this direction's logic.js exactly as the page does,
// then checks what the screenshots can only show once: nothing moves when a piece is added, the
// fitted sky's labels never collide at either screen size, flights start and end where they
// should, and the files keep the canvas rules. Exits non-zero on the first failure.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url)), shared = join(here, '../shared')
const require = createRequire(import.meta.url)
globalThis.window = globalThis
require(join(shared, 'pieces.js'))
require(join(shared, 'layout.js'))
const SKYB = require(join(here, 'logic.js'))
const LAB = window.LAB
let n = 0
const ok = (cond, msg) => { if (!cond) { console.error('FAIL', msg); process.exit(1) } n++ }

// the door: eggs.ts's world point, as desk.js transcribes it
const desk = readFileSync(join(shared, 'desk.js'), 'utf8')
const at = /"deepSpace":[\s\S]*?"at":\s*{\s*"x":\s*(-?\d+),\s*"y":\s*(-?\d+)/.exec(desk)
ok(at, 'desk.js still carries the deep-space point')
const door = { x: +at[1], y: +at[2] }
const P = SKYB.skyPlacement(door)
const sky = (pieces) => LAB.layout(pieces, { shape: 'disc', centre: P.centre, extent: P.extent })

// 1. append-stability, through this direction's world mapping, for every kind of new piece
const base = sky(LAB.pieces)
ok(Object.keys(base.stars).length === LAB.pieces.length, `all ${LAB.pieces.length} pieces placed`)
const TESTS = {
  'to Hackathons': { shelf: 'notes', kind: 'write-up', constellation: 'hackathons', links: ['sop-opera'] },
  'to Arcade': { shelf: 'playground', kind: 'game', constellation: 'arcade' },
  'loose, Playground': { shelf: 'playground', kind: 'scrap' },
  'loose, Notes': { shelf: 'notes', kind: 'essay' },
}
for (const [name, t] of Object.entries(TESTS)) {
  const next = sky([...LAB.pieces, { slug: 'test-piece', title: 'Test piece', date: '2099-01', ...t }])
  ok(next.stars['test-piece'], `${name}: the new piece is placed`)
  const moved = LAB.pieces.filter((p) => Math.hypot(base.stars[p.slug].x - next.stars[p.slug].x, base.stars[p.slug].y - next.stars[p.slug].y) > 0.5)
  ok(!moved.length, `${name}: moved ${moved.map((p) => p.slug)}`)
}

// 2. geography: the sky sits past the island's last dither square, and the door outside the disc
const { GEO } = SKYB
const rimR = Math.max(P.radius, base.frame.r)
const reach = (u) => (GEO.dissolve + 0.25) / Math.hypot(u.x / GEO.core.rx, u.y / GEO.core.ry) // island edge along u
ok(Math.hypot(P.centre.x, P.centre.y) - rimR > reach(P.dir) + 400, 'the sky clears the island by 400+ world px')
ok(Math.hypot(P.door.x - P.centre.x, P.door.y - P.centre.y) > rimR, 'the door sits outside the disc')
for (const p of LAB.pieces) ok(SKYB.ditherCell(base.stars[p.slug].x, base.stars[p.slug].y) === 0, `${p.slug} is in open sky, not on the island`)

// 3. the dissolve: solid at the core, empty past the edge, thinning in between
const fill = (e0, e1) => {
  let on = 0, all = 0
  for (let a = 0; a < Math.PI * 2; a += 0.02) for (let e = e0; e < e1; e += 0.01) {
    all++; on += SKYB.ditherCell(Math.cos(a) * e * GEO.core.rx, Math.sin(a) * e * GEO.core.ry)
  }
  return on / all
}
ok(fill(0, 0.9) === 1, 'the core is solid cream')
ok(fill(GEO.dissolve + 0.26, GEO.dissolve + 0.6) === 0, 'nothing past the dissolve')
const rings = [1, 1.15, 1.3, 1.45, 1.6].map((e) => fill(e, e + 0.15))
ok(rings.every((v, i) => !i || v < rings[i - 1]), `the dissolve thins outward: ${rings.map((v) => v.toFixed(2))}`)

// 4. labels at the fitted sky, desktop and phone: names always, titles where they fit, no collisions
// Text widths are estimated (Space Grotesk 500 at 12px ≈ 6.7px a character; the label role's
// uppercase + 0.04em ≈ 8.2px), within a few px of what the page measures.
const markOf = (p) => SKYB.markR(base.stars[p.slug].r)
for (const [name, vw, vh] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
  const f = SKYB.skyFit({ centre: P.centre, rimR, door: { ...door, ...GEO.doorSize }, vw, vh })
  const cam = { s: f.s, x: vw / 2 - f.cx * f.s, y: vh / 2 - f.cy * f.s }
  const stars = LAB.pieces.map((p) => ({ slug: p.slug, ...base.stars[p.slug], rp: markOf(p), w: SKYB.truncate(p.title, 24).length * 6.7, h: 16, isProject: !!p.isProject, date: p.date }))
  const members = {}
  for (const p of LAB.pieces) if (p.constellation) (members[p.constellation] ||= []).push(base.stars[p.slug])
  const cons = LAB.constellations.filter((c) => members[c.id]).map((c) => {
    const m = members[c.id]
    return { id: c.id, w: c.name.length * 8.2, h: 16, box: { x0: Math.min(...m.map((s) => s.x)), y0: Math.min(...m.map((s) => s.y)), x1: Math.max(...m.map((s) => s.x)), y1: Math.max(...m.map((s) => s.y)) } }
  })
  const doorBox = { x: door.x * f.s, y: door.y * f.s, w: GEO.doorSize.w * f.s, h: GEO.doorSize.h * f.s, owner: '' }
  const bounds = SKYB.labelBounds(cam, vw, vh)
  const out = SKYB.skyLabels({ stars, cons, s: f.s, bounds, tiny: rimR * f.s < 150, obstacles: [doorBox] })
  const boxes = []
  for (const c of cons) {
    const o = out['con:' + c.id], x = ((c.box.x0 + c.box.x1) / 2) * f.s, y = ((c.box.y0 + c.box.y1) / 2) * f.s
    ok(o && o.show, `${name}: constellation ${c.id} named`)
    boxes.push({ id: c.id, x: x + o.dx, y: y + o.dy, w: c.w, h: c.h })
  }
  for (const t of stars) {
    const o = out[t.slug]
    if (o && o.show) boxes.push({ id: t.slug, owner: t.slug, x: t.x * f.s + o.dx, y: t.y * f.s + o.dy, w: t.w, h: t.h })
  }
  const hit = (a, b) => a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) ok(!hit(boxes[i], boxes[j]), `${name}: label ${boxes[i].id} overlaps ${boxes[j].id}`)
    for (const t of stars) if (t.slug !== boxes[i].owner) ok(!hit(boxes[i], { x: t.x * f.s - t.rp, y: t.y * f.s - t.rp, w: t.rp * 2, h: t.rp * 2 }), `${name}: label ${boxes[i].id} covers star ${t.slug}`)
    ok(!hit(boxes[i], doorBox), `${name}: label ${boxes[i].id} covers the door`)
  }
  const titles = stars.filter((t) => out[t.slug] && out[t.slug].show).length
  ok(titles >= (name === 'desktop' ? 17 : 12), `${name}: ${titles} of ${stars.length} star titles fit`)
  console.log(`  ${name}: fitted at ${(f.s * 100).toFixed(0)}%, ${cons.length} constellation names, ${titles}/${stars.length} star titles, no overlaps`)
}

// 5. flights: van Wijk & Nuij's path ends where it should and zooms out on the way across
const a = { cx: 0, cy: 0, w: 2400 }, b = { cx: P.centre.x, cy: P.centre.y, w: 5800 }
const F = SKYB.flight(a, b)
const close = (p, q) => Math.abs(p.cx - q.cx) < 1e-6 * 1e4 && Math.abs(p.cy - q.cy) < 1e-2 && Math.abs(p.w - q.w) / q.w < 1e-6
ok(close(F.at(0), a) && close(F.at(1), b), 'flight starts and ends on the two views')
const ws = Array.from({ length: 41 }, (_, i) => F.at(i / 40).w)
ok(Math.max(...ws) > Math.max(a.w, b.w), 'flight zooms out past both ends to cross the gap')
ok(ws.every((w) => w > 0 && Number.isFinite(w)), 'flight widths stay finite')
const same = SKYB.flight({ cx: 5, cy: 5, w: 1000 }, { cx: 5, cy: 5, w: 3000 })
ok(Math.abs(same.at(1).w - 3000) < 1e-6, 'a pure zoom is a flight too')

// 6. Tab order: shelf, then constellation, then date
const order = SKYB.starOrder(LAB.pieces, LAB.constellations, LAB.shelves)
ok(order.length === LAB.pieces.length, 'every star is in the Tab order')
const firstPlay = order.findIndex((p) => p.shelf === 'playground')
ok(order.slice(firstPlay).every((p) => p.shelf === 'playground'), 'notes stars come before playground stars')

// 7. the files keep the rules
// (the patterns use a character class so this file can grep its neighbours without matching itself)
for (const f of readdirSync(here)) {
  const t = readFileSync(join(here, f), 'utf8')
  ok(!/backdrop-filte[r]/.test(t), `${f}: no backdrop blur`)
  ok(!/lore[m]|ipsu[m]/i.test(t), `${f}: no placeholder text`)
  ok(!/<script[^>]+src=["']https?:|<link[^>]+href=["']https?:/i.test(t), `${f}: no remote scripts or styles (fonts come in through jet.css)`)
  ok(!/\bfrom\s+['"](?!node:)|require\(['"](?!\.|node:)/.test(t), `${f}: no libraries`)
}

console.log(`sky-beyond: ${n} checks passed`)
