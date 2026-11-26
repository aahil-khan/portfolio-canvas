// The Lab v2A check: builds, then audits every registered view and state.
//
//   cx heavy -- node --experimental-strip-types --no-warnings prototype/lab-v2a/check.mjs [--no-shots]
//
// One Chromium launch (the server's cached one, same lookup as ~/.local/bin/shot) with the
// playwright-core in ~/.local/share/cx-tools; always closed. Rules A1–A16 and P1–P3 come from the
// plan's research.md §5; the rest from plan.md §5 "The check command". Exit 0 only if all pass.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from './build.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = path.join(HERE, '.shots')
const TRACKER = path.join(os.homedir(), 'projects/scratch/lab-sources/agent-reliability-study-tracker.xlsx')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(os.homedir(), '.local/share/cx-tools/node_modules/playwright-core'))
const SHOTS_ON = !process.argv.includes('--no-shots')

function browserPath() {
  if (process.env.CX_CHROMIUM) return process.env.CX_CHROMIUM
  const cache = path.join(os.homedir(), '.cache/ms-playwright')
  let dirs = []
  try { dirs = fs.readdirSync(cache) } catch { /* none */ }
  const pick = (prefix, rel) => dirs.filter((d) => d.startsWith(prefix)).sort().reverse().map((d) => path.join(cache, d, rel)).find((p) => fs.existsSync(p))
  return pick('chromium-', 'chrome-linux64/chrome') || pick('chromium-', 'chrome-linux/chrome') ||
    pick('chromium_headless_shell-', 'chrome-headless-shell-linux64/chrome-headless-shell') || pick('chromium_headless_shell-', 'chrome-linux/headless_shell')
}

const SIZES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const STATUS_WORDS = ['written up', 'in progress', 'next', 'parked']
const BANNED_HEADINGS = ['overview', 'introduction', 'summary', 'key takeaways', 'conclusion', 'what to learn', 'resources', 'hours and log', 'what it does', 'notes', 'the map', 'start here']
const TEMPLATE = ['dive in', 'delve', "let's explore", 'journey', 'seamless', 'robust', 'leverage', 'unlock', 'game-changer', 'in this note', 'this note covers', 'the place where', 'who wrote this', "whether you're"]
const P1 = [/Role evidence/i, /\binterview/i, /\binternship/i, /Increff/i, /starting point/i, /\bLevel\b/, /\bT4[3-7]\b/, /Phase 5/i, /\bP[0-2]\b/, /\bresum[eé]/i, /résumé/i]
// built from parts so this file doesn't trip its own hygiene grep
const OLD_LAB = [['prototype', 'lab/'].join('/'), ['..', 'lab/'].join('/')]

const results = [] // { row, rule, ok, val }
const fail = (row, rule, val) => results.push({ row, rule, ok: false, val: String(val) })
const pass = (row, rule, val = '') => results.push({ row, rule, ok: true, val: String(val) })
const rule = (row, name, ok, val) => (ok ? pass : fail)(row, name, val)

/* ---------------------------------------------------------------- xlsx (P2), no deps */
function unzip(file) {
  const buf = fs.readFileSync(file)
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  const n = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const out = {}
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extra = buf.readUInt16LE(p + 30)
    const comment = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const lNameLen = buf.readUInt16LE(local + 26)
    const lExtra = buf.readUInt16LE(local + 28)
    const data = buf.subarray(local + 30 + lNameLen + lExtra, local + 30 + lNameLen + lExtra + size)
    out[name] = method === 8 ? zlib.inflateRawSync(data).toString('utf8') : data.toString('utf8')
    p += 46 + nameLen + extra + comment
  }
  return out
}
function sheetRows(xml) {
  const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
    const row = {}
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const t = [...(c[2] || '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join('') || ((c[2] || '').match(/<v>([\s\S]*?)<\/v>/) || [])[1] || ''
      row[c[1]] = unesc(t)
    }
    return row
  })
}
/** Company names, read at check time and never written anywhere. */
function privateNames() {
  if (!fs.existsSync(TRACKER)) return null
  const z = unzip(TRACKER)
  const names = new Set()
  const wb = z['xl/workbook.xml']
  const sheets = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1])
  const sheetXml = (name) => z[`xl/worksheets/sheet${sheets.indexOf(name) + 1}.xml`]
  const roles = sheetRows(sheetXml('Role evidence') || '')
  const head = roles.findIndex((r) => Object.values(r).some((v) => /^company$/i.test(v.trim())))
  if (head >= 0) {
    const col = Object.keys(roles[head]).find((k) => /^company$/i.test(roles[head][k].trim()))
    for (const r of roles.slice(head + 1)) if (r[col]) names.add(r[col].replace(/\s*\(.*\)\s*/g, '').trim())
  }
  const topics = sheetRows(sheetXml('Topics') || '')
  const th = topics.findIndex((r) => Object.values(r).some((v) => /why it matters/i.test(v)))
  if (th >= 0) {
    const col = Object.keys(topics[th]).find((k) => /why it matters/i.test(topics[th][k]))
    for (const r of topics.slice(th + 1)) {
      for (const m of (r[col] || '').matchAll(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)*)(?='s|\s+India\b|\s+(?:lists|asks|builds|FDEs?)\b)/g)) names.add(m[1])
    }
  }
  return [...names].filter((n) => n.length >= 3)
}

/* ---------------------------------------------------------------- static rules */
function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (['.shots', 'node_modules'].includes(e.name)) return []
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walkFiles(p) : [p]
  })
}
function staticChecks(data, fixtureData, bytes) {
  const row = 'static'
  // A10: the Lab's own copy (ui strings, front matter, bodies). Quoted sources aren't ours.
  const copyFiles = walkFiles(path.join(HERE, 'content')).filter((f) => /\.(md|json)$/.test(f) && !f.endsWith('external.json'))
  const copy = copyFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
  const hits = TEMPLATE.filter((t) => copy.toLowerCase().includes(t))
  const words = (copy.match(/\b[\w']+\b/g) || []).length
  const dashes = (copy.match(/—/g) || []).length
  rule(row, 'A10', !hits.length && dashes <= words / 150, hits.length ? hits.join(', ') : `${dashes} em dashes / ${words} words`)
  // A12 vocabulary: every status is a word from the fixed list
  const bad = [data, fixtureData].flatMap((d) => Object.values(d.items)).filter((it) => it.status && !STATUS_WORDS.includes(it.status)).map((it) => `${it.key}:${it.status}`)
  rule(row, 'A12', !bad.length, bad.length ? bad.join(', ') : 'status in words')
  // P1/P3 over every piece of Lab text the build emits
  const text = [data, fixtureData].map((d) => JSON.stringify(d.items) + JSON.stringify(d.ui)).join('\n').replace(/<[^>]+>/g, ' ')
  const p1 = P1.filter((re) => re.test(text) || re.test(copy)).map(String)
  rule(row, 'P1', !p1.length, p1.length ? p1.join(' ') : '0 hits')
  const phaseBad = /Hardening \+|Phase 5|Interviews/i.test(text)
  rule(row, 'P3', !phaseBad, phaseBad ? 'unrewritten phase name' : 'exact')
  const names = privateNames()
  if (!names) { pass(row, 'P2', 'SKIP (tracker missing)'); console.warn('warning: P2 skipped, tracker xlsx not found') } else {
    const hay = (text + '\n' + copy).toLowerCase()
    const n = names.filter((nm) => new RegExp(`(^|[^a-z0-9])${nm.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(hay)).length
    rule(row, 'P2', n === 0, `${n} hits of ${names.length} names`)
  }
  // hygiene: bundle size, no backdrop-filter in source, no reference to the old Lab
  rule(row, 'size', bytes <= 1.5 * 1024 * 1024, `${(bytes / 1024).toFixed(0)} KB`)
  const own = walkFiles(HERE).filter((f) => /\.(m?js|css|md|json|html)$/.test(f) && !/lab-v2a(\.fixtures)?\.html$/.test(f))
  const refs = own.filter((f) => { const s = fs.readFileSync(f, 'utf8'); return OLD_LAB.some((o) => s.includes(o)) })
  rule(row, 'old-lab', !refs.length, refs.length ? refs.map((f) => path.relative(HERE, f)).join(', ') : 'no references')
  const css = fs.readFileSync(path.join(HERE, 'src/lab.css'), 'utf8')
  rule(row, 'backdrop', !/backdrop-filter/.test(css), 'none in css')
  // A16 counts: pull-quotes ≤ words / 800 (verbatim is checked in the page)
  const pq = [data, fixtureData].flatMap((d) => Object.values(d.items)).filter((it) => it.pullquotes > it.words / 800).map((it) => it.key)
  rule(row, 'A16', !pq.length, pq.length ? pq.join(', ') : 'counts ok')
  // generality: no template code branches on a slug or the word shopkeeper
  const src = fs.readdirSync(path.join(HERE, 'src')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(HERE, 'src', f), 'utf8')).join('\n')
  const keys = Object.keys(fixtureData.items).filter((k) => k.length > 3)
  const slugHits = ['shopkeeper', ...keys].filter((k) => new RegExp(`['"\`/]${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`/]`, 'i').test(src) || /shopkeeper/i.test(k) && /shopkeeper/i.test(src))
  rule(row, 'general', !slugHits.length, slugHits.length ? slugHits.join(', ') : 'no slug branches')
}

/* ---------------------------------------------------------------- in-page measurements */
const INIT = () => {
  window.__raf = 0
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => raf((t) => { window.__raf++; cb(t) })
  window.__errors = []
  window.addEventListener('error', (e) => window.__errors.push(String(e.message)))
}

/** Everything A1–A9, A11–A16 need, measured on the current page. */
const MEASURE = (scope) => {
  const W = innerWidth
  const H = innerHeight
  const vis = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const inFirst = (r) => r.bottom > 0 && r.top < H && r.right > 0 && r.left < W && r.width > 0 && r.height > 0
  const out = {}
  // text nodes rendered on the first screen
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const firstText = []
  const allText = []
  for (let n; (n = tw.nextNode());) {
    const t = n.textContent.replace(/\s+/g, ' ')
    if (!t.trim()) continue
    const el = n.parentElement
    if (!el || el.closest('script, style, [hidden], .vh, svg') || !vis(el)) continue
    const range = document.createRange()
    range.selectNodeContents(n)
    const rects = [...range.getClientRects()]
    allText.push({ n, el, t })
    if (rects.some(inFirst)) firstText.push({ n, el, t })
  }
  // A1 controls
  const ctlSel = 'a[href], button, input, select, summary, [role=button], [tabindex="0"]'
  const controls = [...document.querySelectorAll(ctlSel)].filter((el) => vis(el) && inFirst(el.getBoundingClientRect()) && !el.closest('[aria-hidden="true"]'))
  out.controls = controls.length
  // A2 glyphs
  const GLYPH = /[\u2190-\u21FF\u2300-\u23FF\u2460-\u27BF\u2B00-\u2BFF]|[\u{1F300}-\u{1FAFF}]/gu
  let glyphs = 0
  let arrows = 0
  for (const { el, t } of firstText) {
    if (el.closest('pre, code')) continue
    for (const g of t.match(GLYPH) || []) {
      if ((g === '→' || g === '←') && el.closest('a')) arrows++
      else glyphs++
    }
  }
  out.glyphs = glyphs + Math.max(0, arrows - 2)
  // A3 chrome text vs note text
  let chrome = 0
  let prose = 0
  for (const { el, t } of firstText) {
    const len = t.trim().length
    if (el.closest('header, nav, aside, footer, button') || (el.closest('a') && !el.closest('article'))) chrome += len
    else if (el.closest('article')) prose += len
  }
  out.chromeRatio = prose ? chrome / prose : (chrome ? 99 : 0)
  // A4 skeleton
  const navs = [...document.querySelectorAll('nav, aside')].filter((x) => vis(x) && inFirst(x.getBoundingClientRect()))
  out.bigNav = navs.filter((x) => x.querySelectorAll('a').length > 12).length
  const col = document.querySelector('main')?.getBoundingClientRect()
  const side = (cond) => [...document.querySelectorAll('nav, aside')].some((x) => { if (!vis(x)) return false; const r = x.getBoundingClientRect(); return inFirst(r) && cond(r) })
  out.twoRails = !!col && side((r) => r.right <= col.left + 2) && side((r) => r.left >= col.right - 2)
  // headings
  out.headings = [...document.querySelectorAll('main h2, main h3')].map((h) => h.textContent.replace(/^\d+/, '').trim())
  // A6 tracker language (chapter and note pages)
  out.trackerHits = (document.querySelector('main')?.innerText.match(/\d+(\.\d+)? ?h (logged|planned)|planned \d|P[012]\b|→ \d{4}-\d\d-\d\d|Level\b|starting point/g) || []).length
  // A7 type rhythm on the first screen
  const sizes = new Set()
  for (const { el } of firstText) sizes.add(Math.round(parseFloat(getComputedStyle(el).fontSize) * 2) / 2)
  out.sizes = [...sizes].sort((a, b) => a - b)
  const bodyP = document.querySelector('main [data-body] > p, main .intro')
  out.bodySize = bodyP ? parseFloat(getComputedStyle(bodyP).fontSize) : 17
  // A8 mono share (whole rendered page) and mono in chrome
  let mono = 0
  let total = 0
  let monoChrome = 0
  for (const { el, t } of allText) {
    if (el.closest('pre, code, kbd, samp')) continue
    const len = t.trim().length
    total += len
    const isMono = /Space Mono|monospace/i.test(getComputedStyle(el).fontFamily.split(',')[0])
    if (isMono) {
      mono += len
      if (el.closest('nav, header, button') && !el.closest('[data-id]') && !/^[\d\s·]+$/.test(t.trim())) monoChrome++
    }
  }
  out.monoShare = total ? mono / total : 0
  out.monoChrome = monoChrome
  // A9 hues of text and borders on the first screen
  const toRgb = (c) => { const m = c.match(/[\d.]+/g); return m ? m.slice(0, 4).map(Number) : null }
  const chroma = (rgb) => {
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const [r, g, b] = rgb.slice(0, 3).map(lin)
    const l = Math.cbrt(0.4122214708 * r + 0.5363026903 * g + 0.0514459929 * b)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return { c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 }
  }
  const hues = new Set()
  const note = (c) => { const rgb = toRgb(c); if (!rgb || (rgb[3] !== undefined && rgb[3] < 0.2)) return; const { c: ch, h } = chroma(rgb); if (ch > 0.04) hues.add(Math.round(h / 25)) }
  for (const { el } of firstText) note(getComputedStyle(el).color)
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (!inFirst(r) || !vis(el)) continue
    const s = getComputedStyle(el)
    if (parseFloat(s.borderTopWidth) > 0) note(s.borderTopColor)
    if (s.textDecorationLine.includes('underline')) note(s.textDecorationColor)
  }
  out.hues = hues.size
  // A11 artifact first
  const art = document.querySelector('main article')
  if (art) {
    const first = [...art.children].find((c) => !c.matches('[data-note-head]'))
    const block = first && first.matches('[data-body]') ? first.firstElementChild : first
    out.artifactFirst = !!block && block.matches('figure, video, table, pre, [data-artifact]')
    out.artifactTop = block ? block.getBoundingClientRect().top + scrollY : null
  }
  // A12 chips, A13 hard shadows on the first screen
  let chips = 0
  let shadows = 0
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue
    const r = el.getBoundingClientRect()
    if (!inFirst(r)) continue
    const s = getComputedStyle(el)
    const txt = el.innerText ? el.innerText.trim() : ''
    const boxed = parseFloat(s.borderTopWidth) > 0 || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor)
    if (parseFloat(s.borderTopLeftRadius) >= 8 && boxed && txt && txt.length < 24 && parseFloat(s.fontSize) < 14 && el.children.length <= 2) chips++
    if (s.boxShadow !== 'none' && /(-?\d+px) (-?\d+px) 0px/.test(s.boxShadow) && !/0px 0px 0px/.test(s.boxShadow)) shadows++
  }
  out.chips = chips
  out.shadows = shadows
  // A14 measure: first body paragraph with ≥ 120 characters
  const p = [...document.querySelectorAll('main [data-body] > p, main .intro')].find((x) => x.textContent.trim().length >= 120)
  if (p) {
    const tw2 = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
    const lines = new Map()
    const r = document.createRange()
    for (let n; (n = tw2.nextNode());) {
      for (let i = 0; i < n.length; i++) {
        r.setStart(n, i); r.setEnd(n, i + 1)
        const rc = r.getClientRects()[0]
        if (!rc) continue
        const k = Math.round(rc.top / 4)
        lines.set(k, (lines.get(k) || 0) + 1)
      }
    }
    const counts = [...lines.values()]
    const full = counts.slice(0, -1)
    out.cpl = full.length ? Math.round(full.reduce((a, b) => a + b, 0) / full.length) : counts[0]
    out.lineHeight = parseFloat(getComputedStyle(p).lineHeight) / parseFloat(getComputedStyle(p).fontSize)
  }
  // A15 read time vs words
  const rt = document.querySelector('[data-readtime]')
  const bodyEl = document.querySelector('[data-body]')
  if (rt && bodyEl) {
    const words = (bodyEl.innerText.match(/[\p{L}\p{N}₹][\p{L}\p{N}'’.,₹-]*/gu) || []).length
    out.readLabel = Number(rt.dataset.readtime)
    out.readCalc = words / 230
  }
  // A16 pull-quotes verbatim in the body (outside the quote itself)
  out.pullOk = [...document.querySelectorAll('[data-pullquote]')].every((q) => {
    const t = q.innerText.trim()
    const clone = bodyEl.cloneNode(true)
    clone.querySelectorAll('[data-pullquote]').forEach((x) => x.remove())
    return clone.textContent.replace(/\s+/g, ' ').includes(t)
  })
  // phone overflow + hit areas
  out.overflow = document.documentElement.scrollWidth - innerWidth
  const ctls = [...document.querySelectorAll(ctlSel)].filter((el) => vis(el) && (!scope || el.closest(scope)) && !el.closest('[aria-hidden="true"]') && !el.closest('.prose p, .prose li, .note-box, .kicker, .audience, .art-cap, svg') && !(el.matches('.skip')))
  const rects = ctls.map((el) => el.getBoundingClientRect())
  const small = []
  ctls.forEach((el, i) => {
    const a = rects[i]
    if (a.width >= 44 && a.height >= 44) return
    if (a.width < 24 || a.height < 24) { small.push(`${el.tagName.toLowerCase()}.${el.className || ''} ${Math.round(a.width)}×${Math.round(a.height)}`); return }
    const near = rects.some((b, j) => j !== i && !ctls[j].contains(el) && !el.contains(ctls[j]) && Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom) < 8)
    if (near) small.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(a.width)}×${Math.round(a.height)} (spacing)`)
  })
  out.smallTargets = small
  // no backdrop-filter anywhere
  out.backdrop = [...document.querySelectorAll('*')].filter((el) => { const v = getComputedStyle(el).backdropFilter; return v && v !== 'none' }).length
  out.h1 = document.querySelector('h1')?.textContent || ''
  out.stub = !!document.querySelector('[data-stub]')
  out.kind = document.querySelector('main article')?.dataset.kind || (location.hash.replace(/\?.*/, '') === '#/lab' ? 'home' : '')
  out.accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  return out
}

/** Contrast in every theme, computed in the page after switching data-theme (plan §5 rule 3). */
const CONTRAST = () => {
  const probe = document.createElement('div')
  document.body.appendChild(probe)
  const rgba = (v) => { probe.style.color = ''; probe.style.color = `var(${v})`; const m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number); if (getComputedStyle(probe).color.startsWith('color(srgb')) return [m[0] * 255, m[1] * 255, m[2] * 255, m[3] ?? 1]; return [m[0], m[1], m[2], m[3] ?? 1] }
  const over = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1)
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const res = []
  const ids = JSON.parse(document.getElementById('lab-data').textContent).themes.map((t) => t.id)
  const before = document.documentElement.getAttribute('data-theme')
  for (const id of ids) {
    document.documentElement.setAttribute('data-theme', id)
    const base = over(rgba('--canvas-base'), [255, 255, 255, 1])
    const grounds = ['--canvas-base', '--surface', '--surface-alt', '--surface-sunken'].map((g) => [g, over(rgba(g), base)])
    let min = 99
    const bad = []
    const check = (name, fg, bg, need) => { const r = ratio(fg, bg); min = Math.min(min, need === 4.5 ? r : min); if (r < need) bad.push(`${name} ${r.toFixed(2)}`) }
    for (const [gname, g] of grounds) for (const t of ['--ink', '--ink-muted', '--ink-subtle', '--link', '--accent-text']) check(`${t} on ${gname}`, over(rgba(t), g), g, 4.5)
    const accent = over(rgba('--accent'), base)
    check('--accent-ink on --accent', over(rgba('--accent-ink'), accent), accent, 4.5)
    const sel = over(rgba('--selection'), base)
    check('--selection-ink on --selection', over(rgba('--selection-ink'), sel), sel, 4.5)
    const ink = over(rgba('--ink'), base)
    check('key sentence', base, ink, 4.5)
    check('--border on --canvas-base', over(rgba('--border'), base), base, 3)
    check('--focus on --canvas-base', over(rgba('--focus'), base), base, 3)
    res.push({ id, min: +min.toFixed(2), bad })
  }
  document.documentElement.setAttribute('data-theme', before)
  probe.remove()
  return res
}

/** Accent pixel share from a screenshot, decoded in the page (no PNG dependency). */
async function accentShare(page, png, accent) {
  return page.evaluate(async ({ b64, accent }) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    const m = accent.replace('#', '')
    const [ar, ag, ab] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16))
    let n = 0
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - ar) <= 30 && Math.abs(d[i + 1] - ag) <= 30 && Math.abs(d[i + 2] - ab) <= 30) n++
    return n / (d.length / 4)
  }, { b64: png.toString('base64'), accent })
}

/* ---------------------------------------------------------------- the run */
const VIEWS = [
  { name: 'home', route: '/lab', limits: { desk: 16, phone: 10, shadows: 3 } },
  { name: 'chapter', route: '/lab/agent-reliability/shopkeeper/03-blind-agent', limits: { desk: 10, phone: 7, shadows: 1 } },
]
const STATES = {
  folder: { desktop: '.crumbs [data-folder]', phone: '[data-sheet]', expect: { desktop: '.folder-win .row', phone: '.sheet .row' } },
  preview: { desktop: 'hover', expect: { desktop: '.preview' } },
  listen: { both: '[data-listen]', expect: { both: '.strip [data-where]' }, only: 'chapter' },
  themes: { both: '[data-theme-list]', expect: { desktop: '.theme-win [data-set-theme]', phone: '.sheet [data-set-theme]' } },
  player: { both: '[data-player]', expect: { desktop: '.player-win [data-station]', phone: '.sheet [data-station]' } },
}

async function main() {
  const t0 = Date.now()
  const real = await build({ copy: true })
  const fx = await build({ fixtures: true })
  staticChecks(real.data, fx.data, real.bytes)
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ executablePath: browserPath(), headless: true })
  const headings = { real: new Map(), fixtures: new Map() }
  try {
    const open = async (file, route, size, { theme, reduced = false } = {}) => {
      const ctx = await browser.newContext({ ...SIZES[size === '1280' ? 'desktop' : size], ...(size === '1280' ? { viewport: { width: 1280, height: 800 } } : {}), reducedMotion: reduced ? 'reduce' : 'no-preference' })
      await ctx.addInitScript(INIT)
      const page = await ctx.newPage()
      const net = []
      const errs = []
      page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()) })
      page.on('pageerror', (e) => errs.push(e.message))
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
      await page.goto(`file://${file}#${route}${theme ? `?theme=${theme}` : ''}`)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(250)
      return { ctx, page, net, errs }
    }
    const audit = async (label, file, route, size, limits, set) => {
      const row = `${label} ${size}`
      const { ctx, page, net, errs } = await open(file, route, size)
      const m = await page.evaluate(MEASURE)
      if (m.stub) { pass(row, 'view', 'stub, skipped'); await ctx.close(); return }
      const isNote = m.kind && m.kind !== 'home'
      const lim = limits || (isNote ? { desk: 10, phone: 7, shadows: 1 } : { desk: 16, phone: 10, shadows: 3 })
      rule(row, 'A1', m.controls <= (size === 'phone' ? lim.phone : lim.desk), m.controls)
      rule(row, 'A2', m.glyphs === 0, m.glyphs)
      rule(row, 'A3', m.chromeRatio <= 0.35, m.chromeRatio.toFixed(2))
      rule(row, 'A4', !(isNote && (m.bigNav || m.twoRails)), m.bigNav || m.twoRails ? 'skeleton' : 'none')
      for (const h of m.headings) { const k = h.toLowerCase().replace(/[^a-z ]/g, '').trim(); set.set(k, (set.get(k) || []).concat(route)) }
      if (['chapter', 'note'].includes(m.kind)) rule(row, 'A6', m.trackerHits === 0, m.trackerHits)
      const ratio = m.sizes.at(-1) / m.sizes[0]
      rule(row, 'A7', m.sizes.length <= (size === 'phone' ? 4 : 5) && ratio >= 2.2 && m.sizes[0] >= 12 && m.bodySize >= 16, `${m.sizes.length} sizes ${m.sizes.join('/')} r${ratio.toFixed(1)}`)
      rule(row, 'A8', m.monoShare <= 0.08 && m.monoChrome === 0, `${(m.monoShare * 100).toFixed(1)}% ${m.monoChrome ? 'chrome!' : ''}`)
      const png = await page.screenshot()
      const share = await accentShare(page, png, m.accent)
      rule(row, 'A9', m.hues <= 2 && share <= 0.05, `${m.hues} hues, accent ${(share * 100).toFixed(1)}%`)
      if (['chapter', 'entry'].includes(m.kind)) rule(row, 'A11', m.artifactFirst && (size !== 'phone' || m.artifactTop < 0.6 * 844), `first=${m.artifactFirst} top=${Math.round(m.artifactTop)}`)
      rule(row, 'A12', m.chips <= 1, m.chips)
      rule(row, 'A13', m.shadows <= lim.shadows, m.shadows)
      if (m.cpl !== undefined && isNote) {
        const [lo, hi] = size === 'phone' ? [34, 46] : [85, 100]
        rule(row, 'A14', m.cpl >= lo && m.cpl <= hi && m.lineHeight >= 1.65, `${m.cpl} cpl, lh ${m.lineHeight.toFixed(2)}`)
      }
      if (m.readLabel) rule(row, 'A15', Math.abs(m.readLabel - m.readCalc) <= Math.max(1, m.readCalc * 0.15), `${m.readLabel} min for ${(m.readCalc * 230).toFixed(0)} words`)
      rule(row, 'A16', m.pullOk, m.pullOk ? 'verbatim' : 'not in body')
      // reduced motion
      {
        const r = await open(file, route, size, { reduced: true })
        await r.page.waitForTimeout(1500)
        const anims = await r.page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !['offset', 'easing', 'composite', 'computedOffset', 'opacity'].includes(x)))))
        const raf0 = await r.page.evaluate(() => window.__raf)
        await r.page.waitForTimeout(2000)
        const raf = (await r.page.evaluate(() => window.__raf)) - raf0
        rule(row, 'reduced', !anims.length && raf === 0, `${anims.length} non-opacity, ${raf} rAF/2s`)
        await r.ctx.close()
      }
      // idle budget
      await page.waitForTimeout(3000)
      const idle = await page.evaluate(async () => {
        const inf = document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).length
        const r0 = window.__raf
        await new Promise((res) => setTimeout(res, 2000))
        return { inf, raf: (window.__raf - r0) / 2 }
      })
      rule(row, 'idle', idle.inf <= 1 && idle.raf <= 1, `${idle.inf} infinite, ${idle.raf} rAF/s`)
      rule(row, 'network', net.length === 0, net.length ? net[0] : 'none')
      if (size === 'phone') rule(row, 'phone', m.overflow <= 0 && !m.smallTargets.length, m.overflow > 0 ? `overflow ${m.overflow}px` : m.smallTargets.length ? m.smallTargets.slice(0, 3).join('; ') : 'ok')
      rule(row, 'backdrop', m.backdrop === 0, m.backdrop)
      // stable URL: the route reloads to itself
      await page.reload()
      await page.waitForTimeout(200)
      const again = await page.evaluate(() => document.querySelector('h1')?.textContent || '')
      rule(row, 'reload', again === m.h1, again === m.h1 ? 'stable' : `${again} != ${m.h1}`)
      rule(row, 'errors', errs.length === 0 && !(await page.evaluate(() => window.__errors.length)), errs[0] || 'none')
      await ctx.close()
      return m
    }

    for (const v of VIEWS) for (const size of ['desktop', 'phone']) {
      const m = await audit(v.name, real.out, v.route, size, v.limits, headings.real)
      if (v.name === 'chapter' && size === 'desktop' && m) {
        const p = await open(real.out, v.route, '1280')
        const m2 = await p.page.evaluate(MEASURE)
        rule('chapter 1280', 'A14', m2.cpl >= 78, `${m2.cpl} cpl`)
        await p.ctx.close()
      }
      // states
      for (const [sname, st] of Object.entries(STATES)) {
        if (st.only && st.only !== v.name) continue
        const sel = st[size] || st.both
        if (!sel) continue
        const row = `${v.name} ${size} +${sname}`
        const { ctx, page, errs } = await open(real.out, v.route, size)
        if (sel !== 'hover' && !(await page.locator(sel).filter({ visible: true }).count())) {
          pass(row, 'state', `n/a: no ${sel} on this view`)
          await ctx.close()
          continue
        }
        let ok = true
        let val = ''
        try {
          const y0 = await page.evaluate(() => scrollY)
          if (sel === 'hover') {
            const link = page.locator(v.name === 'chapter' ? '.prose a[data-preview]' : '.latest a[data-preview]').first()
            await link.hover()
            await page.waitForTimeout(450)
          } else {
            await page.locator(sel).filter({ visible: true }).first().click()
            await page.waitForTimeout(500)
          }
          const exp = st.expect[size] || st.expect.both
          if (SHOTS_ON && sname === 'themes') await page.screenshot({ path: path.join(SHOTS, `${v.name}-${size}-themes.png`) })
          const count = await page.locator(exp).count()
          ok = count > 0
          val = `${count} × ${exp}`
          if (sname === 'listen') {
            await page.waitForTimeout(1200)
            const s = await page.evaluate(() => ({ reading: document.querySelectorAll('.s.reading').length, y: scrollY }))
            ok = ok && s.reading === 1 && s.y === y0
            val += `, highlight ${s.reading}, scrolled ${s.y - y0}px`
          }
          if (sname === 'themes') {
            const n = await page.locator(`${exp}`).count()
            ok = ok && n === 20
            await page.locator(exp).nth(1).click()
            await page.waitForTimeout(200)
            const th = await page.evaluate(() => document.documentElement.dataset.theme)
            ok = ok && th === 'lab-light'
            val = `${n} themes, switched to ${th}`
          }
          // with a window or sheet open, the page under it is covered: measure what's on top
          const after = await page.evaluate(MEASURE, '.float, .sheet, .strip')
          if (size === 'phone' && (after.overflow > 0 || after.smallTargets.length)) { ok = false; val += ` | ${after.overflow > 0 ? 'overflow' : after.smallTargets.slice(0, 2).join('; ')}` }
          if (after.backdrop) { ok = false; val += ' | backdrop-filter' }
          if (SHOTS_ON && sname !== 'themes') await page.screenshot({ path: path.join(SHOTS, `${v.name}-${size}-${sname}.png`) })
          if (sname === 'folder' || sname === 'player') {
            await page.keyboard.press('Escape')
            await page.waitForTimeout(400)
            const left = await page.locator('.folder-win, .player-win, .sheet').count()
            if (left) { ok = false; val += ' | Esc did not close' }
          }
        } catch (e) { ok = false; val = e.message.split('\n')[0] }
        if (errs.length) { ok = false; val += ` | ${errs[0]}` }
        rule(row, 'state', ok, val)
        await ctx.close()
      }
    }
    // review screenshots: both views × sizes × lab-dark, lab-light, plus the chapter in cream
    if (SHOTS_ON) {
      const jobs = []
      for (const v of VIEWS) for (const size of ['desktop', 'phone']) for (const th of ['lab-dark', 'lab-light']) jobs.push([v, size, th])
      jobs.push([VIEWS[1], 'desktop', 'cream'], [VIEWS[1], 'phone', 'cream'])
      for (const [v, size, th] of jobs) {
        const { ctx, page } = await open(real.out, v.route, size, { theme: th })
        await page.screenshot({ path: path.join(SHOTS, `${v.name}-${size}-${th}.png`) })
        await page.screenshot({ path: path.join(SHOTS, `${v.name}-${size}-${th}-full.png`), fullPage: true })
        await ctx.close()
      }
    }
    // contrast in all 20 themes
    {
      const { ctx, page } = await open(real.out, '/lab', 'desktop')
      const c = await page.evaluate(CONTRAST)
      for (const t of c) rule(`theme ${t.id}`, 'contrast', !t.bad.length, t.bad.length ? t.bad.slice(0, 3).join('; ') : `min ${t.min}`)
      rule('static', 'themes', c.length === 20, `${c.length} themes`)
      await ctx.close()
    }
    // generality: the fixture build, on the home and every built fixture page
    {
      const fixtureKeys = Object.values(fx.data.items).filter((it) => it.built && !real.data.items[it.key]).map((it) => it)
      await audit('fx home', fx.out, '/lab', 'desktop', VIEWS[0].limits, headings.fixtures)
      await audit('fx home', fx.out, '/lab', 'phone', VIEWS[0].limits, headings.fixtures)
      for (const it of fixtureKeys) for (const size of ['desktop', 'phone']) await audit(`fx ${it.kind} ${it.key}`, fx.out, it.path, size, null, headings.fixtures)
      // the home takes a 4th section and an experiment with no layout change
      const shape = async (file) => {
        const { ctx, page } = await open(file, '/lab', 'desktop')
        const s = await page.evaluate(() => ({
          blocks: [...document.querySelectorAll('main article > *')].map((b) => `${b.className}:${Math.round(b.getBoundingClientRect().left)}:${Math.round(b.getBoundingClientRect().width)}`),
          sections: document.querySelectorAll('.sec').length,
          kinds: [...document.querySelectorAll('.latest .kind')].map((k) => k.textContent),
        }))
        if (SHOTS_ON && file === fx.out) await page.screenshot({ path: path.join(SHOTS, 'fixtures-home-desktop-full.png'), fullPage: true })
        await ctx.close()
        return s
      }
      const a = await shape(real.out)
      const b = await shape(fx.out)
      rule('fx home', 'layout', JSON.stringify(a.blocks) === JSON.stringify(b.blocks) && b.sections === a.sections + 1 && b.kinds.includes('experiment'), `${a.sections}→${b.sections} sections, latest: ${b.kinds.join('/')}`)
    }
    // A5 across views
    for (const [k, set] of Object.entries(headings)) {
      const repeats = [...set.entries()].filter(([, r]) => new Set(r).size > 1).map(([h]) => h)
      const banned = [...set.keys()].filter((h) => BANNED_HEADINGS.includes(h))
      rule(`${k} views`, 'A5', !repeats.length && !banned.length, repeats.length || banned.length ? [...repeats, ...banned].join(', ') : `${set.size} headings unique`)
    }
  } finally {
    await browser.close()
  }

  // the table
  const rows = [...new Set(results.map((r) => r.row))]
  const cols = [...new Set(results.map((r) => r.rule))]
  const w = Math.max(...rows.map((r) => r.length)) + 2
  console.log('\n' + 'view'.padEnd(w) + '  result')
  let failed = 0
  for (const r of rows) {
    const cells = results.filter((x) => x.row === r)
    const bad = cells.filter((x) => !x.ok)
    failed += bad.length
    console.log(r.padEnd(w) + (bad.length ? 'FAIL  ' + bad.map((x) => `${x.rule}: ${x.val}`).join(' | ') : 'PASS  ' + cells.map((x) => `${x.rule} ${x.val}`).join(' · ')))
  }
  console.log(`\n${results.length} checks over ${rows.length} rows and ${cols.length} rules, ${failed} failed, ${((Date.now() - t0) / 1000).toFixed(0)}s. Shots: ${SHOTS_ON ? path.relative(process.cwd(), SHOTS) : 'off'}`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(2) })
