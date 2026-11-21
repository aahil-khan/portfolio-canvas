// prototype/lab/notebook/audit.mjs: the readability targets, measured in a real browser. No
// screenshots: every claim is a computed style, a geometry or a count. Built from the audit's
// measure.mjs probe (~/.local/state/hq/plans/portfolio-canvas/lab-audit-readability-first/).
//
//   node prototype/lab/notebook/audit.mjs [page.html]   (default: ~/projects/scratch/lab-mockups/lab.html)
//   AUDIT_JSON=1 …                                     also prints the raw measurements as JSON
//
// One section per fix round; each round adds its own. Exits 1 on any miss. One browser, closed at
// the end. Playwright core from ~/.local/share/cx-tools/node_modules (or $PLAYWRIGHT_CORE).
//
// Round 1 (reading) asserts, on 01-spec, 05-scenarios, T02, Holt, the Chrome post and W1, at
// 1440×900 and 390×844:
//   - desktop characters per line of the first paragraph that runs ≥ 3 lines: 58–70 (the median
//     full line, counted by where each character lands; the short last line is left out)
//   - monospace ≤ 35 % of the visible characters
//   - text under 13 px ≤ 15 % of the visible characters, the tree excluded
//   - ≤ 5 distinct font sizes in the reading column (all of it, not just the first screen)
//   - the kicker (metadata line) is one line at 390 px, and nothing in it is cut off
//   - link colour ≠ body text colour
// and on single views:
//   - 01-spec, desktop, first viewport: ≤ 25 interactive elements. Counted as a keyboard meets
//     them: every tab stop in view, plus graph nodes. The tree is one ARIA tree widget with a
//     roving tab stop (arrows move inside it), so it counts once; measure.mjs's raw count of every
//     visible link, tree rows included, is printed beside it so neither number hides the other.
//   - 01-spec, desktop: reading text covers ≥ 25 % of the viewport (paragraphs, list items, the
//     lede and table cells: 01-spec opens on one paragraph and a 16-row table of sentences)
//   - Holt and the post: the first paragraph starts < 320 px (desktop) and < 420 px (phone)
//   - narration playing (03-blind-agent in W1, voice sam), phone: every strip button ≥ 44 px tall;
//     desktop: ≥ 32×32
//
// Round 2 (colour) asserts, in night and in paper (a fresh profile with prefers-color-scheme dark,
// then light: the real way a theme is chosen), at both sizes, on the views above plus start-here,
// 03-blind-agent in W1, the study hub, the Drag to Workspace stub and #/graph:
//   - the computed colours of body text, links, the kicker, table cells and the tree (desktop)
//     reach 4.5:1 on the background actually behind them (every ancestor's background, composited)
//     (the section dot and the folder chevrons are marks, aria-hidden shapes: 3:1, as check.mjs §7)
//   - at most 3 elements in view are painted with the accent (--lab-hi, and the two forms it takes
//     on paper: --lab-here and --lab-word-bg). DIRECTION's ≤ ~5 % accent rule, made countable
//   - a note in each section shows its section colour in the kicker: the dot in the mark, the
//     name in the text colour (01-spec and T02 agent reliability, Holt builds, the post writing)
//   - narration playing (desktop): the spoken word's ink reaches 4.5:1 on its background
//   - M9: at rest on a note no animation is running (the starfield is paused); on #/graph it runs
//
// Round 3 (graphs → maps) asserts, in night and in paper:
//   - no svg.nb-g on any note page or on start-here, at both sizes (the local graph is gone)
//   - #/graph at 1440×900: every visible label ≥ 12 px tall, 0 label overlaps (each label's box,
//     every line of it), ≤ 35 nodes in the default (folded) view, a key naming the three sections
//   - #/graph at 390×844: no SVG, and every row of the list map (notes and folders) ≥ 44 px tall
//   - the study hub: no SVG chart; its progress text is ≥ 15 px
//   - start-here's first phone screen holds "Aahil" and three entry links
//
// Round 4 (reader controls) asserts, in night and in paper:
//   - at each text-size step (15 / 17 / 19 / 21 / 23 px), on 05-scenarios at 1440×900 and 390×844:
//     the body's px is the step, the h2 is the step × 1.294 (it scales with it), and at 390 px no
//     sideways scroll; at 23 px, every view of the plan's table has no sideways scroll at 390×844
//     and 390×664 (the shell's in-app height), and the bar's cells stay on one line
//   - the Aa panel's controls are ≥ 44 px tall on a phone (≥ 32 on a desktop), and the panel opens
//     from the top on a phone (its top is the bar's foot), under the bar on a desktop
//   - the progress hairline's scale at the end of 05-scenarios is ≥ 0.99 (both sizes), 0 at the top
//   - every glossary term in 05-scenarios' visible text has a popover target (.nb-gl) in view's DOM
//
// Round 5 (motion) asserts, with motion and again under reducedMotion: 'reduce', at 1440×900,
// 390×844 and 390×664, navigating in the app (a hash change, as a link does) from start-here
// through every view of the plan's table and back:
//   - every animation that runs during a note navigation (document.getAnimations(), read every
//     frame for 700 ms) has keyframes on opacity and transform only, on DIRECTION's easing
//   - the navigation's longest task is < 50 ms (PerformanceObserver 'longtask')
//   - with no graph or trip showing, getAnimations() is empty at rest (900 ms after arriving)
//   - and, beyond navigation, while focus mode, the sidebar, the drawer, the strip, the word, an
//     anchor jump, a tree folder, a hover and the graph (open, filter) move: every animation is on
//     the one easing and one of DIRECTION's durations (120 / 180 / 220 / 320 / 450 / 600 ms; the
//     graph's 40 ms stagger is a delay). The shared starfield's twinkle, behind the graph, is the
//     sky's own and is listed, not held to the easing
//   - under reduce: no animation has a transform keyframe, and none runs longer than 120 ms
//   - a 2-second scroll of 05-scenarios at 1440×900 runs at ≥ 55 fps median (rAF deltas)
// Every animation seen is listed at the end (what, duration, delay, easing): the PR's table.
// AUDIT_ROUND=5 runs this round alone (for iterating; the check runs every round).
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || join(homedir(), '.local/share/cx-tools/node_modules/playwright-core'))
const FILE = pathToFileURL(resolve(process.argv[2] || join(homedir(), 'projects/scratch/lab-mockups/lab.html'))).href
const VIEWS = {
  spec01: '#/agent-reliability/shopkeeper/01-spec',
  scen05: '#/agent-reliability/shopkeeper/05-scenarios',
  T02: '#/T02',
  holt: '#/builds/02-holt',
  post: '#/writing/02-chrome-already-built-our-idea',
  W1: '#/W1',
}
const SIZES = { desk: [1440, 900], phone: [390, 844] }
const ONLY5 = process.env.AUDIT_ROUND === '5'
let fails = 0, n = 0
const ok = (cond, msg) => { n++; console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++ }

// in the page: the round-1 measurements
function probe() {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 }
  const shown = (e) => { for (let a = e; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden') return false } return true }
  const own = (e) => [...e.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent.trim()).join('').length
  const hasText = (e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())
  const out = {}
  // from the top of the page, as measure.mjs takes it (the column or the document scrolls)
  const top = (e) => Math.round(e.getBoundingClientRect().top + scrollY + document.querySelector('.nb-main').scrollTop)
  // characters per line: the first paragraph that runs at least three lines
  const ps = [...document.querySelectorAll('.nb-body > p')]
  const long = ps.find((p) => p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight) >= 2.6)
  // characters on each full line (the last, short line left out), by where each character lands
  if (long) {
    const tops = new Map(), r = document.createRange()
    const walk = document.createTreeWalker(long, NodeFilter.SHOW_TEXT)
    while (walk.nextNode()) {
      const t = walk.currentNode
      for (let i = 0; i < t.length; i++) { r.setStart(t, i); r.setEnd(t, i + 1); const b = r.getClientRects()[0]; if (b) { const y = Math.round(b.top / 4); tops.set(y, (tops.get(y) || 0) + 1) } }
    }
    const per = [...tops.entries()].sort((a, z) => a[0] - z[0]).map((x) => x[1]).slice(0, -1).sort((a, z) => a - z)
    out.charsPerLine = per[per.length >> 1]
  }
  // the visible characters: mono share, small share (tree excluded)
  let mono = 0, all = 0, small = 0, allNoTree = 0
  for (const e of document.querySelectorAll('.nb *')) {
    if (!vis(e) || !hasText(e)) continue
    const s = getComputedStyle(e), k = own(e)
    all += k
    if (/mono/i.test(s.fontFamily.split(',')[0])) mono += k
    if (e.closest('.nb-side')) continue
    allNoTree += k
    if (parseFloat(s.fontSize) < 13) small += k
  }
  out.monoPct = Math.round(mono / Math.max(1, all) * 100)
  out.smallPct = Math.round(small / Math.max(1, allNoTree) * 100)
  // every font size in the reading column, first screen or not
  const sizes = new Set()
  for (const e of document.querySelectorAll('.nb-col *')) if (hasText(e) && shown(e)) sizes.add(getComputedStyle(e).fontSize)
  out.colSizes = [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b))
  // interactive: tab stops in view (+ graph nodes), and the raw count measure.mjs takes
  const inter = [...document.querySelectorAll('a[href], button, [role=button], input, [tabindex], .nb-g .n')].filter(vis)
  out.tabStops = inter.filter((e) => e.tabIndex >= 0 && e.getAttribute('tabindex') !== '-1').length
  out.rawInteractive = [...document.querySelectorAll('a, button, [role=button], .nb-g .n, input')].filter(vis).length
  // reading text's share of the viewport
  const VA = innerWidth * innerHeight
  let area = 0
  for (const e of document.querySelectorAll('.nb-body > p, .nb-body li, .nb-lede, .nb-body td, .nb-body dd')) {
    if (!vis(e)) continue
    const r = e.getBoundingClientRect()
    area += Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0))
  }
  out.readPct = +(area / VA * 100).toFixed(1)
  const fp = ps.find((p) => p.textContent.trim().length > 0)
  out.firstProseTop = fp ? top(fp) : null
  // the kicker: one line, nothing cut off
  const k = document.querySelector('.nb-kicker')
  if (k) { const s = getComputedStyle(k); out.kicker = { text: k.innerText.replace(/\s+/g, ' '), lines: Math.round(k.getBoundingClientRect().height / parseFloat(s.lineHeight)), cut: k.scrollWidth > k.clientWidth + 1 } }
  const a = document.querySelector('.nb-body a'), p = a && a.closest('p, li, td')
  if (a) out.link = { link: getComputedStyle(a).color, text: getComputedStyle(p || a.parentElement).color }
  return out
}

// in the page: the round-3 measurements
function probe3() {
  const shown = (e) => { const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' }
  const out = { svgG: document.querySelectorAll('svg.nb-g').length, theme: document.documentElement.dataset.labTheme }
  const svg = document.querySelector('.nb-g--full')
  if (svg) {
    const ls = [...svg.querySelectorAll('text')].filter((t) => shown(t) && t.getBoundingClientRect().width > 0)
    const lines = ls.flatMap((t) => [...t.querySelectorAll(':scope > tspan')].map((x) => x.getBoundingClientRect()))
    const boxes = ls.map((t) => t.getBoundingClientRect())
    let ov = 0
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) ov++ }
    const fs = ls.map((t) => parseFloat(getComputedStyle(t).fontSize) * (svg.querySelector('.nb-g__world').getCTM() || { a: 1 }).a)
    out.graph = { labels: ls.length, minLine: Math.min(...lines.map((r) => r.height)), minPx: Math.min(...fs), overlaps: ov, nodes: svg.querySelectorAll('a.n').length, key: (document.querySelector('.nb-key') || {}).innerText || '' }
  }
  // a folded list: open every section and folder, so every row is measured
  for (const d of document.querySelectorAll('.nb-maplist details')) d.open = true
  const rows = [...document.querySelectorAll('.nb-maplist__row, .nb-maplist summary')]
  out.list = rows.length ? { n: rows.length, minH: Math.min(...rows.map((r) => r.getBoundingClientRect().height)) } : null
  const pr = [...document.querySelectorAll('.nb-progress *')].filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()))
  out.progress = pr.length ? { n: pr.length, minPx: Math.min(...pr.map((e) => parseFloat(getComputedStyle(e).fontSize))) } : null
  out.chart = document.querySelectorAll('.nb-col svg').length
  const inView = (e) => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 && r.width > 0 }
  out.entries = [...document.querySelectorAll('.nb-entry')].filter(inView).length
  out.aahil = [...document.querySelectorAll('.nb-col h1, .nb-col p')].some((e) => inView(e) && /Aahil/.test(e.textContent))
  return out
}

// in the page: the round-2 measurements
function probe2() {
  const parse = (c) => {
    let m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(c)
    if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]]
    m = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)$/.exec(c)
    if (m) return [+m[1] * 255, +m[2] * 255, +m[3] * 255, m[4] == null ? 1 : +m[4]]
    return null
  }
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1) }
  const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
  // the background behind an element: every ancestor's background, composited from the page up
  const bgOf = (e) => {
    const layers = []
    for (let a = e; a; a = a.parentElement) { const c = parse(getComputedStyle(a).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break } }
    let out = [255, 255, 255, 1]
    for (const l of layers.reverse()) out = over(l, out)
    return out
  }
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && s.visibility !== 'hidden' && s.display !== 'none' }
  const hasText = (e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())
  const contrast = (e) => { const bg = bgOf(e), fg = over(parse(getComputedStyle(e).color), bg); return +ratio(fg, bg).toFixed(2) }
  // the section dot and the folder chevron are marks (aria-hidden shapes, not words): 3:1, not 4.5
  const MARKS = '.nb-k__dot, .nb-row__chev'
  const group = (sel, all) => {
    const es = [...document.querySelectorAll(sel)].filter((e) => vis(e) || all).filter((e) => !e.matches(MARKS) || sel === MARKS).filter((e) => hasText(e) || e.querySelector('*') === null).slice(0, 40)
    const rs = es.map((e) => ({ r: contrast(e), what: (e.className || e.tagName) + ' "' + e.textContent.trim().slice(0, 24) + '"' }))
    rs.sort((a, z) => a.r - z.r)
    return { n: rs.length, min: rs.length ? rs[0].r : null, worst: rs[0] ? rs[0].what : '' }
  }
  const out = {
    theme: document.documentElement.dataset.labTheme,
    body: group('.nb-body > p, .nb-body li, .nb-lede'),
    link: group('.nb-body a, .nb-end a, .nb-tour a'),
    kicker: group('.nb-kicker .nb-k, .nb-kicker .nb-k *'),
    table: group('.nb-table th, .nb-table td, .nb-table td a, .nb-dl dt, .nb-dl dd'),
    tree: innerWidth >= 900 ? group('.nb-row__title, .nb-row__glyph') : null,
  }
  out.marks = group(MARKS)
  // the accent, in each form it takes on this theme
  const root = getComputedStyle(document.documentElement)
  const hexRgb = (h) => { const m = /^#([0-9a-f]{6})$/i.exec(h.trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(', ') : null }
  const accent = [...new Set(['--lab-hi', '--lab-here', '--lab-word-bg'].map((v) => hexRgb(root.getPropertyValue(v))).filter(Boolean))]
  const painted = []
  for (const e of document.querySelectorAll('.nb *, .nb')) {
    if (!vis(e)) continue
    const s = getComputedStyle(e)
    const props = [s.color, s.backgroundColor, s.boxShadow, s.outlineStyle !== 'none' ? s.outlineColor : '', ...['Top', 'Right', 'Bottom', 'Left'].map((k) => (parseFloat(s[`border${k}Width`]) > 0 && s[`border${k}Style`] !== 'none' ? s[`border${k}Color`] : '')), s.textDecorationLine !== 'none' ? s.textDecorationColor : '']
    if (props.some((v) => accent.some((a) => v && v.includes(`rgb(${a})`)))) painted.push(e.className || e.tagName)
  }
  out.accent = { n: painted.length, what: painted }
  const k = document.querySelector('.nb-kicker')
  if (k) {
    const sec = document.querySelector('.nb').dataset.sec, tok = { 'agent-reliability': 'ar', builds: 'builds', writing: 'writing' }[sec]
    out.sec = { sec, name: getComputedStyle(k.querySelector('.nb-k__name')).color, dot: getComputedStyle(k.querySelector('.nb-k__dot')).color, want: tok ? `rgb(${hexRgb(root.getPropertyValue(`--lab-${tok}`))})` : null, wantMark: tok ? `rgb(${hexRgb(root.getPropertyValue(`--lab-${tok}-mark`))})` : null }
  }
  out.running = document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.id || 'anim')
  return out
}
const VIEWS2 = {
  start: '', spec01: VIEWS.spec01, tour3: '#/agent-reliability/shopkeeper/03-blind-agent?w=W1', scen05: VIEWS.scen05, T02: VIEWS.T02,
  study: '#/agent-reliability/study', W1: VIEWS.W1, holt: VIEWS.holt, stub: '#/builds/01-drag-to-workspace', post: VIEWS.post, graph: '#/graph',
}
const THEMES = { night: 'dark', paper: 'light' }
const SIZES4 = { desk: [1440, 900], phone: [390, 844], inapp: [390, 664] }

// in the page: the round-4 measurements, at whatever text size is on <html>
function probe4() {
  const px = (e) => (e ? parseFloat(getComputedStyle(e).fontSize) : null)
  const cells = [...document.querySelectorAll('.nb-bar__cell')].filter((c) => c.offsetParent !== null && c.getBoundingClientRect().width > 0)
  return {
    size: document.documentElement.dataset.labSize, body: px(document.querySelector('.nb-body p')), h2: px(document.querySelector('.nb-body h2')),
    aaIn: (() => { const a = document.querySelector('.nb-bar [data-act="aa"]'); if (!a) return false; const r = a.getBoundingClientRect(), bar = document.querySelector('.nb-bar').getBoundingClientRect(); return r.width >= 40 && r.left >= bar.left && r.right <= Math.min(innerWidth, bar.right) + 0.5 })(),
    kickerCut: (() => { const k = document.querySelector('.nb-kicker'); return !!k && k.offsetParent !== null && k.scrollWidth > k.clientWidth + 1 })(),
    sw: document.documentElement.scrollWidth, iw: innerWidth, barOne: new Set(cells.map((c) => Math.round(c.getBoundingClientRect().top))).size === 1 && cells.every((c) => c.getBoundingClientRect().height <= 44.5),
  }
}
// in the page: every glossary term in the visible text has its marked first use
function probeGloss() {
  const body = document.querySelector('.nb-body')
  const clone = body.cloneNode(true)
  for (const x of clone.querySelectorAll('a, code, pre, h1, h2, h3, h4, .nb-formula, .nb-code, .nb-embed')) x.remove()
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-9999px;width:600px'; host.appendChild(clone); document.body.appendChild(host)
  const text = clone.innerText
  host.remove()
  const used = NB.gloss.entries().filter((e) => { const re = NB.reading.termRe(e); return re && re.test(text) })
  const marked = (id) => [...body.querySelectorAll(`.nb-gl[data-gloss="${id}"]`)].some((x) => x.getClientRects().length > 0)
  return { used: used.map((e) => e.term), missing: used.filter((e) => !marked(e.id)).map((e) => e.term), total: body.querySelectorAll('.nb-gl').length }
}

// ── round 5, in the page ──────────────────────────────────────────────────────────────────
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const DURS = [120, 180, 220, 320, 450, 600]
// watch everything that animates while `act` runs and for `ms` after (every frame), and the long
// tasks; then what is still animating `rest` ms later. Runs in the page.
async function watch({ act, ms = 700, rest = 200 }) {
  const META = new Set(['offset', 'computedOffset', 'easing', 'composite'])
  const seen = new Map(), lt = []
  const desc = (a) => {
    const e = a.effect, t = e.getTiming(), kf = e.getKeyframes(), tg = e.target
    const cls = tg ? (typeof tg.className === 'string' ? tg.className : tg.className.baseVal || tg.tagName.toLowerCase()) : ''
    return {
      name: a.id || a.transitionProperty || a.animationName || 'anim', kind: a.constructor.name,
      props: [...new Set(kf.flatMap((f) => Object.keys(f)).filter((k) => !META.has(k)))],
      dur: t.duration, delay: t.delay, iter: t.iterations, easing: t.easing, kfEase: [...new Set(kf.map((f) => f.easing))].join(','),
      target: String(cls).split(' ')[0] || (tg && tg.tagName.toLowerCase()),
    }
  }
  const rec = () => { for (const a of document.getAnimations()) if (!seen.has(a)) seen.set(a, desc(a)) }
  const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push(Math.round(e.duration)) })
  po.observe({ type: 'longtask' })
  const raf = () => new Promise((r) => requestAnimationFrame(r))
  const t0 = performance.now()
  await act()
  rec()
  while (performance.now() - t0 < ms) { await raf(); rec() }
  po.disconnect()
  await new Promise((r) => setTimeout(r, rest))
  return { anims: [...seen.values()], lt, rest: document.getAnimations().map(desc), title: (document.querySelector('.nb-title') || {}).textContent || '' }
}
// run `src` (an async body) in the page under watch(); the watcher goes in as source
const inPage = (pg, src, o = {}) => pg.evaluate(({ w, src, o }) => (0, eval)(`(${w})`)({ act: new Function(`return (async () => { ${src} })()`), ...o }), { w: watch.toString(), src, o })
const navTo = (pg, hash) => inPage(pg, `await new Promise((r) => { addEventListener('hashchange', () => r(), { once: true }); location.hash = ${JSON.stringify(hash || '#/')} })`)
// in the page: a 2 s scroll of the column, one step a frame; the frame deltas
async function scrollFps() {
  const sc = NB.controls.scroller(), d = []
  sc.scrollTop = 0
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  let last = null
  const t0 = performance.now()
  await new Promise((done) => {
    const step = (t) => { if (last != null) d.push(t - last); last = t; sc.scrollTop += 14; if (t - t0 < 2000) requestAnimationFrame(step); else done() }
    requestAnimationFrame(step)
  })
  d.sort((a, b) => a - b)
  return { frames: d.length, median: +d[d.length >> 1].toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2), moved: Math.round(sc.scrollTop) }
}

const b = await chromium.launch()
const res = {}
try {
  if (!ONLY5) {
  for (const [sz, [w, h]] of Object.entries(SIZES)) {
    const phone = sz === 'phone'
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone })
    const pg = await ctx.newPage()
    for (const [k, hash] of Object.entries(VIEWS)) {
      await pg.goto('about:blank'); await pg.goto(FILE + hash)
      await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(500)
      res[`${k}@${sz}`] = await pg.evaluate(probe)
    }
    // narration playing: 03-blind-agent in W1, voice sam
    await pg.goto('about:blank'); await pg.goto(FILE + '#/agent-reliability/shopkeeper/03-blind-agent?w=W1')
    await pg.waitForTimeout(400)
    await pg.evaluate(() => { NIGHT.voice.use('sam'); NB.narrator.press() })
    await pg.waitForFunction(() => NIGHT.voice.state().playing, null, { timeout: 8000 }).catch(() => {})
    await pg.waitForTimeout(300)
    res[`strip@${sz}`] = await pg.evaluate(() => [...document.querySelectorAll('.nb-strip button')].map((x) => { const r = x.getBoundingClientRect(); return { b: x.dataset.nb, w: Math.round(r.width), h: Math.round(r.height) } }))
    res[`stripText@${sz}`] = await pg.evaluate(() => document.querySelector('.nb-strip').innerText.replace(/\s+/g, ' '))
    await ctx.close()
  }
  // round 2: each theme, chosen the way a reader's browser chooses it
  for (const [theme, scheme] of Object.entries(THEMES)) {
    for (const [sz, [w, h]] of Object.entries(SIZES)) {
      const phone = sz === 'phone'
      const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, colorScheme: scheme })
      const pg = await ctx.newPage()
      for (const [k, hash] of Object.entries(VIEWS2)) {
        await pg.goto('about:blank'); await pg.goto(FILE + hash)
        await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(400)
        res[`r2:${theme}:${k}@${sz}`] = await pg.evaluate(probe2)
        res[`r3:${theme}:${k}@${sz}`] = await pg.evaluate(probe3)
      }
      if (!phone) {
        await pg.goto('about:blank'); await pg.goto(FILE + VIEWS2.tour3)
        await pg.waitForTimeout(400)
        await pg.evaluate(() => { NIGHT.voice.use('sam'); NB.narrator.press() })
        await pg.waitForFunction(() => document.querySelector('.nb-word.is-on'), null, { timeout: 8000 }).catch(() => {})
        res[`r2:${theme}:word`] = await pg.evaluate(() => {
          const w = document.querySelector('.nb-word.is-on')
          if (!w) return null
          const s = getComputedStyle(w), rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number)
          const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
          const [x, y] = [lum(rgb(s.color)), lum(rgb(s.backgroundColor))].sort((m, n) => n - m)
          return { fg: s.color, bg: s.backgroundColor, r: +((x + 0.05) / (y + 0.05)).toFixed(2) }
        })
        await pg.evaluate(() => NB.narrator.stop())
      }
      await ctx.close()
    }
  }
  // round 4: the reader's controls, in each theme
  for (const [theme, scheme] of Object.entries(THEMES)) {
    for (const [sz, [w, h]] of Object.entries(SIZES4)) {
      const phone = sz !== 'desk'
      const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, colorScheme: scheme })
      const pg = await ctx.newPage()
      const open = async (hash) => { await pg.goto('about:blank'); await pg.goto(FILE + hash); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(350) }
      if (sz !== 'inapp') {
        await open(VIEWS.scen05)
        res[`r4:${theme}:theme@${sz}`] = await pg.evaluate(() => document.documentElement.dataset.labTheme)
        for (let i = 0; i < 5; i++) {
          await pg.evaluate((k) => NB.prefs.setSize(k), i)
          await pg.waitForTimeout(80)
          res[`r4:${theme}:step${i}@${sz}`] = await pg.evaluate(probe4)
        }
        await pg.evaluate(() => NB.prefs.setSize(1))
        // the hairline at the top and at the end
        await pg.evaluate(() => NB.controls.scroller().scrollTo(0, 0)); await pg.waitForTimeout(120)
        const top = await pg.evaluate(() => NB.controls.progress)
        await pg.evaluate(() => NB.controls.scroller().scrollTo(0, 1e7)); await pg.waitForTimeout(150)
        res[`r4:${theme}:bar@${sz}`] = await pg.evaluate((t) => { const i = document.querySelector('.nb-readbar i'), m = new DOMMatrix(getComputedStyle(i).transform); return { top: t, end: +m.a.toFixed(4), h: Math.round(i.getBoundingClientRect().height), shown: !document.querySelector('.nb-readbar').hidden } }, top)
        await pg.evaluate(() => NB.controls.scroller().scrollTo(0, 0)); await pg.waitForTimeout(100)
        res[`r4:${theme}:gloss@${sz}`] = await pg.evaluate(probeGloss)
        // the Aa panel
        await pg.click('.nb-bar [data-act="aa"]')
        await pg.waitForTimeout(80)
        res[`r4:${theme}:aa@${sz}`] = await pg.evaluate(() => {
          const aa = document.querySelector('.nb-aa'), r = aa.getBoundingClientRect(), bar = document.querySelector('.nb-bar').getBoundingClientRect()
          const bs = [...aa.querySelectorAll('button')].filter((x) => x.offsetParent !== null).map((x) => { const q = x.getBoundingClientRect(); return { t: x.textContent.trim() || x.getAttribute('aria-label'), h: Math.round(q.height), w: Math.round(q.width) } })
          return { open: !aa.hidden, top: Math.round(r.top - bar.bottom), left: Math.round(r.left), right: Math.round(innerWidth - r.right), bs }
        })
      }
      // every view at the largest size: nothing scrolls sideways, the bar stays one line
      await open(VIEWS2.start)
      await pg.evaluate(() => NB.prefs.setSize(4))
      for (const [k, hash] of Object.entries(VIEWS2)) {
        await open(hash)
        res[`r4:${theme}:big:${k}@${sz}`] = await pg.evaluate(probe4)
      }
      await ctx.close()
    }
  }
  }
  // round 5: motion, and then reduced motion
  for (const motion of ['motion', 'reduce']) {
    for (const [sz, [w, h]] of Object.entries(SIZES4)) {
      const phone = sz !== 'desk'
      const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference', colorScheme: 'dark' })
      const pg = await ctx.newPage()
      const out = (res[`r5:${motion}@${sz}`] = { navs: [], acts: [] })
      await pg.goto(FILE + '#/'); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(700)
      // the load's own tail (a direct landing decodes the desk's images while idle) is not a
      // navigation: start measuring once 500 ms pass with no long task (at most 5 s)
      out.loadTail = await pg.evaluate(() => new Promise((done) => {
        const seen = []; let last = performance.now()
        const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) { seen.push(Math.round(e.duration)); last = performance.now() } })
        po.observe({ type: 'longtask' })
        const t0 = performance.now()
        const tick = () => { if (performance.now() - last >= 500 || performance.now() - t0 > 5000) { po.disconnect(); done(seen) } else setTimeout(tick, 50) }
        tick()
      }))
      out.startRest = await pg.evaluate(() => document.getAnimations().map((a) => a.id || a.transitionProperty || a.animationName))
      // through every view of the plan's table, in the app, and back to start-here
      for (const [k, hash] of [...Object.entries(VIEWS2).filter(([k]) => k !== 'start'), ['start', '#/']]) out.navs.push({ k, ...(await navTo(pg, hash)) })
      const act = async (k, src, o) => out.acts.push({ k, ...(await inPage(pg, src, o)) })
      // the rest of what moves: hover, a folder, an anchor jump, focus mode and the sidebar or the
      // drawer, the strip and the word, the graph
      await navTo(pg, VIEWS.scen05)
      if (!phone) {
        const row = await pg.evaluate(() => { const r = document.querySelector('.nb-tree .nb-row:not([aria-current])').getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2] })
        await pg.mouse.move(row[0], row[1])
        await act('hover', '', { ms: 300 })
        await pg.mouse.move(5, 300)
      }
      await act('fold', "document.querySelector('.nb-tree li[data-folder][data-open=\"false\"] > .nb-row--folder .nb-row__chev').click()")
      await act('anchor', "const a = NB.reader.outline()[2] || NB.reader.headings[2]; location.hash = NB.shell.href(NB.shell.state.route, 'a=' + a.id)", { ms: 1600 })
      if (phone) { await act('drawer open', 'NB.shell.openDrawer()'); await act('drawer close', 'NB.shell.closeDrawer()') }
      else for (const [k, src] of [['focus on', 'NB.shell.toggleFocus()'], ['focus off', 'NB.shell.toggleFocus()'], ['sidebar off', 'NB.shell.toggleSide()'], ['sidebar on', 'NB.shell.toggleSide()']]) await act(k, src, { ms: 500 })
      // narration: the strip's row, its contents, the paragraph mark and the word
      await navTo(pg, VIEWS2.tour3)
      await act('strip in', "NIGHT.voice.use('sam'); NB.narrator.press(); await new Promise((r) => { const t = setInterval(() => { if (NIGHT.voice.state().playing) { clearInterval(t); r() } }, 20); setTimeout(() => { clearInterval(t); r() }, 8000) })", { ms: 1500, rest: 0 })
      await act('strip out', 'NB.narrator.stop()', { ms: 500 })
      await pg.waitForTimeout(300)
      out.stripRest = await pg.evaluate(() => document.getAnimations().length)
      // the graph (desktop): a filter, then Fit (the camera is rAF, so it is timed, not listed)
      if (!phone) {
        await navTo(pg, VIEWS2.graph)
        await act('graph filter', "document.querySelector('.nb-graph__bar [data-filter=\"builds\"]').click()", { ms: 400 })
        out.camera = await pg.evaluate(async () => {
          NB.shell.graphZoomAt(400, 300, NB.shell.graphCam.s * 2)
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
          const t0 = performance.now(), before = { ...NB.shell.graphCam }
          NB.shell.graphFit()
          const moving = NB.shell.graphMoving()
          await new Promise((r) => { const t = () => (NB.shell.graphMoving() ? requestAnimationFrame(t) : r()); requestAnimationFrame(t) })
          return { moving, ms: Math.round(performance.now() - t0), moved: Math.abs(NB.shell.graphCam.s - before.s) > 0.01 }
        })
        await pg.evaluate(() => { NB.shell.graphFilters.builds = true })
      }
      if (sz === 'desk') {
        await navTo(pg, VIEWS.scen05)
        await pg.waitForTimeout(300)
        out.fps = await pg.evaluate(scrollFps)
      }
      await ctx.close()
    }
  }
} finally { await b.close() }
if (process.env.AUDIT_JSON) console.log(JSON.stringify(res, null, 1))

if (!ONLY5) {
console.log('round 1: reading')
for (const sz of Object.keys(SIZES)) {
  console.log(` ${sz}`)
  for (const k of Object.keys(VIEWS)) {
    const m = res[`${k}@${sz}`]
    if (sz === 'desk' && m.charsPerLine != null) ok(m.charsPerLine >= 58 && m.charsPerLine <= 70, `${k}: ${m.charsPerLine} characters a line (58–70)`)
    ok(m.monoPct <= 35, `${k}: monospace is ${m.monoPct} % of the visible characters (≤ 35)`)
    ok(m.smallPct <= 15, `${k}: text under 13 px is ${m.smallPct} % of the visible characters outside the tree (≤ 15)`)
    ok(m.colSizes.length <= 5, `${k}: ${m.colSizes.length} font sizes in the column (≤ 5): ${m.colSizes.join(' ')}`)
    if (m.link) ok(m.link.link !== m.link.text, `${k}: links are ${m.link.link}, text is ${m.link.text}`)
    if (sz === 'phone') ok(m.kicker && m.kicker.lines === 1 && !m.kicker.cut, `${k}: the kicker is one line at 390 px, nothing cut off ("${m.kicker && m.kicker.text}")`)
  }
}
const d = res['spec01@desk']
ok(['spec01', 'scen05'].every((k) => res[`${k}@desk`].charsPerLine != null), 'the spec notes have a paragraph long enough to measure')
ok(d.tabStops <= 25, `01-spec, desktop, first viewport: ${d.tabStops} tab stops (≤ 25; the tree is one) · ${d.rawInteractive} visible links and buttons in all`)
ok(d.readPct >= 25, `01-spec, desktop: reading text covers ${d.readPct} % of the viewport (≥ 25)`)
for (const k of ['holt', 'post']) {
  ok(res[`${k}@desk`].firstProseTop < 320, `${k}: the first paragraph starts at ${res[`${k}@desk`].firstProseTop} px on desktop (< 320)`)
  ok(res[`${k}@phone`].firstProseTop < 420, `${k}: the first paragraph starts at ${res[`${k}@phone`].firstProseTop} px on a phone (< 420)`)
}
const sp = res['strip@phone'], sd = res['strip@desk']
ok(sp.length >= 3 && sp.every((x) => x.h >= 44 && x.w >= 44), `narration, phone: ${sp.length} strip buttons, all ≥ 44×44 (${sp.map((x) => `${x.b} ${x.w}×${x.h}`).join(', ')})`)
ok(sd.length >= 3 && sd.every((x) => x.h >= 32 && x.w >= 32), `narration, desktop: ${sd.length} strip buttons, all ≥ 32×32 (${sd.map((x) => `${x.b} ${x.w}×${x.h}`).join(', ')})`)
ok(/left/.test(res['stripText@desk']) && !/¶/.test(res['stripText@desk']), `the strip says the whole note's time left, no paragraph counter ("${res['stripText@desk']}")`)

console.log('round 2: colour')
for (const theme of Object.keys(THEMES)) {
  for (const sz of Object.keys(SIZES)) {
    console.log(` ${theme} · ${sz}`)
    for (const k of Object.keys(VIEWS2)) {
      const m = res[`r2:${theme}:${k}@${sz}`]
      ok(m.theme === theme, `${k}: the page is in ${m.theme}`)
      const parts = ['body', 'link', 'kicker', 'table', 'tree'].filter((g) => m[g] && m[g].n)
      const low = parts.filter((g) => m[g].min < 4.5)
      if (k !== 'graph') ok(parts.length >= 2 && !low.length, `${k}: text reaches 4.5:1 on what is behind it · ${parts.map((g) => `${g} ${m[g].min} (${m[g].n})`).join(' · ')}${low.length ? ' — LOW: ' + low.map((g) => `${g} ${m[g].worst}`).join('; ') : ''}`)
      if (k !== 'graph' && m.marks.n) ok(m.marks.min >= 3, `${k}: the section dot and folder chevrons reach 3:1 as marks (lowest ${m.marks.min}, ${m.marks.n})`)
      if (k !== 'graph' && k !== 'start') ok(m.accent.n <= 3, `${k}: ${m.accent.n} elements in view wear the accent (≤ 3)${m.accent.n ? ': ' + m.accent.what.join(', ') : ''}`)
      if (['spec01', 'T02', 'holt', 'post'].includes(k)) ok(m.sec && m.sec.name === m.sec.want && m.sec.dot === m.sec.wantMark, `${k}: the kicker is in ${m.sec && m.sec.sec}'s colour (name ${m.sec && m.sec.name}, dot ${m.sec && m.sec.dot})`)
      if (k === 'spec01') ok(!m.running.length, `${k}: no animation runs at rest (${m.running.join(', ') || 'none'}): the starfield is paused`)
      if (k === 'graph') ok(m.running.includes('lab-twinkle'), `#/graph: the starfield twinkles behind it (${m.running.join(', ') || 'none'})`)
    }
  }
  const wd = res[`r2:${theme}:word`]
  ok(wd && wd.r >= 4.5, `${theme}: the spoken word is ${wd && wd.fg} on ${wd && wd.bg}, ${wd && wd.r}:1 (≥ 4.5)`)
}

console.log('round 3: graphs → maps')
for (const theme of Object.keys(THEMES)) {
  console.log(` ${theme}`)
  for (const sz of Object.keys(SIZES)) {
    const notes = Object.keys(VIEWS2).filter((k) => k !== 'graph').filter((k) => res[`r3:${theme}:${k}@${sz}`].svgG)
    ok(!notes.length, `${sz}: no svg.nb-g on any note page or on start-here${notes.length ? ' — on ' + notes.join(', ') : ''}`)
  }
  const g = res[`r3:${theme}:graph@desk`].graph
  ok(g && g.minLine >= 12 && g.minPx >= 12, `#/graph, desktop: ${g && g.labels} visible labels, every line ≥ 12 px tall (smallest line ${g && g.minLine.toFixed(1)} px, type ${g && g.minPx.toFixed(1)} px on screen)`)
  ok(g && g.overlaps === 0, `#/graph, desktop: ${g && g.overlaps} label overlaps (0)`)
  ok(g && g.nodes <= 35, `#/graph, desktop: ${g && g.nodes} nodes in the default view (≤ 35)`)
  ok(g && ['Agent reliability', 'Builds', 'Writing'].every((t) => g.key.includes(t)) && /dot is a note/.test(g.key), 'the key names the three sections and says what a dot and a line are')
  const gp = res[`r3:${theme}:graph@phone`]
  ok(!gp.graph && gp.chart === 0 && gp.list && gp.list.minH >= 44, `#/graph, phone: no SVG; ${gp.list && gp.list.n} list rows, the shortest ${gp.list && Math.round(gp.list.minH)} px (≥ 44)`)
  for (const sz of Object.keys(SIZES)) {
    const st = res[`r3:${theme}:study@${sz}`]
    ok(st.chart === 0 && st.progress && st.progress.minPx >= 15, `study hub, ${sz}: no SVG chart; progress text ≥ 15 px (smallest ${st.progress && st.progress.minPx} px, ${st.progress && st.progress.n} pieces)`)
  }
  const h = res[`r3:${theme}:start@phone`]
  ok(h.aahil && h.entries === 3, `start-here's first phone screen: "Aahil" ${h.aahil ? 'is there' : 'MISSING'}, ${h.entries} entry links in full view (3)`)
}

console.log('round 4: reader controls')
for (const theme of Object.keys(THEMES)) {
  for (const sz of Object.keys(SIZES4)) {
    console.log(` ${theme} · ${sz}`)
    if (sz !== 'inapp') {
      ok(res[`r4:${theme}:theme@${sz}`] === theme, `the page is in ${res[`r4:${theme}:theme@${sz}`]}`)
      const steps = [0, 1, 2, 3, 4].map((i) => res[`r4:${theme}:step${i}@${sz}`])
      const want = [15, 17, 19, 21, 23]
      ok(steps.every((m, i) => m.size === String(i) && m.body === want[i]), `05-scenarios: the body is ${steps.map((m) => m.body).join(' / ')} px at the five steps (15 / 17 / 19 / 21 / 23)`)
      ok(steps.every((m, i) => Math.abs(m.h2 - want[i] * 1.2941) < 0.6) && steps.every((m, i) => !i || m.h2 > steps[i - 1].h2), `the h2 scales with it: ${steps.map((m) => m.h2.toFixed(1)).join(' / ')} px`)
      if (sz === 'phone') ok(steps.every((m) => m.sw <= 390 && m.iw <= 390), `390 px: no sideways scroll at any step (widest ${Math.max(...steps.map((m) => Math.max(m.sw, m.iw)))} px)`)
      const bar = res[`r4:${theme}:bar@${sz}`]
      ok(bar.shown && bar.end >= 0.99 && bar.top === 0 && bar.h === 2, `the progress hairline: 2 px, 0 at the top, ${bar.end} at the end of 05-scenarios (≥ 0.99)`)
      const g = res[`r4:${theme}:gloss@${sz}`]
      ok(g.used.length >= 1 && !g.missing.length, `every glossary term in 05-scenarios' text has a popover target (${g.used.join(', ')}; ${g.total} marked)${g.missing.length ? ' — MISSING: ' + g.missing.join(', ') : ''}`)
      const aa = res[`r4:${theme}:aa@${sz}`], min = sz === 'phone' ? 44 : 32
      ok(aa.open && aa.bs.length >= 8 && aa.bs.every((x) => x.h >= min), `the Aa panel: ${aa.bs.length} controls, all ≥ ${min} px tall (shortest ${Math.min(...aa.bs.map((x) => x.h))}: ${aa.bs.filter((x) => x.h === Math.min(...aa.bs.map((y) => y.h))).map((x) => x.t).slice(0, 2).join(', ')})`)
      ok(Math.abs(aa.top) <= 1 && (sz === 'phone' ? aa.left === 0 && aa.right === 0 : aa.right >= 0 && aa.left > 700), `the Aa panel opens ${sz === 'phone' ? 'from the top, full width (a sheet, never from the bottom)' : 'under the bar, at its right'} (top ${aa.top}, left ${aa.left}, right ${aa.right})`)
    }
    const big = Object.keys(VIEWS2).map((k) => [k, res[`r4:${theme}:big:${k}@${sz}`]])
    if (sz !== 'desk') ok(big.every(([, m]) => m.sw <= 390 && m.iw <= 390), `at 23 px, ${big.length} views have no sideways scroll at ${SIZES4[sz].join('×')}${big.filter(([, m]) => m.sw > 390 || m.iw > 390).map(([k, m]) => ` — ${k} ${Math.max(m.sw, m.iw)}`).join('')}`)
    ok(big.every(([, m]) => m.aaIn), `Aa is whole on the bar on all ${big.length} views, however long the path (the path gives way)${big.filter(([, m]) => !m.aaIn).map(([k]) => ' — ' + k).join('')}`)
    ok(big.every(([, m]) => !m.kickerCut), `at 23 px, no kicker is cut off (it wraps; the clock stays whole)${big.filter(([, m]) => m.kickerCut).map(([k]) => ' — ' + k).join('')}`)
    ok(big.every(([, m]) => m.barOne), `at 23 px, the bar's cells stay on one line on all ${big.length} views (the chrome does not grow)`)
  }
}

}

console.log('round 5: motion')
{
  const inv = new Map()
  const keyOf = (a) => `${a.kind === 'CSSTransition' ? 'css ' + a.name : a.kind === 'CSSAnimation' ? 'css @' + a.name : a.name} · ${a.target}`
  const twinkle = (a) => a.kind === 'CSSAnimation' && a.name === 'lab-twinkle'
  const NAV_OK = new Set(['opacity', 'transform'])
  for (const motion of ['motion', 'reduce']) {
    for (const sz of Object.keys(SIZES4)) {
      const r = res[`r5:${motion}@${sz}`]
      console.log(` ${motion} · ${sz}`)
      const all = [...r.navs.flatMap((x) => x.anims.map((a) => ({ ...a, at: x.k }))), ...r.acts.flatMap((x) => x.anims.map((a) => ({ ...a, at: x.k })))]
      for (const a of all) { const k = keyOf(a); const e = inv.get(k) || { ...a, motion: new Set(), at: new Set() }; e.motion.add(motion); e.at.add(a.at); if (motion === 'motion') Object.assign(e, { dur: a.dur, delay: Math.max(e.delay || 0, a.delay), easing: a.easing }); inv.set(k, e) }
      const notes = r.navs.filter((x) => x.k !== 'graph')
      const bad = notes.flatMap((x) => x.anims.filter((a) => !twinkle(a) && a.props.some((p) => !NAV_OK.has(p))).map((a) => `${x.k}: ${keyOf(a)} [${a.props}]`))
      ok(!bad.length, `${notes.length} note navigations: every animation touches only opacity and transform (${new Set(notes.flatMap((x) => x.anims.map(keyOf))).size} kinds)${bad.length ? ' — ' + bad.slice(0, 4).join(' | ') : ''}`)
      const lts = notes.map((x) => [x.k, Math.max(0, ...x.lt)])
      ok(lts.every(([, v]) => v < 50), `the longest task of any note navigation is under 50 ms (${lts.map(([k, v]) => (v ? `${k} ${v}` : '')).filter(Boolean).join(', ') || 'none over 50 at all'})`)
      const rest = notes.filter((x) => x.rest.length).map((x) => `${x.k}: ${x.rest.map(keyOf).join(', ')}`)
      ok(!r.startRest.length && !rest.length && r.stripRest === 0, `with no graph or trip showing, getAnimations() is empty at rest (on start-here, after each of ${notes.length} arrivals, after the strip)${rest.length ? ' — ' + rest.join(' | ') : ''}${r.startRest.length ? ' — start: ' + r.startRest.join(', ') : ''}`)
      const moved = all.filter((a) => !twinkle(a))
      if (motion === 'motion') {
        const offEase = moved.filter((a) => a.easing !== EASE || a.kfEase !== 'linear').map((a) => `${keyOf(a)} ${a.easing}/${a.kfEase}`)
        ok(!offEase.length, `all ${new Set(moved.map(keyOf)).size} kinds of animation run on ${EASE}${offEase.length ? ' — ' + [...new Set(offEase)].slice(0, 4).join(' | ') : ''}`)
        // a 0 s transition is a hold, not a motion: the drawer's visibility waits out its slide
        const hold = (a) => a.dur === 0 && a.props.every((p) => p === 'visibility') && DURS.includes(a.delay)
        const offDur = moved.filter((a) => !DURS.includes(a.dur) && !hold(a)).map((a) => `${keyOf(a)} ${a.dur}`)
        ok(!offDur.length, `every duration is one of ${DURS.join(' / ')} ms (the drawer's visibility holds for its slide)${offDur.length ? ' — ' + [...new Set(offDur)].slice(0, 4).join(' | ') : ''}`)
        const m1 = notes.filter((x) => x.k !== 'start' || true).filter((x) => x.anims.some((a) => a.name === 'm1-out') && x.anims.some((a) => a.name === 'm1-in'))
        ok(m1.length >= notes.length - 1, `note to note crossfades (out 120, in 220 rising 8 px) on ${m1.length} of ${notes.length} arrivals (the one from the graph rises in only)`)
        const acts = Object.fromEntries(r.acts.map((x) => [x.k, x.anims.map(keyOf)]))
        const has = (k, re) => (acts[k] || []).some((x) => re.test(x))
        if (sz === 'desk') ok(has('focus on', /m7-out/) && has('focus off', /m7-in/) && has('sidebar off', /m7-out/) && has('sidebar on', /m7-in/), 'focus mode and the sidebar: the panes leave and come back (320 ms)')
        else ok(has('drawer open', /css transform · nb-side/) && has('drawer open', /fade · nb-scrim/), 'the drawer slides in (320 ms) and its scrim fades (180 ms)')
        ok(has('strip in', /m3-row/) && has('strip in', /m3-in/) && has('strip in', /css box-shadow/) && has('strip out', /m3-row/), 'the strip: its row grows (180) and its contents fade in (120); the paragraph mark fades in (180); the row folds away on stop')
        ok(has('anchor', /m8-flash/) && has('fold', /css transform · nb-row__chev/), 'an anchor jump flashes its target (600); a folder\'s chevron turns (180)')
        if (sz === 'desk') {
          ok(has('hover', /css (background-color|color)/) && has('graph filter', /css opacity · n/), 'hover fades colour (180); a graph filter dims over 180')
          ok(r.camera && r.camera.moving && r.camera.moved && r.camera.ms >= 430 && r.camera.ms <= 700, `Fit tweens the camera through the one transform (${r.camera && r.camera.ms} ms; 450 planned)`)
          const g = r.navs.find((x) => x.k === 'graph')
          const ds = [...new Set(g.anims.filter((a) => a.name === 'm5-in').map((a) => a.delay))].sort((x, y) => x - y)
          ok(ds.length >= 3 && ds.every((d, i) => d === i * 40), `the graph's sections fade in one after another, ${ds.join(' / ')} ms apart (320 ms each)`)
          ok(r.fps && r.fps.median <= 1000 / 55, `a 2 s scroll of 05-scenarios: median frame ${r.fps && r.fps.median} ms (≥ 55 fps; p95 ${r.fps && r.fps.p95} ms, ${r.fps && r.fps.frames} frames, ${r.fps && r.fps.moved} px)`)
        }
      } else {
        const tf = moved.filter((a) => a.props.includes('transform')).map(keyOf)
        ok(!tf.length, `no animation has a transform keyframe (${new Set(moved.map(keyOf)).size} kinds seen)${tf.length ? ' — ' + [...new Set(tf)].join(' | ') : ''}`)
        const long = moved.filter((a) => (a.delay || 0) + a.dur * (a.iter || 1) > 120).map((a) => `${keyOf(a)} ${a.delay}+${a.dur}`)
        ok(!long.length, `none runs longer than 120 ms${long.length ? ' — ' + [...new Set(long)].slice(0, 5).join(' | ') : ''}`)
        if (sz === 'desk') ok(r.camera && !r.camera.moving, 'Fit jumps (no camera tween)')
        ok(!(r.navs.find((x) => x.k === 'graph') || { anims: [] }).anims.some((a) => a.name === 'm5-in'), 'the graph shows whole')
        ok((r.acts.find((x) => x.k === 'anchor') || { anims: [] }).anims.every((a) => a.name !== 'm8-flash'), 'an anchor jump is instant and keeps its static mark (no flash)')
      }
    }
  }
  console.log('\n  every animation seen (with motion; reduced motion runs the ones marked R, at ≤ 120 ms):')
  for (const [k, a] of [...inv.entries()].sort()) console.log(`    ${k.padEnd(44)} ${String(a.dur).padStart(5)} ms${a.delay ? ` +${a.delay} delay` : ''}  ${twinkle(a) ? 'ease-in-out (the sky)' : a.easing === EASE ? 'the easing' : a.easing}  ${a.motion.has('reduce') ? 'R' : ' '}  ${[...a.at].slice(0, 4).join(', ')}`)
}

console.log(fails ? `\n${fails} of ${n} FAILED` : `\nall ${n} audit checks pass`)
process.exit(fails ? 1 : 0)
