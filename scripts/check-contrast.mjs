#!/usr/bin/env node
/**
 * WCAG contrast audit across every theme, the Lab's two Premium palettes included.
 *
 * This drives a real browser and reads *computed* colours off the live page for each theme,
 * rather than checking a table of hex values. That matters because the thing that actually
 * fails is a token composited over a surface it wasn't designed against — the previous site
 * shipped `--fg-subtle` at 4.57:1 on one surface and 4.23:1 on another, and only the second
 * was wrong.
 *
 *   node scripts/check-contrast.mjs [url]
 *
 * With no URL (and no CONTRAST_URL) it serves the app itself: `next start` when the production
 * build is newer than every source file, otherwise `next dev`, so it never audits a stale build.
 * It listens on CONTRAST_PORT, else $PORT + 1, else a free port, and stops the server at the end.
 *
 * The browser is the server's cached Chromium, driven by the playwright-core in
 * ~/.local/share/cx-tools (the one `shot` uses; CX_CHROMIUM overrides the binary). With no
 * browser it **fails**: a contrast check that skips itself proves nothing. CONTRAST_SKIP=1 is
 * the one deliberate way past it, for a machine that has no browser by design.
 */

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

/** Body text must clear 4.5:1; large/bold text and non-text UI clear 3:1. */
const AA_TEXT = 4.5
const AA_LARGE = 3.0

function skipOrFail(why) {
  if (process.env.CONTRAST_SKIP === '1') {
    console.log(`check-contrast: ${why}; skipped because CONTRAST_SKIP=1`)
    process.exit(0)
  }
  console.error(`check-contrast: ${why}. Nothing was checked, so this fails (CONTRAST_SKIP=1 skips it on purpose).`)
  process.exit(1)
}

/** The cached Chromium, newest first. Same search as `shot` and the mockup's check. */
function chromiumPath() {
  if (process.env.CX_CHROMIUM) return existsSync(process.env.CX_CHROMIUM) ? process.env.CX_CHROMIUM : null
  const cache = path.join(homedir(), '.cache/ms-playwright')
  const dirs = existsSync(cache) ? readdirSync(cache).sort().reverse() : []
  const rel = ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/headless_shell', 'chrome-linux64/chrome', 'chrome-linux/chrome']
  return dirs.flatMap((d) => rel.map((r) => path.join(cache, d, r))).find((f) => existsSync(f)) ?? null
}

function loadPlaywright() {
  try {
    return require(path.join(homedir(), '.local/share/cx-tools/node_modules/playwright-core'))
  } catch {
    return null
  }
}

/** Every theme the source defines, read from content/themes.ts itself. */
function sourceThemes() {
  const out = execFileSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--no-warnings',
      '--input-type=module',
      '-e',
      `import { allThemes } from ${JSON.stringify(path.join(ROOT, 'content/themes.ts'))};` +
        `console.log(JSON.stringify(allThemes.map(({ id, dark, labOnly }) => ({ id, dark, labOnly: !!labOnly }))))`,
    ],
    { encoding: 'utf8' },
  )
  return JSON.parse(out)
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })

/** Newest mtime under the paths that feed the build. */
function newestSource() {
  let newest = 0
  const visit = (p) => {
    if (!existsSync(p)) return
    const st = statSync(p)
    if (st.isDirectory()) for (const e of readdirSync(p)) visit(path.join(p, e))
    else newest = Math.max(newest, st.mtimeMs)
  }
  for (const p of ['app', 'components', 'lib', 'content', 'public', 'next.config.ts', 'proxy.ts', 'package-lock.json']) visit(path.join(ROOT, p))
  return newest
}

async function serve() {
  const port = Number(process.env.CONTRAST_PORT) || (process.env.PORT ? Number(process.env.PORT) + 1 : await freePort())
  const buildId = path.join(ROOT, '.next/BUILD_ID')
  const fresh = existsSync(buildId) && statSync(buildId).mtimeMs >= newestSource()
  const mode = fresh ? 'start' : 'dev'
  const child = spawn(path.join(ROOT, 'node_modules/.bin/next'), [mode, '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', (d) => (log += d))
  child.stderr.on('data', (d) => (log += d))
  const url = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next ${mode} exited ${child.exitCode}:\n${log.slice(-2000)}`)
    try {
      const r = await fetch(`${url}/canvas`)
      if (r.ok) break
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  console.log(`check-contrast: serving the app with next ${mode} on :${port}${fresh ? '' : ' (no build newer than the source)'}`)
  return { url, stop: () => child.kill('SIGTERM') }
}

const playwright = loadPlaywright()
if (!playwright) skipOrFail('playwright-core is missing from ~/.local/share/cx-tools')
const exe = chromiumPath()
if (!exe) skipOrFail('no cached Chromium in ~/.cache/ms-playwright (or CX_CHROMIUM is wrong)')

const expected = sourceThemes()
const given = process.argv[2] || process.env.CONTRAST_URL
const server = given ? null : await serve()
const BASE = (given || server.url).replace(/\/$/, '')
// the canvas, because it is the page that paints on the dock's fixed pastels too
const PAGE = /\/[a-z]/.test(new URL(BASE).pathname) ? BASE : `${BASE}/canvas`

let browser
let exitCode = 1
try {
  browser = await playwright.chromium.launch({ executablePath: exe, args: ['--force-color-profile=srgb'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const res = await page.goto(PAGE, { waitUntil: 'networkidle' })
  if (!res?.ok()) throw new Error(`${PAGE} answered ${res?.status()}`)
  await page.waitForTimeout(800)

  const found = await page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((s) => {
        try {
          return [...s.cssRules]
        } catch {
          return []
        }
      })
      .map((r) => r.selectorText?.match(/^\[data-theme="([^"]+)"\]$/)?.[1])
      .filter(Boolean),
  )
  const missing = expected.filter((t) => !found.includes(t.id)).map((t) => t.id)
  if (!found.length) throw new Error('found no [data-theme] blocks — is the theme CSS being emitted?')
  if (missing.length) throw new Error(`the page emits no CSS for ${missing.join(', ')}`)

  const results = await page.evaluate(
    ({ themes, AA_TEXT, AA_LARGE }) => {
      const srgb = (c) => {
        const v = c / 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }
      /*
       * Chrome returns two shapes: `rgb(0-255)` for plain colours and `color(srgb 0-1 / a)` for
       * anything produced by color-mix(). Reading the second as 0-255 makes every mixed colour
       * look near-black — which silently turns this audit into nonsense rather than a failure.
       */
      const parse = (s) => {
        const nums = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0]
        const scale = s.startsWith('color(') ? 255 : 1
        return { r: nums[0] * scale, g: nums[1] * scale, b: nums[2] * scale, a: nums[3] ?? 1 }
      }
      const lum = ({ r, g, b }) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
      /** Composite a possibly-translucent foreground over its backdrop before measuring. */
      const over = (fg, bg) => ({
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
        a: 1,
      })
      const ratio = (f, b) => {
        const L1 = lum(f)
        const L2 = lum(b)
        return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
      }

      const root = document.documentElement
      const before = root.dataset.theme
      // resolve a token to rgb by painting it
      const probe = document.createElement('div')
      document.body.appendChild(probe)
      const resolve = (token) => {
        probe.style.color = `var(${token})`
        return parse(getComputedStyle(probe).color)
      }

      const INKS = ['--ink', '--ink-muted', '--ink-subtle']
      // only surfaces something is actually painted on; testing declared-but-unused tokens
      // produced 100+ meaningless failures. `--raised` is the Lab's menus and panels.
      const SURFACES = ['--canvas-base', '--surface', '--raised']
      const out = []

      for (const { id, dark } of themes) {
        root.dataset.theme = id
        const fails = []
        const need = (ink, surf, min, fg = resolve(ink), bg = resolve(surf)) => {
          const r = ratio(over(fg, bg), bg)
          if (r < min) fails.push({ ink, surf, r: +r.toFixed(2), min })
        }
        // --ink-subtle is used for small meta labels, so it is held to the text threshold too
        for (const ink of INKS) for (const surf of SURFACES) need(ink, surf, AA_TEXT)
        // accent is a fill behind ink, and a UI colour; the mark is the same pairing, paler
        need('--accent-ink', '--accent', AA_TEXT)
        need('--accent-ink', '--mark', AA_TEXT)
        // card headers, chips and dock tiles sit on the fixed pastels from apps.ts, which do not
        // follow the theme — so --on-app must stay readable on every one of them
        const onApp = resolve('--on-app')
        for (const tile of document.querySelectorAll('.dock__icon')) {
          const bg = parse(getComputedStyle(tile).backgroundColor)
          if (bg.a === 0) continue
          const r = ratio(over(onApp, bg), bg)
          if (r < AA_TEXT) fails.push({ ink: '--on-app', surf: getComputedStyle(tile).backgroundColor, r: +r.toFixed(2), min: AA_TEXT })
        }
        // the border must be visible against the canvas. The offset shadow is not held to it:
        // the frame is the boundary, and Premium Day's softer stone offset is deliberate
        need('--border', '--canvas-base', AA_LARGE)
        /*
         * The Lab's reading trail (DIRECTION, "The Lab → Tokens"). On a dark ground it is a line
         * of its own under the bar, so it is measured against the bar's ground. On a light ground
         * it is laid over the bar's ink edge and read as that edge changing colour, so it is
         * measured against the edge. The bar's ground is --canvas-base at 96%: the same colour.
         */
        need('--trail', dark ? '--canvas-base' : '--border', AA_LARGE)
        out.push({ id, fails })
      }
      probe.remove()
      root.dataset.theme = before
      return out
    },
    { themes: expected, AA_TEXT, AA_LARGE },
  )

  let bad = 0
  for (const { id, fails } of results) {
    const lab = expected.find((t) => t.id === id)?.labOnly ? ' (Lab only)' : ''
    if (!fails.length) {
      console.log(`  ✓ ${id}${lab}`)
      continue
    }
    bad += fails.length
    console.log(`  ✗ ${id}${lab}`)
    for (const f of fails) console.log(`      ${f.ink} on ${f.surf} = ${f.r}:1 (needs ${f.min})`)
  }
  console.log(
    bad === 0
      ? `\ncheck-contrast: ${results.length} themes pass (text ≥ ${AA_TEXT}:1, border and trail ≥ ${AA_LARGE}:1)`
      : `\ncheck-contrast: ${bad} failing pairs across ${results.filter((r) => r.fails.length).length} themes`,
  )
  exitCode = bad === 0 ? 0 : 1
} catch (e) {
  console.error(`check-contrast: ${e.message}`)
  exitCode = 1
} finally {
  await browser?.close()
  server?.stop()
}
process.exit(exitCode)
