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

const b = await chromium.launch()
const res = {}
try {
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
} finally { await b.close() }
if (process.env.AUDIT_JSON) console.log(JSON.stringify(res, null, 1))

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

console.log(fails ? `\n${fails} of ${n} FAILED` : `\nall ${n} audit checks pass`)
process.exit(fails ? 1 : 0)
