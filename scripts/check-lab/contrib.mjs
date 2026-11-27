/**
 * Rule GH: GitHub contributions on `/` (plan PR 8). Lane module for scripts/check-lab.mjs
 * (API.md §11).
 *
 * The calendar is `components/site/contributions.tsx`, drawn on the server from `lib/github.ts`.
 * The rule holds it to:
 *
 *   - absent without data: a build with no `GITHUB_TOKEN` renders no `[data-contrib]`, `/` still
 *     prerenders and Work is otherwise whole;
 *   - server-rendered and script-free: with data, the block is in `/`'s static HTML inside
 *     `#work`, headed with GitHub's line ("{total} contributions in the last year") and nothing
 *     else saying the total, one `<svg>` with a square per day, each square's `<title>` the day's
 *     sentence, no script in it, the calendar itself not a client component, and nothing hidden or
 *     different with JavaScript off;
 *   - full width: from 768 the block is as wide as the wrap's content box, so it is centred, and
 *     from 1024 the grid fills its inner width without scrolling;
 *   - GitHub's look: the five greens by the theme's `dark` flag, square days in GitHub's
 *     proportions, never under 10px (drawn 1:1 on narrow screens), and an
 *     empty day distinguishable from the frame (≥ 1.1:1 by its fill or its outline);
 *   - hovered like GitHub: with JavaScript, a square under the pointer shows its own sentence in
 *     a tooltip above it, inside the block at both ends of the year, and a ring on it; the squares
 *     stop taking the pointer, so the native tooltip does not double it. Without JavaScript the
 *     squares take the pointer, so their `<title>` is the tooltip. The hover layer is small and
 *     imports nothing but React and the calendar's geometry;
 *   - one keyboard stop, named with the summary, never a stop per day;
 *   - laid out: no page overflow at 390, 768, 1024, 1440 and 1920, and the strip opening on the newest weeks
 *     when it scrolls;
 *   - readable: every word in the block ≥ 4.5:1 on what it sits on, the tooltip's included, and
 *     the darkest green ≥ 3:1, in all 18 site themes.
 *
 * The server under test shows whichever state its build had (locally, no token: absent). The
 * present state is proved on a second build of its own, made with `GITHUB_CONTRIB_FIXTURE`
 * pointing at the recorded GraphQL response in `lib/fixtures/` and with the token blanked, into
 * `.next/contrib`, served on $PORT + 4 and removed afterwards. With `--url` there is no second
 * build, and the rule checks what that server shows.
 *
 * Never prints a token: it only asks whether one is set.
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { contributions } from '../../content/contributions.ts'
import { themes } from '../../content/themes.ts'
import { calendarLayout, CELL, daySentence, fill, GREENS } from '../../lib/contrib-grid.ts'
import { parseContributions } from '../../lib/github.ts'

const FIXTURE = 'lib/fixtures/github-contributions.json'
const DIST = '.next/contrib'
const COMPONENT = 'components/site/contributions.tsx'
/** The one client file, the hover layer. */
const HOVER = 'components/site/contrib-hover.tsx'
/** Its source may be no bigger than this: an enhancement, not a widget. */
const HOVER_MAX_BYTES = 6_000
const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]
/** From this width the block is as wide as the wrap's content box; from FILL_FROM the grid fills it. */
const FULL_FROM = 768
const FILL_FROM = 1024
/** An empty day against the frame, by its fill or its outline. The greens are not text. */
const EMPTY_MIN = 1.1

/** Tracked files `next build` rewrites for a new distDir. */
const TOUCHED = ['tsconfig.json', 'next-env.d.ts']
const readOrNull = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
function restore(root, kept) {
  for (const [f, text] of kept) {
    const p = path.join(root, f)
    if (text === null) fs.rmSync(p, { force: true })
    else if (readOrNull(p) !== text) fs.writeFileSync(p, text)
  }
}

/** Is a GitHub token set where `next build` would see it? Reads names only, never values. */
function tokenAtBuild(root) {
  if (process.env.GITHUB_TOKEN) return 'the environment'
  if (process.env.GITHUB_CONTRIB_FIXTURE) return 'GITHUB_CONTRIB_FIXTURE'
  for (const f of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const p = path.join(root, f)
    if (fs.existsSync(p) && /^\s*(?:export\s+)?GITHUB_TOKEN\s*=\s*\S/m.test(fs.readFileSync(p, 'utf8'))) return f
  }
  return null
}

/** The `<div … data-contrib …>…</div>` block out of `/`'s HTML, by balancing its divs. */
function contribBlock(html) {
  const start = html.search(/<div[^>]*\bdata-contrib\b/)
  if (start < 0) return null
  const re = /<(\/?)div\b[^>]*>/g
  re.lastIndex = start
  let depth = 0
  for (let m; (m = re.exec(html)); ) {
    depth += m[1] ? -1 : 1
    if (depth === 0) return html.slice(start, m.index + m[0].length)
  }
  return null
}
function workSection(html) {
  const start = html.search(/<section[^>]*\bid="work"/)
  if (start < 0) return null
  const end = html.indexOf('</section>', start)
  return end < 0 ? null : html.slice(start, end)
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

function prerendered(root, dist) {
  const p = path.join(root, dist, 'prerender-manifest.json')
  if (!fs.existsSync(p)) return null
  return Boolean(JSON.parse(fs.readFileSync(p, 'utf8')).routes?.['/'])
}

/** The client modules `/` takes: if the calendar were a client component, it would be listed. */
function clientManifest(root, dist) {
  const p = path.join(root, dist, 'server/app/page_client-reference-manifest.js')
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null
}

/** What the HTML alone must show when there is data. */
function staticAssertions(html, expect, where, fail) {
  const work = workSection(html)
  const block = contribBlock(html)
  if (!work) return void fail.push(`${where}: / has no #work section`)
  if (!block) return void fail.push(`${where}: / has no [data-contrib] block, but the build had data`)
  if (!work.includes(block.slice(0, 200))) fail.push(`${where}: the calendar is not inside #work`)
  // tags only: the inline RSC payload names the attribute too
  if ((html.match(/<[a-z]+\b[^>]*\sdata-contrib\b/g) ?? []).length !== 1) fail.push(`${where}: [data-contrib] appears more than once`)
  const svgs = block.match(/<svg\b[^>]*>/g) ?? []
  if (svgs.length !== 1) fail.push(`${where}: the block has ${svgs.length} <svg>, not 1`)
  const h3 = decode((block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '').replace(/<[^>]+>/g, ''))
  if (h3 !== expect.title) fail.push(`${where}: the heading is "${h3}", expected "${expect.title}"`)
  // the number shows once: the heading says it, nothing else in the block repeats it
  const visible = decode(block.replace(/<title>[\s\S]*?<\/title>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' '))
  const times = visible.split(expect.total).length - 1
  if (times !== 1) fail.push(`${where}: the total ${expect.total} shows ${times} times in the block's text, not once`)
  // one keyboard stop, named with the summary
  const stops = block.match(/<[a-z]+\b[^>]*\stabindex="0"[^>]*>/gi) ?? []
  if (stops.length !== 1) fail.push(`${where}: ${stops.length} keyboard stops in the block, not 1`)
  else {
    const label = decode(stops[0].match(/aria-label="([^"]*)"/)?.[1] ?? '')
    if (label !== expect.label) fail.push(`${where}: the keyboard stop is named "${label}", expected "${expect.label}"`)
  }
  const rects = (block.match(/<rect\b/g) ?? []).length
  if (rects !== expect.cells) fail.push(`${where}: ${rects} squares in the HTML, expected ${expect.cells} (one a day)`)
  const titles = [...block.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => decode(m[1]))
  if (titles.length !== expect.cells) fail.push(`${where}: ${titles.length} day tooltips, expected ${expect.cells}`)
  else {
    const wrong = titles.findIndex((t, i) => t !== expect.sentences[i])
    if (wrong >= 0) fail.push(`${where}: day ${wrong} says "${titles[wrong]}", expected "${expect.sentences[wrong]}"`)
  }
  if (/<script\b/i.test(block)) fail.push(`${where}: a <script> inside the calendar`)
  if (/\son[a-z]+=/i.test(block)) fail.push(`${where}: an inline event handler inside the calendar`)
  if (!/href="https:\/\/github\.com\/[^"]+"/.test(block)) fail.push(`${where}: no plain link to the GitHub profile`)
}

/** In the browser: the block's geometry and visibility. Runs in the page. */
function measure() {
  const block = document.querySelector('[data-contrib]')
  if (!block) return null
  const svg = block.querySelector('svg')
  const scroll = block.querySelector('.contrib__scroll')
  const rects = [...svg.querySelectorAll('rect')]
  const last = rects.reduce((a, r) => (r.getBoundingClientRect().right > a.getBoundingClientRect().right ? r : a), rects[0])
  const cs = getComputedStyle(block)
  const sb = scroll.getBoundingClientRect()
  const lb = last.getBoundingClientRect()
  // the wrap's content box, and the block's inner one
  const inside = (e) => {
    const r = e.getBoundingClientRect()
    const c = getComputedStyle(e)
    const left = r.left + parseFloat(c.borderLeftWidth) + parseFloat(c.paddingLeft)
    const right = r.right - parseFloat(c.borderRightWidth) - parseFloat(c.paddingRight)
    return { left, right }
  }
  // layout offsets, not the rect: the reveal may still be moving the block
  const br = block.getBoundingClientRect()
  const wrap = inside(block.closest('.wrap'))
  const inner = inside(block)
  const days = block.querySelector('.contrib__days').getBoundingClientRect()
  return {
    gapLeft: br.left - wrap.left,
    gapRight: wrap.right - br.right,
    widthShort: wrap.right - wrap.left - br.width,
    // the grid runs from the weekday labels' left edge to the SVG's right
    unfilled: Math.max(Math.abs(days.left - inner.left), Math.abs(inner.right - svg.getBoundingClientRect().right)),
    visible: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.99,
    blockHeight: block.getBoundingClientRect().height,
    svgWidth: svg.getBoundingClientRect().width,
    svgHeight: svg.getBoundingClientRect().height,
    rects: rects.length,
    drawn: rects.filter((r) => r.getBoundingClientRect().width > 0).length,
    cell: rects[0].getBoundingClientRect().width + Number(getComputedStyle(rects[0]).strokeWidth.replace('px', '')),
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    scrolls: scroll.scrollWidth > scroll.clientWidth + 1,
    newestInView: lb.right <= sb.right + 1 && lb.left >= sb.left - 1,
    focusable: scroll.tabIndex === 0,
    stops: [...block.querySelectorAll('a, [tabindex]')].filter((e) => e.tabIndex >= 0).length,
  }
}

/**
 * In the browser: where the pointer lands on a square's centre, and what the hover layer shows
 * once the mouse is there. Runs in the page, in two calls around a real mouse move.
 */
function squareAt(which) {
  const rects = [...document.querySelectorAll('[data-contrib] svg rect')]
  const rect = which === 'first' ? rects[0] : rects[rects.length - 1]
  const scroll = document.querySelector('[data-contrib] .contrib__scroll')
  // rtl: 0 is the right end, the newest weeks, and the left end is negative
  scroll.scrollLeft = which === 'first' ? -scroll.scrollWidth : 0
  const r = rect.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  const hit = document.elementFromPoint(x, y)
  return { x, y, size: r.width, title: rect.querySelector('title')?.textContent ?? '', hit: hit?.tagName.toLowerCase() ?? null }
}
function hovered() {
  const block = document.querySelector('[data-contrib]')
  const tip = block.querySelector('.contrib__tip')
  const ring = block.querySelector('.contrib__ring')
  const box = (e) => {
    if (!e || getComputedStyle(e).display === 'none') return null
    const r = e.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
  }
  return { text: tip?.textContent ?? '', tip: box(tip), ring: box(ring), block: box(block) }
}

/** In the browser: contrast in every theme. Runs in the page; colours resolved through a canvas. */
function contrastIn(ids) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const g = cv.getContext('2d', { willReadFrequently: true })
  const rgba = (c) => {
    g.clearRect(0, 0, 1, 1)
    g.fillStyle = '#000'
    g.fillStyle = c
    g.fillRect(0, 0, 1, 1)
    const [r, gg, b, a] = g.getImageData(0, 0, 1, 1).data
    return [r, gg, b, a / 255]
  }
  const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]))
  const lum = ([r, gg, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b)
  }
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  const root = document.documentElement
  const before = root.dataset.theme
  const block = document.querySelector('[data-contrib]')
  const texts = [
    ['the heading', 'h3'],
    ['a month label', '.contrib__months span'],
    ['a weekday label', '.contrib__days span:nth-child(2)'],
    ['the login', '.contrib__foot a'],
    ['the key', '.contrib__key'],
  ]
  const hex = (c) => '#' + rgba(c).slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')
  const out = []
  for (const [id, dark] of ids) {
    root.dataset.theme = id
    // reduced motion sets every element's transition to 0.01ms (globals.css), so a theme change
    // starts a transition on each colour, and a read now would return the last theme's: flush the
    // style change, then end the transitions it started
    void document.body.offsetHeight
    for (const a of document.getAnimations()) a.finish()
    const cs = getComputedStyle(block)
    const bg = rgba(cs.backgroundColor)
    for (const [what, sel] of texts) {
      const el = block.querySelector(sel)
      if (!el) {
        out.push({ id, what, missing: true })
        continue
      }
      out.push({ id, what, ratio: ratio(over(rgba(getComputedStyle(el).color), bg), bg), min: 4.5, text: true })
    }
    // the tooltip's words, on its own ground (it is hidden until hovered; its colours are not)
    const tip = block.querySelector('.contrib__tip')
    if (!tip) out.push({ id, what: 'the tooltip', missing: true })
    else {
      const ground = rgba(cs.getPropertyValue('--c-tip').trim())
      out.push({ id, what: 'the tooltip', ratio: ratio(over(rgba(getComputedStyle(tip).color), ground), ground), min: 4.5, text: true })
    }
    // GitHub's greens, by the theme's dark flag
    const fills = [0, 1, 2, 3, 4].map((l) => {
      const r = block.querySelector(`rect[data-l="${l}"]`)
      return r ? hex(getComputedStyle(r).fill) : null
    })
    out.push({ id, what: 'the greens', fills, dark })
    const empty = block.querySelector('rect[data-l="0"]')
    if (empty) {
      const cell = over(rgba(getComputedStyle(empty).fill), bg)
      const line = over(rgba(getComputedStyle(empty).stroke), cell)
      const r = Math.max(ratio(cell, bg), Number(getComputedStyle(empty).strokeWidth.replace('px', '')) >= 1 ? ratio(line, bg) : 0)
      // its floor is EMPTY_MIN, applied outside: this function runs in the page
      out.push({ id, what: 'an empty day, by its fill or its outline', ratio: r, empty: true })
    }
    const top = block.querySelector('rect[data-l="4"]')
    if (top) out.push({ id, what: 'the darkest green', ratio: ratio(over(rgba(getComputedStyle(top).fill), bg), bg), min: 3 })
  }
  root.dataset.theme = before
  return out
}

/** Every browser assertion, on a server whose build had data. */
async function browserAssertions(ctx, base, expect, where, fail, notes) {
  const ids = themes.map((t) => [t.id, t.dark])
  for (const w of WIDTHS) {
    const views = {}
    for (const js of [false, true]) {
      const { page, errors, close } = await ctx.page(null, {
        viewport: { width: w.width, height: w.height },
        javaScriptEnabled: js,
        reducedMotion: 'reduce',
      })
      await page.goto(base + '/', { waitUntil: 'networkidle' })
      // the motion layer reveals on scroll; bring the block in (the hover needs it on screen too)
      await page.locator('[data-contrib]').scrollIntoViewIfNeeded().catch(() => {})
      if (js) await page.waitForTimeout(900)
      const m = await page.evaluate(measure)
      views[js ? 'on' : 'off'] = m
      const tag = `${where} at ${w.width}, JS ${js ? 'on' : 'off'}`
      if (!m) {
        fail.push(`${tag}: no [data-contrib] in the page`)
        await close()
        continue
      }
      if (!m.visible) fail.push(`${tag}: the calendar is hidden`)
      if (m.drawn !== expect.cells) fail.push(`${tag}: ${m.drawn} of ${expect.cells} squares are drawn`)
      // never under 1:1; scaled, the squares and gaps grow together
      const k = m.svgWidth / expect.width
      if (k < 1 - 0.002) fail.push(`${tag}: the SVG is ${m.svgWidth.toFixed(1)}px wide, under its ${expect.width}px (1:1)`)
      if (w.width < FULL_FROM && Math.abs(k - 1) > 0.002) fail.push(`${tag}: the SVG is ${m.svgWidth.toFixed(1)}px wide, expected ${expect.width}px (drawn 1:1)`)
      if (Math.abs(m.svgHeight / expect.height - k) > 0.01) fail.push(`${tag}: the squares are not square (the SVG is ${m.svgWidth.toFixed(1)}×${m.svgHeight.toFixed(1)})`)
      if (Math.abs(m.cell - CELL * k) > 0.25 * k) fail.push(`${tag}: a square is ${m.cell.toFixed(2)}px, expected ${(CELL * k).toFixed(2)}px`)
      if (w.width >= FULL_FROM) {
        if (Math.abs(m.gapLeft - m.gapRight) > 2) fail.push(`${tag}: the block is off centre: ${m.gapLeft.toFixed(1)}px to its left, ${m.gapRight.toFixed(1)}px to its right`)
        if (Math.abs(m.widthShort) > 2) fail.push(`${tag}: the block is ${m.widthShort.toFixed(1)}px narrower than the wrap's content box`)
        if (!js) notes.push(`${tag}: gaps ${m.gapLeft.toFixed(1)} / ${m.gapRight.toFixed(1)}px, square ${(CELL * k).toFixed(2)}px, grid unfilled ${m.unfilled.toFixed(1)}px`)
      }
      if (w.width >= FILL_FROM) {
        if (m.unfilled > 4) fail.push(`${tag}: the grid stops ${m.unfilled.toFixed(1)}px short of the block's inner width`)
        if (m.scrolls) fail.push(`${tag}: the strip scrolls, but the year should fit`)
      }
      if (!m.focusable) fail.push(`${tag}: the strip is not a keyboard stop`)
      if (m.stops !== 2) fail.push(`${tag}: ${m.stops} keyboard stops in the block, expected 2 (the strip and the login)`)
      if (m.overflowX > 0) fail.push(`${tag}: the page overflows sideways by ${m.overflowX}px`)
      if (m.scrolls && !m.newestInView) fail.push(`${tag}: the strip scrolls but does not open on the newest week`)
      if (js && errors.length) fail.push(`${tag}: ${errors.length} console or page errors (${errors[0].slice(0, 120)})`)
      await hoverAssertions(page, js, w.width === 390 ? ['last'] : ['first', 'last'], tag, fail)
      if (!js && w.width === 1440) {
        const res = await page.evaluate(contrastIn, ids)
        for (const r of res) {
          if (r.missing) fail.push(`${where}, ${r.id}: ${r.what} is missing`)
          else if (r.fills) {
            const want = GREENS[r.dark ? 'dark' : 'light']
            if (r.fills.join() !== want.join()) fail.push(`${where}, ${r.id}: the greens are ${r.fills.join(' ')}, expected GitHub's ${r.dark ? 'dark' : 'light'} ${want.join(' ')}`)
          } else if (r.ratio < (r.empty ? EMPTY_MIN : r.min)) fail.push(`${where}, ${r.id}: ${r.what} is ${r.ratio.toFixed(2)}:1, under ${r.empty ? EMPTY_MIN : r.min}:1`)
        }
        const low = (f) => Math.min(...res.filter(f).map((r) => r.ratio)).toFixed(2)
        notes.push(`${where}: in ${ids.length} site themes, lowest text ${low((r) => r.text)}:1, lowest empty day ${low((r) => r.empty)}:1`)
      }
      await close()
    }
    const { on, off } = views
    if (on && off) {
      if (Math.abs(on.svgWidth - off.svgWidth) > 0.5 || Math.abs(on.svgHeight - off.svgHeight) > 0.5)
        fail.push(`${where} at ${w.width}: the calendar is ${off.svgWidth}×${off.svgHeight} with JS off and ${on.svgWidth}×${on.svgHeight} with it on`)
      if (Math.abs(on.blockHeight - off.blockHeight) > 1) fail.push(`${where} at ${w.width}: the block's height changes with JS (${off.blockHeight} → ${on.blockHeight})`)
    }
  }
}

/** Hover a square with the real mouse, and read what shows. */
async function hoverAssertions(page, js, which, tag, fail) {
  for (const end of which) {
    const at = await page.evaluate(squareAt, end)
    // a scroll hides the tooltip, and its event lands a frame later: let it pass before hovering
    await page.waitForTimeout(120)
    // with JS the hover layer owns the pointer (the SVG); without, the square does (its <title>)
    const want = js ? 'svg' : 'rect'
    if (at.hit !== want) fail.push(`${tag}: the pointer on the ${end} square lands on <${at.hit}>, expected <${want}>`)
    if (!js) continue
    await page.mouse.move(at.x, at.y)
    await page.waitForTimeout(50)
    const h = await page.evaluate(hovered)
    const who = `${tag}, the ${end} square`
    if (!h.tip) {
      fail.push(`${who}: no tooltip on hover`)
      continue
    }
    if (h.text !== at.title) fail.push(`${who}: the tooltip says "${h.text}", its <title> "${at.title}"`)
    if (h.tip.left < h.block.left - 0.5 || h.tip.right > h.block.right + 0.5) fail.push(`${who}: the tooltip clips at the block's edge (${h.tip.left.toFixed(0)}–${h.tip.right.toFixed(0)} in ${h.block.left.toFixed(0)}–${h.block.right.toFixed(0)})`)
    // the rect is drawn inside its outline, so the square is 10/9 of it
    if (h.ring && Math.abs(h.ring.right - h.ring.left - (at.size * CELL) / (CELL - 1)) > 0.5) fail.push(`${who}: the ring is ${(h.ring.right - h.ring.left).toFixed(1)}px on a ${((at.size * CELL) / (CELL - 1)).toFixed(1)}px square`)
    if (h.tip.bottom > at.y - at.size / 2) fail.push(`${who}: the tooltip is not above the square`)
    if (!h.ring || Math.abs((h.ring.left + h.ring.right) / 2 - at.x) > 1 || Math.abs((h.ring.top + h.ring.bottom) / 2 - at.y) > 1) fail.push(`${who}: no ring on the square`)
    await page.mouse.move(1, 1)
    await page.waitForTimeout(30)
    if ((await page.evaluate(hovered)).tip) fail.push(`${who}: the tooltip stays after the pointer leaves`)
  }
}

function sourceAssertions(root, fail) {
  const src = fs.readFileSync(path.join(root, COMPONENT), 'utf8')
  if (/^\s*['"]use client['"]/m.test(src)) fail.push(`${COMPONENT} is a client component`)
  const hover = fs.readFileSync(path.join(root, HOVER), 'utf8')
  if (!/^\s*['"]use client['"]/m.test(hover)) fail.push(`${HOVER} is not marked 'use client'`)
  if (hover.length > HOVER_MAX_BYTES) fail.push(`${HOVER} is ${hover.length} bytes, over ${HOVER_MAX_BYTES}: the hover is an enhancement`)
  const imports = [...hover.matchAll(/^\s*import\b[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
  const extra = imports.filter((i) => i !== 'react' && i !== '@/lib/contrib-grid')
  if (extra.length) fail.push(`${HOVER} imports ${extra.join(', ')}: only react and @/lib/contrib-grid are allowed`)
  const perSquare = /\.(rects|cells)\b[^\n]*\.(map|forEach)\([^\n]*addEventListener|for\s*\([^)]*rect[^)]*\)\s*\{?[^}]*addEventListener/
  if (perSquare.test(hover)) fail.push(`${HOVER} adds a listener per square; it listens on the SVG`)
  for (const f of ['lib/contrib-grid.ts', 'lib/github.ts'])
    if (/^\s*['"]use client['"]/m.test(fs.readFileSync(path.join(root, f), 'utf8'))) fail.push(`${f} is marked 'use client'`)
}

async function serveDist(root, port, dist, env) {
  const child = spawn(path.join(root, 'node_modules/.bin/next'), ['start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: root,
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', (d) => (out += d))
  child.stderr.on('data', (d) => (out += d))
  const base = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start (${dist}) exited ${child.exitCode}:\n${out.slice(-1500)}`)
    try {
      if ((await fetch(base + '/')).ok) return { base, stop: () => child.kill('SIGTERM') }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  child.kill('SIGTERM')
  throw new Error(`next start (${dist}) on :${port} did not answer within 60s`)
}

const contrib = {
  id: 'GH',
  title: 'Contributions on /: server-rendered, absent without a token, no JS',
  needs: ['server', 'browser'],
  async run(ctx) {
    const fail = []
    const notes = []
    const recorded = JSON.parse(fs.readFileSync(path.join(ctx.root, FIXTURE), 'utf8'))
    const data = parseContributions(recorded)
    if (!data) return { fail: [`${FIXTURE} does not parse into a calendar`] }
    const grid = calendarLayout(data)
    const total = data.total.toLocaleString('en-GB')
    const expect = {
      cells: grid.cells.length,
      weeks: grid.weeks,
      width: grid.width,
      height: grid.height,
      total,
      title: fill(contributions.home.title, { total }),
      label: fill(contributions.home.label, { total }),
      sentences: grid.cells.map((c) => daySentence(c.count, c.date, contributions.home.day)),
    }

    sourceAssertions(ctx.root, fail)

    // 1. the server under test, in whatever state its build had
    const home = await ctx.get('/')
    if (home.status !== 200) return { fail: [...fail, `/ answered ${home.status}`] }
    const fromUrl = process.argv.some((a) => a.startsWith('--url'))
    const source = fromUrl ? undefined : tokenAtBuild(ctx.root)
    const present = /<div\b[^>]*\sdata-contrib\b/.test(home.text)
    if (source === null) {
      notes.push('the build under test had no GitHub token: checking that the block is absent')
      if (present) fail.push('/ renders the calendar, but the build had no token')
      if (!workSection(home.text)) fail.push('/ has no #work section without a token')
      if (!/class="[^"]*\bcases\b/.test(workSection(home.text) ?? '')) fail.push("Work's cases are missing without a token")
      const pre = prerendered(ctx.root, '.next')
      if (pre === false) fail.push('/ is not prerendered without a token')
      else if (pre === null) notes.push('no .next/prerender-manifest.json to confirm / prerenders')
    } else {
      notes.push(`the build under test had data (${source ?? 'a server given by --url'})`)
      if (!present && source) fail.push('the build had a token, but / renders no calendar')
      // live data: the shape is the live year's, so only what does not depend on it
      if (present) {
        const block = contribBlock(home.text) ?? ''
        if (!/<svg\b/.test(block) || !/<title>/.test(block)) fail.push('the calendar is not a server-rendered <svg> with a <title> a day')
        if (/<script\b/i.test(block)) fail.push('a <script> inside the calendar')
      }
    }

    // 2. a build of its own with the recorded response: the present state, end to end
    if (fromUrl) return { fail, notes }
    if (ctx.quick) {
      notes.push('--quick: the second build, with the recorded response, is skipped')
      return { fail, notes }
    }
    const port = (Number(process.env.PORT) || 3000) + 4
    process.stdout.write(`\n$ GITHUB_CONTRIB_FIXTURE=${FIXTURE} NEXT_DIST_DIR=${DIST} next build   (rule GH)\n`)
    const env = { GITHUB_CONTRIB_FIXTURE: FIXTURE, GITHUB_TOKEN: '', NEXT_DIST_DIR: DIST }
    // `next build` adds its distDir's types to tsconfig.json; put the tracked files back after
    const kept = TOUCHED.map((f) => [f, readOrNull(path.join(ctx.root, f))])
    const built = spawnSync(path.join(ctx.root, 'node_modules/.bin/next'), ['build'], {
      cwd: ctx.root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
    restore(ctx.root, kept)
    if (built.status !== 0) {
      fs.rmSync(path.join(ctx.root, DIST), { recursive: true, force: true })
      return { fail: [...fail, `the build with the recorded response failed:\n${String(built.stdout).slice(-1500)}${String(built.stderr).slice(-1500)}`], notes }
    }
    let server
    try {
      server = await serveDist(ctx.root, port, DIST, env)
      const where = 'with the recorded response'
      const r = await fetch(server.base + '/')
      const res = { status: r.status, text: await r.text() }
      if (res.status !== 200) fail.push(`${where}: / answered ${res.status}`)
      else staticAssertions(res.text, expect, where, fail)
      if (prerendered(ctx.root, DIST) === false) fail.push(`${where}: / is not prerendered`)
      const manifest = clientManifest(ctx.root, DIST)
      if (manifest === null) notes.push(`${where}: no client reference manifest for / to read`)
      else {
        if (manifest.includes('components/site/contributions')) fail.push(`${where}: the calendar is in /'s client reference manifest, so it ships JS`)
        if (!manifest.includes('components/site/contrib-hover')) notes.push(`${where}: the hover layer is not in /'s client reference manifest`)
      }
      await browserAssertions(ctx, server.base, expect, where, fail, notes)
    } finally {
      server?.stop()
      // the second build is ~half a gigabyte and nothing reuses it
      await new Promise((r) => setTimeout(r, 500))
      fs.rmSync(path.join(ctx.root, DIST), { recursive: true, force: true })
    }
    return { fail, notes }
  },
}

export default contrib
