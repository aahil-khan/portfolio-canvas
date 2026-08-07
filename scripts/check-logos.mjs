#!/usr/bin/env node
/**
 * Logo luminance audit.
 *
 * Some vendor logos ship white-on-transparent for dark UIs. This site is light, so those
 * are invisible unless `invert: true` is set in content/stack.ts. That is exactly how
 * `qdrant.png` (measured luminance 255.0) shipped invisible in the prototype.
 *
 * The old repo's tech-logo table carried a hand-maintained `invert` flag calibrated for a
 * DARK site — every one of those flags is backwards here — so this measures rather than
 * trusting anyone's notes: each asset is rasterised on white and its opaque pixels averaged.
 *
 *   node scripts/check-logos.mjs
 */

import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

const PUPPETEER = path.join(
  homedir(),
  '.claude/plugins/cache/claude-plugins-official/chrome-devtools-mcp/1.6.0/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
)
const CHROME = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/brave-browser']

/** Above this, a logo is too light to read on our white cards and needs `invert: true`. */
const TOO_LIGHT = 200

const stack = await readFile('content/stack.ts', 'utf8')
// deliberately a regex over the source rather than importing: this script stays dependency-free
// and doesn't need a TypeScript loader just to read a list of paths.
const entries = [...stack.matchAll(/\{\s*name:\s*'([^']+)'(?:,\s*logo:\s*'([^']+)')?(?:,\s*invert:\s*(true))?/g)]
  .filter(([, , logo]) => logo)
  .map(([, name, logo, invert]) => ({ name, logo, invert: invert === 'true' }))

if (!entries.length) {
  console.error('check-logos: found no logo entries in content/stack.ts — has the format changed?')
  process.exit(1)
}

const { existsSync } = await import('node:fs')
const exe = CHROME.find((c) => existsSync(c))
if (!exe) {
  console.log('check-logos: no Chrome found, skipping the luminance audit')
  process.exit(0)
}

const { default: puppeteer } = await import(PUPPETEER)
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'new',
  args: ['--no-sandbox', '--force-color-profile=srgb', '--allow-file-access-from-files'],
})
const page = await browser.newPage()
await page.goto(`file://${path.resolve('public')}/`, { waitUntil: 'domcontentloaded' }).catch(() => {})

const problems = []
for (const e of entries) {
  const lum = await page.evaluate(
    (src) =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const c = document.createElement('canvas')
          c.width = img.naturalWidth || 64
          c.height = img.naturalHeight || 64
          const x = c.getContext('2d', { willReadFrequently: true })
          x.drawImage(img, 0, 0, c.width, c.height)
          const d = x.getImageData(0, 0, c.width, c.height).data
          let sum = 0
          let n = 0
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 30) continue
            sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
            n++
          }
          resolve(n ? sum / n : null)
        }
        img.onerror = () => resolve(NaN)
        img.src = src
      }),
    `file://${path.resolve('public')}${e.logo}`,
  )

  if (Number.isNaN(lum)) problems.push(`${e.name}: could not load ${e.logo}`)
  else if (lum === null) problems.push(`${e.name}: ${e.logo} is fully transparent`)
  else if (lum > TOO_LIGHT && !e.invert)
    problems.push(`${e.name}: luminance ${lum.toFixed(0)} is too light for a white card — set invert: true`)
  else if (lum <= TOO_LIGHT && e.invert)
    problems.push(`${e.name}: luminance ${lum.toFixed(0)} is already dark — remove invert: true`)
}

await browser.close()

if (problems.length) {
  console.error(`\ncheck-logos failed (${problems.length}):`)
  for (const p of problems) console.error(`  • ${p}`)
  process.exit(1)
}
console.log(`check-logos: ${entries.length} logos OK`)
