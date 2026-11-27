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
 *     `#work`, one `<svg role="img">` with a square per day and the total as its label, no script
 *     in it, no client component behind it, and nothing hidden or different with JavaScript off;
 *   - laid out: no page overflow at 390 and 1440, the SVG at its step size, and the strip opening
 *     on the newest weeks when it scrolls;
 *   - readable: every text in the block ≥ 4.5:1 on the frame, and the darkest square ≥ 3:1, in all
 *     18 site themes.
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
import { calendarLayout, fill, STEP } from '../../lib/contrib-grid.ts'
import { parseContributions } from '../../lib/github.ts'

const FIXTURE = 'lib/fixtures/github-contributions.json'
const DIST = '.next/contrib'
const COMPONENT = 'components/site/contributions.tsx'
/** The phone's step, from app/site.css (`--contrib-step` under 560px). */
const PHONE_STEP = 15.6
const WIDTHS = [
  { width: 390, height: 844, step: PHONE_STEP },
  { width: 1440, height: 900, step: STEP },
]

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
  else {
    if (!/\brole="img"/.test(svgs[0])) fail.push(`${where}: the calendar's <svg> has no role="img"`)
    const label = decode(svgs[0].match(/aria-label="([^"]*)"/)?.[1] ?? '')
    if (label !== expect.label) fail.push(`${where}: the calendar's label is "${label}", expected "${expect.label}"`)
  }
  const rects = (block.match(/<rect\b/g) ?? []).length
  if (rects !== expect.cells) fail.push(`${where}: ${rects} squares in the HTML, expected ${expect.cells} (one a day)`)
  const titles = (block.match(/<title>/g) ?? []).length
  if (titles !== expect.cells) fail.push(`${where}: ${titles} day tooltips, expected ${expect.cells}`)
  if (!decode(block.replace(/<[^>]+>/g, '')).includes(expect.total)) fail.push(`${where}: the total ${expect.total} is not in the block's text`)
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
  return {
    visible: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.99,
    blockHeight: block.getBoundingClientRect().height,
    svgWidth: svg.getBoundingClientRect().width,
    svgHeight: svg.getBoundingClientRect().height,
    rects: rects.length,
    drawn: rects.filter((r) => r.getBoundingClientRect().width > 0).length,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    scrolls: scroll.scrollWidth > scroll.clientWidth + 1,
    newestInView: lb.right <= sb.right + 1 && lb.left >= sb.left - 1,
    focusable: scroll.tabIndex === 0,
  }
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
    ['the lede', '.contrib__head p'],
    ['the total', '.contrib__head strong'],
    ['a month label', '.contrib__months span'],
    ['the login', '.contrib__foot a'],
    ['the key', '.contrib__key'],
  ]
  const out = []
  for (const id of ids) {
    root.dataset.theme = id
    const bg = rgba(getComputedStyle(block).backgroundColor)
    for (const [what, sel] of texts) {
      const el = block.querySelector(sel)
      if (!el) {
        out.push({ id, what, missing: true })
        continue
      }
      out.push({ id, what, ratio: ratio(over(rgba(getComputedStyle(el).color), bg), bg), min: 4.5 })
    }
    const top = block.querySelector('rect[data-l="4"]')
    if (top) out.push({ id, what: 'the darkest square', ratio: ratio(over(rgba(getComputedStyle(top).fill), bg), bg), min: 3 })
  }
  root.dataset.theme = before
  return out
}

/** Every browser assertion, on a server whose build had data. */
async function browserAssertions(ctx, base, expect, where, fail, notes) {
  const ids = themes.map((t) => t.id)
  for (const w of WIDTHS) {
    const views = {}
    for (const js of [false, true]) {
      const { page, errors, close } = await ctx.page(null, {
        viewport: { width: w.width, height: w.height },
        javaScriptEnabled: js,
        reducedMotion: 'reduce',
      })
      await page.goto(base + '/', { waitUntil: 'networkidle' })
      if (js) {
        // the motion layer reveals on scroll; bring the block in and let it settle
        await page.locator('[data-contrib]').scrollIntoViewIfNeeded().catch(() => {})
        await page.waitForTimeout(900)
      }
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
      const want = expect.weeks * w.step - w.step / 6
      if (Math.abs(m.svgWidth - want) > 1) fail.push(`${tag}: the SVG is ${m.svgWidth.toFixed(1)}px wide, expected ${want.toFixed(1)}px`)
      if (m.overflowX > 0) fail.push(`${tag}: the page overflows sideways by ${m.overflowX}px`)
      if (m.scrolls && !m.newestInView) fail.push(`${tag}: the strip scrolls but does not open on the newest week`)
      if (m.scrolls && !m.focusable) fail.push(`${tag}: the strip scrolls but cannot take keyboard focus`)
      if (js && errors.length) fail.push(`${tag}: ${errors.length} console or page errors (${errors[0].slice(0, 120)})`)
      if (!js && w.width === 1440) {
        const res = await page.evaluate(contrastIn, ids)
        for (const r of res) {
          if (r.missing) fail.push(`${where}, ${r.id}: ${r.what} is missing`)
          else if (r.ratio < r.min) fail.push(`${where}, ${r.id}: ${r.what} is ${r.ratio.toFixed(2)}:1, under ${r.min}:1`)
        }
        const text = res.filter((r) => !r.missing && r.min === 4.5)
        if (text.length) notes.push(`${where}: text contrast measured in ${ids.length} site themes, lowest ${Math.min(...text.map((r) => r.ratio)).toFixed(2)}:1`)
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

function sourceAssertions(root, fail) {
  const src = fs.readFileSync(path.join(root, COMPONENT), 'utf8')
  if (/^\s*['"]use client['"]/m.test(src)) fail.push(`${COMPONENT} is a client component`)
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
    const expect = { cells: grid.cells.length, weeks: grid.weeks, total, label: fill(contributions.home.label, { total }) }

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
        if (!/<svg\b[^>]*role="img"/.test(block)) fail.push('the calendar is not a server-rendered <svg role="img">')
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
      else if (manifest.includes('components/site/contributions')) fail.push(`${where}: the calendar is in /'s client reference manifest, so it ships JS`)
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
