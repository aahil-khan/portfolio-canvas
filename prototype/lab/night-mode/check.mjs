// prototype/lab/night-mode/check.mjs: what the Lab claims, checked without a browser.
//
//   node prototype/lab/night-mode/check.mjs
//
// Loads the shared kit's content (pieces.js, body.js) and this mockup's pure parts (work.js,
// copy.js, decode.js, fx.js, model.js, moon.js) in Node and checks, on the real pieces:
//   1. what is in the Lab: three sections, the serious work only; work.js agrees with
//      content/data/projects.json field for field; actions only where the data has them
//   2. the 20th piece, in all three layouts: one new row in the right section, every other row
//      byte-identical, and nothing that lays the screen out reads content
//   3. nothing pans or zooms: no camera call, the desk's zoom keys stopped, the only drag is the
//      toy's and it moves nothing; one navigation system per layout, no top bar, no boxed panels;
//      the trip is ≤ 0.8 s each way
//   4. the toys: five, each pure and the right size, none flashing (idle and under input), each
//      answering its input, one picked at random per visit (never the last one twice)
//   5. the reader: a write-up's parts become its sections (the TOC), text verbatim; prev / next
//   6. the decode and the moon
//   7. the palettes: every text token ≥ 4.5:1 on every surface it sits on, frames ≥ 3:1
//   8. the files: the day desk is untouched (every painting rule in night.css is scoped to the
//      night), no backdrop-filter, no lorem, no CDN script, every UI word in copy.js
// Exits 1 if anything fails.
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
globalThis.window = globalThis
for (const f of ['../shared/pieces.js', '../shared/body.js', 'work.js', 'copy.js', 'decode.js', 'moon.js', 'fx.js', 'essay.js', 'model.js']) require(join(here, f))
const { LAB, NIGHT } = globalThis
const M = NIGHT.model, FX = NIGHT.fx, C = NIGHT.copy

let fails = 0
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++ }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const piece = (slug) => LAB.pieces.find((p) => p.slug === slug)
const LAYOUTS = ['index', 'dock', 'page']
const rowsOf = (secs, layout) => Object.fromEntries(secs.flatMap((s) => s.entries.map((e) => [`${s.id}/${e.slug}`, M.rowHtml(e, s.id, layout)])))

console.log('1. what is in the Lab')
const secs = M.build(LAB.pieces), tree = LAYOUTS.map((l) => Object.values(rowsOf(secs, l)).join('')).join(''), ids = (id) => secs.find((s) => s.id === id).entries.map((e) => e.slug)
ok(same(secs.map((s) => s.id), ['work', 'experiments', 'writing']), `three sections, in order: ${secs.map((s) => s.id + ' (' + String(s.count).padStart(2, '0') + ')').join(' · ')}`)
ok(same(ids('work').slice().sort(), ['flowsync', 'holt', 'konta', 'portana', 'sop-opera', 'this-site']), `work: the six projects`)
ok(same(ids('experiments').slice().sort(), ['chinese-watch', 'cursor-search-providor', 'usb-camera']), 'experiments: Cursor Search Provider, the Chinese watch, the laptop webcam')
const posts = LAB.pieces.filter((p) => p.kind === 'essay' || (p.kind === 'write-up' && p.body)).map((p) => p.slug).sort()
ok(same(ids('writing').slice().sort(), posts) && posts.length === 8, 'writing: the 2 essays and the 6 write-ups')
const fun = LAB.pieces.filter((p) => ['scrap', 'found', 'game'].includes(p.kind)).map((p) => p.slug)
ok(fun.length === 8 && fun.every((s) => !tree.includes(`/${s}"`)), `the fun stuff stays on the desk: none of ${fun.join(', ')} is in the Lab`)
ok(LAYOUTS.every((l) => Object.keys(rowsOf(secs, l)).length === 17), `17 rows in each of the three layouts`)
const projects = JSON.parse(readFileSync(join(here, '../../../content/data/projects.json'), 'utf8'))
const list = Array.isArray(projects) ? projects : projects.projects || Object.values(projects)[0]
const drift = Object.entries(NIGHT.facts).filter(([slug, f]) => {
  const p = list.find((x) => x.slug === slug)
  return !p || p.kind !== f.kind || !same(p.stack, f.stack) || (p.award || undefined) !== f.award || !same(p.links, f.links)
})
ok(!drift.length && Object.keys(NIGHT.facts).length === 4, `work.js matches projects.json for ${Object.keys(NIGHT.facts).join(', ')}`)
const sop = M.previewHtml(secs, 'work/sop-opera')
ok(/data-read="sop-opera"/.test(sop) && /SOP-Opera"[^>]*>repo</.test(sop) && /sop-opera\.vercel\.app"[^>]*>live</.test(sop) && /Python · TypeScript/.test(sop) && /Economic Times/.test(sop), 'a work preview: tagline, stack, award, [read] [live] [repo]')
ok(!/>repo<|>live</.test(M.previewHtml(secs, 'work/portana')), 'no [live] / [repo] invented for Portana (projects.json has none)')
const exp = M.previewHtml(secs, 'experiments/chinese-watch')
ok(/exp-03 · jul 2026 · hardware/.test(exp) && /shelved/.test(exp) && /data-read="chinese-watch" data-in="experiments"/.test(exp), 'an experiment preview is its log entry: exp-03 · jul 2026 · hardware [shelved], first lines, [open]')
const wr = M.previewHtml(secs, 'writing/sop-opera'), ess = M.previewHtml(secs, 'writing/chrome-hackathon')
ok(/aug 2026 · 1 min read/.test(wr) && /Genuinely the most planning/.test(wr) && /data-read="chrome-hackathon" data-in="writing"/.test(ess), 'a post preview: date, reading time, first lines, [↵ read]; the essays read in the Lab now (essay.js)')
ok(/data-read="old-laptop-cloud" data-in="writing"/.test(M.rowHtml(secs[2].entries.find((e) => e.slug === 'old-laptop-cloud'), 'writing', 'page')) && ['index', 'dock'].every((l) => /4 min/.test(M.rowHtml(secs[2].entries.find((e) => e.slug === 'chrome-hackathon'), 'writing', l))) && !/medium\.com/.test(tree),
  'the imported essays show their reading time and open in the reader, like the other posts (no "medium.com ↗" in any row)')
const bare = M.previewHtml(secs, 'work/sop-opera', { bare: true })
ok(!/pv__path|pv__title|pv__lede/.test(bare) && /data-read="sop-opera"/.test(bare) && /pv__figs/.test(bare), "the dock's expanded entry: the preview without the path, title and tagline its row already shows")
ok(same(M.order(secs).slice(0, 2), ['work/sop-opera', 'work/this-site']) && M.order(secs).length === 17, '↑↓ in the index walks every entry, section by section (17 stops)')

console.log('2. the 20th piece')
const extras = {
  "the brief's (an experiment)": [{ slug: 'test-piece', title: 'Test piece', shelf: 'playground', kind: 'experiment', date: '2099-01' }, ['experiments']],
  'an essay': [{ slug: 'test-essay', title: 'Test essay', shelf: 'notes', kind: 'essay', date: '2099-01', href: 'https://example.com/x' }, ['writing']],
  'a write-up with a body': [{ slug: 'test-wu', title: 'Test write-up', shelf: 'notes', kind: 'write-up', date: '2099-01', body: 'One line.' }, ['work', 'writing']],
  'an oldest experiment (lands last)': [{ slug: 'test-old', title: 'Old one', shelf: 'playground', kind: 'experiment', date: '1999-01' }, ['experiments']],
  'a scrap (stays on the desk)': [{ slug: 'test-scrap', title: 'Test scrap', shelf: 'playground', kind: 'scrap', date: '2099-01' }, []],
}
for (const layout of LAYOUTS) {
  const before = rowsOf(secs, layout)
  const res = Object.entries(extras).map(([what, [p, where]]) => {
    const after = rowsOf(M.build([...LAB.pieces, p]), layout)
    const added = Object.keys(after).filter((k) => !before[k])
    const kept = Object.keys(before).every((k) => after[k] === before[k])
    return [what, kept && same(added.sort(), where.map((s) => `${s}/${p.slug}`).sort())]
  })
  ok(res.every(([, r]) => r), `${layout}: each of the five extra pieces adds exactly its rows; all 17 other rows byte-identical${res.some(([, r]) => !r) ? ' — FAILS: ' + res.filter(([, r]) => !r).map(([w]) => w).join(', ') : ''}`)
}
ok(same(M.build([...LAB.pieces, extras["the brief's (an experiment)"][0]])[1].entries[0].n, 'exp-04'), 'a new experiment is exp-04; no older number moves')
const css = readFileSync(join(here, 'night.css'), 'utf8')
const home = readFileSync(join(here, 'home.js'), 'utf8')
ok(!/offsetHeight|getBoundingClientRect\(\)\.height|\.length \*|count \*/.test(home.replace(/keepInSight[\s\S]*?\n  \}/, '')) && LAYOUTS.every((l) => !/[├└]──|style=/.test(M.rowHtml(secs[0].entries[0], 'work', l))), 'no layout places anything by counting rows or reading heights; rows carry no inline style')

console.log('3. nothing pans, zooms or drags')
const files = readdirSync(here).filter((f) => /\.(html|css|js|mjs)$/.test(f) && f !== 'check.mjs')
const text = Object.fromEntries(files.map((f) => [f, readFileSync(join(here, f), 'utf8')]))
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '')
const lab = ['night.js', 'home.js', 'reader.js', 'model.js'].map((f) => code(text[f])).join('\n')
ok(!/DESK\.flyTo|DESK\.fit\(|DESK\.focusCard/.test(code(text['night.js']).replace(/if \(q\.get\('roundtrip'\)\)[\s\S]*?settled\(\)\.then/, '')), 'the Lab never moves the camera (DESK.flyTo only in the ?roundtrip proof, by day)')
ok(!/pointermove|setPointerCapture|style\.(left|top)\s*=/.test(lab.replace(/about\.el\.style\.(left|top)/g, '')), 'no drag handler and no left/top written in the Lab screen, its layouts or the reader')
const toyJs = code(text['toy.js'])
ok(/setPointerCapture/.test(toyJs) && !/style\.|\.animate\(|transform|translate/.test(toyJs.replace(/el\.pre\.textContent/g, '')) && /el\.pre\.textContent = text/.test(toyJs), "the only drag is the toy's, and it rewrites the toy's own text: no style, transform or animation")
ok(/\['0', '\+', '=', '-'\]\.includes\(e\.key\)\) e\.stopPropagation\(\)/.test(text['night.js']) && /html\.has-night #deskViewport \{ pointer-events: none;/.test(css), "the desk's 0 / + / − keys are stopped at night, and the desk takes no pointer from the first frame of dusk")
ok(/\.lab \{\s*position: fixed; inset: 0;/.test(css) && !/\.lab[^{]*\{[^}]*transform/.test(css), 'the Lab screen is position:fixed, inset 0, never transformed')
ok(!/lbar|status bar class|\.palsw|class="frame/.test(code(text['night.js']) + code(text['home.js'])) && !/\.(lbar|frame|tui)\b/.test(code(css)), 'no top status bar and no boxed panels (no .lbar, .frame or .tui anywhere)')
const borders = [...code(css).matchAll(/([^{}]+)\{([^{}]*\bborder(?:-(?:top|bottom|left|right))?:\s*1px solid[^{}]*)\}/g)].map((m) => m[1].trim()).filter((sel) => !/^\.(rd__|lbx|reader|proof)|html\.is-night \.desk-dock|desk-dock__item|pv__fig|pg__fig|rd__zoom/.test(sel))
ok(!borders.length, `solid frames only on the reader's header, figures and the dock${borders.length ? ' — ALSO ON: ' + borders.join(' | ') : ''}`)
// one navigation system per layout: the index has no dock and no jump line; the dock has no index;
// the page has no dock and no index
const navs = { index: /class="ixn"/, dock: /class="dkl"/, page: /class="jump"/ }
const VIEW = (l) => (home.match(new RegExp(`    ${l}: \\(\\) => [\\s\\S]*?(?=\\n    (index|dock|page): |\\n  \\})`)) || [''])[0]
ok(LAYOUTS.every((l) => navs[l].test(VIEW(l)) && Object.entries(navs).filter(([k]) => k !== l).every(([, re]) => !re.test(VIEW(l)))) &&
  /html\.has-night\[data-lab-layout='dock'\] \.ldock \{/.test(css) && !/html\.has-night \.ldock \{/.test(css) && /html\[data-lab-layout='dock'\] \.lcorner \{ display: none; \}/.test(css),
  'one navigation system per layout: index = the index, dock = the dock (its tiles appear only there), page = the jump line; one ← canvas in each')
const MS = /const MS = \{ in: (\d+), out: (\d+), calm: (\d+) \}/.exec(text['night.js'])
ok(MS && +MS[1] <= 800 && +MS[2] <= 800 && +MS[3] <= 400 && !/intro/.test(code(text['night.js'])), `the trip: ${MS && MS[1]} ms in, ${MS && MS[2]} ms back, decode included (the decode windows end by t = 1); reduced motion a ${MS && MS[3]} ms crossfade; no intro after it`)

console.log('4. the toys')
ok(same(FX.ids, ['donut', 'warp', 'life', 'nebula', 'moon']), `${FX.ids.length} toys: ${FX.ids.join(', ')}`)
const W = { ' ': 0, '.': 0.12, '·': 0.12, ',': 0.15, '-': 0.2, ':': 0.25, '~': 0.3, ';': 0.32, '=': 0.4, '+': 0.4, '!': 0.45, 'o': 0.5, '*': 0.55, '|': 0.3, '/': 0.3, '\\': 0.3, '#': 0.75, '%': 0.8, '$': 0.85, '@': 1, '▀': 0.5, '▄': 0.5, '█': 1 }
const ink = (f) => { let s = 0, n = 0; for (const ch of f) { if (ch === '\n') continue; s += W[ch] ?? 0.4; n++ } return s / n }
// what a visitor does to each, frame by frame at 30 fps: nothing for 2 s, then 2 s of input
const INPUT = {
  donut: (k) => ({ held: k < 30, dx: k < 30 ? 1.5 : 0, dy: k < 30 ? 0.8 : 0 }),
  warp: (k) => ({ aim: { x: Math.sin(k / 9) * 0.9, y: Math.cos(k / 13) * 0.7 } }),
  life: (k) => (k % 6 === 0 ? { flip: [[10 + (k % 12), 7]] } : {}),
  nebula: (k) => ({ stir: { x: 0.3 + 0.4 * Math.sin(k / 10), y: 0.5, m: 0.03 } }),
  moon: () => ({ dx: 0.8 }),
}
for (const id of FX.ids) {
  const [c, r] = [34, 16]
  const sized = [[34, 16], [22, 11]].every(([cc, rr]) => { const f = FX.draw(id, FX.init(id, cc, rr, 3, 0.4), cc, rr).split('\n'); return f.length === rr && f.every((l) => [...l].length === cc) })
  const s0 = FX.init(id, c, r, 3, 0.4), pure = FX.draw(id, s0, c, r) === FX.draw(id, FX.init(id, c, r, 3, 0.4), c, r) && same(FX.step(id, s0, 0.033, {}), FX.step(id, s0, 0.033, {}))
  let s = s0
  const series = [ink(FX.draw(id, s, c, r))], frames = [FX.draw(id, s, c, r)]
  for (let k = 0; k < 120; k++) { s = FX.step(id, s, 1 / 30, k < 60 ? {} : INPUT[id](k - 60)); const f = FX.draw(id, s, c, r); series.push(ink(f)); frames.push(f) }
  const jumps = series.slice(1).map((v, i) => Math.abs(v - series[i])), maxJump = Math.max(...jumps), peak = Math.max(...series)
  // input does something: the frames with input differ from what idling would have drawn
  let idle = s0
  for (let k = 0; k < 120; k++) idle = FX.step(id, idle, 1 / 30, {})
  const reacts = FX.draw(id, idle, c, r) !== frames[120]
  ok(sized && pure && reacts && maxJump < 0.03 && peak < 0.45 && peak > 0.01, `${id}: rows × cols exact (34 × 16, 22 × 11), pure of its state; answers its input; peak ink ${peak.toFixed(3)}, biggest frame-to-frame change ${maxJump.toFixed(4)} (< 0.03: no flash)`)
}
{
  const s = FX.init('donut', 34, 16, 3), a = FX.step('donut', s, 0.033, { held: true, dx: 20, dy: 0 })
  let b = { ...a, vb: 6 }
  for (let k = 0; k < 90; k++) b = FX.step('donut', b, 1 / 30, {})
  ok(a.B > s.B && Math.abs(b.vb - 0.22) < 0.3 && b.vb < 6, `donut: a drag turns it, a flick coasts and settles back to the idle spin (${b.vb.toFixed(2)} rad/s after 3 s)`)
  const l = FX.init('life', 34, 16, 9), f = FX.step('life', l, 0, { flip: [[0, 0]], paused: true }), rs = FX.step('life', l, 0, { reseed: true, paused: true })
  ok(f.a[0] !== l.a[0] && f.n === 0 && rs.seed !== l.seed && !same([...rs.a], [...l.a]), 'life: a click flips that cell (no generation passes while paused: reduced motion), r reseeds')
  const m0 = FX.init('moon', 34, 16, 3, 0.25), m1 = FX.step('moon', m0, 0, { dx: 14 })
  ok(Math.abs(m1.phase - 0.5) < 1e-9 && FX.draw('moon', m0, 34, 16) !== FX.draw('moon', m1, 34, 16), 'moon: a drag of a quarter box is a quarter of a month (first quarter → full)')
  const w0 = FX.init('warp', 34, 16, 3), w1 = FX.step('warp', w0, 0.1, { aim: { x: 1, y: 0 } })
  ok(w1.hx > 0 && w1.v > w0.v, 'warp: the pointer sets the heading and the speed picks up')
}
const picks = []; let last = null, seq = 0
const rnd = () => ((seq = (seq * 9301 + 49297) % 233280) / 233280)
for (let i = 0; i < 600; i++) { const p = FX.pick(last, rnd); picks.push([last, p]); last = p }
ok(picks.every(([a, b]) => a !== b) && FX.ids.every((id) => picks.some(([, b]) => b === id)), 'pick(): every toy comes up over 600 visits, and never the same one twice running')
const tj = code(text['toy.js'])
ok(/IntersectionObserver/.test(tj) && /visibilitychange/.test(tj) && /reader\.isOpen\(\)/.test(tj) && /go = visible\(\) && !R\(\)/.test(tj), 'the clock runs only while the toy is on screen, the tab visible and no post open; never under reduced motion (input redraws a still frame)')

console.log('5. the reader')
const parts = (slug) => M.parts(piece(slug).body)
ok(same(parts('sop-opera').map((p) => p.id), ['story', 'what', 'highlights']) && same(parts('holt').map((p) => p.id), ['what', 'highlights']), "a write-up's parts become sections: SOP Opera has 3 (a contents column), Holt 2")
ok(LAB.pieces.filter((p) => p.body).every((p) => same(M.parts(p.body).flatMap((x) => x.blocks).join('\n\n'), p.body.trim().split(/\n\s*\n/).filter(Boolean).join('\n\n'))), 'every body is all there, in order, word for word: sections only add headings')
const R = M.readable(LAB.pieces)
ok(same(R.writing.map((e) => e.slug), ids('writing').filter((s) => M.bodyOf(piece(s)))) && same(R.experiments.map((e) => e.slug), ids('experiments')), "prev / next run in the menu's order, per section")
for (const [slug, secs, figs] of [['old-laptop-cloud', 15, 10], ['chrome-hackathon', 10, 9]]) {
  const p = piece(slug), sp = M.parts(M.bodyOf(p)), im = M.imagesOf(p), e = R.writing.find((x) => x.slug === slug)
  ok(sp.filter((s) => s.title).length === secs && im.length === figs && im.every((x) => /^https:\/\/cdn-images-1\.medium\.com\//.test(x.src)) && e && e.mins >= 4 && !/<[a-z]/i.test(M.bodyOf(p)) && !M.bodyOf(p).split('\n\n').some((b) => /^#.*\*/.test(b)),
    `${slug}: the real essay (essay.js, from the Medium export): ${secs} sections for the contents, ${figs} figures, ${e && e.mins} min; opens in the reader instead of linking out`)
}
const { convert } = await import(join(here, 'import-medium.mjs'))
const sample = convert('<section data-field="body" class="e-content"><h3 class="graf graf--h3">T</h3><h3 class="graf graf--h3">Part</h3><h4 class="graf graf--h4">Sub</h4><p class="graf graf--p">A <strong class="markup--strong">b</strong> <em>c</em> <code>d</code> <a href="https://x.y/z">e</a><br>f &amp; g</p><ul class="postList"><li class="graf graf--li">one</li></ul><ol class="postList"><li class="graf graf--li">first</li></ol><figure class="graf graf--figure"><img src="https://cdn-images-1.medium.com/max/800/1*a.png"><figcaption class="imageCaption">cap</figcaption></figure></section>')
ok(sample.title === 'T' && sample.body === '## Part\n\n### Sub\n\nA **b** *c* `d` [e](https://x.y/z) f & g\n\n- one\n\n1. first\n\n![cap](https://cdn-images-1.medium.com/max/1024/1*a.png)', 'import-medium.mjs maps every Medium block: h3 → ##, h4 → ###, p, ul, ol, figure + caption, and bold / italic / code / links inline')
ok(/\^#\\\/\(writing\|experiments\)\\\/\(\[a-z0-9-\]\+\)\$/.test(text['reader.js']) && /history\.back\(\)/.test(text['reader.js']) && /hashchange/.test(text['reader.js']), 'posts and logs deep-link (#/writing/<slug>, #/experiments/<slug>), and Back closes them')
ok(/function morph\(from, open\)/.test(text['reader.js']) && /clipPath: clip/.test(text['reader.js']) && /OPEN_MS = 560, CLOSE_MS = 480/.test(text['reader.js']), "#17's open / close motion is kept: the clip from the row, the title FLIP, 560 / 480 ms")

console.log('6. the decode and the moon')
const D = NIGHT.decode
const strs = [...(tree + M.order(secs).map((id) => M.previewHtml(secs, id)).join('')).matchAll(/>([^<>]+)</g)].map((m) => m[1].replace(/&[a-z]+;|&#\d+;/g, '?')).filter((t) => /\S/.test(t))
const steps = [0, 0.05, 0.2, 0.37, 0.5, 0.73, 0.9, 0.999, 1]
ok(strs.length > 60 && strs.every((t) => steps.every((p) => { const v = D(t, p, 3); return v.length === t.length && [...t].every((c, i) => (c === ' ') === (v[i] === ' ')) })), `length and spaces never change (${strs.length} Lab strings × ${steps.length} steps): nothing reflows`)
ok(strs.every((t) => D(t, 1, 9) === t) && D('SOP Opera', 0.4, 5) === D('SOP Opera', 0.4, 5), 'p = 1 is the text exactly; pure of (p, seed)')
const full = NIGHT.moonBits(64, 0.5), dark = NIGHT.moonBits(64, 0), lit = (b) => b.reduce((n, v) => n + v, 0)
ok(lit(full) > 64 * 64 * 0.45 && lit(dark) < lit(full) / 6, `the moon (the moon toy): full lights ${lit(full)} px, new ${lit(dark)}`)

console.log('7. the palettes')
const hex = (v) => { const m = /^#([0-9a-f]{6})$/i.exec(v.trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null }
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const mix = (a, k, b) => a.map((v, i) => Math.round(v * k + b[i] * (1 - k)))
const palettes = {}
for (const m of css.matchAll(/html\[data-palette='(\w+)'\]\s*\{([^}]*)\}/g)) palettes[m[1]] = Object.fromEntries([...m[2].matchAll(/--lab-([\w-]+):\s*([^;]+);/g)].map((x) => [x[1], hex(x[2])]).filter((x) => x[1]))
ok(same(Object.keys(palettes), ['white', 'green', 'amber']), `three palettes: ${Object.keys(palettes).join(', ')}`)
for (const [name, P] of Object.entries(palettes)) {
  const SECT = ['work', 'experiments', 'writing'], pairs = []
  for (const t of ['fg', 'dim', ...SECT]) for (const s of ['bg', 'pane']) pairs.push([`${t} on ${s}`, P[t], P[s], 4.5])
  for (const c of [...SECT, 'fg']) for (const t of ['fg', 'dim', c]) pairs.push([`${t} on a highlighted ${c} row`, P[t], mix(P[c], 0.14, P.pane), 4.5])
  for (const c of SECT) for (const t of ['fg', 'dim', c]) pairs.push([`${t} on a hovered ${c} prev/next`, P[t], mix(P[c], 0.14, P.bg), 4.5])
  for (const c of ['fg', ...SECT]) pairs.push([`bg on ${c} (inverse: the cursor, ← canvas, the dock's section, the jump line, the TOC)`, P.bg, P[c], 4.5])
  for (const c of ['fg', ...SECT]) pairs.push([`${c} frame on the sky`, P[c], P.bg, 3])
  const low = pairs.map(([w, a, b, min]) => [w, ratio(a, b), min]).filter(([, r, min]) => r < min)
  const worst = Math.min(...pairs.filter((p) => p[3] === 4.5).map(([, a, b]) => ratio(a, b)))
  ok(!low.length, `${name}: ${pairs.length} pairs, lowest text pair ${worst.toFixed(2)}:1${low.length ? ' (' + low.map(([w, r]) => `${w} ${r.toFixed(2)}`).join('; ') + ')' : ''}`)
}

console.log('8. the files')
const NIGHT_ONLY = /html\.(has-night|is-night|is-turning|is-reading)|^html\[data-lab-layout=[^\]]+\] \.lcorner$|^\.(night|cut|act|lab|lcorner|lsw|hello|keys|toy|sh|is-new|L--|ix|pv|top|dk|dl|jump|pg|ldock|reader|rd__|lbx|proof)|^\[data-|^html\[data-palette|^html:not\(\[data-palette\]\)|^:root$|^\.desk-dock__item\[(data-id|aria-label)=[^\]]+\] \.desk-dock__icon$/
const rules = [...code(css).replace(/'[^'\n]*'/g, "''").replace(/@import[^;]+;/g, '').replace(/@media[^{]+\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]])
const leaky = rules.filter(([sel, body]) => {
  const props = [...body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1])
  if (props.length && props.every((p) => p.startsWith('--'))) return false
  return sel.split(',').map((s) => s.trim()).some((s) => !NIGHT_ONLY.test(s))
})
ok(rules.length > 150 && !leaky.length, `night.css: all ${rules.length} rules paint only at night or on Lab-only elements${leaky.length ? ' — LEAKS: ' + leaky.map((r) => r[0]).join(' | ') : ''}`)
ok(files.every((f) => !/backdrop-filter/i.test(code(text[f]))), 'no backdrop-filter in any rule or script')
ok(files.every((f) => !/lorem|ipsum/i.test(text[f])), 'no lorem ipsum')
const scripts = [...text['index.html'].matchAll(/<script[^>]*src="([^"]+)"/g)].map((x) => x[1])
ok(scripts.every((s) => !/^https?:|^\/\//.test(s)), `no script from a CDN (${scripts.length} local scripts)`)
ok(['../shared/pieces.js', '../shared/desk.js', '../shared/sky.js', '../shared/body.js', 'copy.js', 'fx.js', 'model.js', 'toy.js', 'home.js', 'reader.js', 'night.js'].every((s) => scripts.includes(s)) && !scripts.some((s) => /shelves|windows|intro|menu/.test(s)), 'built on the shared kit plus this folder; no intro.js or menu.js left')
// every sentence the Lab shows is in copy.js: no quoted run of 4+ words in the UI scripts
const sentence = /(['"`])(?:(?!\1)[^\n]){0,6}\b[a-z]+ [a-z]+ [a-z]+ [a-z]+\b(?:(?!\1)[^\n])*\1/i
const strip = (s) => code(s).replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, (m) => (/[<>=(){}$]|\.\w+\(|^.(\w+-)+\w+.$/.test(m) ? "''" : m))
const prose = ['night.js', 'home.js', 'toy.js', 'reader.js', 'model.js'].filter((f) => sentence.test(strip(text[f])))
ok(!prose.length && C.welcome.length === 3 && /PROPOSAL FOR AAHIL/.test(text['copy.js']), `every UI word is in copy.js (the welcome is marked a proposal)${prose.length ? ' — prose in ' + prose.join(', ') : ''}`)

console.log(fails ? `\n${fails} check(s) failed` : '\nthe Lab: all checks pass')
process.exit(fails ? 1 : 0)
