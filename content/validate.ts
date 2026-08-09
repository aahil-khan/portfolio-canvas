import { existsSync } from 'node:fs'
import path from 'node:path'

import { apps, dockLayout, externalApps } from './apps'
import { jobs } from './experience'
import { profile } from './profile'
import { projects } from './projects'
import { toolGroups, toolsByName } from './stack'
import { archive } from './archive'
import { props } from './props'
import { posts } from './writing'

/**
 * Content checks that types can't express.
 *
 * SERVER ONLY — this reads the filesystem. It is called at module scope from `app/page.tsx`,
 * so it runs while `next build` prerenders the page: bad content fails the build rather than
 * rendering a blank card in production. In dev it re-runs on every recompile, so you find out
 * the moment you save.
 */

const PUBLIC = path.join(process.cwd(), 'public')

/**
 * The backend's resume.json contains real typos that shipped for months: a capital i read as
 * a lowercase L ("Al Powered" for "AI Powered"), and "non-based" for "n8n-based". Content here
 * is hand-written, so guard against reintroducing them rather than patching them downstream.
 */
const FORBIDDEN: [RegExp, string][] = [
  [/\bAl\b/, '"Al" — that is a capital i mis-typed as a lowercase L. Write "AI".'],
  [/non-based/i, '"non-based" — should be "n8n-based".'],
]

function walkStrings(value: unknown, visit: (s: string) => void): void {
  if (typeof value === 'string') visit(value)
  else if (Array.isArray(value)) for (const v of value) walkStrings(v, visit)
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) walkStrings(v, visit)
}

let done = false

export function validateContent(): void {
  if (done) return
  done = true
  const errors: string[] = []

  const dupes = (label: string, slugs: readonly string[]) => {
    const seen = new Set<string>()
    for (const s of slugs) {
      if (seen.has(s)) errors.push(`${label}: duplicate slug "${s}"`)
      seen.add(s)
    }
  }
  dupes('projects', projects.map((p) => p.slug))
  dupes('jobs', jobs.map((j) => j.slug))
  dupes('posts', posts.map((p) => p.slug))
  dupes('archive', archive.map((a) => a.id))

  // a stack entry that doesn't match a tool silently loses its logo, so make it loud
  const known = new Set(toolsByName.keys())
  for (const { slug, stack } of [...projects, ...jobs])
    for (const name of stack)
      if (!known.has(name))
        errors.push(`"${slug}" lists stack "${name}", which is not in content/stack.ts`)

  const fileMustExist = (p: string, where: string) => {
    if (!existsSync(path.join(PUBLIC, p.replace(/^\//, ''))))
      errors.push(`${where}: file not found in public/ → ${p}`)
  }
  for (const p of projects)
    for (const img of p.images ?? []) fileMustExist(img, `project "${p.slug}"`)
  for (const j of jobs)
    for (const img of j.images ?? []) fileMustExist(img, `job "${j.slug}"`)
  // two notes in the same place read as one broken note
  const noteSpots = new Set<string>()
  for (const n of props) {
    const at = `${n.x},${n.y}`
    if (noteSpots.has(at)) errors.push(`two desk notes share the spot ${at}`)
    noteSpots.add(at)
    if (!n.lines && !n.glyph) errors.push(`desk note "${n.id}" has nothing written on it`)
    if (n.lines && n.glyph) errors.push(`desk note "${n.id}" has both words and a glyph`)
  }

  for (const a of archive) {
    if (a.image) fileMustExist(a.image, `archive "${a.id}"`)
    for (const shot of a.images ?? []) {
      fileMustExist(typeof shot === 'string' ? shot : shot.src, `archive "${a.id}"`)
    }
  }
  for (const g of toolGroups)
    for (const t of g.tools) if (t.logo) fileMustExist(t.logo, `tool "${t.name}"`)

  // every dock entry needs a renderer, and ids are used as card ids so must be unique
  dupes('apps', [...apps, ...externalApps].map((a) => a.id))

  /*
   * The dock layout is a second, hand-maintained ordering of the same ids, which is exactly the
   * kind of thing that silently loses a card. So: every id it names must be a real app, and
   * every app must appear in it exactly once — a typo orphans a card from the dock rather than
   * failing loudly, and nobody notices until someone asks where Notes went.
   */
  const laid = dockLayout.flatMap((n) => (n.kind === 'folder' ? [...n.items] : [n.id]))
  const dockable = new Set(apps.map((a) => a.id))
  for (const id of laid) {
    if (!dockable.has(id)) errors.push(`dockLayout names "${id}", which is not an app in apps.ts`)
  }
  for (const a of apps) {
    const n = laid.filter((id) => id === a.id).length
    if (n === 0) errors.push(`"${a.id}" is an app but is missing from dockLayout — it would have no dock tile`)
    if (n > 1) errors.push(`"${a.id}" appears ${n} times in dockLayout`)
  }
  dupes('dockLayout folders', dockLayout.filter((n) => n.kind === 'folder').map((n) => n.id))

  // a project link is typed as a string, so only a check catches a missing scheme
  for (const p of projects)
    for (const l of p.links ?? [])
      if (!/^https?:\/\//.test(l.href))
        errors.push(`project "${p.slug}" link "${l.label}" is not an absolute URL → ${l.href}`)

  if (!profile.email.includes('@')) errors.push(`profile.email does not look like an address`)
  if (profile.resumePdf) fileMustExist(profile.resumePdf, 'profile.resumePdf')

  walkStrings({ profile, projects, jobs, posts, toolGroups, archive }, (s) => {
    for (const [re, why] of FORBIDDEN)
      if (re.test(s)) errors.push(`forbidden text ${why}\n      in: "${s.slice(0, 90)}"`)
  })

  if (errors.length)
    throw new Error(
      `\n\nContent validation failed (${errors.length}):\n` +
        errors.map((e) => `  • ${e}`).join('\n') +
        `\n\nFix the files in content/ and save.\n`,
    )
}
