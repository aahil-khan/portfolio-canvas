// prototype/lab/notebook/check.mjs: what the notebook claims, checked without a browser.
//
//   node prototype/lab/notebook/check.mjs
//
// Loads the pure parts (copy.js, md.js, model.js, graph.js, vault.js, study.js, essay.js,
// graph-seed.js, logic.js) in Node and checks, on the real vault:
//   1. the vault: vault.js is current, every link resolves, names and numbers, fields, 71 notes,
//      and the visibility switch
//   2. verbatim: the seven spec notes are the spec's own lines (SKIP if the source is absent)
//   3. the study: the allowlist, Aahil's 2026-11-21 calls, the private-term scan, the numbers
//   4. the graph: deterministic, in bounds, no overlaps, warm relayout, the local graph
//   5. walkthroughs: steps, totals, the listen clock
//   6. the renderer: tables, fences, embeds, anchors, auto-links, broken links, escaping
//   7. the palettes: text ≥ 4.5:1 on every surface, selection and hover included; frames ≥ 3:1
//   8. the switcher's matcher
//   9. the files: CSS scope, no backdrop-filter, no lorem, no CDN, every UI word in copy.js, the
//      dropped modules gone, only this folder changed
// Exits 1 if anything fails.
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { execFileSync } from 'node:child_process'
import * as vaultTool from './tools/build-vault.mjs'
import * as tracker from './tools/import-tracker.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
for (const f of ['copy.js', 'md.js', 'model.js', 'graph.js', 'vault.js', 'study.js', 'essay.js', 'graph-seed.js', 'logic.js']) require(join(here, f))
const { NB, NIGHT } = globalThis
const C = NB.copy, MD = NB.md, G = NB.graph

let fails = 0
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++ }
const skip = (msg) => console.log('  SKIP ' + msg)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const build = (o = {}) => NB.model.build({ files: NB.vaultFiles, study: NB.study, essays: NIGHT.imports, copy: C, ...o })
const V = build()
const at = (r) => V.get(r)
const graphInput = (v) => ({ nodes: v.notes.map((n) => ({ key: n.route, section: n.section, type: n.type })), edges: v.edges.map((e) => ({ a: e.a.route, b: e.b.route, kind: e.kind })) })

// ── 1 ───────────────────────────────────────────────────────────────────────────────────────
console.log('1. the vault')
ok(readFileSync(join(here, 'vault.js'), 'utf8') === vaultTool.render(), 'vault.js is byte-identical to a fresh build-vault run')
ok(!V.problems.length, `the validator finds nothing (dangling links, anchors, names, numbers, fields, embeds)${V.problems.length ? ': ' + V.problems.join(' | ') : ''}`)
const files = Object.keys(NB.vaultFiles)
ok(files.every((f) => NB.model.FILE.test(f.split('/').pop())), `all ${files.length} filenames match NN-slug, T00, PW0 or W0-slug`)
const keys = V.all.flatMap((n) => [n.id, ...n.aliases].filter(Boolean))
ok(new Set(keys).size === keys.length && new Set(V.all.map((n) => n.route)).size === V.all.length, 'IDs, aliases and routes are unique')
const numClash = V.all.filter((n) => !n.isHub && V.all.some((o) => o !== n && !o.isHub && o.folder === n.folder && o.num === n.num))
ok(!numClash.length, 'every number appears once per folder; 00 is only ever a hub')
const counts = { root: 1, arHub: 1, shop: V.all.filter((n) => n.folder === 'agent-reliability/shopkeeper').length, study: V.all.filter((n) => n.folder.startsWith('agent-reliability/study')).length, builds: V.all.filter((n) => n.folder === 'builds').length, writing: V.all.filter((n) => n.folder === 'writing').length, tours: V.tours.length }
ok(V.notes.length === 71 && counts.shop === 13 && counts.study === 46 && counts.builds === 5 && counts.writing === 3 && counts.tours === 2,
  `71 notes: 1 + 1 + ${counts.shop} shopkeeper + ${counts.study} study (hub, log, ${NB.study.topics.length} topics, PW6) + ${counts.builds} + ${counts.writing} + ${counts.tours}`)
const reqMiss = V.all.flatMap((n) => [...NB.model.REQUIRED.all, ...NB.model.REQUIRED[n.type]].filter((k) => n.fm[k] === undefined).map((k) => `${n.route}.${k}`))
ok(!reqMiss.length, `each type has its required fields${reqMiss.length ? ': ' + reqMiss.join(', ') : ''}`)
ok(V.all.filter((n) => n.type === 'post').every((n) => n.fm.entry), 'every post sets entry (a note, or none)')
ok(V.all.every((n) => ['public', 'hidden'].includes(n.fm.visibility)) && V.all.every((n) => n.visibility === 'public'), 'every note carries visibility (public | hidden); all public today')
{
  // the visibility switch: hide T02 and see it leave everything
  const f2 = { ...NB.vaultFiles }
  const study2 = { ...NB.study, topics: NB.study.topics.map((t) => (t.id === 'T02' ? { ...t, visibility: 'hidden' } : t)) }
  const h = NB.model.build({ files: f2, study: study2, essays: NIGHT.imports, copy: C })
  const holt = h.get('builds/02-holt')
  const html = MD.render(holt.blocks, { resolve: (t) => { const n = h.resolve(t); return n && { href: h.href(n), id: n.id, title: n.title } } }).html
  const treeIds = (f) => [...(f.hub ? [f.hub.id] : []), ...f.notes.map((n) => n.id), ...f.folders.flatMap(treeIds)]
  const inTree = treeIds(h.tree).includes('T02') || h.tours.some((w) => w.steps.some((s) => s.id === 'T02'))
  ok(!h.notes.some((n) => n.id === 'T02') && !h.edges.some((e) => e.a.id === 'T02' || e.b.id === 'T02') && !h.match('T02').some((n) => n.id === 'T02') && !h.back(holt).concat(h.out(holt)).some((l) => l.note.id === 'T02') && !inTree && !/href="#\/[^"]*T02"/.test(html),
    'a hidden note leaves the tree, the graph, the switcher and the links; a link to it reads as text')
  const shown = NB.model.build({ files: f2, study: study2, essays: NIGHT.imports, copy: C, hidden: true })
  ok(shown.notes.some((n) => n.id === 'T02' && n.visibility === 'hidden'), '?hidden=1 shows it again, marked hidden')
}
ok(at('') && at('') === V.resolve('index') && V.resolve('T02') === at('agent-reliability/study/evals/T02') && V.resolve('PW1') === at('agent-reliability/shopkeeper/PW1') && V.resolve('W1') === at('walkthroughs/W1-shopkeeper-so-far'),
  'short links: T02, PW1 and W1 resolve to their full paths; no hash is start-here')
ok(V.resolve('shopkeeper/policy') === at('agent-reliability/shopkeeper/02-policy') && V.resolve('spec') === at('agent-reliability/shopkeeper/01-spec') && V.resolve('datesheet') === at('builds/03-datesheet-generator'),
  'a slug path resolves without its number (shopkeeper/policy), and so does an alias (datesheet)')

// ── 2 ───────────────────────────────────────────────────────────────────────────────────────
console.log('2. verbatim')
const SPEC = join(homedir(), 'projects/scratch/lab-sources/shopkeeper-spec-v1.md')
const specNotes = V.all.filter((n) => n.type === 'doc')
if (!existsSync(SPEC)) skip(`the spec is not on this machine (${SPEC})`)
else {
  const src = readFileSync(SPEC, 'utf8')
  const srcLines = new Set(src.split('\n').map((l) => l.trimEnd()))
  const stripLinks = (l) => l.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
  const bad = []
  let lines = 0
  for (const n of specNotes) {
    let inFence = false
    for (const l of n.body.split('\n')) {
      if (/^```/.test(l)) { inFence = !inFence; continue }
      if (inFence || !l.trim()) continue
      lines++
      if (!srcLines.has(stripLinks(l).trimEnd())) bad.push(`${n.slug}: ${l.slice(0, 60)}`)
    }
  }
  ok(specNotes.length === 7 && !bad.length, `every paragraph, list item and table row of the 7 spec notes (${lines} lines) is a line of the spec, link markup stripped${bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''}`)
  const heads = [...src.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
  const used = heads.map((h) => specNotes.filter((n) => n.blocks.some((b) => b.t === 'h' && b.level === 2 && b.text === h)).length)
  ok(heads.length === 13 && used.every((u) => u === 1), `all 13 of its ## sections are used exactly once (${heads.length})`)
}

// ── 3 ───────────────────────────────────────────────────────────────────────────────────────
console.log('3. the study')
const S = NB.study
const TOPIC_FIELDS = ['id', 'title', 'track', 'trackName', 'learn', 'phase', 'parked', 'status', 'est_h', 'spent_h', 'start', 'target', 'finished', 'resource', 'proof', 'notes', 'visibility']
ok(S.topics.every((t) => same(Object.keys(t), TOPIC_FIELDS)) && S.stages.every((s) => same(Object.keys(s), ['id', 'title', 'ship', 'topics', 'phase', 'target', 'status', 'link', 'visibility'])) && S.log.every((r) => same(Object.keys(r), ['date', 'id', 'h', 'did'])),
  'study.js holds only the allowlisted fields')
const ids = S.topics.map((t) => t.id)
ok(S.topics.length === 43 && !ids.some((i) => tracker.PRIVATE_IDS.includes(i)) && !JSON.stringify(S).includes('Phase 5') && !JSON.stringify(S).includes('Interview prep'), `43 topics; none of T43–T47; no "Phase 5", no Interview prep track`)
ok(['T21', 'T22', 'T39', 'T40', 'T41', 'T42'].every((i) => ids.includes(i)) && ['T21', 'T22', 'T41'].every((i) => S.topics.find((t) => t.id === i).phase === '') && S.phases.some((p) => p.name === 'Phase 4 · Hardening') && /HoneyHive/.test(S.topics.find((t) => t.id === 'T14').learn),
  "Aahil's calls (2026-11-21): the FDE track, T21 and T22 shown (Phase 5's topics with no phase), Phase 4 · Hardening, T14 as written")
const jobs = S.topics.filter((t) => tracker.JOB_POSTING.test(t.resource))
ok(!jobs.length && S.topics.find((t) => t.id === 'T12').resource === '' && S.topics.find((t) => t.id === 'T33').resource === '', 'no resource is a job posting (T12, T33 and the rest dropped)')
const scanStudy = [...tracker.strings(S)].flatMap(([w, s]) => tracker.scan(s, w))
const scanNotes = V.all.filter((n) => n.generated !== 'study').flatMap((n) => tracker.scan(n.body + ' ' + JSON.stringify(n.fm), n.route))
ok(!scanStudy.length && !scanNotes.length, `the private-term scan (${tracker.TERMS.length} terms; allowed: ${tracker.ALLOW.map((a) => a.where).join(', ')}) finds nothing in study.js or any note${scanStudy.concat(scanNotes).length ? ': ' + scanStudy.concat(scanNotes).join(', ') : ''}`)
const active = S.topics.filter((t) => !t.parked), p1 = S.topics.filter((t) => t.phase === 'Phase 1 · Evals core'), logged = S.log.reduce((a, r) => a + r.h, 0)
const nums = { active: active.length, done: active.filter((t) => t.status === 'done').length, p1: `${p1.filter((t) => t.status === 'done').length} of ${p1.length}`, h: logged }
ok(same(nums, { active: 35, done: 2, p1: '2 of 9', h: 4.5 }), `the numbers: ${nums.active} active, ${nums.done} done, Phase 1 ${nums.p1}, ${nums.h} h`)
ok(V.blockMd(at(''), 'studying-now').startsWith('**Phase 1 · Evals core** · 2 of 9 topics done · 4.5 h logged · last logged 2026-11-20'), 'start-here computes studying now from the tracker')
if (!existsSync(tracker.SOURCE)) skip('the tracker is not on this machine: study.js not re-imported')
else ok(readFileSync(join(here, 'study.js'), 'utf8') === tracker.render(tracker.importBook()), 'study.js matches a fresh import of the .xlsx')

// ── 4 ───────────────────────────────────────────────────────────────────────────────────────
console.log('4. the graph')
const gi = graphInput(V)
const L1 = G.layout(gi.nodes, gi.edges, { seed: NB.graphSeed }), L2 = G.layout(gi.nodes, gi.edges, { seed: NB.graphSeed })
ok(same(L1, L2) && same(G.layout(gi.nodes, gi.edges), G.layout(gi.nodes, gi.edges)), 'two runs are identical, warm and cold')
ok(gi.nodes.every((n) => { const [x, y] = L1.pos[n.key], r = G.R[n.type]; return x - r >= 0 && y - r >= 0 && x + r <= G.W && y + r <= G.H }), `every node is in bounds (${G.W}×${G.H})`)
let close = 0
for (let i = 0; i < gi.nodes.length; i++) for (let j = i + 1; j < gi.nodes.length; j++) { const a = L1.pos[gi.nodes[i].key], b = L1.pos[gi.nodes[j].key]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < G.R[gi.nodes[i].type] + G.R[gi.nodes[j].type]) close++ }
ok(!close, 'no two nodes are closer than the sum of their radii')
{
  const n2 = [...gi.nodes, { key: 'test/added', section: 'agent-reliability', type: 'doc' }], e2 = [...gi.edges, { a: 'test/added', b: 'agent-reliability/shopkeeper/01-spec', kind: 'link' }]
  const L3 = G.layout(n2, e2, { seed: NB.graphSeed })
  const mv = gi.nodes.map((n) => Math.hypot(L3.pos[n.key][0] - L1.pos[n.key][0], L3.pos[n.key][1] - L1.pos[n.key][1])).sort((a, b) => a - b)
  ok(mv[mv.length >> 1] < 4 && mv[mv.length - 1] < 24, `?add=1: the 72nd note relayouts warm; median move ${mv[mv.length >> 1].toFixed(2)} px (< 4), max ${mv[mv.length - 1].toFixed(2)} px (< 24)`)
}
{
  const spec = at('agent-reliability/shopkeeper/01-spec')
  const local = new Set(V.neighbours(spec, 1).map((x) => x.note.route))
  const lb = new Set([...V.out(spec), ...V.back(spec)].map((l) => l.note.route))
  ok(local.size > 0 && same([...local].sort(), [...lb].sort()), `01-spec's depth-1 local graph is its links ∪ its backlinks (${local.size})`)
  const d2 = V.neighbours(spec, 2)
  ok(d2.filter((x) => x.hop === 1).length === local.size && d2.some((x) => x.hop === 2), 'depth 2 adds the second hop, marked')
}
ok(V.edges.every((e) => ['link', 'typed', 'tour'].includes(e.kind)) && !V.edges.some((e) => e.a.isHub && e.b.folder.startsWith(e.a.route) && e.kind === 'folder'), 'edges are links, typed frontmatter links and tour steps; the folder tree is not an edge')

// ── 5 ───────────────────────────────────────────────────────────────────────────────────────
console.log('5. walkthroughs')
const [W1, W2] = V.tours
ok(W1.id === 'W1' && W1.steps.length === 9 && W2.id === 'W2' && W2.steps.length === 8, `W1 has 9 steps, W2 has 8, all resolving`)
for (const w of V.tours) {
  const t = V.totals(w), r = w.steps.reduce((a, s) => a + V.clock(s).read, 0), l = w.steps.reduce((a, s) => a + V.clock(s).listen, 0)
  ok(t.readExact === Math.round(r * 10) / 10 && t.listenExact === Math.round(l * 10) / 10 && t.read === Math.max(1, Math.round(r)), `${w.id}: totals are the sums of the steps' clocks (~${t.read} min read, ~${t.listen} min listen)`)
}
{
  const sc = at('agent-reliability/shopkeeper/05-scenarios'), c = V.clock(sc)
  const tables = sc.blocks.filter((b) => b.t === 'table').length
  const cells = sc.blocks.filter((b) => b.t === 'table').reduce((a, b) => a + b.rows.flat().join(' ').split(/\s+/).length, 0)
  const tableLine = C.say.table(10).split(/\s+/).length
  ok(c.spoken <= c.prose + tables * tableLine + 40 && c.spoken < c.prose + cells / 4, `the listen clock says one line per table, not its cells (05-scenarios: ${tables} tables, ${cells} cell words, ${c.spoken} spoken)`)
}

// ── 6 ───────────────────────────────────────────────────────────────────────────────────────
console.log('6. the renderer')
const ctxOf = (n) => ({ resolve: (t) => { const x = V.resolve(t); return x && { href: V.href(x), id: x.id, title: x.title } }, rowIds: V.rowIdsOf(n), row: (id) => V.rowHref(n, id) })
const rendered = (r) => { const n = at(r); return MD.render(n.blocks, ctxOf(n)).html }
const pol = rendered('agent-reliability/shopkeeper/02-policy'), sce = rendered('agent-reliability/shopkeeper/05-scenarios')
ok(/<table>/.test(pol) && /class="nb-table"/.test(sce), 'tables render, each in its own scrolling region')
const pIds = Array.from({ length: 13 }, (_, i) => `p${i + 1}`), sIds = [...Array.from({ length: 10 }, (_, i) => `a${i + 1}`), ...Array.from({ length: 13 }, (_, i) => `b${i + 1}`), ...Array.from({ length: 12 }, (_, i) => `c${i + 1}`)]
ok(pIds.every((id) => pol.includes(`<tr id="${id}">`)) && sIds.every((id) => sce.includes(`<tr id="${id}">`)), 'table rows P1–P13 and A1–C12 carry their IDs as anchors')
ok(/class="nb-wl nb-row" href="#\/agent-reliability\/shopkeeper\/02-policy\?a=p\d+"/.test(sce) || /nb-row" href="#\/agent-reliability\/shopkeeper\/02-policy/.test(rendered('agent-reliability/shopkeeper/03-blind-agent') + sce), 'a P or A–C mention in the Shopkeeper links to its row')
ok(/class="nb-wl nb-id" href="#\/agent-reliability\/study\/evals\/T02"/.test(rendered('builds/02-holt')) || /nb-id" href="#\/agent-reliability\/study\/evals\/T0/.test(rendered('agent-reliability/study/log')), 'ID mentions (T02) auto-link to their notes')
{
  const off = NB.model.build({ files: NB.vaultFiles, study: NB.study, essays: NIGHT.imports, copy: C, autolink: false })
  const lg = off.get('agent-reliability/study/log')
  ok(!/nb-id/.test(MD.render(lg.blocks, { resolve: () => ({ href: '#', id: 'x' }), autolink: false }).html) && off.out(lg).length === 0, '?autolink=0 leaves ID mentions as plain text, and they make no edges')
}
const kinds = new Set(V.all.flatMap((n) => n.blocks.filter((b) => b.t === 'fence').map((b) => b.kind)))
ok(MD.EMBEDS.every((k) => kinds.has(k)), `the 5 embed kinds are used in the vault: ${MD.EMBEDS.join(', ')}`)
const emb = MD.render(MD.parse('```clip src=x dur=42\nfig · clip · c\n```\n\n```terminal\n$ ls\n```\n\n```try margin-capture\nfig · try it · t\n```\n\n```chart study-hours\n```\n\n```diagram sale-confirmation\n```'), {}).html
ok(MD.EMBEDS.every((k) => emb.includes(`data-embed="${k}"`)) && (emb.match(/<figcaption class="nb-cap">fig \d · /g) || []).length === 5, 'each embed renders as a numbered figure with a mono caption')
const broken = MD.render(MD.parse('see [[nowhere]] and <script>alert(1)</script> & [x](javascript:alert(1))'), { resolve: () => null }).html
ok(/nb-wl is-broken/.test(broken) && broken.includes('&lt;script&gt;') && !/<script/.test(broken) && !/javascript:/.test(broken), 'an unresolved link renders as marked text; input is escaped; javascript: hrefs are refused')
ok(MD.latexText('\\text{margin capture} = \\frac{\\text{unit price} - \\text{floor}}{\\text{list} - \\text{floor}}') === 'margin capture = (unit price − floor) / (list − floor)', "the spec's formula renders as text")

// ── 7 ───────────────────────────────────────────────────────────────────────────────────────
console.log('7. the palettes')
const css = readFileSync(join(here, 'notebook.css'), 'utf8')
const hex = (v) => { const m = /^#([0-9a-f]{6})$/i.exec(String(v).trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null }
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const palettes = {}
for (const m of css.matchAll(/html\[data-palette='(\w+)'\][^{]*\{([^}]*)\}/g)) palettes[m[1]] = Object.fromEntries([...m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((x) => [x[1], hex(x[2])]).filter((x) => x[1]))
ok(same(Object.keys(palettes), ['white', 'green', 'amber']), `three palettes: ${Object.keys(palettes).join(', ')}`)
const TEXT = ['lab-fg', 'lab-dim', 'lab-ar', 'lab-builds', 'lab-writing', 'lab-neutral', 'lab-hi'], SURF = ['lab-bg', 'lab-pane', 'hov-bg']
for (const [name, P] of Object.entries(palettes)) {
  const missing = [...TEXT, ...SURF, 'sel-bg', 'sel-ink', 'lab-line', 'lab-faint'].filter((t) => !P[t])
  const pairs = []
  for (const t of TEXT) for (const s of SURF) pairs.push([`${t} on ${s}`, P[t], P[s], 4.5])
  pairs.push(['sel-ink on sel-bg (the selected row, the spoken word)', P['sel-ink'], P['sel-bg'], 4.5])
  pairs.push(['lab-bg on lab-hi (the focus ring\'s inverse)', P['lab-bg'], P['lab-hi'], 4.5])
  for (const t of ['lab-line', 'lab-ar', 'lab-builds', 'lab-writing', 'lab-neutral']) for (const s of ['lab-bg', 'lab-pane']) pairs.push([`${t} frame on ${s}`, P[t], P[s], 3])
  const low = missing.length ? [] : pairs.map(([w, a, b, min]) => [w, ratio(a, b), min]).filter(([, r, min]) => r < min)
  const worst = missing.length ? 0 : Math.min(...pairs.filter((p) => p[3] === 4.5).map(([, a, b]) => ratio(a, b)))
  ok(!missing.length && !low.length, `${name}: ${pairs.length} pairs, lowest text pair ${worst.toFixed(2)}:1${missing.length ? ' — MISSING ' + missing.join(', ') : ''}${low.length ? ' (' + low.map(([w, r]) => `${w} ${r.toFixed(2)}`).join('; ') + ')' : ''}`)
}

// ── 8 ───────────────────────────────────────────────────────────────────────────────────────
console.log('8. the switcher')
ok(V.match('T02')[0] === at('agent-reliability/study/evals/T02'), '"T02" ranks T02 first')
ok(V.match('pass^k').includes(at('agent-reliability/study/evals/T02')), '"pass^k" finds T02')
const ev = V.match('#evals')
ok(ev.length > 5 && ev.every((n) => n.tags.includes('evals')), `"#evals" filters by tag (${ev.length} notes)`)
ok(V.match('#evals pass')[0] === at('agent-reliability/study/evals/T02') && V.match('#evals pass').every((n) => n.tags.includes('evals')), '"#evals pass" narrows within the tag, T02 first')
const cmd = NB.model.command('> voice sam', C.switcher.commands)
ok(cmd && cmd.cmd === 'voice sam' && cmd.head === 'voice' && cmd.arg === 'sam' && cmd.known && NB.model.command('T02', C.switcher.commands) === null, '"> voice sam" parses as a command; "T02" does not')
ok(NIGHT.logic.commands(C.switcher.commands, 'pal')[0].cmd === 'palette white', "the > list reuses #21's logic.commands for matching")

// ── 9 ───────────────────────────────────────────────────────────────────────────────────────
console.log('9. the files')
const own = readdirSync(here).filter((f) => /\.(html|css|js|mjs)$/.test(f))
const text = Object.fromEntries(own.map((f) => [f, readFileSync(join(here, f), 'utf8')]))
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '')
ok(!/backdrop-filter/i.test(code(css)), 'no backdrop-filter in the notebook\'s CSS')
ok(own.filter((f) => f !== 'check.mjs').every((f) => !/lorem|ipsum/i.test(text[f])) && Object.values(NB.vaultFiles).every((t) => !/lorem|ipsum/i.test(t)), 'no lorem ipsum')
const scripts = [...(text['index.html'] || '').matchAll(/<script[^>]*src="([^"]+)"/g)].map((x) => x[1])
ok(scripts.length > 10 && scripts.every((s) => !/^https?:|^\/\//.test(s)), `no script from a CDN (${scripts.length} local scripts)`)
const DROPPED = ['vignette.js', 'deck.js', 'dial.js', 'home.js', 'toy.js', 'fx.js', 'series.js', 'night.js', 'night.css', 'work.js', 'moon.js', 'render-sample.mjs']
ok(DROPPED.every((f) => !existsSync(join(here, f))) && !existsSync(join(here, 'narration/sample-audio.js')) && !scripts.some((s) => DROPPED.includes(s)), `the dropped modules are gone (${DROPPED.length}, and the 0.8 MB pre-rendered sample: sam renders live)`)
ok(same(Object.keys(NIGHT.imports).sort(), ['chrome-hackathon', 'old-laptop-cloud']) && V.all.filter((n) => n.type === 'post').length === 2, 'the two essays are the only Medium content')
// every painting rule is scoped to the notebook, so the day desk is untouched
const SCOPED = /^(html\.(has-night|is-night|is-turning|nb-[\w-]+)|html:not\(\.nb-on\)|html\[data-palette|html:not\(\[data-palette\]\)|\.nb|\.night|\.lab-sky|\.lab-starfield|\.proof|@keyframes|from|to|\d+%)/
const rules = [...code(css).replace(/'[^'\n]*'/g, "''").replace(/@import[^;]+;/g, '').replace(/@media[^{]+\{/g, '').replace(/@supports[^{]+\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]])
const leaky = rules.filter(([sel, body]) => !(sel === ':root' && [...body.matchAll(/([\w-]+)\s*:/g)].every((m) => m[1].startsWith('--'))) && sel.split(',').map((s) => s.trim()).some((s) => !SCOPED.test(s)))
ok(rules.length > 80 && !leaky.length, `notebook.css: all ${rules.length} rules paint only the notebook or the night${leaky.length ? ' — LEAKS: ' + leaky.map((r) => r[0]).slice(0, 6).join(' | ') : ''}`)
const sentence = /(['"`])(?:(?!\1)[^\n]){0,6}\b[a-z]+ [a-z]+ [a-z]+ [a-z]+\b(?:(?!\1)[^\n])*\1/i
const strip = (s) => code(s).replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, (m) => (/[<>=(){}$]|\.\w+\(|^.(\w+-)+\w+.$/.test(m) ? "''" : m))
const UI = ['shell.js', 'reader.js', 'switcher.js', 'embeds.js', 'trip.js', 'model.js', 'graph.js', 'md.js', 'voice.js', 'sound.js']
const prose = UI.filter((f) => text[f] && sentence.test(strip(text[f])))
ok(UI.every((f) => text[f]) && !prose.length, `every UI word is in copy.js${prose.length ? ' — prose in ' + prose.join(', ') : ''}${UI.filter((f) => !text[f]).length ? ' — missing ' + UI.filter((f) => !text[f]).join(', ') : ''}`)
{
  let changed = null
  try { changed = execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { cwd: here, encoding: 'utf8' }).split('\n').filter(Boolean) } catch { changed = null }
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' }).trim()
  const mine = relative(top, here).split('\\').join('/') + '/'
  if (changed == null) skip('git diff origin/main...HEAD failed')
  else ok(changed.every((f) => f.startsWith(mine)), `only ${mine} changed on this branch (${changed.length} files)${changed.filter((f) => !f.startsWith(mine)).length ? ': ' + changed.filter((f) => !f.startsWith(mine)).join(', ') : ''}`)
}

console.log(fails ? `\n${fails} FAILED` : '\nall checks pass')
process.exit(fails ? 1 : 0)
