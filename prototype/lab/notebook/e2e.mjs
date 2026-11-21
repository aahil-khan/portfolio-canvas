// prototype/lab/notebook/e2e.mjs: what the notebook claims, checked in a real browser. No screenshots:
// every visual claim is a geometry, hit-test or contrast assertion.
//
//   node prototype/lab/notebook/e2e.mjs [page.html]      (default: this folder's index.html;
//                                                        pass the bundled lab.html to check it)
//
// Playwright (playwright-core from ~/.local/share/cx-tools/node_modules, or $PLAYWRIGHT_CORE), at
// 1440×900, 390×844 and 390×664 (an in-app browser's real viewport), plus reduced motion. One
// browser, closed at the end. Exits 1 if anything fails.
//
// Round 4 (reader controls), at 1440×900 and 390×844: text size and line width persist across a
// reload with the attribute set before DOMContentLoaded; copy-link (desktop) and share (phone)
// write a URL that lands there; resume restores the scroll within 40 px and start-here offers the
// last tour step; ▶ after scrolling mid-note starts on that paragraph; the glossary popover and
// the hover preview; emulateMedia print hides the bar and the tree; the bar's title goes to the top.
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { homedir } from 'node:os'
import { TERMS, ALLOW } from './tools/import-tracker.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || join(homedir(), '.local/share/cx-tools/node_modules/playwright-core'))
const base = pathToFileURL(resolve(process.argv[2] || join(here, 'index.html'))).href
let fails = 0, n = 0
const ok = (cond, msg) => { n++; console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++ }
const wait = (p, ms) => p.waitForTimeout(ms)
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 }, inapp: { width: 390, height: 664 } }
const PHONES = ['phone', 'inapp']

const b = await chromium.launch()
const errors = []
// counts every AudioContext and every oscillator, so "nothing sounds before a gesture" is testable
const AUDIO_SPY = () => {
  window.__ac = 0; window.__osc = 0
  const A = window.AudioContext || window.webkitAudioContext
  if (!A) return
  class Spy extends A { constructor(...a) { super(...a); window.__ac++ } createOscillator() { window.__osc++; return super.createOscillator() } }
  window.AudioContext = Spy; window.webkitAudioContext = Spy
}
// records the Lab's theme attribute the moment <body> exists (before anything below it is parsed,
// so before first paint) and at DOMContentLoaded: "no flash" is testable
const THEME_SPY = () => {
  window.__theme = {}
  window.__prefs = {}
  const at = (k) => {
    const h = document.documentElement
    if (!(k in window.__theme)) window.__theme[k] = h.getAttribute('data-lab-theme')
    if (!(k in window.__prefs)) window.__prefs[k] = { size: h.getAttribute('data-lab-size'), width: h.getAttribute('data-lab-width') }
  }
  new MutationObserver((_, mo) => { if (document.body) { at('body'); mo.disconnect() } }).observe(document, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', () => at('dcl'))
}
const contexts = []
async function page(size, url, opts = {}) {
  const phone = PHONES.includes(size)
  const ctx = opts.ctx || await b.newContext({ viewport: SIZES[size], isMobile: phone, hasTouch: phone, reducedMotion: opts.reduce ? 'reduce' : 'no-preference', colorScheme: opts.scheme || 'dark' })
  if (!opts.ctx) { contexts.push(ctx); await ctx.addInitScript(AUDIO_SPY); await ctx.addInitScript(THEME_SPY) }
  const p = await ctx.newPage()
  p.setDefaultTimeout(6000)
  p.on('pageerror', (e) => errors.push(`${size} ${url}: ${e.message}`))
  await p.goto(base + url)
  await p.evaluate(() => document.fonts.ready)
  await wait(p, opts.settle ?? 600)
  return p
}
const close = async (p) => { await p.context().close(); contexts.splice(contexts.indexOf(p.context()), 1) }
const go = async (p, hash) => { await p.evaluate((h) => { location.hash = h }, hash); await wait(p, 160) }

// in the page: is the reading column covered, cut off or scrolling sideways?
const layoutProbe = () => {
  const col = document.querySelector('.nb-col'), head = document.querySelector('.nb-head')
  const vis = (e) => { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const clip = (r) => ({ l: Math.max(0, r.left), t: Math.max(0, r.top), r: Math.min(innerWidth, r.right), b: Math.min(innerHeight, r.bottom) })
  const cr = clip(col.getBoundingClientRect())
  const hits = []
  for (const e of document.querySelectorAll('body *')) {
    if (col.contains(e) || e.contains(col) || head.contains(e) || e.closest('.nb-layer') || e.closest('[hidden]')) continue
    const pos = getComputedStyle(e).position
    if (pos !== 'fixed' && pos !== 'sticky') continue
    if (!vis(e)) continue
    let a = e, shown = true
    while (a && a !== document.body) { const s = getComputedStyle(a); if (s.visibility === 'hidden' || +s.opacity === 0 || s.display === 'none') { shown = false; break } a = a.parentElement }
    if (!shown) continue
    const r = clip(e.getBoundingClientRect())
    if (!(r.l < cr.r && r.r > cr.l && r.t < cr.b && r.b > cr.t)) continue
    // it overlaps the column's box: is it painted on top anywhere there? (a layer behind is fine)
    const l = Math.max(r.l, cr.l), t = Math.max(r.t, cr.t), rr = Math.min(r.r, cr.r), bb = Math.min(r.b, cr.b)
    let top = false
    for (let i = 0; i < 5 && !top; i++) for (let j = 0; j < 5 && !top; j++) { const at = document.elementFromPoint(l + ((rr - l) * (i + 0.5)) / 5, t + ((bb - t) * (j + 0.5)) / 5); if (at && e.contains(at)) top = true }
    if (top) hits.push(e.className || e.id || e.tagName)
  }
  const tables = [...document.querySelectorAll('.nb-col .nb-table')].map((w) => ({ wide: w.querySelector('table').scrollWidth > w.clientWidth + 1, ox: getComputedStyle(w).overflowX, right: w.getBoundingClientRect().right }))
  return { hits, sw: document.documentElement.scrollWidth, iw: innerWidth, tables }
}
// scroll the column (desktop) or the document (phone) to its end; does the last block hit-test to itself?
const endProbe = () => {
  const main = document.querySelector('.nb-main'), phone = innerWidth < 900
  if (phone) scrollTo(0, document.documentElement.scrollHeight); else main.scrollTop = main.scrollHeight
  const blocks = [...document.querySelectorAll('.nb-note > *')].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && getComputedStyle(e).display !== 'none' })
  const last = blocks[blocks.length - 1]
  const r = last.getBoundingClientRect()
  const hb = document.querySelector('.nb-head').getBoundingClientRect().bottom
  const x = r.left + Math.min(r.width / 2, 40), y = (Math.max(r.top, hb) + Math.min(r.bottom, innerHeight)) / 2
  const at = document.elementFromPoint(x, y)
  return { tag: last.className || last.tagName, inside: !!at && last.contains(at), bottom: r.bottom, ih: innerHeight, headBottom: document.querySelector('.nb-head').getBoundingClientRect().bottom, top: r.top }
}
const contrastIn = (s) => {
  const rgb = (c) => { const m = c.match(/[\d.]+/g).map(Number); return m.slice(0, 3) }
  const lum = (c) => { const [r, g, bb] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.0722 * bb }
  const ratio = (a, z) => { const [x, y] = [lum(a), lum(z)].sort((m, k) => k - m); return (x + 0.05) / (y + 0.05) }
  const e = document.querySelector(s)
  const bg = rgb(getComputedStyle(e).backgroundColor)
  return [e, ...e.querySelectorAll('*')].filter((x) => x.textContent.trim()).map((x) => ratio(rgb(getComputedStyle(x).color), bg))
}

const ROUTES = {
  start: '', spec: '#/agent-reliability/shopkeeper/01-spec', tour3: '#/agent-reliability/shopkeeper/03-blind-agent?w=W1', longest: '#/agent-reliability/shopkeeper/05-scenarios',
  topic: '#/T02', study: '#/agent-reliability/study', w1: '#/W1', holt: '#/builds/02-holt', stub: '#/builds/01-drag-to-workspace', post: '#/writing/02-chrome-already-built-our-idea',
}

// E2E_ONLY=<size> runs one size and skips the rest (for iterating; the check runs everything)
const ONLY = process.env.E2E_ONLY
for (const size of Object.keys(SIZES).filter((x) => !ONLY || x === ONLY)) {
  const phone = PHONES.includes(size)
  console.log(`\n${size} ${SIZES[size].width}×${SIZES[size].height}`)

  // ── arriving ──────────────────────────────────────────────────────────────────────────
  {
    const p = await page(size, '')
    const r = await p.evaluate(() => {
      const cells = [...document.querySelectorAll('.nb-bar__cell')].filter((c) => c.offsetParent !== null && c.getBoundingClientRect().width > 0)
      const first = cells.sort((a, z) => a.getBoundingClientRect().left - z.getBoundingClientRect().left)[0]
      const side = [...document.querySelectorAll('.nb-side a, .nb-side button')][0]
      return { hash: location.hash, live: NB.trip.live(), timing: NB.trip.timing.in, h1: document.querySelector('.nb-title').textContent, muted: NIGHT.sound.muted, playing: NIGHT.voice.state().playing, ac: window.__ac, first: first.className, firstLeft: first.getBoundingClientRect().left, sideFirst: side.className, strip: document.querySelector('.nb-strip').hidden }
    })
    ok(r.hash === '#/' && r.live && r.timing === null && r.h1 === "Aahil's Lab", `no hash lands on start-here, in the Lab, with no trip (${r.hash})`)
    ok(r.muted && !r.playing && r.ac === 0 && r.strip, 'muted, nothing playing, no AudioContext before a gesture, no strip')
    if (!phone) ok(/nb-bar__canvas/.test(r.first) && r.firstLeft <= 1, `← canvas is the leftmost item of the bar (${r.first} at ${r.firstLeft}px)`)
    else ok(/nb-bar__menu/.test(r.first) && /nb-side__canvas/.test(r.sideFirst), `☰ takes the bar's left slot; ← canvas is the drawer's first row`)
    // the bar's cells stay on one line
    const one = await p.evaluate(() => { const cs = [...document.querySelectorAll('.nb-bar__cell')].filter((c) => c.offsetParent !== null); return cs.every((c) => c.getBoundingClientRect().height <= 44.5) && new Set(cs.map((c) => Math.round(c.getBoundingClientRect().top))).size === 1 })
    ok(one, "the bar's cells sit on one line")
    // round 4: the theme and the sounds moved into the Aa panel (O11); the bar holds one Aa cell
    const cells = await p.evaluate(() => {
      const aa = document.querySelector('.nb-bar [data-act="aa"]'), foot = [...document.querySelectorAll('.nb-side__foot button')].filter((x) => getComputedStyle(x).display !== 'none').map((x) => x.textContent)
      return { text: document.querySelector('.nb-bar').innerText, snd: !!document.querySelector('.nb-bar [data-act="snd"], .nb-bar [data-act="pal"], .nb-bar [data-act="theme"], .nb-side [data-act="snd"]'), aa: aa && aa.offsetParent !== null ? aa.getAttribute('aria-label') : null, foot }
    })
    ok(!cells.snd && !/snd:|pal:|◐/.test(cells.text) && /^Reading settings/.test(cells.aa || '') && (phone ? cells.foot.join() === 'Share this note' : cells.foot.join() === '? keys'), `no theme, sound or palette cell in the bar; Aa says "${cells.aa}"; the tree's footer: ${cells.foot.join(', ')}`)
    await close(p)
  }

  // ── a direct link ─────────────────────────────────────────────────────────────────────
  {
    const p = await page(size, ROUTES.spec)
    const r = await p.evaluate(() => {
      const lis = [...document.querySelectorAll('.nb-bar__path li')].filter((li) => !li.classList.contains('nb-ell'))
      const row = document.querySelector('.nb-row[aria-current="page"]')
      return { hash: location.hash, timing: NB.trip.timing.in, title: document.title, allLinks: lis.length === 4 && lis.every((li) => li.querySelector('a[href]')), segs: lis.map((li) => li.textContent).join('/'), row: row && row.dataset.route, open: document.querySelector('li[data-folder="agent-reliability/shopkeeper"]').dataset.open }
    })
    ok(r.hash === ROUTES.spec && r.timing === null, 'a direct link lands on its note with no trip')
    ok(r.allLinks, `every path segment is a link (${r.segs})`)
    ok(r.row === 'agent-reliability/shopkeeper/01-spec' && r.open === 'true', 'the sidebar marks the note, with its folder open')
    ok(r.title.startsWith('Shopkeeper Agent Spec v1'), `document.title is the note's title (${r.title})`)
    await go(p, '#/T02')
    const t = await p.evaluate(() => location.hash)
    ok(t === '#/agent-reliability/study/evals/T02', `#/T02 redirects to the full path (${t})`)
    await close(p)
  }

  // ── the path: titles; a phone shows "‹ parent" as one 44 px target, no doubled separator ──
  {
    const p = await page(size, ROUTES.longest)
    const r = await p.evaluate(() => {
      const path = document.querySelector('.nb-bar__path'), up = document.querySelector('.nb-up')
      return { text: path.innerText.replace(/\s*›\s*/g, ' › ').replace(/\s+/g, ' ').trim(), upH: up.getBoundingClientRect().height, href: up.getAttribute('href') }
    })
    if (phone) ok(/^‹ Shopkeeper$/.test(r.text) && r.upH >= 44 && r.href === '#/agent-reliability/shopkeeper' && !/[/›‹]\s*[/›‹]/.test(r.text), `the phone's path is "${r.text}", one ${r.upH} px target up to the hub, no doubled separator`)
    else ok(r.text === 'Lab › Agent reliability › Shopkeeper › Scenarios' && !/[/›]\s*[/›]/.test(r.text), `the path is titles, not slugs: "${r.text}"`)
    await close(p)
  }

  // ── prev / next move focus to the new note's h1 ──────────────────────────────────────
  {
    const p = await page(size, ROUTES.spec)
    await p.click('.nb-prevnext a[rel="next"]')
    await wait(p, 250)
    const a = await p.evaluate(() => ({ hash: location.hash, focus: document.activeElement.classList.contains('nb-title') && document.activeElement.closest('.nb-note').dataset.route }))
    await p.evaluate(() => document.activeElement.blur())
    await p.keyboard.press('[')
    await wait(p, 250)
    const k = await p.evaluate(() => document.activeElement.classList.contains('nb-title') && document.activeElement.closest('.nb-note').dataset.route)
    ok(/02-policy$/.test(a.hash) && a.focus === 'agent-reliability/shopkeeper/02-policy' && k === 'agent-reliability/shopkeeper/01-spec', `next → focuses 02-policy's h1; [ back focuses 01-spec's h1`)
    await close(p)
  }

  // ── focus mode: f hides the tree and the margin, centres the column, survives a reload ──
  if (!phone) {
    const p = await page(size, ROUTES.spec)
    const panes = () => {
      const side = getComputedStyle(document.querySelector('.nb-side')), margin = getComputedStyle(document.querySelector('.nb-margin'))
      const col = document.querySelector('.nb-col').getBoundingClientRect()
      return { on: document.documentElement.hasAttribute('data-focus'), side: side.visibility === 'hidden', margin: margin.display === 'none', centred: Math.abs((col.left + col.right) / 2 - innerWidth / 2) < 2, pressed: document.querySelector('[data-act="focus"]').getAttribute('aria-pressed') }
    }
    const before = await p.evaluate(panes)
    await p.keyboard.press('f')
    await wait(p, 100)
    const on = await p.evaluate(panes)
    await p.reload()
    await p.evaluate(() => document.fonts.ready)
    await wait(p, 500)
    const again = await p.evaluate(panes)
    await p.click('[data-act="focus"]')
    const off = await p.evaluate(panes)
    ok(!before.on && !before.side && on.on && on.side && on.margin && on.centred && on.pressed === 'true', 'f turns focus mode on: the tree and the margin go, the column centres, the bar button says so')
    ok(again.on && again.side && again.margin && again.centred && !off.on && !off.side, 'focus mode survives a reload, and the bar button turns it off')
    await close(p)
  }

  // ── every view: nothing cut off or covered ────────────────────────────────────────────
  {
    const p = await page(size, '')
    for (const [name, url] of Object.entries(ROUTES)) {
      await go(p, url || '#/')
      await wait(p, 120)
      const top = await p.evaluate(layoutProbe)
      const end = await p.evaluate(endProbe)
      const bottom = await p.evaluate(layoutProbe)
      const tablesOk = top.tables.every((t) => !t.wide || (t.ox === 'auto' && t.right <= top.iw + 0.5))
      if (process.env.E2E_DEBUG) console.log('   ', name, JSON.stringify({ end, hits: top.hits.concat(bottom.hits), tables: top.tables }))
      ok(!top.hits.length && !bottom.hits.length && top.sw <= top.iw && tablesOk && end.inside && end.bottom <= end.ih + 0.5,
        `${name}: nothing covers the column (top and end), no sideways scroll (${top.sw}/${top.iw}), ${top.tables.filter((t) => t.wide).length} wide tables scroll inside, the last block (${end.tag}) is reached and hit-tests to itself${top.hits.concat(bottom.hits).length ? ' — COVERED BY ' + top.hits.concat(bottom.hits).join(', ') : ''}`)
    }
    // the switcher and the drawer views
    await go(p, '#/')
    await close(p)
  }

  // ── hover and selection stay readable; hover changes nothing ──────────────────────────
  {
    const p = await page(size, ROUTES.spec)
    if (phone) { await p.click('.nb-bar__menu'); await wait(p, 300) }
    const before = await p.evaluate(() => document.querySelector('.nb-col').innerHTML)
    const target = '.nb-row[data-route="agent-reliability/shopkeeper/02-policy"]'
    await p.hover(target)
    await wait(p, 100)
    const after = await p.evaluate(() => document.querySelector('.nb-col').innerHTML)
    const hov = await p.evaluate(contrastIn, target)
    const sel = await p.evaluate(contrastIn, '.nb-row[aria-current="page"]')
    ok(before === after, 'hovering a sidebar row changes no content')
    ok(hov.length && Math.min(...hov) >= 4.5, `a hovered row is readable: lowest ${Math.min(...hov).toFixed(2)}:1`)
    ok(sel.length && Math.min(...sel) >= 4.5, `the selected row is readable: lowest ${Math.min(...sel).toFixed(2)}:1`)
    await close(p)
  }

  // ── the drawer (phone) ────────────────────────────────────────────────────────────────
  if (phone) {
    const p = await page(size, ROUTES.spec)
    await p.click('.nb-bar__menu')
    await wait(p, 320)
    const inside = []
    for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); inside.push(await p.evaluate(() => !!document.activeElement.closest('.nb-side'))) }
    const vis = await p.evaluate(() => { const r = document.querySelector('.nb-side').getBoundingClientRect(); return r.left >= -1 && r.width <= Math.min(innerWidth * 0.86, 340) + 1 })
    ok(vis && inside.every(Boolean), '☰ opens the drawer (≤ 86vw or 340 px), and focus stays trapped inside it')
    await p.keyboard.press('Escape')
    await wait(p, 300)
    const r = await p.evaluate(() => ({ open: document.documentElement.classList.contains('nb-drawer'), focus: document.activeElement.className }))
    ok(!r.open && /nb-bar__menu/.test(r.focus), 'Esc closes it and returns focus to ☰')
    await p.click('.nb-bar__menu')
    await wait(p, 320)
    await p.click('.nb-side .nb-row[data-route="agent-reliability/shopkeeper/02-policy"]')
    await wait(p, 400)
    const t = await p.evaluate(() => ({ hash: location.hash, open: document.documentElement.classList.contains('nb-drawer') }))
    ok(t.hash === '#/agent-reliability/shopkeeper/02-policy' && !t.open, 'tapping a note navigates and closes the drawer')
    await close(p)
    const q = await page(size, '#/&pop=drawer'.replace('#/&', '#/?'))
    ok(await q.evaluate(() => document.documentElement.classList.contains('nb-drawer')), '&pop=drawer opens it on arrival')
    await close(q)
  }

  // ── the switcher ──────────────────────────────────────────────────────────────────────
  {
    const p = await page(size, '')
    if (!phone) { await p.keyboard.press('/'); await wait(p, 100) } else { await p.click('[data-act="search"]'); await wait(p, 100) }
    const open1 = await p.evaluate(() => NB.switcher.isOpen() && document.activeElement.classList.contains('nb-dialog__in'))
    await p.keyboard.type('T02')
    const top = await p.evaluate(() => document.querySelector('.nb-dialog__list li[aria-selected="true"]').dataset.route)
    const selC = await p.evaluate(contrastIn, '.nb-dialog__list li[aria-selected="true"]')
    await p.keyboard.press('Enter')
    await wait(p, 200)
    const h = await p.evaluate(() => location.hash)
    ok(open1 && top === 'agent-reliability/study/evals/T02' && h === '#/agent-reliability/study/evals/T02', `${phone ? '⌕' : '/'} opens the switcher; T02 then Enter opens T02`)
    ok(Math.min(...selC) >= 4.5, `the switcher's selected row is readable: lowest ${Math.min(...selC).toFixed(2)}:1`)
    await p.keyboard.press('Control+k')
    await wait(p, 100)
    await p.keyboard.type('> palette amber')
    await p.keyboard.press('Enter')
    await wait(p, 100)
    ok(await p.evaluate(() => document.documentElement.dataset.labTheme === 'amber' && !NB.switcher.isOpen()), 'Ctrl+K opens it; > palette amber switches to the amber theme')
    await p.keyboard.press('Control+k')
    await wait(p, 100)
    await p.keyboard.press('Escape')
    await wait(p, 100)
    ok(await p.evaluate(() => !NB.switcher.isOpen()), 'Esc closes it')
    await close(p)
    const q = await page(size, '#/?pop=switcher')
    ok(await q.evaluate(() => NB.switcher.isOpen()), '&pop=switcher opens it on arrival')
    await close(q)
  }

  // ── where this fits, and the map (round 3: no local graph; a phone gets the map as a list) ──
  {
    const p = await page(size, ROUTES.spec)
    const r = await p.evaluate(() => {
      const n = NB.shell.state.note, want = new Set([...NB.vault.out(n), ...NB.vault.back(n)].map((l) => l.note.route))
      const end = document.querySelector('.nb-fits')
      const listed = end ? new Set([...end.querySelectorAll('ul a[data-route]')].map((a) => a.dataset.route)) : new Set()
      return { want: [...want].sort(), listed: [...listed].sort(), svg: !!document.querySelector('svg.nb-g'), part: (end.querySelector('.nb-fits__row') || {}).textContent || '', next: !!end.querySelector('.nb-fits__next'), map: (end.querySelector('.nb-fits__map a') || {}).getAttribute?.('href') }
    })
    ok(r.want.length > 0 && JSON.stringify(r.want) === JSON.stringify(r.listed), `01-spec's "where this fits" lists exactly its links ∪ backlinks (${r.listed.length})`)
    ok(!r.svg && /Agent reliability/.test(r.part) && /Shopkeeper/.test(r.part) && r.next && r.map === '#/graph?focus=agent-reliability/shopkeeper/01-spec', `no graph on the note; "Part of ${r.part.replace(/\s+/g, ' ').replace(/^Part of /, '')}", one Next →, and "see on the map →"`)
    ok(await p.evaluate(() => !document.querySelector('.nb-margin .nb-g, .nb-margin .nb-sec--back, .nb-margin .nb-sec--out')), 'the margin holds no graph and no link lists: only "on this page"')
    await go(p, ROUTES.post)
    ok(await p.evaluate(() => !/nothing links here/i.test(document.body.innerText) && ![...document.querySelectorAll('.nb-fits h3')].some((h) => !h.nextElementSibling || !h.nextElementSibling.querySelector('li'))), 'an empty list is not drawn ("nothing links here yet" is gone)')
    await go(p, '#/graph')
    await wait(p, 300)
    if (!phone) {
      const g = await p.evaluate(() => {
        const svg = document.querySelector('.nb-g--full'), sr = svg.getBoundingClientRect()
        const ns = [...svg.querySelectorAll('a.n')]
        const inView = ns.every((a) => { const r = a.querySelector('.s').getBoundingClientRect(); return r.left >= sr.left - 1 && r.right <= sr.right + 1 && r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1 })
        return { count: ns.length, tracks: ns.filter((a) => a.dataset.type === 'track').length, inView, key: document.querySelector('.nb-key').innerText }
      })
      ok(g.count <= 35 && g.tracks === 7 && g.inView, `#/graph shows ${g.count} nodes (≤ 35), the topics folded into ${g.tracks} tracks, fitted fully in view`)
      ok(/Each dot is a note/.test(g.key) && ['Agent reliability', 'Builds', 'Writing'].every((t) => g.key.includes(t)), 'the key says what a dot and a line mean and names the sections')
      // clicking a track expands its topics: the count goes up by that track's size
      const t = await p.evaluate(() => { const a = document.querySelector('.nb-g--full a.n[data-route="track:agent-reliability/study/evals"]'); const r = a.querySelector('.s').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, before: document.querySelectorAll('.nb-g--full a.n').length, size: NB.vault.notes.filter((n) => n.folder === 'agent-reliability/study/evals').length } })
      await p.mouse.click(t.x, t.y)
      await wait(p, 200)
      const after = await p.evaluate(() => ({ n: document.querySelectorAll('.nb-g--full a.n').length, card: (document.querySelector('.nb-card:not([hidden])') || {}).innerText || '' }))
      ok(after.n === t.before + t.size && /Evals/.test(after.card), `clicking the Evals track expands its ${t.size} topics (${t.before} → ${after.n} nodes), and the card lists them`)
      await p.evaluate(() => { NB.shell.graphToggle('track:agent-reliability/study/evals'); NB.shell.graphUnselect() })
      await p.click('.nb-graph__bar [data-filter="builds"]')
      const dim = await p.evaluate(() => [...document.querySelectorAll('.nb-g--full a.n')].every((a) => a.classList.contains('is-dim') === (a.dataset.sec === 'builds')))
      ok(dim, 'a section filter dims that section')
      // pan and zoom write one element's transform, and nothing else
      await p.evaluate(() => { window.__mut = new Set(); new MutationObserver((ms) => { for (const m of ms) window.__mut.add(m.target.getAttribute('class') + ':' + m.attributeName) }).observe(document.querySelector('.nb-g--full'), { attributes: true, subtree: true }) })
      const box = await p.evaluate(() => { const r = document.querySelector('.nb-g--full').getBoundingClientRect(); return { x: r.left + 12, y: r.top + 12 } })
      await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.x + 60, box.y + 40, { steps: 6 }); await p.mouse.up()
      await p.mouse.wheel(0, -200)
      await wait(p, 100)
      const mut = await p.evaluate(() => [...window.__mut])
      ok(mut.length === 1 && mut[0] === 'nb-g__world:transform', `pan and zoom change only one element's transform (${mut.join(', ')})`)
      await p.click('.nb-graph__bar [data-fit]')
      await wait(p, 100)
      const fit = await p.evaluate(() => { const sr = document.querySelector('.nb-g--full').getBoundingClientRect(); return [...document.querySelectorAll('.nb-g--full a.n .s')].every((s) => { const r = s.getBoundingClientRect(); return r.left >= sr.left - 1 && r.right <= sr.right + 1 && r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1 }) })
      ok(fit, 'Fit brings every node back into view')
      // ?focus= centres the note within 2 px, its neighbours lit, its card open
      await go(p, '#/graph?focus=agent-reliability/shopkeeper/01-spec')
      await wait(p, 300)
      const f = await p.evaluate(() => {
        const sr = document.querySelector('.nb-g--full').getBoundingClientRect(), a = document.querySelector('.nb-g--full a.n[data-route="agent-reliability/shopkeeper/01-spec"]'), r = a.querySelector('.s').getBoundingClientRect()
        return { dx: r.left + r.width / 2 - (sr.left + sr.width / 2), dy: r.top + r.height / 2 - (sr.top + sr.height / 2), sel: a.classList.contains('is-sel'), lit: document.querySelectorAll('.nb-g--full a.n.is-lit').length, card: (document.querySelector('.nb-card:not([hidden]) .nb-card__open') || {}).getAttribute?.('href') }
      })
      ok(Math.abs(f.dx) <= 2 && Math.abs(f.dy) <= 2 && f.sel && f.lit > 0 && f.card === '#/agent-reliability/shopkeeper/01-spec', `?focus= centres 01-spec (off by ${f.dx.toFixed(1)}, ${f.dy.toFixed(1)} px), lights its ${f.lit} neighbours, and its card offers open →`)
    } else {
      const m = await p.evaluate(() => ({ svg: !!document.querySelector('.nb-col svg'), secs: document.querySelectorAll('.nb-maplist__sec').length, input: !!document.querySelector('.nb-maplist input') }))
      ok(!m.svg && m.secs >= 3 && m.input, `#/graph on a phone is the map as a list: no SVG, ${m.secs} sections, a filter on top`)
      await p.fill('.nb-maplist input', 'T02')
      await wait(p, 150)
      const hit = await p.evaluate(() => { const rows = [...document.querySelectorAll('.nb-maplist__row')].filter((a) => a.offsetParent !== null); return { rows: rows.map((a) => a.dataset.route), h: Math.min(...rows.map((a) => a.getBoundingClientRect().height)) } })
      ok(hit.rows.includes('agent-reliability/study/evals/T02') && hit.rows.length <= 3 && hit.h >= 44, `the filter finds T02 (${hit.rows.length} row${hit.rows.length === 1 ? '' : 's'} shown, ${Math.round(hit.h)} px tall)`)
      await p.click('.nb-maplist__row[data-route="agent-reliability/study/evals/T02"]')
      await wait(p, 200)
      ok(await p.evaluate(() => location.hash === '#/agent-reliability/study/evals/T02'), 'tapping a row opens the note')
    }
    await close(p)
  }

  // ── walkthroughs ──────────────────────────────────────────────────────────────────────
  {
    const p = await page(size, ROUTES.w1)
    const r = await p.evaluate(() => ({ steps: document.querySelectorAll('[data-block="steps"] li').length, meta: [...document.querySelectorAll('.nb-meta')].map((m) => m.textContent).join(' ') }))
    ok(r.steps === 9 && /9 notes · ~\d+ min read · ~\d+ min listen/.test(r.meta), `the W1 page lists 9 steps with their totals`)
    await p.click('[data-block="steps"] li:nth-child(3) a')
    await wait(p, 200)
    const b3 = await p.evaluate(() => ({ hash: location.hash, banner: (document.querySelector('.nb-tour') || {}).textContent || '' }))
    ok(/03-blind-agent\?w=W1$/.test(b3.hash) && /3 of 9/.test(b3.banner), `step 3 opened from W1 shows "3 of 9"`)
    await p.evaluate(() => document.activeElement.blur())
    await p.keyboard.press(']')
    await wait(p, 200)
    ok(await p.evaluate(() => /02-policy\?w=W1$/.test(location.hash) && /4 of 9/.test(document.querySelector('.nb-tour').textContent)), '] goes to step 4 (02 policy)')
    await close(p)
  }

  // ── listening ─────────────────────────────────────────────────────────────────────────
  {
    const p = await page(size, ROUTES.spec + '?x', {})
    await go(p, ROUTES.spec)
    await p.evaluate(() => NIGHT.voice.use('sam'))
    await p.click('.nb-bar [data-act="listen"]')
    await p.waitForFunction(() => NIGHT.voice.state().playing, null, { timeout: 8000 }).catch(() => {})
    await wait(p, 300)
    const g = await p.evaluate(() => {
      const bar = document.querySelector('.nb-bar').getBoundingClientRect(), strip = document.querySelector('.nb-strip'), sr = strip.getBoundingClientRect()
      const col = document.querySelector('.nb-col').getBoundingClientRect(), main = document.querySelector('.nb-main').getBoundingClientRect()
      return { shown: !strip.hidden, gap: Math.abs(sr.top - bar.bottom), below: (innerWidth < 900 ? col.top : main.top) >= sr.bottom - 0.5, playing: NIGHT.voice.state().playing }
    })
    ok(g.shown && g.gap < 1 && g.below && g.playing, `▶ with sam brings in the strip right under the bar; the column starts below it (gap ${g.gap.toFixed(1)} px)`)
    const covered = await p.evaluate(layoutProbe)
    ok(!covered.hits.length, `while it plays nothing covers the column${covered.hits.length ? ': ' + covered.hits.join(', ') : ''}`)
    const w0 = await p.evaluate(() => NIGHT.voice.state().word)
    await wait(p, 1500)
    const w1 = await p.evaluate(() => ({ word: NIGHT.voice.state().word, lit: !!document.querySelector('.nb-word.is-on'), k: NB.narrator.state.k }))
    ok((w1.word > w0 || w1.k > 0) && w1.lit, `the word highlight advances (word ${w0} → ${w1.word}, part ${w1.k + 1})`)
    await p.evaluate(() => document.activeElement.blur())
    await p.keyboard.press(' ')
    await wait(p, 150)
    ok(await p.evaluate(() => !NIGHT.voice.state().playing && !document.querySelector('.nb-strip').hidden), 'space pauses, and the strip stays')
    await p.keyboard.press('Escape')
    await wait(p, 150)
    ok(await p.evaluate(() => document.querySelector('.nb-strip').hidden && !NIGHT.voice.state().playing), 'Esc stops, and the strip leaves')
    // the narrator never yanks the page: scrolled away, it waits and offers to come back
    await go(p, ROUTES.longest)
    await p.click('.nb-bar [data-act="listen"]')
    await p.waitForFunction(() => NIGHT.voice.state().playing, null, { timeout: 8000 }).catch(() => {})
    const focusOn = await p.evaluate(() => document.documentElement.hasAttribute('data-focus'))
    await p.evaluate(() => NB.narrator.part(Math.floor(NB.narrator.state.parts.length / 2)))
    await p.waitForFunction(() => NIGHT.voice.state().playing, null, { timeout: 8000 }).catch(() => {})
    await wait(p, 2600)
    const pos = () => (innerWidth < 900 ? window.scrollY : document.querySelector('.nb-main').scrollTop)
    const followed = await p.evaluate(pos)
    if (phone) await p.evaluate(() => scrollTo(0, 0))
    else { await p.mouse.move(700, 450); await p.mouse.wheel(0, -200000) }
    await wait(p, 3000)
    const stay = { y: await p.evaluate(pos), ...(await p.evaluate(() => ({ playing: NB.narrator.active(), chip: !!document.querySelector('.nb-strip__follow') }))) }
    if (process.env.E2E_DEBUG) console.log('   ', JSON.stringify({ focusOn, followed, stay }))
    ok(focusOn && followed > 400 && stay.y < 60 && stay.playing && stay.chip, `while it plays, the page follows (to ${Math.round(followed)} px) until the reader scrolls; scrolled to the top it stays there 3 s later (${Math.round(stay.y)} px), and the strip offers "↓ back to narration"; focus mode is on`)
    await p.click('.nb-strip__follow')
    await wait(p, 1200)
    const back = await p.evaluate(pos)
    await p.keyboard.press('Escape')
    await wait(p, 150)
    ok(back > 400 && !(await p.evaluate(() => document.documentElement.hasAttribute('data-focus'))), `"↓ back to narration" scrolls back (${Math.round(back)} px); stopping restores focus mode to off`)
    // a walkthrough plays note by note
    await go(p, '#/W1')
    await p.click('.nb-bar [data-act="listen"]')
    await p.waitForFunction(() => NIGHT.voice.state().playing, null, { timeout: 8000 }).catch(() => {})
    const s1 = await p.evaluate(() => ({ hash: location.hash, strip: document.querySelector('.nb-strip__where').textContent }))
    await p.evaluate(() => NB.narrator.seekEnd())
    await p.waitForFunction(() => /01-spec/.test(location.hash) && NIGHT.voice.state().playing, null, { timeout: 8000 }).catch(() => {})
    const s2 = await p.evaluate(() => ({ hash: location.hash, playing: NIGHT.voice.state().playing, strip: document.querySelector('.nb-strip__where').textContent }))
    ok(/agent-reliability\/shopkeeper\?w=W1$/.test(s1.hash) && /W1 · 1\/9/.test(s1.strip), `▶ on W1 opens step 1 and plays (${s1.strip})`)
    ok(/01-spec\?w=W1$/.test(s2.hash) && s2.playing && /W1 · 2\/9/.test(s2.strip), `seeking to the end of step 1 moves to step 2, and playback continues (${s2.strip})`)
    // focus mode is on while it plays, so the tree is put away on desktop: navigate by the hash
    if (phone) { await p.click('.nb-bar__menu'); await wait(p, 300); await p.click('.nb-side .nb-row[data-route="builds"]') } else await go(p, '#/builds')
    await wait(p, 300)
    const res = await p.evaluate(() => ({ playing: NIGHT.voice.state().playing, resume: (document.querySelector('.nb-strip__resume') || {}).textContent || '' }))
    ok(!res.playing && /resume W1/.test(res.resume), `a manual navigation pauses it, and the strip offers "${res.resume}"`)
    await close(p)
  }

  // ── sound ─────────────────────────────────────────────────────────────────────────────
  if (!phone) {
    const p = await page(size, ROUTES.spec)
    await p.keyboard.press('/'); await wait(p, 80); await p.keyboard.type('T0'); await p.keyboard.press('Escape')
    await p.click('.nb-row[data-route="agent-reliability/shopkeeper/02-policy"]')
    await wait(p, 150)
    const quiet = await p.evaluate(() => ({ muted: NIGHT.sound.muted, osc: window.__osc }))
    ok(quiet.muted && quiet.osc === 0, 'muted on arrival; no cue sounds while muted')
    await p.click('.nb-bar [data-act="aa"]')
    await p.click('.nb-aa [data-act="snd"]')
    await p.keyboard.press('Escape')
    await p.click('.nb-row[data-route="agent-reliability/shopkeeper/03-blind-agent"]')
    await wait(p, 150)
    const loud = await p.evaluate(() => ({ muted: NIGHT.sound.muted, osc: window.__osc, label: document.querySelector('.nb-aa [data-act="snd"]').textContent }))
    ok(!loud.muted && loud.osc > 0 && /on/.test(loud.label), `the one toggle unmutes (${loud.label}), and cues play`)
    await close(p)
  }

  // ── the trip ──────────────────────────────────────────────────────────────────────────
  if (size !== 'inapp') {
    const p = await page(size, '#desk')
    const desk = await p.evaluate(() => ({ live: NB.trip.live(), t: NB.trip.state.t, rects: NB.trip.rects() }))
    ok(!desk.live && desk.t === 0, '#desk starts on the canvas')
    await p.focus('.desk-dock__item[data-id="lab"]')
    await p.keyboard.press('Enter')
    await wait(p, 1700)
    const r = await p.evaluate(() => ({ live: NB.trip.live(), ms: NB.trip.timing.in, hash: location.hash, focus: document.activeElement.className }))
    ok(r.live && r.ms >= 1100 && r.ms <= 1300 && r.hash === '#/' && /nb-title/.test(r.focus), `Enter on the Lab tile lands on start-here in ${r.ms} ms, focus on the note's h1`)
    // frozen frames, both ways: the bar's clip shrinks on every edge, the dock leaves, the sidebar stays under the bar
    for (const back of [false, true]) {
      const frames = await p.evaluate((bk) => { const out = []; for (let k = 0; k <= 26; k++) { NB.trip.scrub(k / 26, bk); out.push(NB.trip.frame()) } return out }, back)
      const mono = (f) => frames.every((x, i) => i === 0 || f(frames[i - 1]) >= f(x) - 0.01)
      const edgesOk = [0, 1, 2, 3, 4].every((k) => mono((x) => x.clip[k]))
      const inside = frames.every((x) => x.clip.every((v) => v >= -0.01) && x.clip[1] + x.clip[3] <= x.iw + 0.01)
      const oneLine = frames.every((x) => new Set(x.cellsTop.map((v) => Math.round(v))).size <= 1 && x.cellsH.every((hh) => hh <= 44.5))
      const dockMono = frames.every((x, i) => i === 0 || frames[i - 1].dockTop <= x.dockTop + 0.01)
      const dockGone = frames.filter((x) => x.t >= 0.45).every((x) => x.dockTop >= x.ih)
      const sideBelow = phone ? frames.every((x) => !x.sideShown) : frames.every((x) => x.sideTop >= x.barBottom - 0.5)
      if (!(edgesOk && inside && oneLine && dockMono && dockGone && sideBelow)) console.log('   ', JSON.stringify({ edgesOk, inside, oneLine, dockMono, dockGone, sideBelow, f: frames.filter((x, i) => i % 6 === 0).map((x) => [x.t.toFixed(2), x.clip.map((v) => v.toFixed(1)).join(' '), Math.round(x.dockTop), x.cellsTop.map(Math.round).join(' '), Math.round(x.sideTop), Math.round(x.barBottom)]) }))
      ok(edgesOk && inside && oneLine && dockMono && dockGone && sideBelow, `27 frozen frames ${back ? 'back' : 'in'}: the clip shrinks monotonically on every edge, inside the viewport; the cells stay on one line; the dock's top only falls and is out of view by t = 0.45; ${phone ? 'the drawer stays shut' : 'the sidebar stays below the bar'}`)
    }
    // a 480-step scrub: no jumps; the clip starts on the pill and ends on the bar
    const scrub = await p.evaluate(() => {
      const fr = []
      for (let i = 0; i <= 480; i++) { NB.trip.scrub(i / 480); const f = NB.trip.frame(); fr.push([...f.clip, f.dockTop, document.querySelector('.nb-side').getBoundingClientRect().left]) }
      const worst = fr[0].map((_, k) => { const travel = Math.abs(fr[480][k] - fr[0][k]) || 1; let m = 0; for (let i = 1; i <= 480; i++) m = Math.max(m, Math.abs(fr[i][k] - fr[i - 1][k]) / travel); return m })
      NB.trip.scrub(1 / 480); const a = NB.trip.frame()
      const P = a.pill, B = a.bar
      const want = [P.top - B.top, a.iw - P.right, Math.max(0, (B.bottom - B.top) - (P.bottom - B.top)), P.left]
      const at0 = Math.max(...want.map((v, k) => Math.abs(v - a.clip[k])))
      NB.trip.scrub(479 / 480); const z = NB.trip.frame()
      const at1 = Math.max(...z.clip.slice(0, 4).map(Math.abs))
      NB.trip.scrub(1)
      return { worst: Math.max(...worst), at0, at1 }
    })
    ok(scrub.worst <= 0.08 && scrub.at0 <= 2 && scrub.at1 <= 2, `a 480-step scrub: the largest step is ${(scrub.worst * 100).toFixed(1)}% of its travel (≤ 8%); at 0⁺ the clip is ${scrub.at0.toFixed(2)} px from the pill, at 1⁻ ${scrub.at1.toFixed(2)} px from the bar`)
    // ?freeze= renders the same frame as a scrub
    const fz = await page(size, '?freeze=0.5#desk', { settle: 900 })
    const f1 = await fz.evaluate(() => NB.trip.frame().clip.map((v) => v.toFixed(1)).join(','))
    const f2 = await p.evaluate(() => { NB.trip.scrub(0.5); return NB.trip.frame().clip.map((v) => v.toFixed(1)).join(',') })
    ok(f1 === f2, `?freeze=0.5 holds the same frame as a scrub to 0.5 (${f1})`)
    await close(fz)
    await close(p)
    // the way back from a direct link: every card on its default spot
    const d = await page(size, ROUTES.spec)
    if (phone) { await d.click('.nb-bar__menu'); await wait(d, 300); await d.click('.nb-side__canvas') } else await d.click('.nb-bar__canvas')
    await wait(d, 1700)
    const back = await d.evaluate((before) => {
      const now = NB.trip.rects()
      return { delta: Math.max(...Object.keys(before).map((id) => Math.max(...before[id].map((v, i) => Math.abs(v - now[id][i]))))), hash: location.hash, ms: NB.trip.timing.out, t: NB.trip.state.t }
    }, desk.rects)
    ok(back.t === 0 && back.hash === '#desk' && back.delta < 0.01 && back.ms >= 1100 && back.ms <= 1300, `from a direct link, ← canvas lands on the desk in ${back.ms} ms with every card on its default spot (max Δ ${back.delta.toFixed(2)} px)`)
    await close(d)
    const rt = await page(size, '?roundtrip=1#desk', { settle: 600 })
    await rt.waitForFunction(() => NB.trip.roundtrip, null, { timeout: 9000 }).catch(() => {})
    const rr = await rt.evaluate(() => NB.trip.roundtrip || {})
    ok(rr.delta === 0 && rr.in >= 1100 && rr.in <= 1300 && rr.out >= 1100 && rr.out <= 1300, `?roundtrip=1: max Δ ${rr.delta != null ? rr.delta.toFixed(2) : '?'} px, desk → lab ${rr.in} ms, lab → desk ${rr.out} ms`)
    await close(rt)
  }
}

// ── the themes: how one is chosen, and no flash ────────────────────────────────────────────
console.log('\nthemes')
if (!ONLY) {
  for (const size of ['desktop', 'phone']) {
    const light = await page(size, ROUTES.spec, { scheme: 'light' })
    const dark = await page(size, ROUTES.spec, { scheme: 'dark' })
    const lt = await light.evaluate(() => ({ t: document.documentElement.dataset.labTheme, bg: getComputedStyle(document.querySelector('.nb-main')).backgroundColor, spy: window.__theme }))
    const dt = await dark.evaluate(() => document.documentElement.dataset.labTheme)
    ok(lt.t === 'paper' && lt.spy.body === 'paper' && /251, 250, 246/.test(lt.bg) && dt === 'night', `${size}: a direct link follows prefers-color-scheme: light gives paper (${lt.bg}), dark gives night`)
    await close(dark)
    // the trip lands in night, even in light mode, even with paper stored; and it stores nothing
    await light.evaluate(() => NB.prefs.setTheme('paper'))
    const trip = await page(size, '#desk', { scheme: 'light', ctx: light.context() })
    await trip.evaluate(() => NB.trip.enter())
    await wait(trip, 200)
    const tr = await trip.evaluate(() => ({ t: document.documentElement.dataset.labTheme, live: NB.trip.live(), stored: NB.prefs.stored(), hash: location.hash }))
    ok(tr.live && tr.t === 'night' && tr.stored === 'paper', `${size}: the trip from the canvas lands in night (${tr.t}, at ${tr.hash}); the stored choice (${tr.stored}) is untouched`)
    await trip.close()
    // a stored choice survives a reload, with the attribute on <html> before <body> is parsed
    // (round 4: the choice is made in the Aa panel; auto goes back to following the device)
    await light.click('.nb-bar [data-act="aa"]')
    await light.click('.nb-aa [data-mode="night"]')
    const picked = await light.evaluate(() => document.documentElement.dataset.labTheme)
    await light.reload()
    await light.evaluate(() => document.fonts.ready)
    await light.click('.nb-bar [data-act="aa"]')
    const again = await light.evaluate(() => ({ t: document.documentElement.dataset.labTheme, spy: window.__theme, pressed: (document.querySelector('.nb-aa [data-mode][aria-pressed="true"]') || {}).dataset?.mode }))
    ok(picked === 'night' && again.t === 'night' && again.spy.body === 'night' && again.spy.dcl === 'night' && again.pressed === 'night', `${size}: Aa → Night on paper picks ${picked}; after a reload in light mode it is still ${again.t}, set before <body> (${again.spy.body}) and before DOMContentLoaded (${again.spy.dcl}); the panel shows ${again.pressed}`)
    await light.click('.nb-aa [data-mode="auto"]')
    const auto = await light.evaluate(() => ({ t: document.documentElement.dataset.labTheme, stored: NB.prefs.stored() }))
    ok(auto.t === 'paper' && auto.stored === null, `${size}: Aa → Auto stores nothing and follows the device again (${auto.t})`)
    await close(light)
  }
}

// ── round 4: the reader's controls ─────────────────────────────────────────────────────────
console.log('\nreader controls')
if (!ONLY || ONLY === 'desktop' || ONLY === 'phone') {
  for (const size of ['desktop', 'phone']) {
    const phone = PHONES.includes(size)
    // text size and line width persist across a reload, on <html> before DOMContentLoaded
    {
      const p = await page(size, ROUTES.spec)
      const px = () => parseFloat(getComputedStyle(document.querySelector('.nb-body p')).fontSize)
      const before = await p.evaluate(px)
      if (phone) { await p.click('.nb-bar [data-act="aa"]'); await p.click('.nb-aa [data-size="4"]'); await p.keyboard.press('Escape') }
      else { await p.keyboard.press('+'); await p.keyboard.press('+'); await p.keyboard.press('='); await p.keyboard.press('-'); await p.click('.nb-bar [data-act="aa"]'); await p.click('.nb-aa [data-width="wide"]'); await p.keyboard.press('Escape') }
      await p.reload()
      await p.evaluate(() => document.fonts.ready)
      await wait(p, 300)
      const r = await p.evaluate((pxs) => ({ spy: window.__prefs, px: eval(pxs)(), sw: document.documentElement.scrollWidth, iw: innerWidth, measure: getComputedStyle(document.querySelector('.nb-col')).getPropertyValue('--measure') }), `(${px})`)
      const want = phone ? { size: '4', width: 'narrow', px: 23 } : { size: '3', width: 'wide', px: 21 }
      ok(before === 17 && r.spy.body.size === want.size && r.spy.dcl.size === want.size && r.spy.body.width === want.width && r.spy.dcl.width === want.width && r.px === want.px,
        `${size}: text size ${want.px} px${phone ? '' : ' and the wide line'} survive a reload, set on <html> before <body> (${JSON.stringify(r.spy.body)}) and before DOMContentLoaded; the body reads ${r.px} px (was ${before})`)
      if (phone) ok(r.sw <= 390 && r.iw <= 390, `phone at 23 px: no sideways scroll (${r.sw} px of content in a ${r.iw} px viewport, ≤ 390)`)
      await close(p)
    }
    // copy a link to a heading (desktop) or share the note (phone): the URL lands there
    {
      const ctx = await b.newContext({ viewport: SIZES[size], isMobile: phone, hasTouch: phone, colorScheme: 'dark' })
      contexts.push(ctx)
      const p = await page(size, ROUTES.longest, { ctx })
      let url, head = null
      if (!phone) {
        head = await p.evaluate(() => { const hs = [...document.querySelectorAll('.nb-body h2[id], .nb-body h3[id]')]; return hs[Math.floor(hs.length / 2)].id })
        await p.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), head)
        await p.hover(`#${head}`)
        await wait(p, 60)
        const shown = await p.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .nb-hlink`)).opacity, head)
        await p.click(`#${head} .nb-hlink`)
        url = await p.evaluate(() => NB.controls.last)
        ok(shown === '1' && url.endsWith(`?a=${head}`), `desktop: # appears on hovering a heading and copies a link to it (…${url.slice(-36)})`)
      } else {
        await p.evaluate(() => NB.controls.scroller().scrollTo(0, 1e6))
        await wait(p, 100)
        await p.click('.nb-endbar [data-act="share"]')
        url = await p.evaluate(() => NB.controls.last)
        ok(/05-scenarios$/.test(url || ''), `phone: Share at the note's end hands over the note's URL (…${(url || '').slice(-30)})`)
      }
      await p.waitForFunction(() => !document.querySelector('.nb-toast').hidden, null, { timeout: 2000 }).catch(() => {})
      const toast = await p.evaluate(() => { const t = document.querySelector('.nb-toast'); return { shown: !t.hidden, text: t.textContent, top: t.getBoundingClientRect().top } })
      ok(toast.shown && /copied|copy/i.test(toast.text) && toast.top < 120, `a toast at the top says "${toast.text}"`)
      const q = await page(size, '', { ctx })
      await q.goto(url)
      await q.evaluate(() => document.fonts.ready)
      await wait(q, 500)
      const land = await q.evaluate((id) => {
        const hb = document.querySelector('.nb-head').getBoundingClientRect().bottom
        const t = id ? document.getElementById(id) : document.querySelector('.nb-title')
        const r = t.getBoundingClientRect()
        return { top: Math.round(r.top - hb), y: NB.controls.scrollTop(), route: NB.shell.state.route, target: !id || t.classList.contains('is-target') }
      }, head)
      ok(land.route === 'agent-reliability/shopkeeper/05-scenarios' && land.target && (head ? land.top >= -2 && land.top < 60 : land.y === 0), `the copied URL lands on ${head ? 'that heading' : 'the note'} (${land.top} px under the bar)`)
      await q.close()
      await close(p)
    }
    // resume: the scroll position per note, within 40 px; start-here offers the last tour step
    {
      const p = await page(size, ROUTES.longest)
      await p.evaluate(() => NB.controls.scroller().scrollTo(0, 2400))
      await wait(p, 700)
      const at = await p.evaluate(() => NB.controls.scrollTop())
      await go(p, '#/agent-reliability/shopkeeper/01-spec')
      await go(p, ROUTES.longest)
      await wait(p, 200)
      const back = await p.evaluate(() => ({ y: NB.controls.scrollTop(), toast: document.querySelector('.nb-toast').textContent }))
      await p.goto('about:blank')
      await p.goto(base + ROUTES.longest)
      await p.evaluate(() => document.fonts.ready)
      await wait(p, 500)
      const fresh = await p.evaluate(() => NB.controls.scrollTop())
      ok(Math.abs(back.y - at) <= 40 && Math.abs(fresh - at) <= 40 && /top/.test(back.toast), `resume: back at ${back.y} and after a reload at ${fresh} (left at ${at}, ±40), with "${back.toast}" offered`)
      await go(p, ROUTES.tour3)
      await go(p, '#/')
      const cont = await p.evaluate(() => { const a = document.querySelector('.nb-resume a'); return a ? { text: a.textContent, href: a.getAttribute('href') } : null })
      ok(cont && /^Continue W1 at step 3/.test(cont.text) && /03-blind-agent\?w=W1$/.test(cont.href), `start-here: "${cont && cont.text}"`)
      await close(p)
    }
    // ▶ after scrolling to a mid-note paragraph starts on that paragraph
    {
      const p = await page(size, ROUTES.tour3)
      const say = await p.evaluate(() => {
        const ps = [...document.querySelectorAll('.nb-body p[data-say]')]
        const t = ps[Math.floor(ps.length / 2)]
        const hb = document.querySelector('.nb-head').getBoundingClientRect().bottom
        NB.controls.scroller().scrollBy(0, t.getBoundingClientRect().top - hb - 12)
        return t.dataset.say
      })
      await wait(p, 200)
      await p.evaluate(() => { NIGHT.voice.use('sam'); NB.narrator.press() })
      await p.waitForFunction(() => document.querySelector('.nb-say-on'), null, { timeout: 8000 }).catch(() => {})
      const r = await p.evaluate(() => ({ k: NB.narrator.state.k, part: NB.narrator.state.parts[NB.narrator.state.k].i, on: (document.querySelector('.nb-say-on') || {}).dataset?.say }))
      ok(String(r.part) === say && r.on === say && r.k > 0, `▶ mid-note starts on the paragraph in view (part ${r.k}, block ${r.part}; the highlight is on ${r.on}; wanted ${say})`)
      await p.evaluate(() => NB.narrator.stop())
      await close(p)
    }
    // the glossary: the first use is marked; a tap shows ≤ 2 lines and "more →" to the glossary
    {
      const p = await page(size, ROUTES.longest)
      await p.evaluate(() => document.querySelector('.nb-gl').scrollIntoView({ block: 'center' }))
      await wait(p, 100)
      await p.click('.nb-gl')
      await wait(p, 60)
      const g = await p.evaluate(() => {
        const pop = document.querySelector('.nb-pop'), d = pop.querySelector('.nb-pop__def'), r = pop.getBoundingClientRect()
        return { shown: !pop.hidden, n: document.querySelectorAll('.nb-body .nb-gl[data-gloss="zopa"]').length, lines: Math.round(d.getBoundingClientRect().height / parseFloat(getComputedStyle(d).lineHeight)), more: pop.querySelector('.nb-pop__more').getAttribute('href'), inside: r.left >= 0 && r.right <= innerWidth }
      })
      ok(g.shown && g.lines <= 2 && g.inside && /01-glossary\?a=zopa$/.test(g.more), `ZOPA: a tap shows ${g.lines} line(s) inside the screen, and more → ${g.more}`)
      await p.click('.nb-pop__more')
      await wait(p, 300)
      const gl = await p.evaluate(() => ({ route: NB.shell.state.route, inTree: !!document.querySelector('.nb-tree [data-route="01-glossary"]'), target: (document.querySelector('.is-target') || {}).id }))
      ok(gl.route === '01-glossary' && !gl.inTree && gl.target === 'zopa', `more → opens the glossary at ZOPA; the glossary is not in the tree`)
      if (!phone) {
        // Q9: a hover preview after 350 ms: a 320 px card with the title, the kicker and the summary
        await go(p, ROUTES.holt)
        const a = await p.evaluate(() => { const l = document.querySelector('.nb-body a.nb-wl:not(.nb-rowref)'); l.scrollIntoView({ block: 'center' }); return l.getAttribute('href') })
        await p.hover(`.nb-body a.nb-wl[href="${a}"]`)
        await wait(p, 150)
        const early = await p.evaluate(() => !document.querySelector('.nb-pop').hidden)
        await wait(p, 400)
        const card = await p.evaluate(() => { const c = document.querySelector('.nb-pop'); return { shown: !c.hidden, w: Math.round(c.getBoundingClientRect().width), title: (c.querySelector('.nb-pop__title') || {}).textContent, kicker: (c.querySelector('.nb-pop__kicker') || {}).textContent } })
        ok(!early && card.shown && card.w === 320 && card.title && card.kicker, `a wikilink previews after 350 ms, not before: a ${card.w} px card, "${card.title}" (${card.kicker})`)
      }
      await close(p)
    }
    // print: no chrome, paper colours, tables whole
    {
      const p = await page(size, ROUTES.longest)
      await p.emulateMedia({ media: 'print' })
      const r = await p.evaluate(() => {
        const shown = (s) => { const e = document.querySelector(s); if (!e) return false; for (let a = e; a; a = a.parentElement) { const st = getComputedStyle(a); if (st.display === 'none' || st.visibility === 'hidden') return false } return e.getBoundingClientRect().height > 0 }
        return { bar: shown('.nb-bar'), tree: shown('.nb-side'), bg: getComputedStyle(document.querySelector('.nb-main')).backgroundColor, table: getComputedStyle(document.querySelector('.nb-table')).overflowX, rows: [...document.querySelectorAll('.nb-table tbody tr')].every((tr) => getComputedStyle(tr).display !== 'none'), body: shown('.nb-body') }
      })
      ok(!r.bar && !r.tree && r.body && /251, 250, 246/.test(r.bg) && r.table === 'visible' && r.rows, `print: the bar and the tree are hidden, the page is paper (${r.bg}), tables are unclipped with every row`)
      await close(p)
    }
  }
  // Q12: the bar's title goes back to the top
  {
    const p = await page('desktop', ROUTES.longest)
    await p.evaluate(() => NB.controls.scroller().scrollTo(0, 1500))
    await wait(p, 100)
    await p.click('.nb-bar__path [aria-current="page"]')
    await wait(p, 900)
    const y = await p.evaluate(() => ({ y: NB.controls.scrollTop(), hash: location.hash }))
    ok(y.y < 4 && y.hash === ROUTES.longest, `the bar's title scrolls back to the top (${y.y} px) and stays on the note`)
    await close(p)
  }
}

// ── reduced motion ─────────────────────────────────────────────────────────────────────────
console.log('\nreduced motion')
if (!ONLY) {
  const p = await page('desktop', '#desk', { reduce: true })
  await p.focus('.desk-dock__item[data-id="lab"]')
  await p.keyboard.press('Enter')
  await wait(p, 160)
  const mid = await p.evaluate(() => [...document.querySelectorAll('.nb-bar__path a')].map((a) => a.textContent).join('/'))
  await wait(p, 600)
  const r = await p.evaluate(() => ({ ms: NB.trip.timing.in, live: NB.trip.live() }))
  ok(r.live && r.ms >= 250 && r.ms <= 450 && mid === 'Lab', `a ${r.ms} ms crossfade, with no decode (mid-trip the bar reads "${mid}")`)
  await go(p, '#/builds/03-datesheet-generator')
  await p.click('[data-term="replay"]')
  const whole = await p.evaluate(() => { const pre = document.querySelector('.nb-term__out'); return pre.textContent === pre.dataset.src })
  ok(whole, 'a terminal replay is shown whole')
  await close(p)
}

// ── privacy in the DOM, and a few more claims, across every route ──────────────────────────
console.log('\nevery route')
if (!ONLY) {
  const p = await page('desktop', '')
  const routes = await p.evaluate(() => NB.vault.notes.map((n) => n.route))
  const hitsAll = []
  for (const r of [...routes, 'graph']) {
    await p.evaluate((h) => { location.hash = h }, '#/' + r)
    await wait(p, 40)
    const text = await p.evaluate(() => document.body.innerText.toLowerCase())
    for (const t of TERMS) {
      const re = /^T\d\d$/.test(t) ? new RegExp(`\\b${t.toLowerCase()}\\b`) : null
      if (re ? re.test(text) : text.includes(t)) {
        const allowed = ALLOW.some((a) => a.term === t && (r.endsWith('/' + a.where.split('.')[0]) || text.includes('t14')))
        if (!allowed) hitsAll.push(`${t} on ${r || 'start-here'}`)
      }
    }
  }
  ok(!hitsAll.length, `${routes.length + 1} routes visited; no private term in document.body.innerText (HoneyHive only where T14 is shown, as decided)${hitsAll.length ? ': ' + [...new Set(hitsAll)].slice(0, 6).join(', ') : ''}`)
  const add = await page('desktop', '?add=1')
  const a = await add.evaluate(() => ({ text: (document.querySelector('.proof') || {}).textContent || '', n: NB.vault.notes.length, ok: (document.querySelector('.proof') || {}).dataset?.ok }))
  ok(a.n === 72 && a.ok === 'true', `?add=1: ${a.text} (${a.n} notes: 71 and the test note)`)
  await close(add)
  const off = await page('desktop', '?autolink=0#/agent-reliability/study/log')
  ok(await off.evaluate(() => !document.querySelector('.nb-col .nb-id')), '?autolink=0: ID mentions stay plain text')
  await close(off)
  await close(p)
}

ok(!errors.length, `no page errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`)
for (const c of contexts) await c.close()
await b.close()
console.log(fails ? `\n${fails} of ${n} FAILED` : `\nall ${n} e2e checks pass`)
process.exit(fails ? 1 : 0)
