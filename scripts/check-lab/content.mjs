/**
 * Rules 1, 2, T, Q, E and L: the Lab's content. Lane module for scripts/check-lab.mjs (API.md §11);
 * PR 2. Rule O, links out, is `unfurls.mjs` (PR 7), which reads `issues()` from here.
 *
 * Every rule runs `validateLab` (lib/lab/rules.ts) over **both** sets, real and demo, and over the
 * active set with the fixture on top, and fails on that rule's issues. The same function runs at
 * `next build` and in `content:check`, so these hold the build to what the build already refuses,
 * and say which rule a break belongs to.
 *
 *   1  privacy denylist: in every Lab and study file, both sets; in every built /lab page and
 *      RSC payload; in public/lab
 *   2  banned phrases and tracker output, in everything a reader sees
 *   T  terms are data, complete, and every [[t:…]] resolves
 *   Q  every long entry has a pull-quote, verbatim from its body
 *   E  builds and experiments end with a dated "What I'd do now"
 *   L  every [[…]], [[tag:…]] and [^key] resolves; refs numbered by first use and all cited; ≤ 8
 *      tags; reserved and unique ids; no slot headings; and the data's own integrity (schema,
 *      references between entries, images, leads), which has no rule id of its own
 */
import fs from 'node:fs'
import path from 'node:path'

import { loadSet, SET_PATHS } from '../../lib/lab/content.ts'
import { PRIVACY, validateLab } from '../../lib/lab/rules.ts'
import { formatLabIssue, validateLabSets } from '../../lib/lab/validate-sets.ts'

const walk = (d) =>
  fs.existsSync(d)
    ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
    : []
const rel = (root, f) => path.relative(root, f).split(path.sep).join('/')

/** Issues from both sets, and from the active set with the fixture on top. Cached per run. */
let cached = null
function issues(ctx) {
  if (cached) return cached
  const all = validateLabSets({ root: ctx.root })
  const active = ctx.visibility.labDemo ? 'demo' : 'real'
  const fx = loadSet(active, { root: ctx.root, fixture: true })
  const exists = (p) => fs.existsSync(path.join(ctx.root, 'public', p.slice(1)))
  for (const i of validateLab(fx.lab, fx.bodies, exists, { missingUnfurl: active === 'real' ? 'warn' : 'error' })) {
    const line = { ...i, set: `${active}+fixture`, file: i.path.startsWith('bodies.') ? fx.bodyFiles[i.path.split('.')[1]] : 'content/lab/fixture' }
    if (!all.some((a) => a.path === i.path && a.message === i.message)) all.push(line)
  }
  return (cached = all)
}
const byRule = (ctx, ids) => issues(ctx).filter((i) => ids.includes(i.rule)).map(formatLabIssue)

const sets = (ctx) => {
  const real = loadSet('real', { root: ctx.root })
  const demo = loadSet('demo', { root: ctx.root })
  return `real: ${real.lab.entries.length} entries; demo: ${demo.lab.entries.length} entries; active: ${ctx.visibility.labDemo ? 'demo' : 'real'}`
}

const privacy = {
  id: '1',
  title: 'Privacy denylist: Lab content, built /lab pages and RSC payloads, public/lab',
  needs: ['server'],
  async run(ctx) {
    const fail = byRule(ctx, ['1'])
    const notes = [sets(ctx)]
    const hit = (text) => PRIVACY.map((re) => text.match(re)?.[0]).find(Boolean)

    // every file of both sets, as written (validateLab reads them parsed; this reads the bytes)
    const files = [
      ...Object.values(SET_PATHS).flatMap((p) => [p.content, p.terms, p.figures, p.unfurls].map((f) => path.join(ctx.root, f))),
      ...walk(path.join(ctx.root, 'content/lab')).filter((f) => /\.(?:md|json)$/.test(f)),
      ...walk(path.join(ctx.root, 'content/data/studies')).filter((f) => f.endsWith('.json')),
    ].filter((f, i, a) => a.indexOf(f) === i && fs.existsSync(f))
    for (const f of files) {
      const h = hit(fs.readFileSync(f, 'utf8'))
      if (h) fail.push(`${rel(ctx.root, f)}: private term "${h}"`)
    }

    // the build: every /lab page's HTML and RSC payload
    const built = walk(path.join(ctx.root, '.next/server/app/lab')).filter((f) => /\.(?:html|rsc|body|meta)$/.test(f))
    for (const f of built) {
      const h = hit(fs.readFileSync(f, 'utf8'))
      if (h) fail.push(`${rel(ctx.root, f)}: private term "${h}" in the built page`)
    }
    // and what the server answers, for any route the build did not write out
    let served = 0
    for (const r of ctx.lab.routes) {
      const res = await ctx.get(r.path)
      if (res.status !== 200) continue
      served++
      const h = hit(res.text)
      if (h) fail.push(`${r.path}: private term "${h}" in the served page`)
    }
    if (!built.length && !served) notes.push('no /lab page is built yet (PR 6): the content and public/lab are checked, the pages wait')

    // public/lab: file names, and the contents of anything that is text
    for (const f of walk(path.join(ctx.root, 'public/lab'))) {
      const r = rel(ctx.root, f)
      const h = hit(r) ?? (/\.(?:json|md|txt|svg|html|xml)$/.test(f) ? hit(fs.readFileSync(f, 'utf8')) : undefined)
      if (h) fail.push(`${r}: private term "${h}"`)
    }
    return { fail, notes }
  },
}

const simple = (id, title, ids, extra) => ({
  id,
  title,
  needs: [],
  run(ctx) {
    const fail = byRule(ctx, ids)
    return { fail: [...fail, ...(extra?.(ctx) ?? [])], notes: [sets(ctx)] }
  },
})

/** Terms are data: each set's terms file is there and is a list. */
const termsAreData = (ctx) =>
  Object.entries(SET_PATHS).flatMap(([name, p]) => {
    const f = path.join(ctx.root, p.terms)
    if (!fs.existsSync(f)) return [`${p.terms} is missing: the ${name} set's terms are data in that file`]
    try {
      return Array.isArray(JSON.parse(fs.readFileSync(f, 'utf8'))) ? [] : [`${p.terms} must hold a list of terms`]
    } catch (e) {
      return [`${p.terms}: not valid JSON (${e.message})`]
    }
  })

const rules = [
  privacy,
  simple('2', 'Banned phrases and tracker output in everything a reader sees', ['2']),
  simple('T', 'Terms are data, complete, and every [[t:…]] resolves', ['T'], termsAreData),
  simple('Q', 'Every long entry has a pull-quote, verbatim from its body', ['Q']),
  simple('E', 'Builds and experiments end with a dated "What I’d do now"', ['E']),
  simple('L', 'Links, references, tags, ids and slot headings resolve; the data holds together', ['L', 'S', 'D', 'I', 'R']),
]
export default rules
export { issues }
