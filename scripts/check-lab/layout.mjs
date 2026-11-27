/**
 * Rules 5, 6, 7, 8, 9, 10, 11, 12, 13, C, 14, 15, 16, 17, 18, K, U, D, R, 19, 21 and A: the Lab's
 * layout, type, colour, contrast, look switch, frames, reduced motion, health and axe. Lane module
 * for scripts/check-lab.mjs (API.md §11; the plan's rule table). Ported from the mockup's checker,
 * `prototype/lab-v2b/check.mjs`, onto real routes and the DOM hooks below; where the plan's table
 * and the mockup differ, the plan wins.
 *
 * Speed: ONE pass per (route, width, look) loads each built route once and measures everything in
 * a single `page.evaluate` (MEASURE below). Rules 5–14, C, U, D, R, 15, 16/17 (in part), 21 and A
 * are derived from that pass, cached at module level, so whichever of them runs first pays for it.
 * Separate loads: 13's measure (chapter 05), 16's sweep of the other Paper themes (sampled
 * routes, 390 and 1440), 18 (every route, 390 and 1440), K (sampled routes, the Lab theme, 1440)
 * and 19 (every route, 1440, reduced motion).
 *
 * Routes: every route of `ctx.lab.routes` that answers 200 (probed once, cached). Every `entry`
 * route must answer 200; until any does, these rules report "not built".
 *
 * The DOM hooks, the only way any rule here finds anything (API.md §5, plus PR 6's):
 *
 *   article[data-entry="<id>"]   the entry; body paragraphs are `article[data-entry] p`
 *   [data-body-end]              empty marker after the body, before References
 *   [data-lead]                  exactly one per entry
 *   [data-column]                an entry's reading column
 *   [data-rail]                  ≥1200px a sticky second column (`data-waiting`, opacity 0, until a
 *                                quarter screen is scrolled); below, a block after the text
 *   [data-toc]                   On this page: `a[href^="#s-"]`, `aria-current="location"`;
 *                                [data-toc-bar] the sliding accent bar
 *   [data-backlinks], [data-related]   inside the rail; Related has ≥1 `a`
 *   [data-tool-log], [data-num]  Space Mono;   [data-annot], time[datetime], [data-dot]  Caveat
 *   [data-demo-marker]           the demo marker, in the bar
 *   a[data-preview]              links that preview
 *   header[data-bar]             the fixed bar, 56px: [data-look-switch] with
 *                                button[data-look-option="paper"|"lab"][aria-pressed]; on phones
 *                                (≤760px) button[data-look-toggle] instead; button[data-aa]
 *                                (aria-expanded) → [data-aa-panel]; button[data-dark-toggle]
 *   [data-trail]                 full-width, computed transform scaleX(p)
 *   [data-reading-dot]           the dot; `data-in-footer` once it hopped into the footer
 *   main[data-lab-main]          the page's main
 *   [data-share="end"|"rail"]    button[data-share-open][aria-expanded] → [data-share-menu][hidden]
 *                                with button[data-share-copy], a[data-share-x], a[data-share-linkedin]
 *   details[data-picker]         chapters: summary + [data-picker-panel]
 *   footer[data-footer]          [data-clock], [data-build]
 *   [data-ending], [data-refs] (li[id^="ref-"]), [data-pull], aside[data-side]
 *   [data-box]                   ASSUMED (rule K): any other box/card that must keep the frame
 *
 * The other lane files (progress G, rail V, share X, picker Y) import the helpers exported here.
 */
import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------------------------
// Shared helpers (named exports; the harness only reads the default export)
// ---------------------------------------------------------------------------------------------

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Deduplicated, capped at `max` lines, then a count. */
export function capped(list, max = 30) {
  const uniq = [...new Set(list)]
  return uniq.length <= max ? uniq : [...uniq.slice(0, max), `… and ${uniq.length - max} more like these`]
}

/** Runs `fn` over `items`, `n` at a time. */
export async function pool(items, n, fn) {
  let i = 0
  const out = new Array(items.length)
  const worker = async () => {
    while (i < items.length) {
      const k = i++
      out[k] = await fn(items[k], k)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
  return out
}

const routeCache = new WeakMap()
/**
 * Every route that answers 200, probed once per run: `{ routes, entries, missing, notBuilt }`.
 * `missing` lists entry routes that do not answer 200; `notBuilt` is set while none does.
 */
export function builtRoutes(ctx) {
  if (!routeCache.has(ctx)) routeCache.set(ctx, probeRoutes(ctx))
  return routeCache.get(ctx)
}
async function probeRoutes(ctx) {
  if (!ctx.lab.built) return { routes: [], entries: [], missing: [], notBuilt: 'no loaders yet (PR 2)' }
  const all = [...ctx.lab.routes]
  if (!all.some((r) => r.path === '/lab')) all.unshift({ kind: 'home', path: '/lab' })
  const status = new Map()
  await pool(all, 6, async (r) => {
    try {
      status.set(r.path, (await ctx.get(r.path)).status)
    } catch (e) {
      status.set(r.path, `error ${e.message}`)
    }
  })
  const routes = all.filter((r) => status.get(r.path) === 200)
  const entries = routes.filter((r) => r.kind === 'entry')
  const missing = all.filter((r) => r.kind === 'entry' && status.get(r.path) !== 200).map((r) => `${r.path} answered ${status.get(r.path)}; every entry route must answer 200`)
  const notBuilt = !all.some((r) => r.kind === 'entry')
    ? 'the loaders list no entry routes'
    : entries.length === 0
      ? 'no entry page answers 200 yet (PR 6)'
      : null
  return { routes, entries, missing, notBuilt }
}

/** A series' fifth chapter when there is one (chapter 05, the reference page), else its first. Never by id: rule 4. */
export function fifthChapter(routes) {
  const chapters = routes.filter((r) => r.entryKind === 'chapter')
  return chapters[4] ?? chapters[0]
}

/** Chapter 05, an essay, a build, the study, the series hub and the home: the contrast/axe sample. */
export function sampleRoutes(routes, quick = false) {
  const pick = (f) => routes.find(f)
  const list = [
    fifthChapter(routes),
    pick((r) => r.entryKind === 'essay'),
    pick((r) => r.entryKind === 'build'),
    pick((r) => r.entryKind === 'study'),
    pick((r) => r.entryKind === 'series'),
    pick((r) => r.kind === 'home'),
  ].filter(Boolean)
  const uniq = [...new Map(list.map((r) => [r.path, r])).values()]
  return quick ? uniq.slice(0, 2) : uniq
}

export const isLabLook = (look) => /(^|&)look=lab(&|$)/.test(look.query)
export const heightOf = (ctx, width) => ctx.widths.find((w) => w.width === width)?.height ?? { 390: 844, 768: 1024, 1024: 768, 1440: 900, 1920: 1080 }[width] ?? 900
export const tagOf = (route, width, look) => `${route.path} @${width}${look ? ` ${look.name}` : ''}`

/** The canonical origin, from lib/site.ts. */
export function siteUrl(root) {
  const src = fs.readFileSync(path.join(root, 'lib/site.ts'), 'utf8')
  return src.match(/SITE_URL\s*=\s*['"]([^'"]+)['"]/)?.[1]?.replace(/\/$/, '') ?? 'https://aahil-khan.xyz'
}

/** content/data/lab.json's copy. */
export function labCopy(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'content/data/lab.json'), 'utf8')).copy ?? {}
}

/** In-page helpers, installed as `window.__lc` before the page's own scripts. */
function installHelpers() {
  if (window.__lc) return
  const colours = new Map()
  let cv = null
  const parse = (c) => {
    if (!c) return [0, 0, 0, 0]
    if (colours.has(c)) return colours.get(c)
    let v = null
    let m = c.match(/^rgba?\(([^)]+)\)$/)
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map((x) => (x.endsWith('%') ? parseFloat(x) / 100 : Number(x)))
      v = [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]
    } else if ((m = c.match(/^color\(srgb ([^)]+)\)$/))) {
      const p = m[1].split(/[\s/]+/).filter(Boolean).map((x) => (x.endsWith('%') ? parseFloat(x) / 100 : Number(x)))
      v = [p[0] * 255, p[1] * 255, p[2] * 255, p[3] == null ? 1 : p[3]]
    } else if (c === 'transparent') v = [0, 0, 0, 0]
    else {
      // anything else (oklab, lab, color-mix leftovers): let the canvas parse it
      cv ??= new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })
      cv.clearRect(0, 0, 1, 1)
      cv.fillStyle = 'rgba(0,0,0,0)'
      cv.fillStyle = c
      cv.fillRect(0, 0, 1, 1)
      const d = cv.getImageData(0, 0, 1, 1).data
      v = [d[0], d[1], d[2], d[3] / 255]
    }
    colours.set(c, v)
    return v
  }
  const over = (top, bot) => {
    const a = top[3]
    return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]
  }
  const lum = (c) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }
  const ratio = (a, b) => {
    const x = lum(a)
    const y = lum(b)
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }
  const near = (a, b, tol = 14) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < tol
  /** A CSS colour expression (e.g. `var(--ink)`), resolved on <body>. */
  const resolve = (expr) => {
    const d = document.createElement('i')
    d.style.color = expr
    d.style.position = 'absolute'
    document.body.appendChild(d)
    const c = parse(getComputedStyle(d).color)
    d.remove()
    return c
  }
  const srOnly = (el, s) => {
    if (/inset\(50%/.test(s.clipPath) || /^rect\(0(px)?,?\s*0(px)?,?\s*0(px)?,?\s*0(px)?\)$/.test(s.clip)) return true
    if (s.overflow === 'visible' || s.position !== 'absolute') return false
    const r = el.getBoundingClientRect()
    return r.width <= 1 && r.height <= 1
  }
  /** Rendered and not hidden: no display:none, visibility, opacity 0, [hidden], closed <details>, sr-only. */
  const visible = (el, memo = new Map()) => {
    if (!el || el.nodeType !== 1) return true
    if (memo.has(el)) return memo.get(el)
    const s = getComputedStyle(el)
    let ok = !(s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || +s.opacity === 0 || el.hasAttribute('hidden'))
    const p = el.parentElement
    if (ok && p && p.tagName === 'DETAILS' && !p.open && el.tagName !== 'SUMMARY') ok = false
    if (ok && srOnly(el, s)) ok = false
    ok = ok && visible(p, memo)
    memo.set(el, ok)
    return ok
  }
  const opacity = (el) => {
    let o = 1
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= +getComputedStyle(e).opacity
    return o
  }
  const bgOf = (el) => {
    const stack = []
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) stack.push(parse(getComputedStyle(e).backgroundColor))
    let c = [255, 255, 255, 1]
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i][3] > 0) c = over(stack[i], c)
    return c
  }
  const scrollToY = (y) => {
    const l = window.__lenis
    if (l && document.documentElement.classList.contains('lenis') && typeof l.scrollTo === 'function') l.scrollTo(y, { immediate: true, force: true })
    else window.scrollTo({ top: y, left: 0, behavior: 'instant' })
  }
  const frames = (ms = 50) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, ms))))
  const scaleX = (el) => {
    const t = getComputedStyle(el).transform
    if (!t || t === 'none') return 1
    const m = t.match(/matrix(3d)?\(([^)]+)\)/)
    return m ? Number(m[2].split(',')[0]) : NaN
  }
  const describe = (el) => {
    if (!el) return 'nothing'
    const data = [...el.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `[${a.name}${a.value && a.value.length < 24 ? `="${a.value}"` : ''}]`)
    return el.tagName.toLowerCase() + data.slice(0, 2).join('')
  }
  /** The lead, the h1 and the first three body paragraphs: what no control may move. */
  const keyRects = () => {
    const ps = [...document.querySelectorAll('article[data-entry] p')]
    const list = [...document.querySelectorAll('[data-lead], main h1'), ...(ps.length ? ps : [...document.querySelectorAll('main p')]).slice(0, 3)]
    return list.map((e) => {
      const b = e.getBoundingClientRect()
      return { name: describe(e), r: [b.left, b.top + scrollY, b.width, b.height] }
    })
  }
  /** The text a reader actually sees inside an element (crossfaded labels count only when shown). */
  const visibleText = (root) => {
    if (!root) return ''
    const memo = new Map()
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const parts = []
    for (let n; (n = tw.nextNode()); ) if (n.data.trim() && visible(n.parentElement, memo) && opacity(n.parentElement) > 0.5) parts.push(n.data.trim())
    return parts.join(' ').replace(/\s+/g, ' ').trim()
  }
  window.__lc = { parse, over, lum, ratio, near, resolve, visible, opacity, bgOf, scrollToY, frames, scaleX, describe, keyRects, visibleText }
}

/**
 * Opens `routePath` (with `?query`) at `width`, helpers installed, fonts loaded:
 * `{ page, context, errors, thirdParty, status, close }`. Phones (< 600px) get touch, so no Lenis.
 * `init` is a list of functions or `[fn, arg]` pairs, added as init scripts before navigation.
 */
export async function openPage(ctx, routePath, { width = 1440, height, query = '', reduced = false, init = [], contextOptions = {} } = {}) {
  const phone = width < 600
  const o = await ctx.page(null, {
    viewport: { width, height: height ?? heightOf(ctx, width) },
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    ...contextOptions,
  })
  const { page, context } = o
  await context.addInitScript(installHelpers)
  for (const s of init) await (Array.isArray(s) ? context.addInitScript(s[0], s[1]) : context.addInitScript(s))
  const origin = new URL(ctx.base).origin
  const thirdParty = []
  page.on('request', (req) => {
    const u = req.url()
    if (/^(data|blob|about):/.test(u)) return
    try {
      if (new URL(u).origin !== origin) thirdParty.push(u)
    } catch {
      thirdParty.push(u)
    }
  })
  let status = null
  try {
    const res = await page.goto(ctx.base + routePath + (query ? `?${query}` : ''), { waitUntil: 'networkidle' })
    status = res?.status() ?? null
    await page.evaluate(() => document.fonts.ready.then(() => true))
    await page.waitForTimeout(150)
  } catch (e) {
    await o.close()
    throw e
  }
  return { ...o, thirdParty, status }
}

/** Every rule a file's run collects into. */
export function collector(ids) {
  const m = new Map(ids.map((id) => [id, { fail: [], notes: [] }]))
  return {
    fail: (id, s) => m.get(id).fail.push(s),
    note: (id, s) => m.get(id).notes.push(s),
    result: (id) => ({ fail: capped(m.get(id).fail), notes: capped(m.get(id).notes, 12) }),
    map: m,
  }
}

// ---------------------------------------------------------------------------------------------
// In-page measurement for one screen (rules 5–14, C, U, D, R, 15, 16/17)
// ---------------------------------------------------------------------------------------------

function MEASURE(opts) {
  const L = window.__lc
  const memo = new Map()
  const vis = (el) => L.visible(el, memo)
  const vh = innerHeight
  const vw = document.documentElement.clientWidth
  const out = { controls: 0, small: [], glyphs: 0, arrows: 0, chrome: 0, body: 0, sizes: {}, contrast: [], mono: [], hand: [], colour: [], underline: [], splitDates: [] }

  const texts = []
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n; (n = tw.nextNode()); ) {
    if (!n.data.trim()) continue
    const el = n.parentElement
    if (!el || el.closest('script,style,noscript,template')) continue
    const rg = document.createRange()
    rg.selectNodeContents(n)
    const rects = [...rg.getClientRects()].filter((x) => x.width > 0 && x.height > 0)
    if (!rects.length || !vis(el)) continue
    const top = Math.min(...rects.map((x) => x.top))
    const bottom = Math.max(...rects.map((x) => x.bottom))
    texts.push({ el, text: n.data, first: top < vh && bottom > 0 })
  }

  const runningLink = (el) => {
    const a = el.closest('a,button')
    return !!a && !!a.closest('main') && !!a.closest('p,li') && !a.closest('[data-rail],[data-toc],nav,[data-picker],[data-share],header,footer') && getComputedStyle(a).display === 'inline'
  }

  if (!opts.contrastOnly) {
    // 5, 14: controls on the first screen; phone targets
    for (const c of document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')) {
      if (!vis(c)) continue
      if (runningLink(c)) continue // a link in running text is reading, not chrome
      const r = c.getBoundingClientRect()
      if (r.width === 0 || r.bottom <= 0 || r.top >= vh) continue
      out.controls += 1
      const inline = getComputedStyle(c).display === 'inline' || (!!c.closest('p') && getComputedStyle(c).display.startsWith('inline'))
      if (opts.phone && !inline && (r.width < 43.5 || r.height < 43.5))
        out.small.push(`${L.describe(c)} "${(c.getAttribute('aria-label') || c.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`)
    }
  }

  const GLYPHS = /[◐○●✓✔▶◀▸▾±◇◆⌕◎◫⇄★☆]/g
  const ARROWS = /[→←↗]/g
  const tokenNames = ['--ink', '--ink-muted', '--ink-subtle', '--accent', '--accent-ink', '--border', '--surface', '--raised', '--canvas-base', '--shadow-ink', '--hair', '--mark', '--trail', '--border-strong', '--focus', '--highlight']
  const tokens = tokenNames.map((k) => L.resolve(`var(${k})`))
  const sat = (c) => {
    const r = c[0] / 255
    const g = c[1] / 255
    const b = c[2] / 255
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const l = (mx + mn) / 2
    return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1))
  }
  // the Lab's two extra families, by the variables app/lab/layout.tsx's next/font/local sets (their
  // generated names follow the variable names, not "Space Mono"/"Caveat"), and by name as a fallback
  const fam = (v) => (v || '').split(',')[0].replace(/['"]/g, '').replace(/ Fallback$/, '').trim().toLowerCase()
  const varHost = document.querySelector('main') || document.body
  const monoVar = fam(getComputedStyle(varHost).getPropertyValue('--font-lab-mono'))
  const handVar = fam(getComputedStyle(varHost).getPropertyValue('--font-lab-hand'))
  const isMono = (f) => (!!monoVar && f === monoVar) || /space.?mono/i.test(f)
  const isHand = (f) => (!!handVar && f === handVar) || /caveat/i.test(f)
  const where = (el) => L.describe(el.closest('[data-entry],[data-rail],header,footer,[data-lead],aside,[data-refs]') || el)

  for (const t of texts) {
    const s = getComputedStyle(t.el)
    const fs = parseFloat(s.fontSize)
    const first = fam(s.fontFamily)
    if (!opts.contrastOnly) {
      if (t.first) {
        out.glyphs += (t.text.match(GLYPHS) || []).length
        out.arrows += (t.text.match(ARROWS) || []).length
        const len = t.text.trim().length
        const chrome = t.el.closest('a,button,summary,nav,header,footer,[data-rail],[data-share],[data-picker],[data-toc],aside:not([data-side])') && !runningLink(t.el)
        if (chrome) out.chrome += len
        else out.body += len
        const k = Math.round(fs * 2) / 2
        out.sizes[k] = (out.sizes[k] || 0) + 1
      }
      // 9: Space Mono only in code; handwriting only in dates, annotations and the dot, ≤ 8 words
      if (isMono(first) && !t.el.closest('pre,code,kbd,[data-tool-log],[data-num]')) out.mono.push(`"${t.text.trim().slice(0, 30)}" in ${L.describe(t.el)}`)
      if (isHand(first)) {
        const host = t.el.closest('time,[data-annot],[data-dot]')
        if (!host) out.hand.push(`outside time/[data-annot]/[data-dot]: "${t.text.trim().slice(0, 30)}" in ${L.describe(t.el)}`)
        else if (host.textContent.trim().split(/\s+/).length > 8) out.hand.push(`over 8 words: "${host.textContent.trim().slice(0, 40)}"`)
      }
      // 12: colour coding outside leads, figures and code
      if (!t.el.closest('[data-lead],figure,pre,code')) {
        const c = L.parse(s.color)
        if (sat(c) >= 0.15 && !tokens.some((k) => L.near(c, k))) out.colour.push(`text ${s.color} "${t.text.trim().slice(0, 24)}" in ${where(t.el)}`)
      }
    }
    // 16/17: every visible text node ≥ 4.5:1, ≥ 3:1 at 24px and up (the faint big chapter number, a
    // [data-num] at 48px+ or aria-hidden, is decoration and excepted)
    const decorative = !!t.el.closest('[data-num]') && (fs >= 48 || !!t.el.closest('[aria-hidden="true"]'))
    if (!decorative) {
      const bg = L.bgOf(t.el)
      const fgRaw = L.parse(s.color)
      const fg = L.over([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * L.opacity(t.el)], bg)
      const need = fs >= 24 ? 3 : 4.5
      const cr = L.ratio(fg, bg)
      if (cr < need) out.contrast.push(`${cr.toFixed(2)}:1 (need ${need}) "${t.text.trim().slice(0, 32)}" in ${L.describe(t.el)} within ${where(t.el)}`)
    }
  }

  // the trail: 3:1 against the bar's ground (dark) or against the bar's edge (light)
  const trail = document.querySelector('[data-trail]')
  if (trail) {
    const dark = document.documentElement.dataset.dark === '1'
    let tc = L.parse(getComputedStyle(trail).backgroundColor)
    if (tc[3] === 0) tc = L.resolve('var(--trail)')
    const ground = dark ? L.resolve('var(--canvas-base)') : L.resolve('var(--border)')
    const cr = L.ratio(L.over(tc, ground), ground)
    if (cr < 3) out.contrast.push(`the trail is ${cr.toFixed(2)}:1 against ${dark ? 'the bar (--canvas-base)' : 'the bar\'s edge (--border)'}, need 3`)
  }
  if (opts.contrastOnly) return out

  // 12: borders outside the tokens
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[data-lead],figure,pre,code,svg') || !vis(el)) continue
    const s = getComputedStyle(el)
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(s[`border${side}Width`]) === 0 || s[`border${side}Style`] === 'none') continue
      const c = L.parse(s[`border${side}Color`])
      if (c[3] > 0 && sat(c) >= 0.15 && !tokens.some((k) => L.near(c, k))) {
        out.colour.push(`border ${s[`border${side}Color`]} on ${L.describe(el)}`)
        break
      }
    }
  }
  out.accent = L.resolve('var(--accent)')

  // U: every inline link in running text is underlined, never washed, the underline ≥ 3:1
  for (const a of document.querySelectorAll('main a')) {
    if (!vis(a) || !runningLink(a)) continue
    const s = getComputedStyle(a)
    const bg = L.bgOf(a.parentElement)
    const label = `"${a.textContent.trim().slice(0, 24)}"`
    let line = null
    if (/underline/.test(s.textDecorationLine)) line = s.textDecorationColor
    else if (parseFloat(s.borderBottomWidth) > 0 && s.borderBottomStyle !== 'none') line = s.borderBottomColor
    if (!line) {
      out.underline.push(`no underline: ${label}`)
      continue
    }
    if (L.parse(s.backgroundColor)[3] > 0) out.underline.push(`colour wash behind ${label}`)
    const dc = L.over(L.parse(line), bg)
    const cr = L.ratio(dc, bg)
    if (cr < 3) out.underline.push(`underline ${cr.toFixed(2)}:1 on ${label}`)
  }

  // D: a handwritten date never splits across lines
  out.splitDates = [...document.querySelectorAll('time')].filter((x) => vis(x) && x.getClientRects().length > 1).map((x) => x.textContent.trim())

  // 10: the lead
  out.leads = [...document.querySelectorAll('[data-lead]')].map((e) => e.getBoundingClientRect().top)

  // C: the column and the rail centre together (the rail's box counts while it waits)
  const column = document.querySelector('[data-column]')
  const rail = document.querySelector('[data-rail]')
  if (column && rail) {
    const a = column.getBoundingClientRect()
    const b = rail.getBoundingClientRect()
    const left = Math.min(a.left, b.left)
    const right = Math.max(a.right, b.right)
    out.centre = { left: Math.round(left), right: Math.round(vw - right) }
  } else out.centre = { missing: [!column && '[data-column]', !rail && '[data-rail]'].filter(Boolean) }

  // R: Related and Links to this page end every entry
  const end = document.querySelector('[data-body-end]')
  const endTop = end ? end.getBoundingClientRect().top : null
  out.related = {
    rail: !!rail,
    related: !!rail?.querySelector('[data-related]'),
    relatedLinks: rail?.querySelectorAll('[data-related] a[href]').length ?? 0,
    backlinks: !!rail?.querySelector('[data-backlinks]'),
    afterBody: rail && endTop != null ? rail.getBoundingClientRect().top >= endTop - 1 || opts.wide : null,
  }

  // 15: content headings (end matter and template furniture excluded)
  const scope = document.querySelector('article[data-entry]') || document.querySelector('main')
  out.headings = scope
    ? [...scope.querySelectorAll('h2, h3')]
        .filter((h) => !h.closest('[data-refs],[data-ending],[data-rail],[data-related],[data-backlinks],[data-share],[data-picker],footer'))
        .map((h) => h.textContent.trim().toLowerCase())
    : []

  // 13: no empty vertical strip > 240px inside the content block, over the first screen
  if (opts.strip) {
    const main = document.querySelector('main[data-lab-main]') || document.querySelector('main')
    let block = main
    if (column && rail) {
      for (let e = column.parentElement; e; e = e.parentElement)
        if (e.contains(rail)) {
          block = e
          break
        }
    } else if (main) {
      block = [...main.children].find((c) => c.getBoundingClientRect().width > 0) || main
    }
    if (block) {
      const br = block.getBoundingClientRect()
      const cs = getComputedStyle(block)
      const left = br.left + parseFloat(cs.paddingLeft)
      const right = br.right - parseFloat(cs.paddingRight)
      const leafy = (e) => e.matches('img,svg,canvas,video,figure,input,button') || e.children.length === 0 || [...e.childNodes].some((n) => n.nodeType === 3 && n.data.trim())
      const rects = [...block.querySelectorAll('*')].filter((e) => leafy(e) && vis(e)).map((e) => e.getBoundingClientRect())
      if (rail && opts.wide) rects.push(rail.getBoundingClientRect()) // reserved for the rail while it waits
      const spans = rects.filter((r) => r.width > 0 && r.bottom > 56 && r.top < vh).map((r) => [r.left, r.right]).sort((p, q) => p[0] - q[0])
      let x = left
      let gap = 0
      const edge = Math.max(right, ...spans.map((s) => s[1]))
      for (const [p, q] of spans) {
        if (p > x) gap = Math.max(gap, p - x)
        x = Math.max(x, q)
      }
      gap = Math.max(gap, edge - x)
      out.strip = Math.round(gap)
    }
  }

  // 14: horizontal overflow
  out.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth
  return out
}

/** 14: nothing fixed covers the last paragraph or the footer. */
async function COVERED() {
  const L = window.__lc
  const bad = []
  const ps = [...document.querySelectorAll('main p')].filter((p) => L.visible(p) && p.getBoundingClientRect().height > 0)
  const targets = [[ps[ps.length - 1], 'the last paragraph'], [document.querySelector('footer[data-footer]'), 'the footer']]
  L.scrollToY(document.documentElement.scrollHeight)
  await new Promise((r) => setTimeout(r, 350))
  for (const [el, name] of targets) {
    if (!el) continue
    let r = el.getBoundingClientRect()
    if (r.top < 0 || r.bottom > innerHeight) {
      L.scrollToY(Math.max(0, Math.round(r.bottom + scrollY - innerHeight + 2)))
      await L.frames()
      r = el.getBoundingClientRect()
    }
    const x = r.left + Math.min(20, r.width / 2)
    const y = Math.min(innerHeight - 2, r.top + r.height / 2)
    const hit = document.elementFromPoint(x, y)
    if (hit && !el.contains(hit) && !hit.contains(el)) bad.push(`${name} is under ${L.describe(hit)}`)
  }
  return bad
}

/** 11: the share of screenshot pixels within reach of the accent. */
async function ACCENT_SHARE([b64, acc]) {
  const img = new Image()
  img.src = 'data:image/png;base64,' + b64
  await img.decode()
  const c = new OffscreenCanvas(img.width, img.height)
  const x = c.getContext('2d')
  x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, img.width, img.height).data
  let n = 0
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - acc[0]) + Math.abs(d[i + 1] - acc[1]) + Math.abs(d[i + 2] - acc[2]) < 40) n++
  return n / (d.length / 4)
}

const AXE = (root) => path.join(root, 'node_modules/axe-core/axe.min.js')
async function runAxe(page, root) {
  try {
    await page.addScriptTag({ path: AXE(root) })
  } catch {
    await page.evaluate(fs.readFileSync(AXE(root), 'utf8'))
  }
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] })
    return r.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: (v.nodes[0]?.target || []).join(' '), why: (v.nodes[0]?.failureSummary || '').replace(/\s+/g, ' ').slice(0, 140) }))
  })
}

// ---------------------------------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------------------------------

const PASS_IDS = ['5', '6', '7', '8', '9', '10', '11', '12', '13', 'C', '14', '15', '16', '17', 'U', 'D', 'R', '21', 'A']
const JOBS = 3
const passCache = new WeakMap()
/** Errors and third-party requests from this file's other loads, reported by rule 21. */
const health = new WeakMap()
const healthOf = (ctx) => {
  if (!health.has(ctx)) health.set(ctx, [])
  return health.get(ctx)
}
function recordHealth(ctx, tag, o) {
  const list = healthOf(ctx)
  for (const e of o.errors) list.push(`${tag}: ${e.slice(0, 200)}`)
  for (const u of o.thirdParty) list.push(`${tag}: third-party request ${u.slice(0, 120)}`)
}

function pass(ctx) {
  if (!passCache.has(ctx)) passCache.set(ctx, runPass(ctx))
  return passCache.get(ctx)
}

async function runPass(ctx) {
  const info = await builtRoutes(ctx)
  const c = collector(PASS_IDS)
  if (info.notBuilt) return { info, c }
  const sample = new Set(sampleRoutes(info.routes, ctx.quick).map((r) => r.path))
  const wide = ctx.widths.filter((w) => w.width >= 1200)
  const headingWidth = (wide.find((w) => w.width === 1440) ?? wide[0] ?? ctx.widths[0]).width
  const headings = {}
  const jobs = []
  for (const route of info.routes) for (const w of ctx.widths) for (const [li, look] of ctx.looks.entries()) jobs.push({ route, w, look, li })
  let loads = 0

  await pool(jobs, JOBS, async ({ route, w, look, li }) => {
    const tag = tagOf(route, w.width, look)
    const entry = route.kind === 'entry'
    const phone = w.width < 768
    let o
    try {
      o = await openPage(ctx, route.path, { width: w.width, height: w.height, query: look.query })
    } catch (e) {
      c.fail('21', `${tag}: did not load (${e.message.split('\n')[0]})`)
      return
    }
    loads += 1
    try {
      if (o.status !== 200) {
        c.fail('21', `${tag}: answered ${o.status}`)
        return
      }
      const m = await o.page.evaluate(MEASURE, { phone: w.width < 600, wide: w.width >= 1200, strip: w.width >= 1440, contrastOnly: false })
      const limits = entry ? { d: 15, p: 11, chrome: 0.5 } : { d: 21, p: 13, chrome: 1.0 }

      // 5
      if (m.controls > (phone ? limits.p : limits.d)) c.fail('5', `${tag}: ${m.controls} controls on the first screen (at most ${phone ? limits.p : limits.d})`)
      // 6
      if (m.glyphs) c.fail('6', `${tag}: ${m.glyphs} symbol glyphs on the first screen`)
      if (m.arrows > 4) c.fail('6', `${tag}: ${m.arrows} text arrows on the first screen (at most 4)`)
      // 7
      if (m.body && m.chrome / m.body > limits.chrome) c.fail('7', `${tag}: chrome ÷ body characters ${(m.chrome / m.body).toFixed(2)} (at most ${limits.chrome})`)
      if (!m.body) c.fail('7', `${tag}: no body text on the first screen`)
      // 8
      // sizes less than 1px apart are one size to a reader (22 and 22.5 at 1024, where the h2's
      // clamp passes Caveat's fixed 22px); count the distinct ones
      const sizes = Object.keys(m.sizes)
        .map(Number)
        .sort((a, b) => a - b)
        .filter((s, i, all) => i === 0 || s - all[i - 1] >= 1)
      if (sizes.length) {
        const band = sizes.filter((s) => s >= 13 && s <= 17)
        if (sizes.length > 6) c.fail('8', `${tag}: ${sizes.length} font sizes (${sizes.join(', ')}); at most 6`)
        if (sizes.at(-1) / sizes[0] < 3) c.fail('8', `${tag}: largest ÷ smallest ${(sizes.at(-1) / sizes[0]).toFixed(2)} (${sizes.at(-1)}/${sizes[0]}); at least 3`)
        if (sizes[0] < 13) c.fail('8', `${tag}: smallest size ${sizes[0]}px; at least 13`)
        if (band.length > 2) c.fail('8', `${tag}: ${band.length} sizes in the 13–17px band (${band.join(', ')}); at most 2`)
      }
      // 9
      for (const x of m.mono) c.fail('9', `${tag}: Space Mono outside code: ${x}`)
      for (const x of m.hand) c.fail('9', `${tag}: handwriting ${x}`)
      // 10
      if (entry) {
        if (m.leads.length !== 1) c.fail('10', `${tag}: ${m.leads.length} [data-lead]; exactly one`)
        else if (m.leads[0] >= w.height - 60) c.fail('10', `${tag}: the lead starts at ${Math.round(m.leads[0])}px, not on the first screen (viewport ${w.height})`)
      }
      // 11
      const png = (await o.page.screenshot()).toString('base64')
      const share = await o.page.evaluate(ACCENT_SHARE, [png, m.accent])
      if (share > 0.05) c.fail('11', `${tag}: accent is ${(share * 100).toFixed(1)}% of the screen's pixels (at most 5%)`)
      // 12
      for (const x of m.colour.slice(0, 3)) c.fail('12', `${tag}: colour outside the tokens: ${x}`)
      // 13 (strip)
      if (m.strip != null && m.strip > 240) c.fail('13', `${tag}: an empty strip ${m.strip}px wide inside the content block (at most 240)`)
      // C
      if (entry && w.width >= 1440) {
        if (m.centre.missing) c.fail('C', `${tag}: no ${m.centre.missing.join(' or ')}`)
        else if (Math.abs(m.centre.left - m.centre.right) > 24) c.fail('C', `${tag}: column + rail sit ${m.centre.left}px from the left, ${m.centre.right}px from the right (|Δ| ${Math.abs(m.centre.left - m.centre.right)} > 24)`)
      }
      // 14
      if (m.overflow > 0) c.fail('14', `${tag}: horizontal overflow ${m.overflow}px`)
      for (const x of m.small) c.fail('14', `${tag}: target under 44×44: ${x}`)
      // 16 / 17
      for (const x of m.contrast.slice(0, 4)) c.fail(isLabLook(look) ? '17' : '16', `${tag}: ${x}`)
      if (m.contrast.length > 4) c.fail(isLabLook(look) ? '17' : '16', `${tag}: and ${m.contrast.length - 4} more text nodes under contrast`)
      // U, D
      for (const x of m.underline.slice(0, 3)) c.fail('U', `${tag}: ${x}`)
      for (const x of m.splitDates) c.fail('D', `${tag}: the date "${x}" splits across lines`)
      // R (once per route and width)
      if (entry && li === 0) {
        const r = m.related
        if (!r.rail) c.fail('R', `${tagOf(route, w.width)}: no [data-rail]`)
        else {
          if (!r.related) c.fail('R', `${tagOf(route, w.width)}: no [data-related] in the rail`)
          else if (!r.relatedLinks) c.fail('R', `${tagOf(route, w.width)}: Related is empty`)
          if (!r.backlinks) c.fail('R', `${tagOf(route, w.width)}: no [data-backlinks] (Links to this page) in the rail`)
          if (r.afterBody === false) c.fail('R', `${tagOf(route, w.width)}: the rail's block starts before [data-body-end]`)
        }
      }
      // 15 (collected)
      if (w.width === headingWidth && li === 0) headings[route.path] = m.headings
      // A
      if (sample.has(route.path) && (w.width === 390 || w.width === 1440)) {
        for (const v of await runAxe(o.page, ctx.root)) c.fail('A', `${tag}: ${v.impact} ${v.id} ×${v.n} (${v.target}) ${v.why}`)
      }
      // 14 (covered; scrolls, so last)
      for (const x of await o.page.evaluate(COVERED)) c.fail('14', `${tag}: ${x}`)
      // 21
      for (const e of o.errors) c.fail('21', `${tag}: ${e.slice(0, 200)}`)
      for (const u of o.thirdParty) c.fail('21', `${tag}: third-party request ${u.slice(0, 120)}`)
    } catch (e) {
      c.fail('21', `${tag}: the measurement threw: ${e.message.split('\n')[0]}`)
    } finally {
      await o.close()
    }
  })

  // 15: no heading on 3 or more pages; no slot-name headings
  const SLOTS = ['what it is', 'try it', "how it's built", 'how it’s built', 'code', 'what broke', 'what i measured', 'overview', 'summary', 'introduction', 'conclusion', 'key takeaways', 'where this fits']
  const seen = {}
  for (const [p, hs] of Object.entries(headings))
    for (const h of new Set(hs)) {
      ;(seen[h] ??= []).push(p)
      if (SLOTS.includes(h)) c.fail('15', `${p}: a slot-name heading "${h}"`)
    }
  for (const [h, ps] of Object.entries(seen)) if (ps.length >= 3) c.fail('15', `the heading "${h}" is on ${ps.length} pages (${ps.slice(0, 4).join(', ')}${ps.length > 4 ? ', …' : ''})`)

  for (const id of PASS_IDS) c.note(id, `${info.routes.length} routes × ${ctx.widths.length} widths × ${ctx.looks.length} looks: ${loads} loads`)
  return { info, c }
}

/** A rule derived from the pass; `extra` adds its own loads. */
function fromPass(id, title, { entryOnly = false, extra = null } = {}) {
  return {
    id,
    title,
    needs: ['server', 'browser'],
    async run(ctx) {
      const { info, c } = await pass(ctx)
      if (info.notBuilt) return { notBuilt: info.notBuilt }
      if (entryOnly) for (const m of info.missing) c.fail(id, m)
      if (extra) await extra(ctx, info, c)
      return c.result(id)
    },
  }
}

// ---------------------------------------------------------------------------------------------
// 13: measure (its own loads, chapter 05)
// ---------------------------------------------------------------------------------------------

function LINES() {
  const end = document.querySelector('[data-body-end]')
  const article = document.querySelector('article[data-entry]')
  if (!article) return { error: 'no article[data-entry]' }
  let ps = [...article.querySelectorAll('p')].filter(
    (p) =>
      !p.closest('[data-lead],aside,[data-pull],[data-refs],figure,blockquote,[data-ending],[data-rail],[data-share],[data-picker],li,header,footer,details') &&
      (!end || p.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      window.__lc.visible(p),
  )
  const sizes = {}
  for (const p of ps) sizes[getComputedStyle(p).fontSize] = (sizes[getComputedStyle(p).fontSize] || 0) + p.textContent.length
  const body = Object.entries(sizes).sort((a, b) => b[1] - a[1])[0]?.[0]
  ps = ps.filter((p) => getComputedStyle(p).fontSize === body)
  if (!ps.length) return { error: 'no body paragraphs' }
  const counts = []
  for (const p of ps) {
    const lines = new Map()
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
    for (let n; (n = tw.nextNode()); )
      for (let i = 0; i < n.data.length; i++) {
        const rg = document.createRange()
        rg.setStart(n, i)
        rg.setEnd(n, i + 1)
        const rc = rg.getClientRects()[0]
        if (!rc) continue
        const k = Math.round(rc.top / 4)
        lines.set(k, (lines.get(k) || 0) + 1)
      }
    const v = [...lines.values()]
    v.pop() // the last line of a paragraph is short by nature
    counts.push(...v)
  }
  const s = getComputedStyle(ps[0])
  return {
    avg: counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0,
    lines: counts.length,
    lh: parseFloat(s.lineHeight) / parseFloat(s.fontSize),
    measure: document.documentElement.dataset.aaMeasure,
  }
}

async function measureLines(ctx, info, c) {
  const entry = fifthChapter(info.entries) ?? info.entries[0]
  if (!entry) return
  const paper = ctx.looks.find((l) => !isLabLook(l)) ?? ctx.looks[0]
  const cases = [
    [1440, 900, false, 85, 100],
    [1280, 800, false, 78, 100],
    [1440, 900, true, 66, 76],
    [390, 844, false, 32, 999],
    [1920, 1080, false, 85, 100],
  ]
  const comfy = () => {
    try {
      localStorage.setItem('lab.aa', JSON.stringify({ measure: 'comfortable', size: 17 }))
    } catch {
      /* storage can be absent */
    }
  }
  for (const [width, height, comfortable, lo, hi] of cases) {
    const label = `${entry.path} @${width}${comfortable ? ' Comfortable' : ''}`
    const o = await openPage(ctx, entry.path, { width, height, query: paper.query, init: comfortable ? [comfy] : [] })
    try {
      recordHealth(ctx, label, o)
      const r = await o.page.evaluate(LINES)
      if (r.error) {
        c.fail('13', `${label}: ${r.error}`)
        continue
      }
      if (comfortable && r.measure !== 'comfortable') c.fail('13', `${label}: lab.aa set Comfortable, but html[data-aa-measure] is "${r.measure}"`)
      if (!(r.avg >= lo && r.avg <= hi)) c.fail('13', `${label}: ${r.avg.toFixed(1)} characters a line (want ${lo}–${hi === 999 ? '∞' : hi})`)
      if (width >= 1024 && r.lh < 1.7) c.fail('13', `${label}: line height ${r.lh.toFixed(2)} (at least 1.7 on desktop)`)
      c.note('13', `${label}: ${r.avg.toFixed(1)} chars a line over ${r.lines} lines, line height ${r.lh.toFixed(2)}`)
    } finally {
      await o.close()
    }
  }
}

// ---------------------------------------------------------------------------------------------
// 16: the other Paper themes (sampled routes, 390 and 1440)
// ---------------------------------------------------------------------------------------------

export function paperThemes(root) {
  const src = fs.readFileSync(path.join(root, 'content/themes.ts'), 'utf8')
  const start = src.indexOf('export const themes')
  const end = src.indexOf('export const labThemes')
  return [...src.slice(start, end > start ? end : undefined).matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1])
}

async function sweepThemes(ctx, info, c) {
  const done = new Set(ctx.looks.filter((l) => !isLabLook(l)).map((l) => new URLSearchParams(l.query).get('theme')))
  let themes = paperThemes(ctx.root).filter((t) => !done.has(t))
  if (ctx.quick) themes = themes.slice(0, 3)
  const routes = sampleRoutes(info.routes, ctx.quick)
  const widths = [390, 1440].filter((w) => ctx.widths.some((x) => x.width === w))
  const jobs = themes.flatMap((theme) => routes.flatMap((route) => widths.map((width) => ({ theme, route, width }))))
  await pool(jobs, JOBS, async ({ theme, route, width }) => {
    const tag = `${route.path} @${width} paper/${theme}`
    const o = await openPage(ctx, route.path, { width, query: `look=paper&theme=${theme}` })
    try {
      recordHealth(ctx, tag, o)
      const applied = await o.page.evaluate(() => document.documentElement.dataset.theme)
      if (applied !== theme) c.fail('16', `${tag}: ?theme=${theme} did not apply (html[data-theme] is "${applied}")`)
      const m = await o.page.evaluate(MEASURE, { contrastOnly: true })
      for (const x of m.contrast.slice(0, 4)) c.fail('16', `${tag}: ${x}`)
      if (m.contrast.length > 4) c.fail('16', `${tag}: and ${m.contrast.length - 4} more text nodes under contrast`)
    } finally {
      await o.close()
    }
  })
  c.note('16', `the other ${themes.length} Paper themes: ${routes.length} sampled routes × ${widths.join(' and ')}`)
}

// ---------------------------------------------------------------------------------------------
// 18: the look switch (every route, 390 and 1440)
// ---------------------------------------------------------------------------------------------

function recordDclLook() {
  document.addEventListener('DOMContentLoaded', () => {
    window.__dclLook = document.documentElement.dataset.look
  }, { once: true })
}
const moved = (before, after) => {
  let mx = 0
  let what = ''
  before.forEach((b, i) => {
    const a = after[i]
    if (!a) return
    const d = Math.max(...b.r.map((v, j) => Math.abs(v - a.r[j])))
    if (d > mx) {
      mx = d
      what = b.name
    }
  })
  if (after.length !== before.length) return { d: Infinity, what: `${before.length} key elements before, ${after.length} after` }
  return { d: mx, what }
}
export { moved as movedBetween }

const runLookSwitch = {
  id: '18',
  title: 'The look switch: in the bar everywhere, Paper by default, remembered, no flash, moves nothing',
  needs: ['server', 'browser'],
  async run(ctx) {
    const info = await builtRoutes(ctx)
    if (info.notBuilt) return { notBuilt: info.notBuilt }
    const c = collector(['18'])
    const widths = [390, 1440].filter((w) => ctx.widths.some((x) => x.width === w))
    const jobs = info.routes.flatMap((route) => widths.map((width) => ({ route, width })))
    await pool(jobs, JOBS, async ({ route, width }) => {
      const tag = tagOf(route, width)
      const phone = width <= 760
      const o = await openPage(ctx, route.path, { width, init: [recordDclLook] })
      try {
        recordHealth(ctx, `${tag} (18)`, o)
        const p = o.page
        const st = await p.evaluate(() => ({
          look: document.documentElement.dataset.look,
          inBar: !!document.querySelector('header[data-bar] [data-look-switch], header[data-bar] [data-look-toggle]'),
        }))
        if (!st.inBar) c.fail('18', `${tag}: no [data-look-switch] or [data-look-toggle] in header[data-bar]`)
        if (st.look !== 'paper') c.fail('18', `${tag}: the default look is "${st.look}", not paper`)
        const sel = phone ? 'header[data-bar] button[data-look-toggle]' : 'header[data-bar] [data-look-switch] button[data-look-option="lab"]'
        const other = phone ? 'header[data-bar] [data-look-switch]' : 'header[data-bar] button[data-look-toggle]'
        if (!(await p.locator(sel).first().isVisible().catch(() => false))) {
          c.fail('18', `${tag}: ${sel} is not visible`)
          return
        }
        if (await p.locator(other).first().isVisible().catch(() => false)) c.fail('18', `${tag}: ${other} shows too; only one of switch and toggle at a width`)
        const before = await p.evaluate(() => window.__lc.keyRects())
        await p.locator(sel).first().click()
        await p.waitForTimeout(420)
        const after = await p.evaluate(() => ({
          look: document.documentElement.dataset.look,
          pressed: document.querySelector('[data-look-switch] [data-look-option="lab"]')?.getAttribute('aria-pressed'),
          rects: window.__lc.keyRects(),
        }))
        if (after.look !== 'lab') c.fail('18', `${tag}: switching left html[data-look] "${after.look}", not lab`)
        if (!phone && after.pressed !== 'true') c.fail('18', `${tag}: the lab option's aria-pressed is "${after.pressed}" after choosing it`)
        const mv = moved(before, after.rects)
        if (mv.d > 1) c.fail('18', `${tag}: switching the look moved ${mv.what} by ${Number.isFinite(mv.d) ? mv.d.toFixed(1) + 'px' : '(count changed)'}`)
        await p.reload({ waitUntil: 'networkidle' })
        const re = await p.evaluate(() => ({ look: document.documentElement.dataset.look, dcl: window.__dclLook, stored: (() => { try { return localStorage.getItem('lab.look') } catch { return 'unreadable' } })() }))
        if (re.stored !== 'lab') c.fail('18', `${tag}: localStorage lab.look is "${re.stored}" after choosing lab`)
        if (re.look !== 'lab') c.fail('18', `${tag}: the look is "${re.look}" after a reload, not lab`)
        if (re.dcl !== 'lab') c.fail('18', `${tag}: html[data-look] was "${re.dcl}" at DOMContentLoaded after the reload (a flash before the boot script)`)
      } catch (e) {
        c.fail('18', `${tag}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    })
    c.note('18', `${jobs.length} loads`)
    return c.result('18')
  },
}

// ---------------------------------------------------------------------------------------------
// K: the Lab theme keeps the frame (sampled routes, 1440)
// ---------------------------------------------------------------------------------------------

function FRAMES({ sel, dark }) {
  const L = window.__lc
  const border = L.resolve('var(--border)')
  const out = []
  const seen = []
  const split = (v) => v.split(/,(?![^(]*\))/).map((x) => x.trim())
  const framedIn = (el) => {
    const q = [el, ...el.children, ...[...el.children].flatMap((k) => [...k.children])]
    return q.find((e) => parseFloat(getComputedStyle(e).borderTopWidth) > 0 && getComputedStyle(e).borderTopStyle !== 'none')
  }
  for (const el of document.querySelectorAll(sel)) {
    if (!L.visible(el) || !el.getClientRects().length) continue
    const name = L.describe(el)
    seen.push(name)
    const box = framedIn(el)
    if (!box) {
      out.push(`${name}: no frame`)
      continue
    }
    const s = getComputedStyle(box)
    const w = parseFloat(s.borderTopWidth)
    if (Math.abs(w - 2) > 0.5) out.push(`${name}: a ${w}px edge, not 2px`)
    if (!L.near(L.parse(s.borderTopColor), border, 8)) out.push(`${name}: its edge is ${s.borderTopColor}, not --border`)
    const shadows = s.boxShadow === 'none' ? [] : split(s.boxShadow).filter((x) => !/inset/.test(x)).map((x) => x.replace(/(rgba?|color)\([^)]*\)/g, '').trim().split(/\s+/).map(parseFloat))
    const hard = shadows.some((n) => (n[0] > 0 || n[1] > 0) && (n[2] || 0) === 0)
    const soft = shadows.some((n) => (n[2] || 0) > 0)
    if (!hard) out.push(`${name}: no zero-blur offset shadow (${s.boxShadow})`)
    if (soft) out.push(`${name}: a blurred shadow (${s.boxShadow})`)
  }
  const brass = [127, 108, 69]
  if (dark) {
    if (!L.near(border, brass, 6)) out.push(`--border is rgb(${border.slice(0, 3).map(Math.round)}), not brass #7F6C45`)
    const ink = L.resolve('var(--shadow-ink)')
    if (!L.near(ink, brass, 6)) out.push(`--shadow-ink is rgb(${ink.slice(0, 3).map(Math.round)}), not brass #7F6C45`)
  }
  return { out, seen }
}

function noNativeShare() {
  try {
    delete Navigator.prototype.share
    delete Navigator.prototype.canShare
  } catch {
    /* fine */
  }
}

const runFrames = {
  id: 'K',
  title: 'The Lab theme keeps the frame: 2px --border and a zero-blur offset on every box, card, figure and menu; Dark is brass',
  needs: ['server', 'browser'],
  async run(ctx) {
    const info = await builtRoutes(ctx)
    if (info.notBuilt) return { notBuilt: info.notBuilt }
    const c = collector(['K'])
    const looks = ctx.looks.filter(isLabLook)
    if (!looks.length) looks.push({ name: 'lab/dark', query: 'look=lab&mode=dark' })
    const routes = sampleRoutes(info.routes, ctx.quick)
    // an essay's opening is its lead in words alone, set at the lede's size: text, not a box
    const STATIC = '[data-box], [data-lead]:not([data-lead="opening"]), article[data-entry] figure'
    for (const look of looks)
      for (const route of routes) {
        const tag = tagOf(route, 1440, look)
        const dark = /mode=dark/.test(look.query)
        const o = await openPage(ctx, route.path, { width: 1440, query: look.query, init: [noNativeShare] })
        try {
          recordHealth(ctx, `${tag} (K)`, o)
          const p = o.page
          const add = (r, what) => {
            for (const x of r.out) c.fail('K', `${tag}${what ? ` (${what} open)` : ''}: ${x}`)
            return r.seen.length
          }
          const n = add(await p.evaluate(FRAMES, { sel: STATIC, dark }))
          if (route.kind === 'entry' && !n) c.fail('K', `${tag}: no box measured ([data-lead], figure or [data-box])`)
          // the menus, each opened in turn
          const menus = [
            ['header[data-bar] button[data-aa]', '[data-aa-panel]', 'Aa'],
            // the share menu is a row of chips, each framed, rather than one box
            ['[data-share="end"] button[data-share-open]', '[data-share="end"] [data-share-menu] > *', 'the share menu'],
            ['details[data-picker] > summary', 'details[data-picker] [data-picker-panel]', 'the picker'],
          ]
          for (const [btn, panel, what] of menus) {
            const b = p.locator(btn).first()
            if (!(await b.count())) {
              if (what === 'Aa') c.fail('K', `${tag}: no ${btn}`)
              continue
            }
            if (!(await b.isVisible().catch(() => false))) continue
            await b.click()
            await p.waitForTimeout(300)
            const got = add(await p.evaluate(FRAMES, { sel: panel, dark: false }), what)
            if (!got) c.fail('K', `${tag}: ${what} did not open (${panel} not visible)`)
            await p.keyboard.press('Escape')
            await p.waitForTimeout(250)
          }
        } catch (e) {
          c.fail('K', `${tag}: threw ${e.message.split('\n')[0]}`)
        } finally {
          await o.close()
        }
      }
    return c.result('K')
  },
}

// ---------------------------------------------------------------------------------------------
// 19: reduced motion (every route, 1440)
// ---------------------------------------------------------------------------------------------

function ANIMS() {
  return document
    .getAnimations()
    .filter((a) => a.playState === 'running' || a.playState === 'pending')
    .map((a) => {
      const kf = a.effect?.getKeyframes ? a.effect.getKeyframes() : []
      const props = [...new Set(kf.flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))]
      const dur = a.effect?.getTiming ? a.effect.getTiming().duration : 0
      return { name: a.animationName || a.transitionProperty || a.id || 'waapi', props, dur: typeof dur === 'number' ? dur : 0, on: window.__lc.describe(a.effect?.target) }
    })
    .filter((a) => !(a.props.every((p) => p === 'opacity') || a.dur <= 120))
}

const runReduced = {
  id: '19',
  title: 'Reduced motion: every animation opacity-only or ≤ 120ms, the dot still, no Lenis',
  needs: ['server', 'browser'],
  async run(ctx) {
    const info = await builtRoutes(ctx)
    if (info.notBuilt) return { notBuilt: info.notBuilt }
    const c = collector(['19'])
    await pool(info.routes, JOBS, async (route) => {
      const tag = `${tagOf(route, 1440)} reduced`
      const o = await openPage(ctx, route.path, { width: 1440, reduced: true })
      try {
        recordHealth(ctx, tag, o)
        const p = o.page
        const bad = (list, when) => list.forEach((a) => c.fail('19', `${tag}, ${when}: "${a.name}" on ${a.on} animates ${a.props.join('/') || '?'} over ${Math.round(a.dur)}ms`))
        bad(await p.evaluate(ANIMS), 'after load')
        await p.evaluate(async () => {
          window.__lc.scrollToY(600)
          await window.__lc.frames()
        })
        bad(await p.evaluate(ANIMS), 'after a scroll')
        const sw = p.locator('header[data-bar] [data-look-switch] button[data-look-option="lab"]').first()
        if (await sw.isVisible().catch(() => false)) {
          await sw.click()
          await p.evaluate(() => window.__lc.frames())
          bad(await p.evaluate(ANIMS), 'after a look switch')
        } else c.fail('19', `${tag}: no visible look switch to try`)
        const still = await p.evaluate(async () => {
          const dot = document.querySelector('[data-reading-dot]')
          if (!dot) return null
          await new Promise((r) => setTimeout(r, 300))
          const a = getComputedStyle(dot).transform
          await new Promise((r) => setTimeout(r, 1000))
          return { a, b: getComputedStyle(dot).transform }
        })
        if (still && still.a !== still.b) c.fail('19', `${tag}: the reading dot moved with nothing scrolling (${still.a} → ${still.b})`)
        if (!still && route.kind === 'entry') c.fail('19', `${tag}: no [data-reading-dot]`)
        const lenis = await p.evaluate(() => ({ cls: document.documentElement.classList.contains('lenis'), api: typeof window.__lenis !== 'undefined' }))
        if (lenis.cls || lenis.api) c.fail('19', `${tag}: Lenis started (${lenis.cls ? 'html.lenis' : ''}${lenis.cls && lenis.api ? ', ' : ''}${lenis.api ? 'window.__lenis' : ''})`)
      } catch (e) {
        c.fail('19', `${tag}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    })
    return c.result('19')
  },
}

// ---------------------------------------------------------------------------------------------
// The rules, in the order they run (21 and A last, so 21 sees this file's other loads)
// ---------------------------------------------------------------------------------------------

export default [
  fromPass('5', 'First-screen controls: entries ≤ 15 desktop / 11 phone; lists ≤ 21 / 13'),
  fromPass('6', 'Symbol glyphs = 0; text arrows ≤ 4'),
  fromPass('7', 'Chrome-to-body characters ≤ 0.5 on entries, ≤ 1.0 on lists'),
  fromPass('8', '≤ 6 font sizes; largest ÷ smallest ≥ 3; smallest ≥ 13px; ≤ 2 in 13–17px'),
  fromPass('9', 'Space Mono only in code; handwriting only in dates, annotations and the dot, ≤ 8 words'),
  fromPass('10', 'Exactly one [data-lead] per entry, its top on the first screen', { entryOnly: true }),
  fromPass('11', 'Accent ≤ 5% of screenshot pixels'),
  fromPass('12', 'No colour coding outside leads, figures and code'),
  fromPass('13', 'Measure 85–100ch at 1440, 78–100 at 1280, Comfortable 66–76, phone ≥ 32; line height ≥ 1.7; no strip > 240px', { extra: measureLines }),
  fromPass('C', 'The column and the rail centre together (|Δ| ≤ 24px at 1440 and 1920)', { entryOnly: true }),
  fromPass('14', 'No horizontal overflow; nothing fixed covers the last paragraph or the footer; phone targets ≥ 44×44'),
  fromPass('15', 'No h2/h3 on 3 or more pages; no slot-name headings'),
  fromPass('16', 'Paper contrast: every text ≥ 4.5:1 (3:1 at 24px+) in all 18 themes; the trail ≥ 3:1', { extra: sweepThemes }),
  fromPass('17', 'Lab theme contrast, Light and Dark, at every width; the trail ≥ 3:1', {
    extra: async (ctx, info, c) => {
      if (!ctx.looks.some(isLabLook)) c.note('17', 'this run has no Lab theme look (--quick), so nothing was measured')
    },
  }),
  runLookSwitch,
  runFrames,
  fromPass('U', 'Every inline link is underlined, the underline ≥ 3:1 against its ground'),
  fromPass('D', 'A handwritten date never splits across lines'),
  fromPass('R', 'Related and Links to this page end every entry; Related is never empty', { entryOnly: true }),
  runReduced,
  fromPass('21', 'Health: zero console and page errors; no third-party request on load', {
    extra: async (ctx, info, c) => {
      for (const x of healthOf(ctx)) c.fail('21', x)
    },
  }),
  fromPass('A', 'axe-core: zero serious or critical violations at 390 and 1440 in each look'),
]
