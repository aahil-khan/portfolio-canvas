// prototype/lab/night-mode/check.mjs: what the Lab claims, checked without a browser.
//
//   node prototype/lab/night-mode/check.mjs
//
// Loads the shared kit's content (pieces.js, body.js) and this mockup's pure parts (work.js,
// decode.js, shelves.js, moon.js) in Node and checks, on the real pieces:
//   1. what is in the Lab: three panes, the serious work only; the fun stuff in none of them;
//      work.js agrees with content/data/projects.json field for field; actions only where data is
//   2. the 20th piece: one entry in the right pane, every other entry and pane byte-identical
//   3. placement comes from code, never content
//   4. the decode: blank at 0, exact at 1, never changes a string's length or its spaces
//   5. the moon
//   6. the palettes: every text token ≥ 4.5:1 on every surface it sits on, frames ≥ 3:1, per palette
//   7. the files: the day desk is untouched (every painting rule in night.css is scoped to the
//      night), no backdrop-filter, no lorem, no CDN script, no world transform but DESK.flyTo
// Exits 1 if anything fails.
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
globalThis.window = globalThis
for (const f of ['../shared/pieces.js', '../shared/body.js', 'work.js', 'decode.js', 'shelves.js', 'moon.js']) require(join(here, f))
const { LAB, NIGHT } = globalThis
const S = NIGHT.shelves

let fails = 0
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++ }
const slugsIn = (html) => [...html.matchAll(/data-entry="([^"]+)"/g)].map((m) => m[1])
const render = (pieces) => Object.fromEntries(S.model(pieces).map((s) => [s.id, S.bodyHtml(s)]))
const piece = (slug) => LAB.pieces.find((p) => p.slug === slug)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

console.log('1. what is in the Lab')
const model = S.model(LAB.pieces), html = render(LAB.pieces)
ok(same(model.map((s) => s.id), ['work', 'experiments', 'writing']), `three panes, in order: ${model.map((s) => '~/lab/' + s.id).join(' · ')}`)
const ids = (id) => slugsIn(html[id])
ok(same(ids('work').slice().sort(), ['flowsync', 'holt', 'konta', 'portana', 'sop-opera', 'this-site']), `work: the six projects (${ids('work').join(', ')})`)
ok(same(ids('experiments').slice().sort(), ['chinese-watch', 'cursor-search-providor', 'usb-camera']), `experiments: Cursor Search Provider, the Chinese watch, the laptop webcam`)
const posts = LAB.pieces.filter((p) => p.kind === 'essay' || (p.kind === 'write-up' && p.body)).map((p) => p.slug).sort()
ok(same(ids('writing').slice().sort(), posts) && ids('writing').length === 8, `writing: the 2 essays and the 6 write-ups (${ids('writing').length} posts)`)
const fun = LAB.pieces.filter((p) => ['scrap', 'found', 'game'].includes(p.kind)).map((p) => p.slug)
ok(fun.length === 8 && fun.every((s) => !Object.values(html).some((h) => slugsIn(h).includes(s))), `the fun stuff stays on the desk: none of ${fun.join(', ')} is in any pane`)
ok(Object.values(html).every((h) => new Set(slugsIn(h)).size === slugsIn(h).length), 'no entry twice in one pane')
ok(!/Notes & write-ups|Playground|shelf-group|desk-row/.test(Object.values(html).join('')), 'no Notes & write-ups / Playground shelves, no desk-row lists')
// work.js is a transcription: it must agree with content/data/projects.json, field for field
const projects = JSON.parse(readFileSync(join(here, '../../../content/data/projects.json'), 'utf8'))
const list = Array.isArray(projects) ? projects : projects.projects || Object.values(projects)[0]
const drift = Object.entries(NIGHT.facts).filter(([slug, f]) => {
  const p = list.find((x) => x.slug === slug)
  return !p || p.kind !== f.kind || !same(p.stack, f.stack) || (p.award || undefined) !== f.award || !same(p.links, f.links)
})
ok(!drift.length && Object.keys(NIGHT.facts).length === 4, `work.js matches projects.json for ${Object.keys(NIGHT.facts).join(', ')}${drift.length ? ' (drift: ' + drift.map((d) => d[0]).join(', ') + ')' : ''}`)
const work = model[0].entries
ok(work.every((e) => e.read === !!piece(e.slug).body), '[read] on exactly the projects with a body')
ok(work.every((e) => same(e.links.map((l) => l.href), ((NIGHT.facts[e.slug] || {}).links || []).map((l) => l.href))), '[repo] / [live] only where projects.json has the link (none invented for Portana or This site)')
ok(/data-read="sop-opera"[^>]*>read</.test(html.work) && /href="https:\/\/github.com\/aahil-khan\/SOP-Opera"[^>]*>repo</.test(html.work), 'SOP Opera reads [read] [live] [repo]')
const exps = model[1].entries
ok(same(exps.map((e) => e.n), ['exp-02', 'exp-03', 'exp-01']) && exps.every((e) => /^exp-\d\d$/.test(e.n) && e.when && e.topic && e.title), `lab log: ${exps.map((e) => `${e.n} · ${e.when} · ${e.topic}`).join(' | ')}`)
const wr = model[2].entries
ok(wr.filter((e) => !e.href).every((e) => e.mins === S.minutes(piece(e.slug).body) && e.mins >= 1), 'reading time from the body\'s word count, on every post with a body')
ok(wr.filter((e) => e.href).map((e) => e.slug).sort().join() === 'chrome-hackathon,old-laptop-cloud', 'the two essays (no body) link out to Medium instead')
ok(S.minutes('word '.repeat(660)) === 3 && S.minutes('a') === 1, 'minutes(): 220 words a minute, at least one')
ok(same(S.posts(LAB.pieces).map((e) => e.slug), wr.filter((e) => !e.href).map((e) => e.slug)), 'the reader\'s prev / next run in the writing pane\'s order')

console.log('2. the 20th piece')
const extras = {
  'the brief\'s (an experiment)': [{ slug: 'test-piece', title: 'Test piece', shelf: 'playground', kind: 'experiment', date: '2099-01' }, ['experiments']],
  'an essay': [{ slug: 'test-essay', title: 'Test essay', shelf: 'notes', kind: 'essay', date: '2099-01', href: 'https://example.com/x' }, ['writing']],
  'a write-up with a body (a project and its post)': [{ slug: 'test-wu', title: 'Test write-up', shelf: 'notes', kind: 'write-up', date: '2099-01', body: 'One line.' }, ['work', 'writing']],
  'a scrap (stays on the desk)': [{ slug: 'test-scrap', title: 'Test scrap', shelf: 'playground', kind: 'scrap', date: '2099-01' }, []],
}
const entriesOf = (h) => Object.fromEntries([...h.matchAll(/<(article|button|a) [^>]*class="(?:spec|log|post)"[^>]*data-entry="([^"]+)"[\s\S]*?<\/\1>/g)].map((m) => [m[2], m[0]]))
for (const [what, [p, panes]] of Object.entries(extras)) {
  const after = render([...LAB.pieces.map((x) => ({ ...x })), p])
  const okPanes = model.every((s) => {
    const a = entriesOf(after[s.id]), b = entriesOf(html[s.id])
    const added = Object.keys(a).filter((k) => !b[k])
    const kept = Object.keys(b).every((k) => a[k] === b[k])
    return panes.includes(s.id) ? added.length === 1 && added[0] === p.slug && kept : after[s.id] === html[s.id]
  })
  ok(okPanes, `+ ${what}: ${panes.length ? panes.map((x) => '+1 in ~/lab/' + x).join(', ') : 'no pane changes'}; every other entry identical, the other panes untouched`)
}
const at = { x: 140, y: -60 }
ok(same(S.place(at, { phone: false }), (() => { LAB.pieces.push(extras['the brief\'s (an experiment)'][0]); const r = S.place(at, { phone: false }); LAB.pieces.pop(); return r })()), 'the panes\' spots do not move when a piece is added (placement never reads content)')
ok(same(S.model([...LAB.pieces, extras['the brief\'s (an experiment)'][0]])[1].entries[0].n, 'exp-04'), 'a new experiment is exp-04; no older number moves')

console.log('3. placement comes from code')
const desk = S.place(at, { phone: false }), phone = S.place(at, { phone: true, width: 390 })
const xs = S.SECTIONS.map((s) => desk[s.id]), x0 = xs[0].x, x1 = xs[2].x + xs[2].w
ok(Math.abs((x0 + x1) / 2 - at.x) <= 1 && xs[0].x + xs[0].w < xs[1].x && xs[1].x + xs[1].w < xs[2].x && xs.every((r) => r.y === xs[0].y), `desktop: three side by side, centred on the night view (${xs.map((r) => r.x).join(', ')})`)
ok(S.SECTIONS.every((s) => same(phone[s.id], phone.work)) && phone.work.w === 366, 'phone: one spot for all three (one shows at a time), full width less 12px gutters')
const fit = S.fit([{ x: x0, y: -320, w: x1 - x0, h: 640 }], { vw: 1440, vh: 900, top: 88, bottom: 124, side: 40 })
ok(fit.s === 1, `the desktop fit holds all three 640px panes at 100% on 1440×900 (${x1 - x0}px wide, s ${fit.s})`)
ok(!/\b[xy]\s*:\s*-?\d/.test(readFileSync(join(here, '../shared/pieces.js'), 'utf8')), 'pieces.js holds no coordinates')

console.log('4. the decode')
const D = NIGHT.decode
const texts = [...Object.values(html).join('').matchAll(/>([^<>]+)</g)].map((m) => m[1].replace(/&[a-z]+;|&#\d+;/g, '?')).filter((t) => /\S/.test(t))
const steps = [0, 0.05, 0.2, 0.37, 0.5, 0.73, 0.9, 0.999, 1]
ok(texts.length > 80 && texts.every((t) => steps.every((p) => { const v = D(t, p, 3); return v.length === t.length && [...t].every((c, i) => (c === ' ') === (v[i] === ' ')) })), `length and spaces never change, at any p (${texts.length} pane strings × ${steps.length} steps), so nothing reflows in a mono face`)
ok(texts.every((t) => D(t, 1, 9) === t) && texts.every((t) => !/\S/.test(D(t, 0, 9).replace(/\u00a0/g, ''))), 'p = 1 is the text exactly; p = 0 is blank')
ok(D('SOP Opera', 0.4, 5) === D('SOP Opera', 0.4, 5) && D('SOP Opera', 0.4, 5) !== D('SOP Opera', 0.4, 6), 'pure of (p, seed): the same frame every time, so ?freeze= holds')
ok(['[~]', '[≡]', '{¶}', '[gh]'].every((g) => !/["\\]/.test(D(g, 0.5, 1))), 'scrambled dock glyphs never hold a quote or backslash (they go into a CSS string)')

console.log('5. the moon')
const ph = NIGHT.moonPhase(new Date(Date.UTC(2026, 10, 20)))
ok(ph >= 0 && ph < 1, `phase on 2026-11-20 is ${ph.toFixed(3)}`)
ok(Math.abs(NIGHT.moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)))) < 1e-9, 'the reference new moon is phase 0')
const full = NIGHT.moonBits(64, 0.5), dark = NIGHT.moonBits(64, 0), again = NIGHT.moonBits(64, 0.5)
const lit = (bits) => bits.reduce((n, v) => n + v, 0)
ok(lit(full) > 64 * 64 * 0.45 && lit(dark) < lit(full) / 6, `full moon lights ${lit(full)} px, new moon ${lit(dark)} (earthshine only)`)
ok(full.every((v, i) => v === again[i]), 'the dither is deterministic')

console.log('6. the palettes')
const css = readFileSync(join(here, 'night.css'), 'utf8')
const hex = (v) => { const m = /^#([0-9a-f]{6})$/i.exec(v.trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null }
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
// color-mix(in srgb, A k%, B): a straight mix of the encoded channels, as night.css writes them
const mix = (a, k, b) => a.map((v, i) => Math.round(v * k + b[i] * (1 - k)))
const palettes = {}
for (const m of css.matchAll(/html\[data-palette='(\w+)'\]\s*\{([^}]*)\}/g)) palettes[m[1]] = Object.fromEntries([...m[2].matchAll(/--lab-([\w-]+):\s*([^;]+);/g)].map((x) => [x[1], hex(x[2])]).filter((x) => x[1]))
ok(same(Object.keys(palettes), ['white', 'green', 'amber']), `three palettes in night.css: ${Object.keys(palettes).join(', ')}`)
const TOKENS = ['bg', 'pane', 'fg', 'dim', 'faint', 'work', 'experiments', 'writing', 'hi']
for (const [name, P] of Object.entries(palettes)) {
  const missing = TOKENS.filter((t) => !P[t])
  const pairs = [] // [what, text, surface, min]
  const SECT = ['work', 'experiments', 'writing']
  for (const t of ['fg', 'dim', ...SECT]) for (const s of ['bg', 'pane']) pairs.push([`${t} on ${s}`, P[t], P[s], 4.5])
  for (const c of SECT) for (const t of ['fg', 'dim', c]) pairs.push([`${t} on a hovered ${c} row`, P[t], mix(P[c], 0.14, P.pane), 4.5])
  for (const t of ['fg', 'dim', 'writing']) pairs.push([`${t} on a hovered prev/next`, P[t], mix(P.writing, 0.14, P.bg), 4.5])
  pairs.push(['fg on a hovered dock tile', P.fg, mix(P.fg, 0.14, P.pane), 4.5])
  for (const c of ['fg', ...SECT]) pairs.push([`bg on ${c} (inverse: cursor, selected tab, hovered action)`, P.bg, P[c], 4.5])
  for (const c of ['fg', ...SECT]) pairs.push([`${c} frame on the sky`, P[c], P.bg, 3])
  const low = missing.length ? [] : pairs.map(([w, a, b, min]) => [w, ratio(a, b), min]).filter(([, r, min]) => r < min)
  const worst = missing.length ? 0 : Math.min(...pairs.filter((p) => p[3] === 4.5).map(([, a, b]) => ratio(a, b)))
  ok(!missing.length && !low.length, `${name}: ${pairs.length} pairs, lowest text pair ${worst.toFixed(2)}:1${missing.length ? ' (missing ' + missing.join(', ') + ')' : ''}${low.length ? ' (' + low.map(([w, r]) => `${w} ${r.toFixed(2)}`).join('; ') + ')' : ''}`)
}

console.log('7. the files')
const files = readdirSync(here).filter((f) => /\.(html|css|js|mjs)$/.test(f) && f !== 'check.mjs')
const text = Object.fromEntries(files.map((f) => [f, readFileSync(join(here, f), 'utf8')]))
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '')
// The day desk is untouched: a rule in night.css either only sets custom properties (which paint
// nothing), or every selector in it is scoped to the night or to something that exists only then.
const NIGHT_ONLY = /html\.(has-night|is-night|is-turning)|^\.(night|shelves|shelf|pane|cut|lead|is-new|act|spec|log|post|nightbar|nb-|palsw|tw|nwin|reader|rd__|proof)|^\[data-|^html\[data-palette|^html:not\(\[data-palette\]\)|^:root$|^\.desk-dock__item\[(data-id|aria-label)=[^\]]+\] \.desk-dock__icon$/
const rules = [...code(css).replace(/'[^'\n]*'/g, "''").replace(/@import[^;]+;/g, '').replace(/@media[^{]+\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]])
const leaky = rules.filter(([sel, body]) => {
  const props = [...body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1])
  if (props.length && props.every((p) => p.startsWith('--'))) return false
  return sel.split(',').map((s) => s.trim()).some((s) => !NIGHT_ONLY.test(s))
})
ok(rules.length > 150 && !leaky.length, `night.css: all ${rules.length} rules paint only at night (or set custom properties)${leaky.length ? ' — LEAKS: ' + leaky.map((r) => r[0]).join(' | ') : ''}`)
ok(files.every((f) => !/backdrop-filter/i.test(code(text[f]))), 'no backdrop-filter in any rule or script')
ok(files.every((f) => !/lorem|ipsum/i.test(text[f])), 'no lorem ipsum')
const scripts = [...text['index.html'].matchAll(/<script[^>]*src="([^"]+)"/g)].map((x) => x[1])
ok(scripts.every((s) => !/^https?:|^\/\//.test(s)), `no script from a CDN (${scripts.length} local scripts)`)
ok(['../shared/pieces.js', '../shared/desk.js', '../shared/sky.js', '../shared/body.js', 'work.js', 'decode.js', 'shelves.js', 'reader.js'].every((s) => scripts.includes(s)), 'built on the shared kit (pieces, desk, sky, body) plus this folder\'s parts')
ok(!/style\.transform\s*=/.test(code(text['night.js']).replace(/el\.blind\.style\.transform|d\.l\.style\.transform/g, '')), 'night.js writes no world transform of its own (the camera goes through DESK.flyTo)')
ok(/'pane shelf'/.test(text['shelves.js']) && /class="spec"/.test(text['shelves.js']) && /class="log"/.test(text['shelves.js']) && /class="post"/.test(text['shelves.js']) && !/desk-card|desk-row/.test(code(text['shelves.js'])), 'the panes are Lab-native (spec / log / post), not desk cards or desk-rows')
ok(!/desk-card/.test(code(text['windows.js'])) && /'tw nwin'/.test(text['windows.js']), 'windows are terminal windows, not desk cards')
ok(!/arcade/i.test(code(text['windows.js']) + code(text['night.js'])), 'no Arcade in the Lab: its tile goes back to the desk')
ok(/#\/writing\//.test(text['reader.js']) && /history\.back\(\)/.test(text['reader.js']) && /hashchange/.test(text['reader.js']), 'posts deep-link as #/writing/<slug>, and Back closes them')

console.log(fails ? `\n${fails} check(s) failed` : '\nthe Lab: all checks pass')
process.exit(fails ? 1 : 0)
