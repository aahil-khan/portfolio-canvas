// prototype/lab/notebook/check.mjs: what the notebook claims, checked without a browser.
//
//   node prototype/lab/notebook/check.mjs
//
// Loads the pure parts (copy.js, md.js, model.js, graph.js, vault.js, study.js, essay.js,
// graph-seed.js, logic.js) in Node and checks, on the real vault:
//   1. the vault: vault.js is current, every link resolves, names and numbers, fields, 71 public notes (a stub hidden by default),
//      the visibility switch, the glossary (Q5) and the reader controls' arithmetic (reading.js)
//   2. verbatim: the seven spec notes are the spec's own lines (SKIP if the source is absent)
//   3. the study: the allowlist, Aahil's 2026-11-21 calls, the private-term scan, the numbers
//   4. the graph: deterministic, in bounds, no overlaps, warm relayout, tracks folded, "where this fits"
//   5. walkthroughs and clocks: steps, totals, the read clock (every word: prose 200 wpm, table
//      cells 120), the listen clock; and the TL;DR list (WARN: notes whose summary is missing or a
//      list of their own headings; Aahil writes them)
//   6. the renderer: tables, fences, embeds, anchors, auto-links, broken links, escaping
//   7. the themes: every token in every theme; text ≥ 4.5:1 on bg, pane, hover and the callout
//      tints; the selection and the spoken word ≥ 4.5:1; marks ≥ 3:1; the accent only through its
//      three jobs; the starfield paused at rest; how a theme is chosen
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
for (const f of ['prefs.js', 'reading.js', 'copy.js', 'md.js', 'model.js', 'graph.js', 'vault.js', 'study.js', 'essay.js', 'graph-seed.js', 'logic.js']) require(join(here, f))
const { NB, NIGHT } = globalThis
const C = NB.copy, MD = NB.md, G = NB.graph

let fails = 0
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++ }
const skip = (msg) => console.log('  SKIP ' + msg)
const warn = (msg) => console.log('  WARN ' + msg)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const build = (o = {}) => NB.model.build({ files: NB.vaultFiles, study: NB.study, essays: NIGHT.imports, copy: C, ...o })
const V = build()
const at = (r) => V.get(r)
// the map's input: every note, the study topics grouped by track unless a track is expanded
const graphInput = (v, open) => G.view(v.notes, v.edges.map((e) => ({ a: e.a.route, b: e.b.route, kind: e.kind })), new Set(open || []))

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
counts.glossary = V.all.filter((n) => n.route === '01-glossary').length
ok(V.notes.length === 71 && counts.shop === 13 && counts.study === 46 && counts.builds === 5 && counts.writing === 3 && counts.tours === 2 && counts.glossary === 1,
  `71 public notes of 72: 1 + 1 + ${counts.shop} shopkeeper + ${counts.study} study (hub, log, ${NB.study.topics.length} topics, PW6) + ${counts.builds} builds (one a hidden stub) + ${counts.writing} + ${counts.tours} + the glossary`)
{
  // Q5: the glossary is a note out of the tree, the map, prev / next and latest, but in the switcher
  const g = at('01-glossary'), inTree = (f) => f.notes.includes(g) || f.folders.some(inTree)
  const gin = graphInput(V).nodes.some((x) => x.key === g.route)
  const latest = V.blockMd(at(''), 'latest')
  ok(g && !inTree(V.tree) && V.tree.hub !== g && !gin && !/glossary/i.test(latest) && !V.prevNext(at('')).next?.route?.includes('glossary') && V.match('gloss')[0] === g && V.resolve('glossary') === g,
    'the glossary: out of the tree, the map, latest and prev / next; the switcher finds it ("gloss"), [[glossary]] resolves')
  const E = NB.reading.glossary(g.blocks, MD.plain, MD.slugify)
  const want = ['pass@k', 'pass^k', 'ZOPA', 'MCC', 'eval', 'OTel', 'LLM-as-judge', 'PW', 'T', 'W']
  ok(same(E.map((e) => e.term).sort(), want.slice().sort()) && E.every((e) => e.def && e.def.length <= 200 && (e.term + ' ' + /^.*?[.!?](?=\s|$)/.exec(e.def)[0]).length <= 82), `the glossary defines the ${want.length} terms in ≤ 200 characters; the popover's line (the term and the first sentence) ≤ 82, two lines at 320 px (longest ${Math.max(...E.map((e) => (e.term + ' ' + /^.*?[.!?](?=\s|$)/.exec(e.def)[0]).length))})`)
  const ids = new Set(V.anchorsOf ? V.anchorsOf(g) : [])
  const rendered = MD.render(g.blocks, { resolve: () => null }).headings.map((x) => x.id)
  ok(E.every((e) => rendered.includes(e.id)) && new Set(E.map((e) => e.id)).size === E.length, `every term's "more →" anchor is a heading on the glossary (${E.map((e) => e.id).join(' ')})${ids.size ? '' : ''}`)
  ok(g.fm.proposal === true, 'the definitions are flagged PROPOSAL (Aahil rewrites them; the chip shows in the author view)')
  const R = NB.reading, re = (t) => R.termRe(E.find((e) => e.term === t))
  ok(re('eval').test('two evals ran') && !re('eval').test('evaluation') && re('ZOPA').test('ZOPA empty') && !re('ZOPA').test('zopa') && re('LLM-as-judge').test('an LLM-as-a-judge') && re('pass^k').test('the pass^k score') && !re('pass@k').test('pass^k') && !re('T'),
    'terms are found as words: eval and evals, not evaluation; ZOPA by its case; LLM-as-a-judge; pass^k ≠ pass@k; T is an ID prefix, not a word')
  const fu = R.firstUses(['an eval and a ZOPA', 'the ZOPA again, evals'], E)
  ok(fu.length === 2 && fu.every((x) => x.i === 0), 'each term is marked at its first use on a note only')
}
{
  // Q4, Q10, Q11: the reader controls' arithmetic
  const R = NB.reading
  ok(R.progress(0, 2000, 800) === 0 && R.progress(1200, 2000, 800) === 1 && R.progress(600, 2000, 800) === 0.5 && R.progress(0, 700, 800) === 1, 'progress: 0 at the top, 1 at the end, 1 for a note shorter than the screen')
  ok(same(R.left(12, 0), { n: 12, kind: 'read' }) && same(R.left(12, 0.5), { n: 6, kind: 'left' }) && R.left(12, 0.99).kind === 'end' && R.left(1, 0.3).n === 1, 'the kicker clock: "12 min read" at the top, "6 min left" halfway, the end says so')
  ok(R.resumeAt({ top: 900 }, 3000, 800) === 900 && R.resumeAt({ top: 900, done: true }, 3000, 800) === 0 && R.resumeAt({ top: 2900 }, 3000, 800) === 0 && R.resumeAt(null, 3000, 800) === 0, 'resume: back to the stored position; not when the note was finished, or is now shorter')
  ok(R.firstInView([{ top: -400, bottom: -300 }, { top: 0, bottom: 60 }, { top: 120, bottom: 300 }], 44, 800) === 2 && R.firstInView([{ top: 10, bottom: 300 }], 44, 800) === 0 && R.firstInView([{ top: -10, bottom: 40 }, { top: 30, bottom: 300 }], 44, 800) === 1 && R.firstInView([{ top: 60, bottom: 100 }], 44, 800) === 0, '▶ starts at the first part below the bar and above the fold')
  ok(NB.prefs.SIZES.join() === '15,17,19,21,23' && NB.prefs.clampSize(9) === 4 && NB.prefs.clampSize(-1) === 0 && NB.prefs.clampSize(null) === 1 && NB.prefs.widthOf('x') === 'narrow' && NB.prefs.WIDTHS.wide === 44, 'prefs: five sizes (15–23 px, 17 by default), clamped; three widths (32 / 36 / 44em, narrow by default)')
}
const reqMiss = V.all.flatMap((n) => [...NB.model.REQUIRED.all, ...NB.model.REQUIRED[n.type]].filter((k) => n.fm[k] === undefined && !(k === 'visibility' && n.defaultHidden)).map((k) => `${n.route}.${k}`))
ok(!reqMiss.length, `each type has its required fields${reqMiss.length ? ': ' + reqMiss.join(', ') : ''}`)
ok(V.all.filter((n) => n.type === 'post').every((n) => n.fm.entry), 'every post sets entry (a note, or none)')
ok(V.all.every((n) => ['public', 'hidden'].includes(n.fm.visibility) || n.defaultHidden) && V.all.filter((n) => n.visibility !== 'public').map((n) => n.route).join() === 'builds/04-throw-catch', 'every note carries visibility (public | hidden), or is a stub that defaults to hidden; only throw-catch is hidden')
{
  // O6: a build or stage with no "what it is" defaults to hidden; shown publicly, it is one line
  const tc = V.all.find((n) => n.route === 'builds/04-throw-catch'), dw = at('builds/01-drag-to-workspace')
  const one = V.readBlocks(dw), A = build({ hidden: true })
  ok(tc.defaultHidden && tc.visibility === 'hidden' && !at('builds/04-throw-catch') && !V.tree.folders.find((f) => f.path === 'builds').notes.includes(tc), 'a stub with nothing under "what it is" and no visibility of its own is hidden: not in the tree, the map or a link')
  ok(dw.visibility === 'public' && one.length === 1 && one[0].t === 'p' && MD.plain(one[0].text) === C.stubPublic, `a stub shown publicly is one line ("${C.stubPublic}"), no empty slots`)
  ok(A.get('builds/04-throw-catch') && A.readBlocks(A.get('builds/01-drag-to-workspace')).filter((b) => b.t === 'h').length === 6, '?hidden=1 shows the hidden stub and every slot of the shown one')
}
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
const specNotes = V.all.filter((n) => n.type === 'doc' && n.fm.project === 'shopkeeper')
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
ok(gi.nodes.every((n) => { const [x, y] = L1.pos[n.key], r = G.radius(n); return x - r >= 0 && y - r >= 0 && x + r <= G.W && y + r <= G.H }), `every node is in bounds (${G.W}×${G.H})`)
let close = 0
for (let i = 0; i < gi.nodes.length; i++) for (let j = i + 1; j < gi.nodes.length; j++) { const a = L1.pos[gi.nodes[i].key], b = L1.pos[gi.nodes[j].key]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < G.radius(gi.nodes[i]) + G.radius(gi.nodes[j])) close++ }
ok(!close, 'no two nodes are closer than the sum of their radii')
{
  // G4: the topics fold into their tracks; T48 (open source's only topic) stays itself
  const tracks = gi.nodes.filter((n) => n.type === 'track'), folded = gi.groups.reduce((a, t) => a + t.topics.length, 0)
  ok(tracks.length === 7 && folded === 42 && gi.nodes.length <= 35 && gi.nodes.filter((n) => n.type === 'topic').length === 1, `the default map: ${gi.nodes.length} nodes (≤ 35), the 43 topics as 7 track nodes + T48`)
  ok(gi.nodes.every((n) => NB.graphSeed[n.key]) && gi.groups.every((t) => t.topics.every((x) => NB.graphSeed[x.route])), 'graph-seed.js seats every node of the default map, and every topic round its track')
  const ev = gi.groups.find((t) => t.folder.endsWith('/evals')), gx = graphInput(V, [ev.key]), Lx = G.layout(gx.nodes, gx.edges, { seed: NB.graphSeed })
  const mv = gi.nodes.map((n) => Math.hypot(Lx.pos[n.key][0] - L1.pos[n.key][0], Lx.pos[n.key][1] - L1.pos[n.key][1])).sort((a, b) => a - b)
  ok(gx.nodes.length === gi.nodes.length + ev.topics.length && mv[mv.length >> 1] < 4, `expanding Evals adds its ${ev.topics.length} topics, relaid out warm: the others move a median ${mv[mv.length >> 1].toFixed(2)} px (< 4)`)
  ok(G.wrap('Chrome Already Built Our Idea. We Won the Hackathon Anyway.').every((l) => l.length <= 24) && G.wrap('Chrome Already Built Our Idea. We Won the Hackathon Anyway.').length === 2 && G.wrap('Holt').length === 1, 'a label wraps to at most 2 lines of 24 characters')
}
{
  const n2 = [...gi.nodes, { key: 'test/added', section: 'agent-reliability', type: 'doc' }], e2 = [...gi.edges, { a: 'test/added', b: 'agent-reliability/shopkeeper/01-spec', kind: 'link' }]
  const L3 = G.layout(n2, e2, { seed: NB.graphSeed })
  const mv = gi.nodes.map((n) => Math.hypot(L3.pos[n.key][0] - L1.pos[n.key][0], L3.pos[n.key][1] - L1.pos[n.key][1])).sort((a, b) => a - b)
  ok(mv[mv.length >> 1] < 4 && mv[mv.length - 1] < 24, `?add=1: a new note relayouts warm; median move ${mv[mv.length >> 1].toFixed(2)} px (< 4), max ${mv[mv.length - 1].toFixed(2)} px (< 24)`)
}
{
  // G3: "where this fits" replaces the local graph: links ∪ backlinks, one next, the tour step
  const spec = at('agent-reliability/shopkeeper/01-spec'), f = V.fits(spec)
  const listed = new Set([...f.out, ...f.back].map((l) => l.note.route)), lb = new Set([...V.out(spec), ...V.back(spec)].map((l) => l.note.route))
  ok(listed.size > 0 && same([...listed].sort(), [...lb].sort()), `01-spec's "where this fits" lists its links ∪ its backlinks (${listed.size})`)
  ok(f.partOf.map((x) => x.title).join(' › ') === 'Agent reliability › Shopkeeper' && f.next && f.next.route.endsWith('02-policy'), `01-spec is part of ${f.partOf.map((x) => x.title).join(' › ')}; next: ${f.next && f.next.title}`)
  const t3 = V.fits(at('agent-reliability/shopkeeper/03-blind-agent'), 'W1')
  ok(t3.step && t3.step.i === 3 && t3.step.n === 9 && t3.next.route.endsWith('02-policy'), 'on a tour it says "step 3 of 9 in W1", and next is the tour\'s next step')
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
  // the read clock counts every word a reader reads, table cells included (the old one gave 4 min)
  const bad = V.notes.filter((n) => { const k = V.clock(n); return Math.abs(k.read - Math.round((k.prose / 200 + k.cells / 120) * 10) / 10) > 0.01 })
  ok(!bad.length && NB.model.WPM_READ === 200 && NB.model.WPM_CELL === 120, `every note's read clock is prose ÷ 200 wpm + table-cell words ÷ 120 wpm${bad.length ? ' — off: ' + bad.map((n) => n.route).join(', ') : ''}`)
  ok(c.cells >= cells && Math.round(c.read) >= 10, `05-scenarios reads in ${Math.round(c.read)} min (${c.prose} prose words, ${c.cells} table-cell words), not 4`)
}
{
  // the summary is the TL;DR under the title: shown only when it is a real sentence
  const L = (r) => V.ledeOf(at(r)).why
  ok(L('agent-reliability/shopkeeper/01-spec') === 'headings' && L('agent-reliability/shopkeeper/03-blind-agent') === 'headings' && V.ledeOf(V.all.find((n) => n.route === 'builds/04-throw-catch')).why === 'missing' && L('builds/02-holt') === 'repeat' && L('walkthroughs/W1-shopkeeper-so-far') === 'ok',
    'the lede: a ·-joined list of the note\'s own headings or an empty summary is not shown (a PROPOSAL slot under ?hidden=1); one the body already says is not repeated')
  const todo = V.notes.filter((n) => n.visibility === 'public' && ['missing', 'headings'].includes(V.ledeOf(n).why))
  if (todo.length) warn(`${todo.length} public notes need a one-sentence TL;DR (summary missing or a heading list): ${todo.map((n) => n.route || 'start-here').join(', ')}`)
}

// ── 6 ───────────────────────────────────────────────────────────────────────────────────────
console.log('6. the renderer')
const ctxOf = (n) => ({ resolve: (t) => { const x = V.resolve(t); return x && { href: V.href(x), id: x.id, title: x.title } }, rowIds: V.rowIdsOf(n), row: (id) => V.rowHref(n, id) })
const rendered = (r) => { const n = at(r); return MD.render(n.blocks, ctxOf(n)).html }
const pol = rendered('agent-reliability/shopkeeper/02-policy'), sce = rendered('agent-reliability/shopkeeper/05-scenarios')
ok(/<table>/.test(pol) && /class="nb-table"/.test(sce), 'tables render, each in its own scrolling region')
const pIds = Array.from({ length: 13 }, (_, i) => `p${i + 1}`), sIds = [...Array.from({ length: 10 }, (_, i) => `a${i + 1}`), ...Array.from({ length: 13 }, (_, i) => `b${i + 1}`), ...Array.from({ length: 12 }, (_, i) => `c${i + 1}`)]
ok(pIds.every((id) => pol.includes(`<tr id="${id}">`)) && sIds.every((id) => sce.includes(`<tr id="${id}">`)), 'table rows P1–P13 and A1–C12 carry their IDs as anchors')
ok(/class="nb-wl nb-rowref" href="#\/agent-reliability\/shopkeeper\/02-policy\?a=p\d+"/.test(sce) || /nb-rowref" href="#\/agent-reliability\/shopkeeper\/02-policy/.test(rendered('agent-reliability/shopkeeper/03-blind-agent') + sce), 'a P or A–C mention in the Shopkeeper links to its row')
ok(/class="nb-wl nb-id" href="#\/agent-reliability\/study\/evals\/T02"/.test(rendered('builds/02-holt')) || /nb-id" href="#\/agent-reliability\/study\/evals\/T0/.test(rendered('agent-reliability/study/log')), 'ID mentions (T02) auto-link to their notes')
{
  const off = NB.model.build({ files: NB.vaultFiles, study: NB.study, essays: NIGHT.imports, copy: C, autolink: false })
  const lg = off.get('agent-reliability/study/log')
  ok(!/nb-id/.test(MD.render(lg.blocks, { resolve: () => ({ href: '#', id: 'x' }), autolink: false }).html) && off.out(lg).length === 0, '?autolink=0 leaves ID mentions as plain text, and they make no edges')
}
const kinds = new Set(V.all.flatMap((n) => n.blocks.filter((b) => b.t === 'fence').map((b) => b.kind)))
ok(MD.EMBEDS.every((k) => kinds.has(k) || k === 'chart') && !kinds.has('chart') && NB.model.REGISTERED.chart.includes('study-hours'), `the embed kinds are used in the vault: ${MD.EMBEDS.filter((k) => k !== 'chart').join(', ')}; chart stays registered (study-hours), unused since the study hub's progress list replaced it`)
const emb = MD.render(MD.parse('```clip src=x dur=42\nfig · clip · c\n```\n\n```terminal\n$ ls\n```\n\n```try margin-capture\nfig · try it · t\n```\n\n```chart study-hours\n```\n\n```diagram sale-confirmation\n```'), {}).html
ok(MD.EMBEDS.every((k) => emb.includes(`data-embed="${k}"`)) && (emb.match(/<figcaption class="nb-cap">fig \d · /g) || []).length === 5, 'each embed renders as a numbered figure with a mono caption')
const broken = MD.render(MD.parse('see [[nowhere]] and <script>alert(1)</script> & [x](javascript:alert(1))'), { resolve: () => null }).html
ok(/nb-wl is-broken/.test(broken) && broken.includes('&lt;script&gt;') && !/<script/.test(broken) && !/javascript:/.test(broken), 'an unresolved link renders as marked text; input is escaped; javascript: hrefs are refused')
{
  const t2 = MD.render(MD.parse('| Field | Example (A1) |\n| --- | --- |\n| a | b |'), { rowIds: /A\d/, row: () => '#x' }).html
  ok(/<th scope="col">Example \(A1\)<\/th>/.test(t2) && /class="nb-table-wrap is-two"/.test(t2) && /<dl class="nb-dl"/.test(t2), 'a header cell is never auto-linked ("Example (A1)" stays one line); a two-column table also carries its phone stack (<dl>)')
  const ids = rendered('agent-reliability/shopkeeper/02-policy')
  ok(/nb-table-wrap has-ids/.test(ids) && /<td class="nb-td-id">P1<\/td>/.test(ids) && !/nb-table-wrap is-two has-ids/.test(ids), 'a table with row IDs keeps its table (and its anchors) on a phone, with the ID column marked for the sticky mono column')
  const holt = at('builds/02-holt'), hb = V.readBlocks(holt)
  ok(holt.blocks.some((b) => b.t === 'fence' && b.kind === 'clip') && !hb.some((b) => b.t === 'fence' && b.kind === 'clip') && hb[0].t === 'h' && /what it is/i.test(hb[0].text) && build({ hidden: true }).readBlocks(build({ hidden: true }).get('builds/02-holt')).some((b) => b.kind === 'clip'),
    'the public view drops the placeholder clip and its heading, so a build opens on "what it is"; ?hidden=1 keeps the slot')
  ok(V.all.every((n) => n.blocks.every((b) => b.t !== 'h' || !/^\d+\s*·/.test(b.text))), 'no heading shows a part number ("2 · what it is" reads "what it is")')
}
ok(MD.latexText('\\text{margin capture} = \\frac{\\text{unit price} - \\text{floor}}{\\text{list} - \\text{floor}}') === 'margin capture = (unit price − floor) / (list − floor)', "the spec's formula renders as text")

const rules0 = (src) => [...src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]+;/g, '').replace(/@media[^{]+\{/g, '').replace(/@supports[^{]+\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]])
// ── 7 ───────────────────────────────────────────────────────────────────────────────────────
console.log('7. the themes')
const css = readFileSync(join(here, 'notebook.css'), 'utf8')
{
  // Q13: print is paper, token for token (the print block repeats them; this keeps them equal)
  const decl = (b) => [...b.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => `${m[1]}:${m[2].trim()}`).sort().join(';')
  const paperBlock = (/^html\[data-lab-theme='paper'\] \{([^}]*)\}/m.exec(css) || [])[1] || ''
  const printBlock = (/@media print \{\s*html\[data-lab-theme\], html:not\(\[data-lab-theme\]\) \{([^}]*)\}/.exec(css) || [])[1] || ''
  ok(paperBlock && decl(paperBlock) === decl(printBlock), `print uses paper's ${decl(paperBlock).split(';').length} tokens, unchanged`)
}
const hex = (v) => { const m = /^#([0-9a-f]{6})$/i.exec(String(v).trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null }
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const themes = {}, raw = {}
for (const m of css.matchAll(/html\[data-lab-theme='(\w+)'\](?:,\s*html:not\(\[data-lab-theme\]\))?\s*\{([^}]*)\}/g)) {
  raw[m[1]] = Object.fromEntries([...m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]))
  themes[m[1]] = Object.fromEntries(Object.entries(raw[m[1]]).map(([k, v]) => [k, hex(v)]).filter((x) => x[1]))
}
ok(same(Object.keys(themes), NB.prefs.THEMES), `four themes, the prefs owner's list: ${Object.keys(themes).join(', ')}`)
// the contract: every theme defines every one of these, so a theme can never inherit a colour
const TEXT = ['lab-fg', 'lab-dim', 'lab-link', 'lab-ar', 'lab-builds', 'lab-writing', 'lab-neutral', 'lab-done', 'lab-doing', 'lab-code']
const SURF = ['lab-bg', 'lab-pane', 'hov-bg', 'lab-tint-note', 'lab-tint-warn']
const MARK = ['lab-line', 'lab-ar-mark', 'lab-builds-mark', 'lab-writing-mark', 'lab-neutral', 'lab-done', 'lab-doing', 'lab-here', 'lab-ring']
const TOKENS = [...new Set([...TEXT, ...SURF, ...MARK, 'lab-scheme', 'lab-faint', 'lab-hi', 'lab-halo', 'sel-bg', 'sel-ink', 'lab-word-bg', 'lab-word-ink', 'lab-star'])]
const table = []
for (const [name, P] of Object.entries(themes)) {
  const missing = TOKENS.filter((t) => !(t in raw[name]))
  const pairs = []
  for (const t of TEXT) for (const s of SURF) pairs.push([`${t} on ${s}`, P[t], P[s], 4.5])
  pairs.push(['sel-ink on sel-bg (the selected row)', P['sel-ink'], P['sel-bg'], 4.5])
  pairs.push(['lab-word-ink on lab-word-bg (the spoken word)', P['lab-word-ink'], P['lab-word-bg'], 4.5])
  for (const t of MARK) for (const s of ['lab-bg', 'lab-pane']) pairs.push([`${t} mark on ${s}`, P[t], P[s], 3])
  const bad = pairs.filter(([, a, b]) => !a || !b)
  const low = missing.length || bad.length ? [] : pairs.map(([w, a, b, min]) => [w, ratio(a, b), min]).filter(([, r, min]) => r < min)
  const lowest = (min) => (missing.length || bad.length ? 0 : Math.min(...pairs.filter((p) => p[3] === min).map(([, a, b]) => ratio(a, b))))
  ok(!missing.length && !bad.length && !low.length, `${name}: ${pairs.length} pairs, lowest text ${lowest(4.5).toFixed(2)}:1, lowest mark ${lowest(3).toFixed(2)}:1${missing.length ? ' — MISSING ' + missing.join(', ') : ''}${bad.length ? ' — NOT A HEX ' + bad.map((x) => x[0]).join(', ') : ''}${low.length ? ' (' + low.map(([w, r]) => `${w} ${r.toFixed(2)}`).join('; ') + ')' : ''}`)
  if (!missing.length) for (const t of TOKENS) table.push([name, t, raw[name][t], P[t] && P['lab-bg'] ? ratio(P[t], P['lab-bg']) : null])
}
{
  const N = themes.night, Pp = themes.paper
  ok(N && Pp && same(N['lab-hi'], hex('#facc00')) && same(Pp['lab-halo'], hex('#facc00')) && same(Pp['lab-ring'], Pp['lab-fg']), "the accent is DIRECTION's #facc00; on paper the ring is ink with a yellow halo")
  // the accent marks only the focus ring and "you are here": count the rules that paint it
  const hiRules = rules0(css).filter(([, body]) => /var\(--lab-hi\)/.test(body)).map(([sel]) => sel)
  ok(!hiRules.length, `no rule paints --lab-hi directly: it reaches the page only through --lab-here, --lab-ring and --lab-word-bg${hiRules.length ? ' — ' + hiRules.join(' | ') : ''}`)
  const stars = rules0(css).filter(([sel, body]) => /lab-starfield__layer/.test(sel) && /animation-play-state:\s*paused/.test(body))
  ok(stars.length === 1 && /html:not\(\.has-night\)/.test(stars[0][0]) && /html\.nb-on:not\(\.nb-graph\)/.test(stars[0][0]), 'the starfield pauses unless the trip or the full graph is showing (M9)')
  const R = NB.prefs.resolve
  ok(R({ light: true }) === 'paper' && R({ light: false }) === 'night' && R({ light: true, trip: true }) === 'night' && R({ stored: 'paper', trip: true }) === 'paper' && R({ stored: 'paper', light: false }) === 'paper' && R({ stored: 'night', light: true }) === 'night' && R({ asked: 'amber', stored: 'paper' }) === 'amber' && R({ stored: 'bogus', light: true }) === 'paper',
    'NB.prefs.resolve: a stored choice wins; else a direct link follows prefers-color-scheme and the trip is night; ?theme= holds one visit')
}
if (process.env.CHECK_THEMES) console.log(JSON.stringify(table))

// ── 8 ───────────────────────────────────────────────────────────────────────────────────────
console.log('8. the switcher')
ok(V.match('T02')[0] === at('agent-reliability/study/evals/T02'), '"T02" ranks T02 first')
ok(V.match('pass^k').includes(at('agent-reliability/study/evals/T02')), '"pass^k" finds T02')
const ev = V.match('#evals')
ok(ev.length > 5 && ev.every((n) => n.tags.includes('evals')), `"#evals" filters by tag (${ev.length} notes)`)
ok(V.match('#evals pass')[0] === at('agent-reliability/study/evals/T02') && V.match('#evals pass').every((n) => n.tags.includes('evals')), '"#evals pass" narrows within the tag, T02 first')
const cmd = NB.model.command('> voice sam', C.switcher.commands)
ok(cmd && cmd.cmd === 'voice sam' && cmd.head === 'voice' && cmd.arg === 'sam' && cmd.known && NB.model.command('T02', C.switcher.commands) === null, '"> voice sam" parses as a command; "T02" does not')
ok(NIGHT.logic.commands(C.switcher.commands, 'pal')[0].cmd === 'palette night', "the > list reuses #21's logic.commands for matching")

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
const SCOPED = /^(html\.(has-night|is-night|is-turning|nb-[\w-]+)|html:not\(\.(nb-on|has-night)\)|html\[data-lab-|html\[data-focus\]|html:not\(\[data-lab-theme\]\)|\.nb|\.night|\.lab-sky|\.lab-starfield|\.proof|@keyframes|from|to|\d+%)/
const rules = [...code(css).replace(/'[^'\n]*'/g, "''").replace(/@import[^;]+;/g, '').replace(/@media[^{]+\{/g, '').replace(/@supports[^{]+\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]])
const leaky = rules.filter(([sel, body]) => !(sel === ':root' && [...body.matchAll(/([\w-]+)\s*:/g)].every((m) => m[1].startsWith('--'))) && sel.split(',').map((s) => s.trim()).some((s) => !SCOPED.test(s)))
ok(rules.length > 80 && !leaky.length, `notebook.css: all ${rules.length} rules paint only the notebook or the night${leaky.length ? ' — LEAKS: ' + leaky.map((r) => r[0]).slice(0, 6).join(' | ') : ''}`)
const sentence = /(['"`])(?:(?!\1)[^\n]){0,6}\b[a-z]+ [a-z]+ [a-z]+ [a-z]+\b(?:(?!\1)[^\n])*\1/i
const strip = (s) => code(s).replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, (m) => (/[<>=(){}$]|\.\w+\(|^.(\w+-)+\w+.$/.test(m) ? "''" : m))
const UI = ['shell.js', 'reader.js', 'controls.js', 'glossary.js', 'reading.js', 'prefs.js', 'switcher.js', 'embeds.js', 'map.js', 'trip.js', 'model.js', 'graph.js', 'md.js', 'voice.js', 'sound.js']
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
