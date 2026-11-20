// prototype/lab/night-mode/check.mjs: what the Lab claims, checked without a browser.
//
//   node prototype/lab/night-mode/check.mjs
//
// Loads the shared kit's content (pieces.js, body.js) and this mockup's pure parts (work.js,
// copy.js, decode.js, fx.js, series.js, logic.js, model.js, moon.js, sam.js) in Node and checks,
// on the real pieces:
//   1. what is in the Lab: four categories, the serious work only; work.js agrees with
//      content/data/projects.json field for field; actions only where the data has them
//   2. the 20th piece, in the directory: one new row in the right category, every other row
//      byte-identical, and nothing that lays the screen out reads content
//   3. nothing pans or zooms: no camera call, the desk's zoom keys stopped, the only drags are the
//      toy's and the compass's pointer, and neither moves the page; the directory is the one
//      navigation system, the deck does none; no top bar, no boxed panels; the trip ≤ 0.8 s
//   9. the deck, the compass, the series, the voices, the sound (this round's claims)
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
for (const f of ['../shared/pieces.js', '../shared/body.js', 'work.js', 'copy.js', 'decode.js', 'moon.js', 'fx.js', 'essay.js', 'series.js', 'logic.js', 'model.js', 'vignette.js', 'narration/sample-timings.js']) require(join(here, f))
const { LAB, NIGHT } = globalThis
const M = NIGHT.model, FX = NIGHT.fx, C = NIGHT.copy

let fails = 0
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++ }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const piece = (slug) => LAB.pieces.find((p) => p.slug === slug)
const rowsOf = (secs) => Object.fromEntries(secs.flatMap((s) => s.entries.map((e) => [`${s.id}/${e.slug}`, M.rowHtml(e, s.id)])))
const W_ = (secs) => secs.find((s) => s.id === 'writing')

console.log('1. what is in the Lab')
const secs = M.build(LAB.pieces), tree = Object.values(rowsOf(secs)).join(''), ids = (id) => secs.find((s) => s.id === id).entries.map((e) => e.slug)
ok(same(secs.map((s) => s.id), ['work', 'experiments', 'research', 'writing']) && same(secs.map((s) => s.key), ['1', '2', '3', '4']), `four categories, keys 1–4: ${secs.map((s) => s.id + ' (' + String(s.count).padStart(2, '0') + ', ' + s.upd + ')').join(' · ')}`)
const metas = M.sectionsOf(secs)
ok(metas.every((m) => m.blurb && m.upd && new RegExp(`>${m.id}/<`).test(M.catHtml(m)) && M.catHtml(m).includes(m.blurb) && M.catHtml(m).includes(m.upd)), "each category's row: key, name/, a one-line description of what's inside, a count and the last-updated month")
ok(same(ids('research'), ['reliability-study']), 'research: the one series (series.js)')
ok(same(ids('work').slice().sort(), ['flowsync', 'holt', 'konta', 'portana', 'sop-opera', 'this-site']), `work: the six projects`)
ok(same(ids('experiments').slice().sort(), ['chinese-watch', 'cursor-search-providor', 'usb-camera']), 'experiments: Cursor Search Provider, the Chinese watch, the laptop webcam')
const posts = LAB.pieces.filter((p) => p.kind === 'essay' || (p.kind === 'write-up' && p.body)).map((p) => p.slug).sort()
ok(same(ids('writing').slice().sort(), posts) && posts.length === 8, 'writing: the 2 essays and the 6 write-ups')
const fun = LAB.pieces.filter((p) => ['scrap', 'found', 'game'].includes(p.kind)).map((p) => p.slug)
ok(fun.length === 8 && fun.every((s) => !tree.includes(`/${s}"`)), `the fun stuff stays on the desk: none of ${fun.join(', ')} is in the Lab`)
ok(Object.keys(rowsOf(secs)).length === 18, `18 rows in the directory (6 + 3 + 1 + 8)`)
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
ok(/data-read="old-laptop-cloud" data-in="writing"/.test(M.previewHtml(secs, 'writing/old-laptop-cloud')) && /4 min/.test(M.rowHtml(W_(secs).entries.find((e) => e.slug === 'chrome-hackathon'), 'writing')) && !/medium\.com/.test(tree),
  'the imported essays show their reading time and open in the reader, like the other posts (no "medium.com ↗" in any row)')
const bare = M.previewHtml(secs, 'work/sop-opera', { bare: true })
ok(!/pv__path|pv__title|pv__lede/.test(bare) && /data-read="sop-opera"/.test(bare) && /pv__figs/.test(bare), "an entry expanded in place: the preview without the path, title and tagline its row already shows")

console.log('2. the 20th piece')
const extras = {
  "the brief's (an experiment)": [{ slug: 'test-piece', title: 'Test piece', shelf: 'playground', kind: 'experiment', date: '2099-01' }, ['experiments']],
  'an essay': [{ slug: 'test-essay', title: 'Test essay', shelf: 'notes', kind: 'essay', date: '2099-01', href: 'https://example.com/x' }, ['writing']],
  'a write-up with a body': [{ slug: 'test-wu', title: 'Test write-up', shelf: 'notes', kind: 'write-up', date: '2099-01', body: 'One line.' }, ['work', 'writing']],
  'an oldest experiment (lands last)': [{ slug: 'test-old', title: 'Old one', shelf: 'playground', kind: 'experiment', date: '1999-01' }, ['experiments']],
  'a scrap (stays on the desk)': [{ slug: 'test-scrap', title: 'Test scrap', shelf: 'playground', kind: 'scrap', date: '2099-01' }, []],
}
{
  const before = rowsOf(secs)
  const res = Object.entries(extras).map(([what, [p, where]]) => {
    const after = rowsOf(M.build([...LAB.pieces, p]))
    const added = Object.keys(after).filter((k) => !before[k])
    const kept = Object.keys(before).every((k) => after[k] === before[k])
    return [what, kept && same(added.sort(), where.map((s) => `${s}/${p.slug}`).sort())]
  })
  ok(res.every(([, r]) => r), `the directory: each of the five extra pieces adds exactly its rows; all 18 other rows byte-identical${res.some(([, r]) => !r) ? ' — FAILS: ' + res.filter(([, r]) => !r).map(([w]) => w).join(', ') : ''}`)
}
ok(same(M.build([...LAB.pieces, extras["the brief's (an experiment)"][0]])[1].entries[0].n, 'exp-04'), 'a new experiment is exp-04; no older number moves')
const css = readFileSync(join(here, 'night.css'), 'utf8')
const home = readFileSync(join(here, 'home.js'), 'utf8')
ok(!/offsetHeight|getBoundingClientRect\(\)\.height|\.length \*|count \*/.test(home.replace(/function typeAnswer\(\) \{[\s\S]*?\n  \}/, '')) && !/style=/.test(tree), 'nothing places anything by counting rows or reading heights; rows carry no inline style')

console.log('3. nothing pans, zooms or drags')
const files = readdirSync(here).filter((f) => /\.(html|css|js|mjs)$/.test(f) && f !== 'check.mjs')
const text = Object.fromEntries(files.map((f) => [f, readFileSync(join(here, f), 'utf8')]))
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '')
const lab = ['night.js', 'home.js', 'reader.js', 'model.js', 'deck.js', 'voice.js', 'sound.js'].map((f) => code(text[f])).join('\n')
ok(!/DESK\.flyTo|DESK\.fit\(|DESK\.focusCard/.test(code(text['night.js']).replace(/if \(q\.get\('roundtrip'\)\)[\s\S]*?settled\(\)\.then/, '')), 'the Lab never moves the camera (DESK.flyTo only in the ?roundtrip proof, by day)')
ok(!/pointermove|setPointerCapture|style\.(left|top)\s*=/.test(lab.replace(/about\.el\.style\.(left|top)/g, '')), 'no drag handler and no left/top written in the Lab screen, the directory, the deck or the reader')
const dialJs = code(text['dial.js']), frameFn = (dialJs.match(/function frame\(\) \{[\s\S]*?\n  \}/) || [''])[0]
ok(/pointermove/.test(dialJs) && !/setPointerCapture/.test(dialJs) && frameFn.length > 100 && [...frameFn.matchAll(/\.style\.(\w+)/g)].every((m) => ['transform', 'opacity'].includes(m[1])) && !/commit\(|release\(/.test(frameFn) && /requestAnimationFrame\(frame\)/.test(dialJs) && ![...dialJs.matchAll(/\.style\.(\w+)/g)].some((m) => !['transform', 'opacity', 'left', 'top'].includes(m[1])),
  "the dial reads the pointer into a variable and one rAF loop; the loop writes only the needle's transform and opacity and never commits; the dial itself is placed once, when summoned")
const toyJs = code(text['toy.js'])
ok(/setPointerCapture/.test(toyJs) && !/style\.|\.animate\(|transform|translate/.test(toyJs.replace(/el\.pre\.textContent/g, '')) && /el\.pre\.textContent = text/.test(toyJs), "the only drag is the toy's, and it rewrites the toy's own text: no style, transform or animation")
ok(/\['0', '\+', '=', '-'\]\.includes\(e\.key\)\) e\.stopPropagation\(\)/.test(text['night.js']) && /html\.has-night #deskViewport \{ pointer-events: none;/.test(css), "the desk's 0 / + / − keys are stopped at night, and the desk takes no pointer from the first frame of dusk")
ok(/\.lab \{\s*position: fixed; inset: 0;/.test(css) && !/\.lab[^{]*\{[^}]*transform/.test(css), 'the Lab screen is position:fixed, inset 0, never transformed')
ok(!/lbar|status bar class|\.palsw|class="frame/.test(code(text['night.js']) + code(text['home.js'])) && !/\.(lbar|frame|tui)\b/.test(code(css)), 'no top status bar and no boxed panels (no .lbar, .frame or .tui anywhere)')
const borders = [...code(css).matchAll(/([^{}]+)\{([^{}]*\bborder(?:-(?:top|bottom|left|right))?:\s*1px solid[^{}]*)\}/g)].map((m) => m[1].trim()).filter((sel) => !/^\.(rd__|lbx|reader|proof|pop\b|lab-back|hero__go|tile__b|dial)|html\.is-night \.desk-dock|desk-dock__item|pv__fig|pg__fig|rd__zoom/.test(sel))
ok(!borders.length, `solid frames only on the reader's header, figures, the deck and its popovers, ← canvas, the ask hero, the tiles and the dial${borders.length ? ' — ALSO ON: ' + borders.join(' | ') : ''}`)
// one navigation system: the directory. No layouts, no corner, no switches, no section tiles.
const deckJs = code(text['deck.js']), actFn = (deckJs.match(/function act\(doo, from\) \{[\s\S]*?\n  \}/) || [''])[0]
ok(/class="tiles"/.test(home) && !/LAYOUTS|setLayout|lcorner|class="lsw|class="ixn"|class="jump"/.test(code(text['night.js']) + code(home)) && !/data-lab=|\.ldock\[data-lab/.test(deckJs + css) && !/data-lab-layout/.test(css + code(text['night.js'])),
  'one navigation system, the tiles and their categories: no layouts, no layout switch, no corner, no section tiles in the deck')
ok(actFn.length > 200 && !/home\.(go|select|openCat|setHome)|reader\.go|location|NIGHT\.leave/.test(actFn) && (deckJs.match(/reader\.go\(/g) || []).length === 1 && /function runCommand[\s\S]*?reader\.go\(/.test(deckJs),
  "the deck does no navigation: act(), the only thing a cell calls, opens no category, entry or post; reader.go appears once, in the / command line's runCommand (a search)")
const MS = /const MS = \{ in: (\d+), out: (\d+), calm: (\d+) \}/.exec(text['night.js'])
ok(MS && +MS[1] >= 1100 && +MS[1] <= 1300 && +MS[2] >= 1100 && +MS[2] <= 1300 && +MS[3] <= 400 && !/intro/.test(code(text['night.js'])), `the trip: ${MS && MS[1]} ms in, ${MS && MS[2]} ms back, decode included (the decode windows end by t = 1); reduced motion a ${MS && MS[3]} ms crossfade; no intro after it`)

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
ok(/\^#\\\/\(writing\|experiments\|research\)\\\/\(\[a-z0-9-\]\+\)\$/.test(text['reader.js']) && /history\.back\(\)/.test(text['reader.js']) && /hashchange/.test(text['reader.js']), 'posts, logs, hubs and chapters deep-link (#/writing/, #/experiments/, #/research/<slug>), and Back closes them')
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
  const SECT = ['work', 'experiments', 'research', 'writing'], pairs = []
  for (const t of ['fg', 'dim', ...SECT]) for (const s of ['bg', 'pane']) pairs.push([`${t} on ${s}`, P[t], P[s], 4.5])
  for (const c of [...SECT, 'fg']) for (const t of ['fg', 'dim', c]) pairs.push([`${t} on a highlighted ${c} row`, P[t], mix(P[c], 0.14, P.pane), 4.5])
  for (const c of SECT) for (const t of ['fg', 'dim', c]) pairs.push([`${t} on a hovered ${c} prev/next`, P[t], mix(P[c], 0.14, P.bg), 4.5])
  for (const c of ['fg', 'hi', ...SECT]) pairs.push([`bg on ${c} (inverse: the cursor, ← canvas, the deck's mode cell, the lit wedge, the spoken word, the TOC)`, P.bg, P[c], 4.5])
  pairs.push(['hi on bg (the sample-content banner)', P.hi, P.bg, 4.5])
  for (const c of ['fg', ...SECT]) pairs.push([`${c} frame on the sky`, P[c], P.bg, 3])
  const low = pairs.map(([w, a, b, min]) => [w, ratio(a, b), min]).filter(([, r, min]) => r < min)
  const worst = Math.min(...pairs.filter((p) => p[3] === 4.5).map(([, a, b]) => ratio(a, b)))
  ok(!low.length, `${name}: ${pairs.length} pairs, lowest text pair ${worst.toFixed(2)}:1${low.length ? ' (' + low.map(([w, r]) => `${w} ${r.toFixed(2)}`).join('; ') + ')' : ''}`)
}

console.log('8. the files')
const NIGHT_ONLY = /html\.(has-night|is-night|is-turning|is-reading)|^\.(night|cut|act|lab|hello|keys|toy|sh|is-new|L--|pv|top|dk|dl|dir|cat|deckpop|pop|knob|ans|cmd|help|sheet|rad|thread|hub|ldock|reader|rd__|lbx|proof|L\b|hero|chip|tiles?\b|tile__|vg\b|cvh?\b|cvh__|cvs\b|pane\b|dial|ask\b)|^\[data-|^html\[data-(palette|deck|dial)|^html\.has-dial|^html:not\(\[data-palette\]\)|^:root$|^\.desk-dock__item\[(data-id|aria-label)=[^\]]+\] \.desk-dock__icon$/
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
ok(['../shared/pieces.js', '../shared/desk.js', '../shared/sky.js', '../shared/body.js', 'copy.js', 'fx.js', 'series.js', 'logic.js', 'model.js', 'sam.js', 'sound.js', 'voice.js', 'toy.js', 'vignette.js', 'dial.js', 'home.js', 'reader.js', 'deck.js', 'night.js'].every((s) => scripts.includes(s)) && !scripts.some((s) => /shelves|windows|intro|menu|sample-audio/.test(s)), "built on the shared kit plus this folder; the sample's audio is not a page script (it loads on the first press)")
// every sentence the Lab shows is in copy.js: no quoted run of 4+ words in the UI scripts
const sentence = /(['"`])(?:(?!\1)[^\n]){0,6}\b[a-z]+ [a-z]+ [a-z]+ [a-z]+\b(?:(?!\1)[^\n])*\1/i
const strip = (s) => code(s).replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, (m) => (/[<>=(){}$]|\.\w+\(|^.(\w+-)+\w+.$/.test(m) ? "''" : m))
const prose = ['night.js', 'home.js', 'toy.js', 'reader.js', 'model.js', 'deck.js', 'voice.js', 'dial.js', 'vignette.js', 'sound.js', 'logic.js'].filter((f) => sentence.test(strip(text[f])))
ok(!prose.length && C.welcome.length === 3 && /PROPOSAL FOR AAHIL/.test(text['copy.js']), `every UI word is in copy.js (the welcome is marked a proposal)${prose.length ? ' — prose in ' + prose.join(', ') : ''}`)

console.log('9. the deck, the compass, the series, the voices, the sound')
const G = NIGHT.logic, nightJs = code(text['night.js']), voiceJs = code(text['voice.js']), soundJs = code(text['sound.js']), readerJs = code(text['reader.js'])
// the deck
const cellsFn = (deckJs.match(/function cellsHtml\(\) \{[\s\S]*?\n  \}/) || [''])[0]
ok(['dk-mode', 'dk-tr', 'dk-voice', 'dk-flags', 'dk-keys'].every((c) => cellsFn.includes(`'${c}'`)) && ['back', 'play', 'fwd', 'rate', 'voice', 'knobs', 'snd', 'pal', 'cmd', 'help'].every((d) => cellsFn.includes(`'${d}'`)) && !/dk-toy|dk-more|dk-pplay|'radial'|'ask'|'toy'|'more'|canvas/.test(cellsFn),
  'the deck at rest: LAB │ snd pal │ / ? — no toy, no ask, no radial flag, no ← canvas; the transport and the voice are its only other cells')
ok(/cell\('dk-tr', 'play'/.test(cellsFn) && /cell\('dk-voice', 'play'/.test(cellsFn) && /cell\('dk-flags', 'flags'/.test(cellsFn) && /role === 'play' \? k \* kp/.test(nightJs) && /NIGHT\.deckPlay\(on\)/.test(deckJs) && /setTimeout\(go, \d{3,4}\)/.test(nightJs) && /chp: 17/.test(cellsFn) && /innerWidth < 820/.test(nightJs),
  'the transport and the voice slide in only while something plays (night.js kp), and out a moment after it stops; under 820 px the transport is short and the flags step aside while it plays')
// the compass
const wd = (deg, prev, r = 100) => G.wedge(Math.sin((deg * Math.PI) / 180) * r, -Math.cos((deg * Math.PI) / 180) * r, prev)
ok(wd(0) === 0 && wd(90) === 1 && wd(180) === 2 && wd(270) === 3 && G.wedge(5, 5, 2) === 2 && G.wedge(0, -13.9, null) === null && G.wedge(0, -14.1, null) === 0,
  'the compass: N E S W are wedges 0–3; inside the 14 px dead zone nothing changes')
ok(wd(49, 0) === 0 && wd(51, 0) === 1 && wd(41, 1) === 1 && wd(39, 1) === 0 && G.wedge(0, 0, null, { dead: 12 }) === null, 'hysteresis: a lit wedge holds until the pointer is 5° past the boundary, from either side')
const wd8 = (deg, prev) => G.wedge(Math.sin((deg * Math.PI) / 180) * 100, -Math.cos((deg * Math.PI) / 180) * 100, prev, { dead: 16, hyst: 8 })
ok(wd8(52, 0) === 0 && wd8(54, 0) === 1 && wd8(38, 1) === 1 && wd8(36, 1) === 0 && G.wedge(0, -15.9, null, { dead: 16, hyst: 8 }) === null && /DEAD = 16, HYST = 8/.test(dialJs) && /wedge\(st\.px - st\.x, st\.py - st\.y, st\.lit, \{ dead: DEAD, hyst: HYST \}\)/.test(dialJs),
  'the dial: four notches N E S W, a 16 px dead zone, 8° of hysteresis either side')
ok(/q\.get\('dial'\) === '1'/.test(nightJs) && /D\.mount = \(\{ on = false \}/.test(dialJs) && /help: \(\) =>[\s\S]*?b\('dial'/.test(deckJs) && !/'dial'/.test(cellsFn) && /'contextmenu'/.test(dialJs) && /e\.button === 2/.test(dialJs) && /PRESS = 450/.test(dialJs) && /HOLD = \d+/.test(dialJs) && /\^\[1-4\]\$/.test(dialJs) && /commit\(st\.lit\)/.test(dialJs) && /NIGHT\.home\.go\(id\)/.test(dialJs),
  'the dial is off by default: ?dial=1, or its toggle inside ? (never the deck); hold space, right-click or a 450 ms long-press summon it; 1–4 commit; letting go commits the lit notch (none: cancel); a commit only opens a category')
// the living tiles: four vignettes, pure, plain ASCII, one size, looping, calm
console.log('10. the living tiles')
const VGN = NIGHT.vignette, wlines = W_(secs).entries.slice(0, 4).map((e) => e.title)
for (const k of ['work', 'experiments', 'research', 'writing']) {
  const fr = Array.from({ length: 60 }, (_, f) => VGN.frame(k, f, wlines)), per = VGN.period(k, wlines)
  const shape = fr.every((x) => x.split('\n').length === VGN.H && x.split('\n').every((l) => l.length === VGN.W)) && fr.every((x) => /^[\x20-\x7e\n]*$/.test(x))
  const moves = new Set(fr).size > 3, loops = !per || VGN.frame(k, 0, wlines) === VGN.frame(k, per, wlines)
  const diff = (a, b) => [...a].filter((c, i) => c !== b[i]).length / a.length
  const ds = fr.slice(1).map((x, i) => diff(x, fr[i])).sort((a, b) => a - b), med = ds[ds.length >> 1]
  const calm = ds[ds.length - 1] <= 0.35 && med <= 0.25 && fr.every((x) => x.replace(/\s/g, '').length >= 12)
  ok(shape && moves && loops && calm, `${k}: ${VGN.W}×${VGN.H} plain ASCII in every frame, ${new Set(fr).size} distinct frames${per ? `, loops every ${per}` : ''}, a frame changes ${Math.round(med * 100)}% of cells typically, ${Math.round(ds[ds.length - 1] * 100)}% at most (≤ 25% typical, ≤ 35% max), never empty`)
}
const vgJs = code(text['vignette.js'])
ok(/IntersectionObserver/.test(vgJs) && /document\.hidden/.test(vgJs) && /reduced\(\)/.test(vgJs) && /REST: 700, AWAKE: 110/.test(vgJs) && /live && !document\.hidden && !reduced\(\)/.test(vgJs) && /attachVignettes/.test(home) && /h\.wake\(on\)/.test(home),
  'one runner: a frame every 700 ms at rest, 110 ms awake (hover or focus); paused off screen, in a hidden tab, outside the Lab and under reduced motion (first frame, still)')
ok(/tile__d, \.tile__peek \{ grid-area: 1 \/ 1;/.test(css) && /\.tile\.is-awake \.tile__peek \{ opacity: 1; \}/.test(css) && secs.every((s) => s.entries.every((e) => /class="dl__g" data-g="(live|spin|done|shelf|out|post|plan)"/.test(M.rowHtml(e, s.id)))),
  'a woken tile peeks its latest items in place of its line (same box: nothing moves); every row carries a status glyph, ◐ the one that turns')
const ser0 = secs.find((s) => s.id === 'research').entries[0]
ok(new RegExp(`${ser0.written} of ~${ser0.planned}`).test(M.rowHtml(ser0, 'research')), `a series shows ${ser0.written} of ~${ser0.planned} on its row`)

// the series
const ser = NIGHT.series[0], hub = M.build(LAB.pieces).find((x) => x.id === 'research').entries[0]
ok(ser.placeholder && ser.chapters.length === 3 && ser.planned === 6 && ser.next.length === 3 && hub.written === 3 && /3 of ~6 ▓▓▓░░░/.test(M.rowHtml(hub, 'research')),
  `the reliability study: 3 written chapters and 3 planned slots, "3 of ~6 ▓▓▓░░░"; ~${hub.mins} min read, ${G.clock(hub.listen)} listen`)
ok(/SAMPLE CONTENT: PLACEHOLDER/.test(text['series.js']) && /R\.hub = [\s\S]*?\$\{sample\(\)\}/.test(readerJs) && /\(ser \? sample\(\) \+ banner\(/.test(readerJs) && C.series.sample === 'sample content: placeholder',
  'every page of the study carries the "sample content: placeholder" banner: the hub and each chapter')
ok(/thread__prev/.test(readerJs) && /thread__up/.test(readerJs) && /thread__next/.test(readerJs) && /localStorage/.test(readerJs) && /try \{ localStorage\.setItem\(KEY/.test(readerJs), "each chapter has a thread banner (part n · ← · ↑ study · →); progress is this visitor's, in localStorage, in try/catch")
// narration: the sample, its timings, its words
const { sampleWords } = await import(join(here, 'render-sample.mjs'))
const N = NIGHT.narration, sw = sampleWords()
const mono = N.words.every((w, i) => w.s < w.e && (!i || w.s >= N.words[i - 1].e))
ok(same(N.words.map((w) => w.w), sw.words) && N.slug === 'old-laptop-cloud' && mono && Math.abs(N.peaks.length - N.dur * N.perSec) <= N.perSec,
  `the narrated section: "${N.title}", ${N.words.length} words, ${N.dur} s; the timings file's words are the essay's words, in order, each start < end, none overlapping`)
const audio = readFileSync(join(here, 'narration/sample-audio.js'), 'utf8'), b64 = /narrationWav = '([^']+)'/.exec(audio)[1], wav = Buffer.from(b64, 'base64')
ok(wav.toString('ascii', 0, 4) === 'RIFF' && wav.readUInt32LE(24) === N.sr && Math.abs((wav.length - 44) / N.sr - N.dur) < 0.01, `the sample WAV: ${N.sr} Hz, ${((wav.length - 44) / N.sr).toFixed(2)} s, matching the timings; rendered offline by SAM (render-sample.mjs)`)
ok(same(G.align(['“Why', 'not?”', 'I'], ['“Why', 'not?”', 'I']), [0, 1, 2]) && same(G.align(['ago,', '“Why', 'not?', '”', 'I'], ['ago,', '“Why', 'not?”', 'I']), [0, 1, 2, 2, 3]) &&
  same(G.align(['i5', '—', '8250U'], ['i5', '—', '8250U']), [0, 1, 2]) && same(G.align(['Lap', 'top', 'runs'], ['Laptop', 'runs']), [0, 0, 1]),
  'the page\'s words line up with the spoken ones even where markup splits a word')
ok(G.wordAt(N.words, 0) === -1 && G.wordAt(N.words, N.words[5].s + 0.01) === 5 && G.wordAt(N.words, N.dur) === N.words.length - 1, 'wordAt: nothing lit before the first word; the word whose start has passed is lit')
// the voices
const SamJs = (await import(join(here, 'sam.js'))).default
const live = G.samWords(SamJs, ['hello', 'lab.'])
ok(same(['ai', 'me', 'synth', 'sam'], (voiceJs.match(/const IDS = (\[[^\]]+\])/) || [])[1] && JSON.parse((voiceJs.match(/const IDS = (\[[^\]]+\])/))[1].replace(/'/g, '"'))) && /id === 'me' \? 'soon'/.test(voiceJs) && live.words.length === 2 && live.samples.length > live.sr * 0.3,
  `voices ai · me · synth · sam; me is "soon"; SAM renders live (2 words, ${live.dur} s)`)
ok(files.every((f) => !/api\.elevenlabs|xi-api-key|elevenlabs\.io/i.test(text[f])) && /speechSynthesis/.test(voiceJs) && /Chirp/.test(text['voice.js']), 'no ElevenLabs anywhere; ai is speechSynthesis for now, with the free-tier plan (Chirp) noted')
ok(['tape', 'pitch', 'robot', 'mono', 'crush'].every((k) => new RegExp(`${k}:`).test(voiceJs)) && /createDelay[\s\S]*sawtooth/.test(voiceJs) && /rOsc\.connect\(ring\.gain\)/.test(voiceJs) && /for \(let k = 0; k < 12; k\+\+\)/.test(voiceJs) && /crush\.curve/.test(voiceJs),
  'synth: Tier 1 on the pre-rendered file: tape, pitch (dual delay), robot (ring mod), monotone (12-band vocoder), crush (bits), all knobs')
// nothing autoplays; one mute
// the ask hero plays only inside H.ask, and H.ask is reached only from a press (its buttons) or the / command line
const askFn = (code(home).match(/H\.ask = \(id\) => \{[\s\S]*?\n  \}/) || [''])[0]
const plays = ['night.js', 'home.js', 'reader.js', 'dial.js', 'toy.js'].filter((f) => /voice\(\)\.play|voice\.play|V\(\)\.play\(|\.toggle\(\)/.test(code(text[f]).replace(askFn, '').replace(/NIGHT\.toggle\(\)|sound\.toggle\(\)/g, '')))
ok(/V\(\)\.play\(\)/.test(askFn) && (code(home).match(/H\.ask\(/g) || []).length === 1 && /if \(q\) return H\.ask\(q\.dataset\.ask\)/.test(code(home)) && (deckJs.match(/home\.ask\(/g) || []).length === 1,
  'the ask hero plays its answer only on a press: H.ask is called from its own buttons and from the / command line, nowhere else')
ok(!plays.length && /S\.muted = true|muted: true/.test(soundJs) && files.filter((f) => /\.muted\s*=[^=]/.test(code(text[f]))).join() === 'sound.js' && files.filter((f) => /sound\.(setMuted|toggle)\(/.test(code(text[f]))).join() === 'deck.js',
  `nothing autoplays: no page script plays narration on its own${plays.length ? ' — ' + plays.join(', ') : ''}; sound is muted on arrival, and the mute has one owner (sound.js) and one switch (the deck)`)
ok(/S\(\)\.duck\(true\)/.test(voiceJs) && /ducked\) return false/.test(soundJs) && same(['key', 'cursor', 'enter', 'chirp-open', 'chirp-close', 'select', 'boot'], Object.keys(eval('(' + (text['sound.js'].match(/const CUES = (\{[\s\S]*?\n  \})/) || [, '{}'])[1] + ')'))),
  'the terminal cue patch: key, cursor, enter, chirp-open/close, select, boot; narration ducks them and silences key / cursor')
// the ask prompts
ok(C.ask.prompts.map((p) => p.q).join('|') === 'what am i working on?|tell me something interesting|tell me a joke' && /^sample/.test(C.ask.now.mark) && [C.ask.interesting, C.ask.joke].every((a) => a.length >= 2 && a.length <= 3) && C.ask.authored === 'Aahil writes these',
  '?ask: three prompts; "working on" is a marked sample, the other two 2–3 answers each, marked "Aahil writes these"')
const seen = []; let sq = []; for (let i = 0; i < 9; i++) { const r = G.pick([0, 1, 2], sq, () => (i * 0.37) % 1); seen.push(r.i); sq = r.seen }
ok(new Set(seen.slice(0, 3)).size === 3 && new Set(seen.slice(3, 6)).size === 3, 'an answer never repeats until the pool is used up')
ok(G.commands([{ cmd: 'open holt', label: 'Holt' }, { cmd: 'pal green', label: 'green' }, { cmd: 'voice synth', label: 'x' }], 'pa')[0].cmd === 'pal green' && G.commands([{ cmd: 'open holt', label: 'Holt' }], 'zz').length === 0 && G.wave([0, 0.5, 1], 20, 0, 5).length === 5 && G.wave(null, 20, 0, 12) === '▁'.repeat(12),
  '/ commands match by prefix first; the waveform is always exactly its width')

console.log(fails ? `\n${fails} check(s) failed` : '\nthe Lab: all checks pass')
process.exit(fails ? 1 : 0)
