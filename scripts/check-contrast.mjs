#!/usr/bin/env node
/**
 * WCAG contrast audit across every theme.
 *
 * This drives a real browser and reads *computed* colours off the live page for each theme,
 * rather than checking a table of hex values. That matters because the thing that actually
 * fails is a token composited over a surface it wasn't designed against — the previous site
 * shipped `--fg-subtle` at 4.57:1 on one surface and 4.23:1 on another, and only the second
 * was wrong.
 *
 *   node scripts/check-contrast.mjs [url]
 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const URL_ = process.argv[2] || 'http://localhost:3001'
const PUPPETEER = path.join(
  homedir(),
  '.claude/plugins/cache/claude-plugins-official/chrome-devtools-mcp/1.6.0/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
)
const CHROME = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/brave-browser']

/** Body text must clear 4.5:1; large/bold text and non-text UI clear 3:1. */
const AA_TEXT = 4.5
const AA_LARGE = 3.0

const exe = CHROME.find((c) => existsSync(c))
if (!exe) {
  console.log('check-contrast: no Chrome found, skipping')
  process.exit(0)
}

const { default: puppeteer } = await import(PUPPETEER)
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'new',
  args: ['--no-sandbox', '--force-color-profile=srgb'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto(URL_, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1500))

const themes = await page.evaluate(() =>
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

if (!themes.length) {
  console.error('check-contrast: found no [data-theme] blocks — is the theme CSS being emitted?')
  await browser.close()
  process.exit(1)
}

const results = await page.evaluate(
  (themeIds, AA_TEXT, AA_LARGE) => {
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
    // resolve a token to rgb by painting it
    const probe = document.createElement('div')
    document.body.appendChild(probe)
    const resolve = (token) => {
      probe.style.color = `var(${token})`
      return parse(getComputedStyle(probe).color)
    }

    const INKS = ['--ink', '--ink-muted', '--ink-subtle']
    // only surfaces something is actually painted on; testing declared-but-unused tokens
    // produced 100+ meaningless failures
    const SURFACES = ['--canvas-base', '--surface']
    const out = []

    for (const id of themeIds) {
      root.dataset.theme = id
      const fails = []
      for (const ink of INKS) {
        const f = resolve(ink)
        for (const surf of SURFACES) {
          const b = resolve(surf)
          const r = ratio(over(f, b), b)
          // --ink-subtle is used for small meta labels, so it is held to the text threshold too
          if (r < AA_TEXT) fails.push({ ink, surf, r: +r.toFixed(2) })
        }
      }
      // accent is a fill behind ink, and a UI colour: 3:1 is the bar
      const accent = resolve('--accent')
      const accentInk = resolve('--accent-ink')
      const rAccent = ratio(over(accentInk, accent), accent)
      if (rAccent < AA_TEXT) fails.push({ ink: '--accent-ink', surf: '--accent', r: +rAccent.toFixed(2) })
      // card headers, chips and dock tiles sit on the fixed pastels from apps.ts, which do not
      // follow the theme — so --on-app must stay readable on every one of them
      const onApp = resolve('--on-app')
      for (const tile of document.querySelectorAll('.dock__icon')) {
        const bg = parse(getComputedStyle(tile).backgroundColor)
        if (bg.a === 0) continue
        const r = ratio(over(onApp, bg), bg)
        if (r < AA_TEXT) fails.push({ ink: '--on-app', surf: getComputedStyle(tile).backgroundColor, r: +r.toFixed(2) })
      }

      // the border must be visible against the canvas
      const border = resolve('--border')
      const canvas = resolve('--canvas-base')
      const rBorder = ratio(over(border, canvas), canvas)
      if (rBorder < AA_LARGE) fails.push({ ink: '--border', surf: '--canvas-base', r: +rBorder.toFixed(2) })

      out.push({ id, fails })
    }
    probe.remove()
    root.dataset.theme = themeIds[0]
    return out
  },
  themes,
  AA_TEXT,
  AA_LARGE,
)

await browser.close()

let bad = 0
for (const { id, fails } of results) {
  if (!fails.length) {
    console.log(`  ✓ ${id}`)
    continue
  }
  bad += fails.length
  console.log(`  ✗ ${id}`)
  for (const f of fails) console.log(`      ${f.ink} on ${f.surf} = ${f.r}:1`)
}

console.log(
  bad === 0
    ? `\ncheck-contrast: ${results.length} themes pass (text ≥ ${AA_TEXT}:1, border ≥ ${AA_LARGE}:1)`
    : `\ncheck-contrast: ${bad} failing pairs across ${results.filter((r) => r.fails.length).length} themes`,
)
process.exit(bad === 0 ? 0 : 1)
