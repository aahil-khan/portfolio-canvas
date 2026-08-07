#!/usr/bin/env node
/**
 * Screenshot harness.
 *
 * Drives Chrome via the puppeteer-core that ships inside the chrome-devtools-mcp plugin, so this
 * repo needs no puppeteer dependency of its own.
 *
 *   node scripts/shot.mjs http://localhost:3000
 *   node scripts/shot.mjs http://localhost:3000 --w 390 --h 844 --name mobile
 *   node scripts/shot.mjs http://localhost:3000 --all      # 390 / 768 / 1440 / 1920
 *   node scripts/shot.mjs file://$PWD/prototype/index.html --wait 1500
 *
 * Writes PNGs to .shots/ and prints the paths.
 */

import { mkdir, access } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

const PLUGIN_PUPPETEER = path.join(
  homedir(),
  '.claude/plugins/cache/claude-plugins-official/chrome-devtools-mcp/1.6.0/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
)

const CHROME_CANDIDATES = [
  '/opt/google/chrome/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/brave-browser',
]

const BREAKPOINTS = [
  { name: 'mobile', w: 390, h: 844 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'desktop', w: 1440, h: 900 },
  { name: 'wide', w: 1920, h: 1080 },
]

function arg(flag, fallback) {
  const i = process.argv.indexOf(`--${flag}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const has = (flag) => process.argv.includes(`--${flag}`)

async function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    try {
      await access(c)
      return c
    } catch {}
  }
  throw new Error(`No Chrome found. Looked in:\n  ${CHROME_CANDIDATES.join('\n  ')}`)
}

const url = process.argv[2]
if (!url || url.startsWith('--')) {
  console.error('usage: node scripts/shot.mjs <url> [--w N] [--h N] [--name s] [--all] [--full] [--wait ms]')
  process.exit(1)
}

const { default: puppeteer } = await import(PLUGIN_PUPPETEER)
const executablePath = await findChrome()

const outDir = path.resolve('.shots')
await mkdir(outDir, { recursive: true })

const targets = has('all')
  ? BREAKPOINTS
  : [{ name: arg('name', 'shot'), w: Number(arg('w', 1440)), h: Number(arg('h', 900)) }]

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb'],
})

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(11, 19)
const errors = []

for (const t of targets) {
  const page = await browser.newPage()
  await page.setViewport({ width: t.w, height: t.h, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => errors.push(`[${t.name}] ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${t.name}] console: ${m.text()}`))

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })
  await new Promise((r) => setTimeout(r, Number(arg('wait', 900))))

  const file = path.join(outDir, `${t.name}-${stamp}.png`)
  await page.screenshot({ path: file, fullPage: has('full') })
  console.log(`${String(t.w).padStart(4)}×${t.h}  ${file}`)
  await page.close()
}

await browser.close()

if (errors.length) {
  console.error('\nPage errors:')
  for (const e of errors) console.error('  ' + e)
  process.exit(1)
}
