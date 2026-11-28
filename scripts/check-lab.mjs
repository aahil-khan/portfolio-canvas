#!/usr/bin/env node
/**
 * The Lab's check. Contract: `content/lab/API.md` §11; the rules are the plan's table.
 *
 *   npm run check:lab -- [--require=<ids>|all] [--only=<ids>] [--lighthouse] [--quick] [--url=<base>]
 *
 * Unless given --url it builds and serves the app itself, on $PORT:
 *
 *   1. `npm run build`
 *   2. `next start -p $PORT`, stopped at the end
 *   3. `npm run check` (typecheck, lint, tests, content, logos, contrast), with CONTRAST_URL
 *      pointed at that server, so the contrast audit reads this build and not a stale one
 *   4. every rule under scripts/check-lab/, B (`check:bundles`) among them
 *
 * If a selected rule needs the fixture (rule 22), it also builds with LAB_FIXTURE=kinds into
 * `.next/fixture` and serves that on $PORT + 2.
 *
 * Each lane's rules are one file under scripts/check-lab/, whose default export is a rule or a
 * list of rules: `{ id, title, needs, run(ctx) }`. `run` returns `{ fail, notes }` (lists of
 * strings), or `{ notBuilt: '<why>' }` while its feature does not exist yet. A rule no file
 * defines is "not built" too. **--require turns "not built" into a failure.**
 *
 * Browser rules drive the cached Chromium through ~/.local/share/cx-tools' playwright-core, one
 * browser per run, closed at the end. Nothing is installed.
 *
 * Ends with `LAB OK` (exit 0) or `LAB FAIL n` (exit 1), n being the failed assertions.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { labRoutes } from './lab-routes.ts'
import { DEMO_CONTENT, DEMO_PUBLIC, labDemo, labPublic } from '../lib/lab/visibility.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** The cached Chromium, newest first: the same search as `shot` and scripts/check-contrast.mjs. */
function chromiumPath() {
  if (process.env.CX_CHROMIUM) return existsSync(process.env.CX_CHROMIUM) ? process.env.CX_CHROMIUM : null
  const cache = path.join(homedir(), '.cache/ms-playwright')
  const dirs = existsSync(cache) ? readdirSync(cache).sort().reverse() : []
  const rel = ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/headless_shell', 'chrome-linux64/chrome', 'chrome-linux/chrome']
  return dirs.flatMap((d) => rel.map((r) => path.join(cache, d, r))).find((f) => existsSync(f)) ?? null
}
function loadPlaywright() {
  try {
    return createRequire(import.meta.url)(path.join(homedir(), '.local/share/cx-tools/node_modules/playwright-core'))
  } catch {
    return null
  }
}

/** Every rule id in the plan, in its order. `all` means these. */
const ALL_IDS = [
  '1', '2', '4', 'T', 'Q', 'E', 'L', 'O', 'F', 'B', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'C',
  '14', '15', '16', '17', '18', 'K', 'U', 'D', 'R', 'H1', 'H2', 'H3', 'G', 'V', 'X', 'Y', 'P', 'W', 'W2',
  'Z', 'M', '19', '20', 'N', 'S', '23', '24', '25', '26', '21', 'J', 'A', '22', '22h', 'I', 'OG', 'EV',
  'GH', 'SB', 'AG', 'DR', 'LH', 'LB',
]

/** The check's matrix (plan, "The matrix"). `--quick` narrows it for iteration only. */
const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]
/** Lab Dark first: it is the default, and rules that take one look take the first. */
const LOOKS = [
  { name: 'lab-dark', query: 'theme=lab-dark' },
  { name: 'lab-light', query: 'theme=lab-light' },
  { name: 'cream', query: 'theme=cream' },
  { name: 'tokyo-night', query: 'theme=tokyo-night' },
]

function parseArgs(argv) {
  const o = { require: new Set(), only: null, lighthouse: false, quick: false, url: null }
  const ids = (v) => (v === 'all' ? ALL_IDS : v.split(',').map((s) => s.trim()).filter(Boolean))
  for (const a of argv) {
    const [k, v = ''] = a.split(/=(.*)/s)
    if (k === '--require') for (const id of ids(v)) o.require.add(id)
    else if (k === '--only') o.only = new Set(ids(v))
    else if (k === '--lighthouse') o.lighthouse = true
    else if (k === '--quick') o.quick = true
    else if (k === '--url') o.url = v.replace(/\/$/, '')
    else throw new Error(`check-lab: unknown argument ${a}`)
  }
  for (const id of o.require) if (!ALL_IDS.includes(id)) throw new Error(`check-lab: --require names ${id}, which is not a rule in the plan`)
  return o
}

const log = (s = '') => process.stdout.write(s + '\n')

function run(cmd, args, env = {}) {
  log(`\n$ ${[cmd, ...args].join(' ')}`)
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } })
  return r.status === 0
}

async function serve(port, env = {}) {
  const child = spawn(path.join(ROOT, 'node_modules/.bin/next'), ['start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', (d) => (out += d))
  child.stderr.on('data', (d) => (out += d))
  const base = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited ${child.exitCode}:\n${out.slice(-2000)}`)
    try {
      if ((await fetch(base + '/')).ok) return { base, stop: () => child.kill('SIGTERM') }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  child.kill('SIGTERM')
  throw new Error(`next start on :${port} did not answer within 60s`)
}

async function loadRules() {
  const dir = path.join(ROOT, 'scripts/check-lab')
  const rules = new Map()
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href)
    for (const r of [mod.default].flat()) {
      if (!r?.id || typeof r.run !== 'function') throw new Error(`scripts/check-lab/${f}: a rule needs an id and run()`)
      if (rules.has(r.id)) throw new Error(`rule ${r.id} is defined twice (scripts/check-lab/${f} and ${rules.get(r.id).file})`)
      rules.set(r.id, { ...r, needs: r.needs ?? [], file: f })
    }
  }
  return rules
}

/** What every rule's run(ctx) gets. */
function makeContext({ args, base, fixtureBase, routes }) {
  let browser = null
  const open = []
  const ctx = {
    root: ROOT,
    base,
    fixtureBase,
    quick: args.quick,
    lighthouse: args.lighthouse,
    widths: args.quick ? WIDTHS.filter((w) => w.width === 390 || w.width === 1440) : WIDTHS,
    looks: args.quick ? LOOKS.slice(0, 1) : LOOKS,
    visibility: { labPublic, labDemo, DEMO_CONTENT, DEMO_PUBLIC },
    /** `{ built, routes }` from scripts/lab-routes.ts. */
    lab: routes,
    /** GET a path on the server under test: `{ status, headers, text }`. */
    async get(p, { fixture = false } = {}) {
      const res = await fetch((fixture ? fixtureBase : base) + p, { redirect: 'manual' })
      return { status: res.status, headers: res.headers, text: await res.text() }
    },
    /**
     * A new page in the one shared browser: `{ page, errors, close }`. Options are Playwright's
     * context options (viewport, reducedMotion, javaScriptEnabled, …). Pages are closed at the end
     * of the run if the rule forgets.
     */
    async page(p, options = {}) {
      if (!browser) {
        const pw = loadPlaywright()
        const exe = chromiumPath()
        if (!pw || !exe) throw new Error('no browser: playwright-core in ~/.local/share/cx-tools and the cached Chromium are needed')
        browser = await pw.chromium.launch({ executablePath: exe, args: ['--force-color-profile=srgb'] })
      }
      const { fixture = false, ...contextOptions } = options
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...contextOptions })
      const page = await context.newPage()
      const errors = []
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      page.on('pageerror', (e) => errors.push(e.message))
      if (p != null) await page.goto((fixture ? fixtureBase : base) + p, { waitUntil: 'networkidle' })
      const close = () => context.close().catch(() => {})
      open.push(close)
      return { page, context, errors, close }
    },
    async dispose() {
      for (const c of open) await c()
      await browser?.close()
      browser = null
    },
  }
  return ctx
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const rules = await loadRules()
  const selected = [...rules.values()].filter((r) => !args.only || args.only.has(r.id))
  const port = Number(process.env.PORT) || 3000
  const failures = []
  const servers = []

  try {
    let base = args.url
    let fixtureBase = null
    if (!base) {
      if (!run('npm', ['run', 'build'])) {
        failures.push('build: `npm run build` failed')
        throw new Error('stop')
      }
      const s = await serve(port)
      servers.push(s)
      base = s.base
      if (!run('npm', ['run', 'check'], { CONTRAST_URL: base })) failures.push('check: `npm run check` failed (its output is above)')
      if (selected.some((r) => r.needs.includes('fixture'))) {
        const dist = '.next/fixture'
        if (!run('npx', ['next', 'build'], { LAB_FIXTURE: 'kinds', NEXT_DIST_DIR: dist })) failures.push('build: the fixture build failed')
        else {
          const f = await serve(port + 2, { LAB_FIXTURE: 'kinds', NEXT_DIST_DIR: dist })
          servers.push(f)
          fixtureBase = f.base
        }
      }
    }

    const routes = await labRoutes()
    const ctx = makeContext({ args, base, fixtureBase, routes })
    log(`\ncheck-lab: ${base}${fixtureBase ? `, fixture ${fixtureBase}` : ''} · Lab ${labPublic ? 'public' : 'hidden'}${labDemo ? ', demo set' : ''} · ${routes.built ? `${routes.routes.length} routes` : 'no loaders yet'}\n`)

    const results = new Map()
    for (const rule of selected) {
      let out
      try {
        if (rule.needs.includes('fixture') && !fixtureBase) out = { notBuilt: args.url ? 'the fixture is only built without --url' : 'the fixture build is unavailable' }
        else out = (await rule.run(ctx)) ?? {}
      } catch (e) {
        out = { fail: [`threw: ${e.stack || e.message}`] }
      }
      results.set(rule.id, out)
    }
    await ctx.dispose()

    const ids = args.only ? ALL_IDS.filter((id) => args.only.has(id)) : ALL_IDS
    for (const id of ids) {
      const rule = rules.get(id)
      const out = results.get(id)
      const title = rule ? ` ${rule.title}` : ''
      const required = args.require.has(id)
      if (!out || out.notBuilt) {
        const why = out?.notBuilt ?? 'no rule defines it yet'
        if (required) failures.push(`${id}: required, and not built (${why})`)
        if (required || out) log(`${required ? '✗' : '·'} ${id}${title}: not built (${why})`)
        continue
      }
      const fail = out.fail ?? []
      log(`${fail.length ? '✗' : '✓'} ${id}${title}${fail.length ? `: ${fail.length} failed` : ''}`)
      for (const n of out.notes ?? []) log(`    · ${n}`)
      for (const f of fail) {
        log(`    ✗ ${f}`)
        failures.push(`${id}: ${f}`)
      }
    }
    for (const id of rules.keys()) if (!ALL_IDS.includes(id)) failures.push(`${id}: defined in scripts/check-lab/${rules.get(id).file}, but it is not a rule in the plan`)
  } catch (e) {
    if (e.message !== 'stop') failures.push(`check-lab: ${e.stack || e.message}`)
  } finally {
    for (const s of servers) s.stop()
  }

  if (failures.length) {
    log('\nFailed:')
    for (const f of failures) log(`  ✗ ${f}`)
  }
  log(failures.length ? `\nLAB FAIL ${failures.length}` : '\nLAB OK')
  process.exit(failures.length ? 1 : 0)
}

await main()
