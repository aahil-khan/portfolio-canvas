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

console.log(fails ? `\n${fails} of ${n} FAILED` : `\nall ${n} audit checks pass`)
process.exit(fails ? 1 : 0)
