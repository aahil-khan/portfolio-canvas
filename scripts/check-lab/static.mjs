/**
 * Rules 4 (hygiene) and B (bundles): what can be proved from the source and the build output.
 * Lane module for scripts/check-lab.mjs (API.md §11).
 */
import fs from 'node:fs'
import path from 'node:path'

import { checkBundles } from '../check-bundles.mjs'

const CODE_DIRS = ['app', 'components', 'lib', 'content', 'scripts']
const CODE = /\.(?:[cm]?[jt]sx?)$/

/**
 * The only TypeScript that may name the reduced-motion query: its owner, the owner's own test, and
 * the canvas's seven effect-time calls, which predate the owner (research §1) and are allowlisted
 * by path and count. A new reader anywhere fails; one of these moving onto the owner is a note.
 */
const REDUCED_READERS = {
  'lib/motion/reduced.ts': Infinity,
  'lib/motion/reduced.test.ts': Infinity,
  'components/desktop/dock.tsx': 1,
  'components/apps/carousel.tsx': 2,
  'components/desktop/card.tsx': 2,
  'lib/canvas/use-canvas.ts': 2,
}
const REDUCED_RE = /prefers-reduced-motion/g

const walk = (d) =>
  fs.existsSync(d)
    ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
    : []
const rel = (root, f) => path.relative(root, f).split(path.sep).join('/')
/** Source with comments removed, so prose about a thing never counts as doing it. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1')

function sourceFiles(root) {
  return CODE_DIRS.flatMap((d) => walk(path.join(root, d)))
    .filter((f) => CODE.test(f))
    .map((f) => ({ file: rel(root, f), text: fs.readFileSync(f, 'utf8') }))
}

/** Every id the demo set holds (sections, tags, entries), or null before PR 2 writes it. */
function demoIds(root, dir) {
  const f = path.join(root, dir, 'lab.json')
  if (!fs.existsSync(f)) return null
  const set = JSON.parse(fs.readFileSync(f, 'utf8'))
  return [...(set.entries ?? []), ...(set.sections ?? []), ...(set.tags ?? [])].map((x) => x.id).filter(Boolean)
}

/** Every fixture id (`fx-…`) under content/lab/fixture, or null before PR 2 writes it. */
function fixtureIds(root) {
  const dir = path.join(root, 'content/lab/fixture')
  if (!fs.existsSync(dir)) return null
  const ids = new Set()
  for (const f of walk(dir)) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bfx-[a-z0-9-]+/g)) ids.add(m[0])
  return [...ids]
}

/** Lab pages that answer 200, as HTML. */
async function labPages(ctx) {
  const out = []
  for (const r of ctx.lab.routes) {
    const res = await ctx.get(r.path)
    if (res.status === 200) out.push({ path: r.path, html: res.text })
  }
  return out
}

const hygiene = {
  id: '4',
  title: 'Hygiene',
  needs: ['server'],
  async run(ctx) {
    const fail = []
    const notes = []
    const files = sourceFiles(ctx.root)

    // nothing imports the mockup
    for (const { file, text } of files)
      if (/(?:from\s*|import\s*\(\s*|require\(\s*|import\s+)['"][^'"]*prototype\//.test(code(text))) fail.push(`${file} imports from prototype/`)

    // one reader of reduced motion
    for (const { file, text } of files) {
      if (!/\.tsx?$/.test(file)) continue
      const n = [...code(text).matchAll(REDUCED_RE)].length
      if (!n) continue
      const allowed = REDUCED_READERS[file] ?? 0
      if (n > allowed) fail.push(`${file} reads the reduced-motion query ${n}× (allowed ${allowed}); ask lib/motion/reduced.ts`)
      else if (n < allowed && allowed !== Infinity) notes.push(`${file} reads it ${n}× now, under its allowance of ${allowed}: lower the allowance`)
    }
    for (const [file, allowed] of Object.entries(REDUCED_READERS))
      if (allowed !== Infinity && !files.some((f) => f.file === file)) notes.push(`${file} is allowlisted but gone: drop it from the allowance`)

    // the fixture never ships
    const fx = fixtureIds(ctx.root)
    if (!fx) notes.push('no content/lab/fixture yet, so there is no fixture to keep out of the build')
    else {
      const built = [...walk(path.join(ctx.root, '.next/server/app')), ...walk(path.join(ctx.root, '.next/static'))].filter((f) =>
        /\.(?:html|rsc|js|json|body)$/.test(f),
      )
      for (const f of built) {
        const t = fs.readFileSync(f, 'utf8')
        const hit = fx.find((id) => t.includes(id))
        if (hit) fail.push(`the default build holds fixture id ${hit} (${rel(ctx.root, f)})`)
      }
    }

    // demo ids stay in the demo set (API.md, "Demo mode"): the clean-up is deleting directories
    const { DEMO_CONTENT } = ctx.visibility
    const ids = demoIds(ctx.root, DEMO_CONTENT)
    if (!ids) notes.push(`no ${DEMO_CONTENT}/lab.json yet, so no demo id to keep in its directory`)
    else
      for (const { file, text } of files) {
        if (file.startsWith(DEMO_CONTENT + '/') || file === 'lib/lab/visibility.ts') continue
        const t = code(text)
        const hit = ids.find((id) => new RegExp(`['"\`/]${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`/]`).test(t))
        if (hit) fail.push(`${file} names the demo id "${hit}"; only ${DEMO_CONTENT}/ may`)
      }

    // at most three font families on a Lab page
    const pages = await labPages(ctx)
    if (!pages.length) notes.push('no Lab page answers 200 yet, so there are no font families to count')
    const cssCache = new Map()
    for (const p of pages) {
      const hrefs = [...p.html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1])
      const families = new Set()
      for (const h of hrefs) {
        if (!cssCache.has(h)) cssCache.set(h, (await ctx.get(h)).text)
        for (const m of cssCache.get(h).matchAll(/@font-face\s*{[^}]*font-family:\s*['"]?([^;'"}]+)/g)) families.add(m[1].replace(/ Fallback$/, '').trim())
      }
      if (families.size > 3) fail.push(`${p.path} loads ${families.size} font families (${[...families].join(', ')}); at most 3`)
    }
    return { fail, notes }
  },
}

const bundles = {
  id: 'B',
  title: 'Bundles: the import table, stale markers, the 60 KB budget',
  needs: ['build'],
  run(ctx) {
    const r = checkBundles({ root: ctx.root })
    return { fail: r.fail, notes: r.notes }
  },
}

const rules = [hygiene, bundles]
export default rules
