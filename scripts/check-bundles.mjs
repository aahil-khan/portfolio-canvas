#!/usr/bin/env node
/**
 * Proves CLAUDE.md's import table, after `npm run build`. `check:lab` rule B runs the same function.
 *
 *   npm run check:bundles
 *
 * Three kinds of proof, each from what the build wrote, not from what the source intends:
 *
 *   1. Where each package may be imported from: a scan of the source.
 *   2. Which pages load it: every page's client reference manifest
 *      (`.next/server/app/**\/page_client-reference-manifest.js`) names the chunks its first load
 *      takes (`entryJSFiles`). "Reach" adds every chunk those can fetch later, found by following
 *      chunk names inside chunks, so a dynamic `import()` cannot hide a package from a "must not
 *      load" row. A package is in a chunk when the chunk holds one of its marker strings.
 *   3. The Lab's own JavaScript on an entry page's first load stays within the budget, Next and
 *      React excluded.
 *
 * The stale-marker guard: once something imports a package, its marker must match at least one
 * chunk, or a "clean" result would only mean the marker went stale. Until something imports it,
 * the marker must match no chunk at all, or it is not specific to that package.
 *
 * Exits 1 on any broken row.
 */
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

/** The Lab's own JS on an entry page's first load, gzipped, Next and React excluded. */
export const BUDGET = 60 * 1024

/** Where source can import from. Scanned for imports, never for prose. */
const SOURCE_DIRS = ['app', 'components', 'lib', 'content', 'scripts']
const SOURCE_FILES = ['next.config.ts', 'proxy.ts']

/**
 * The import table, as data. `from`: path patterns a file importing the package must match.
 * `load` / `never`: route patterns that must or must not load it (`'*'` is every page). `server`:
 * may never reach any client chunk; the importing file must also `import 'server-only'`.
 * `firstLoad: false` means "on demand only": it may be reachable, never in the first load.
 */
export const TABLE = [
  {
    id: 'gsap',
    pkgs: ['gsap', '@gsap/react'],
    from: ['components/site/*', 'lib/site-motion.ts'],
    marker: /ScrollTrigger|GreenSock|_gsap/,
    load: ['/'],
    never: ['/canvas', '/lab/**', '/edit'],
  },
  {
    id: 'lenis',
    pkgs: ['lenis'],
    from: ['components/site/motion.tsx', 'components/lab/motion/*'],
    marker: /lenis-(?:smooth|stopped|scrolling|prevent)/,
    load: ['/'],
    never: ['/canvas', '/edit'],
  },
  {
    id: 'motion',
    pkgs: ['motion'],
    from: ['components/lab/**'],
    marker: /onMeasureDragConstraints|whileInView/,
    load: ['/lab/**'],
    never: ['/', '/canvas', '/edit'],
  },
  {
    id: 'floating-ui',
    pkgs: ['@floating-ui/react'],
    from: ['components/lab/preview/**', 'components/lab/menus/**'],
    marker: /data-floating-ui-|safe-polygon/,
    firstLoad: false,
    never: ['/', '/canvas', '/edit'],
  },
  {
    id: 'markdown',
    pkgs: ['unified', 'remark-*', 'rehype-*', 'hast-*', 'mdast-*', 'micromark-*', 'shiki', '@shikijs/*'],
    from: ['lib/lab/markdown/**'],
    marker: /without `parser`|containerDirective|Expected `Fragment` in options|ShikiError/,
    server: true,
  },
  {
    id: 'unfurl-tools',
    pkgs: ['open-graph-scraper', 'sharp'],
    from: ['scripts/**'],
    marker: null, // scripts never reach .next; the import scan is the whole proof
  },
  {
    id: 'feed',
    pkgs: ['feed'],
    from: ['app/**/route.ts'],
    marker: /jpmonette\/feed/,
    server: true,
    serverOnlyImport: false, // route handlers are server code by construction
  },
  {
    id: 'editor',
    paths: ['components/edit/', 'lib/edit/'],
    from: ['app/edit/**', 'components/edit/**', 'app/api/edit/**'],
    importedAs: /@\/components\/edit\/|(?:\.\.\/)+components\/edit\//, // lib/edit is shared server code
    marker: /ed-card__title|\/api\/edit\/content|Edited-via: \/edit/,
    load: ['/edit'],
    never: ['*'],
  },
]

/** Source paths no page but its own may load, read from the manifests' module lists. */
const OWN_CODE = [
  { id: 'lab code', paths: ['components/lab/', 'lib/lab/'], only: '/lab/**' },
  { id: 'editor code', paths: ['components/edit/', 'lib/edit/'], only: '/edit' },
]

const glob = (pattern) =>
  new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\//g, '(?:.*/)?')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*') +
      '$',
  )
const routeMatch = (pattern, route) =>
  pattern === '*' || (pattern.endsWith('/**') ? route === pattern.slice(0, -3) || route.startsWith(pattern.slice(0, -2)) : route === pattern)
const pkgMatch = (pattern, spec) => {
  const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
  return glob(pattern).test(name)
}

const walk = (d) =>
  fs.existsSync(d)
    ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
    : []

const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;(])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g

/** Every import in the source: [{ file, spec }]. Comments are stripped first. */
function scanImports(root) {
  const files = [
    ...SOURCE_DIRS.flatMap((d) => walk(path.join(root, d))),
    ...SOURCE_FILES.map((f) => path.join(root, f)).filter((f) => fs.existsSync(f)),
  ].filter((f) => /\.(?:[cm]?[jt]sx?)$/.test(f))
  const out = []
  for (const abs of files) {
    const file = path.relative(root, abs).split(path.sep).join('/')
    const text = fs
      .readFileSync(abs, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1')
    for (const m of text.matchAll(IMPORT_RE)) out.push({ file, spec: m[1] ?? m[2] ?? m[3] ?? m[4], text })
  }
  return out
}

/** Every page the build emitted: route → { first, reach, modules }. */
function readPages(root) {
  const appDir = path.join(root, '.next/server/app')
  const manifests = walk(appDir).filter((f) => f.endsWith('page_client-reference-manifest.js'))
  globalThis.__RSC_MANIFEST = {}
  for (const f of manifests) new Function(fs.readFileSync(f, 'utf8'))()
  const pages = new Map()
  for (const [key, m] of Object.entries(globalThis.__RSC_MANIFEST)) {
    const route = key.replace(/\/page$/, '') || '/'
    if (route.startsWith('/_')) continue // _not-found, _global-error: framework pages
    const first = new Set(Object.values(m.entryJSFiles ?? {}).flat().map((c) => c.replace(/^\/?_next\//, '')))
    const async = Object.values(m.clientModules ?? {}).flatMap((x) => x.chunks ?? []).map((c) => c.replace(/^\/?_next\//, ''))
    const modules = Object.keys(m.clientModules ?? {}).map((k) => k.replace(/^\[project\]\//, ''))
    pages.set(route, { first, seed: new Set([...first, ...async]), modules })
  }
  delete globalThis.__RSC_MANIFEST
  return pages
}

export function checkBundles({ root = process.cwd() } = {}) {
  const fail = []
  const notes = []
  if (!fs.existsSync(path.join(root, '.next/server/app'))) return { fail: ['no build output: run `npm run build` first'], notes, rows: [] }

  const staticFiles = walk(path.join(root, '.next/static/chunks')).filter((f) => f.endsWith('.js'))
  const serverFiles = walk(path.join(root, '.next/server')).filter((f) => f.endsWith('.js') && !f.endsWith('_client-reference-manifest.js'))
  const text = new Map()
  const read = (f) => text.get(f) ?? (text.set(f, fs.readFileSync(f, 'utf8')), text.get(f))
  const byRel = new Map(staticFiles.map((f) => [path.relative(path.join(root, '.next'), f).split(path.sep).join('/'), f]))
  const basenames = [...byRel.keys()].map((r) => [path.basename(r), r])

  /** Follows chunk names inside chunks, so dynamic imports count as reachable. */
  const closure = (seed) => {
    const seen = new Set([...seed].filter((c) => byRel.has(c)))
    const todo = [...seen]
    while (todo.length) {
      const t = read(byRel.get(todo.pop()))
      for (const [base, rel] of basenames) {
        if (seen.has(rel) || !t.includes(base)) continue
        seen.add(rel)
        todo.push(rel)
      }
    }
    return seen
  }

  const pages = readPages(root)
  for (const p of pages.values()) p.reach = closure(p.seed)
  const routes = [...pages.keys()]
  const has = (route) => routes.some((r) => routeMatch(route, r))

  const imports = scanImports(root)
  const rows = []

  for (const row of TABLE) {
    // 1. where it is imported from
    const users = row.pkgs
      ? imports.filter((i) => row.pkgs.some((p) => pkgMatch(p, i.spec)))
      : imports.filter((i) => row.importedAs.test(i.spec))
    const outside = users.filter((u) => !row.from.some((f) => glob(f).test(u.file)) && !(row.paths && row.paths.some((p) => u.file.startsWith(p))))
    for (const u of outside) fail.push(`${row.id}: ${u.file} imports ${u.spec} (allowed from: ${row.from.join(', ')})`)
    if (row.server && row.serverOnlyImport !== false)
      for (const u of users) if (!/(?:^|\s)import\s*['"]server-only['"]/m.test(u.text)) fail.push(`${row.id}: ${u.file} imports ${u.spec} without import 'server-only'`)
    const imported = users.length > 0
    const r = { id: row.id, imported, cells: {} }
    rows.push(r)
    if (!row.marker) continue

    // 2. which chunks hold it
    const inStatic = new Set(staticFiles.filter((f) => row.marker.test(read(f))).map((f) => path.relative(path.join(root, '.next'), f).split(path.sep).join('/')))
    const inServer = serverFiles.filter((f) => row.marker.test(read(f)))
    if (imported && !inStatic.size && !(row.server && inServer.length))
      fail.push(`${row.id}: imported, but its marker matches no chunk: the marker is stale`)
    if (!imported && (inStatic.size || inServer.length))
      fail.push(`${row.id}: nothing imports it, yet its marker matches ${[...inStatic, ...inServer].length} chunk(s): the marker is not specific`)
    if (row.server) {
      r.cells['client chunks'] = inStatic.size ? `LOADS ✗` : 'clean'
      for (const c of inStatic) fail.push(`${row.id}: server-only code is in client chunk ${c}`)
      continue
    }

    // 3. which pages load it
    for (const [route, p] of pages) {
      const first = [...p.first].some((c) => inStatic.has(c))
      const reach = [...p.reach].some((c) => inStatic.has(c))
      const must = (row.load ?? []).some((x) => routeMatch(x, route))
      const never = (row.never ?? []).some((x) => routeMatch(x, route)) && !must
      let broken = null
      if (never && reach) broken = `${route} can load it (${first ? 'first load' : 'on demand'})`
      else if (row.firstLoad === false && first) broken = `${route} loads it on first load; it must load on demand only`
      else if (must && imported && !first) broken = `${route} must load it and doesn't`
      if (broken) fail.push(`${row.id}: ${broken}`)
      r.cells[route] = (first ? 'LOADS' : reach ? 'on demand' : 'clean') + (broken ? ' ✗' : '')
    }
    for (const x of row.load ?? [])
      if (!has(x)) notes.push(`${row.id}: no ${x} page is built yet, so "must load on ${x}" waits`)
      else if (!imported) notes.push(`${row.id}: nothing imports it yet, so "must load on ${x}" waits`)
  }

  // Lab and editor code, by source path, from the manifests' own module lists
  for (const own of OWN_CODE)
    for (const [route, p] of pages)
      if (!routeMatch(own.only, route))
        for (const m of p.modules) if (own.paths.some((x) => m.startsWith(x))) fail.push(`${route} loads ${own.id}: ${m}`)

  // 4. the Lab's own JS on an entry page's first load
  const shared = new Set(['/', '/canvas'].flatMap((r) => [...(pages.get(r)?.first ?? [])]))
  const entries = routes.filter((r) => /^\/lab\/\[[^\]]+\]\/\[[^\]]+\](?:\/\[[^\]]+\])?$/.test(r))
  const budget = []
  for (const route of entries) {
    const own = [...pages.get(route).first].filter((c) => !shared.has(c) && byRel.has(c))
    const bytes = own.reduce((n, c) => n + gzipSync(read(byRel.get(c)), { level: 9 }).length, 0)
    budget.push({ route, bytes })
    if (bytes > BUDGET) fail.push(`${route}: the Lab's own JS is ${(bytes / 1024).toFixed(1)} KB gzipped (budget ${BUDGET / 1024} KB)`)
  }
  if (!entries.length) notes.push(`no Lab entry page is built yet, so the ${BUDGET / 1024} KB budget waits`)

  return { fail, notes, rows, routes, budget }
}

function print({ fail, notes, rows, routes, budget }) {
  const cols = ['/', '/canvas', ...(routes ?? []).filter((r) => r.startsWith('/lab')), '/edit']
  const w = Math.max(14, ...cols.map((c) => c.length + 2))
  console.log('package'.padEnd(14) + cols.map((c) => c.padEnd(w)).join('') + 'client chunks')
  for (const r of rows) {
    if (!Object.keys(r.cells).length) {
      console.log(r.id.padEnd(14) + `(import scan only${r.imported ? '' : ', not imported yet'})`)
      continue
    }
    console.log(
      r.id.padEnd(14) +
        cols.map((c) => (r.cells[c] ?? (r.cells['client chunks'] ? '' : '—')).padEnd(w)).join('') +
        (r.cells['client chunks'] ?? '') +
        (r.imported ? '' : '  (not imported yet)'),
    )
  }
  for (const b of budget ?? []) console.log(`budget ${b.route}: ${(b.bytes / 1024).toFixed(1)} KB of ${BUDGET / 1024} KB`)
  for (const n of notes) console.log(`· ${n}`)
  for (const f of fail) console.log(`✗ ${f}`)
  console.log(fail.length ? `check:bundles: ${fail.length} broken` : 'check:bundles: every row holds')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkBundles()
  print(result)
  process.exit(result.fail.length ? 1 : 0)
}

export { print as printBundles }
