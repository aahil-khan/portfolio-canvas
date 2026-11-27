#!/usr/bin/env node
/**
 * The front page drawer's badge paints its own background, so its text colour must be checked
 * against that background in every theme. Reads computed colours from a running server.
 *
 *   node scripts/check-drawer-badge.mjs [url]
 *
 * Uses playwright-core and its cached Chromium; PLAYWRIGHT_CORE overrides where it is loaded from.
 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'

const url = process.argv[2] || 'http://localhost:3000'
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_CORE || path.join(homedir(), '.local/share/cx-tools/node_modules/playwright-core'),
)
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.drawer__badge', { state: 'attached' })
  const rows = await page.evaluate(() => {
    const themes = [...document.styleSheets]
      .flatMap((s) => [...s.cssRules])
      .map((r) => r.selectorText?.match(/^\[data-theme="([^"]+)"\]$/)?.[1])
      .filter(Boolean)
    const badge = document.querySelector('.drawer__badge')
    const rgb = (c) => {
      const m = c.match(/^rgb\((\d+), (\d+), (\d+)\)$/)
      if (!m) throw new Error(`not an opaque rgb colour: ${c}`)
      return m.slice(1).map(Number)
    }
    const lum = (c) => {
      const [r, g, b] = rgb(c).map((v) => {
        const s = v / 255
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    return [...new Set(themes)].map((id) => {
      document.documentElement.dataset.theme = id
      const { color, backgroundColor } = getComputedStyle(badge)
      const [lo, hi] = [lum(color), lum(backgroundColor)].sort((a, b) => a - b)
      return { id, color, backgroundColor, ratio: (hi + 0.05) / (lo + 0.05) }
    })
  })
  rows.sort((a, b) => a.ratio - b.ratio)
  for (const r of rows) console.log(r.ratio.toFixed(2).padStart(6), r.id, r.color, 'on', r.backgroundColor)
  const bad = rows.filter((r) => r.ratio < 4.5).length
  console.log(`${rows.length} themes, ${bad} below 4.5:1`)
  process.exitCode = bad || rows.length < 18 ? 1 : 0
} finally {
  await browser.close()
}
