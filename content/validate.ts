import { existsSync } from 'node:fs'
import path from 'node:path'

import { validateSet } from '../lib/edit/rules.ts'
import { apps, dockLayout, externalApps } from './apps'
import { props } from './props'
import type { ContentSet } from './schema/index.ts'
import archive from './data/archive.json' with { type: 'json' }
import experience from './data/experience.json' with { type: 'json' }
import now from './data/now.json' with { type: 'json' }
import profile from './data/profile.json' with { type: 'json' }
import projects from './data/projects.json' with { type: 'json' }
import site from './data/site.json' with { type: 'json' }
import stack from './data/stack.json' with { type: 'json' }
import writing from './data/writing.json' with { type: 'json' }

/**
 * Content checks that types can't express.
 *
 * SERVER ONLY — this reads the filesystem. It is called at module scope from `app/page.tsx`,
 * so it runs while `next build` prerenders the page: bad content fails the build rather than
 * rendering a blank card in production. In dev it re-runs on every recompile, so you find out
 * the moment you save.
 *
 * The editable content (`content/data/`) is checked by `validateSet` — the same function `/edit`
 * runs before it commits, so a save that passes there passes here. What stays below is the
 * content only code edits: the dock and the desk notes.
 */

const PUBLIC = path.join(process.cwd(), 'public')

const SET: ContentSet = { profile, projects, experience, archive, now, writing, stack, site }

let done = false

export function validateContent(): void {
  if (done) return
  done = true
  const errors: string[] = []

  for (const { path: at, message } of validateSet(SET, (p) => existsSync(path.join(PUBLIC, p.slice(1)))))
    errors.push(`content/data/${at}: ${message}`)

  const dupes = (label: string, slugs: readonly string[]) => {
    const seen = new Set<string>()
    for (const s of slugs) {
      if (seen.has(s)) errors.push(`${label}: duplicate id "${s}"`)
      seen.add(s)
    }
  }

  // two notes in the same place read as one broken note
  const noteSpots = new Set<string>()
  for (const n of props) {
    const at = `${n.x},${n.y}`
    if (noteSpots.has(at)) errors.push(`two desk notes share the spot ${at}`)
    noteSpots.add(at)
    if (!n.lines && !n.glyph) errors.push(`desk note "${n.id}" has nothing written on it`)
    if (n.lines && n.glyph) errors.push(`desk note "${n.id}" has both words and a glyph`)
  }

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

  if (errors.length)
    throw new Error(
      `\n\nContent validation failed (${errors.length}):\n` +
        errors.map((e) => `  • ${e}`).join('\n') +
        `\n\nFix the files in content/ and save.\n`,
    )
}
