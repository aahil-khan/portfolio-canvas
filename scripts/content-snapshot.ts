/**
 * Prints every value the editable content modules export, as stable JSON.
 *
 *   node scripts/content-snapshot.ts > before.json
 *
 * Used to prove a refactor of `content/` changed nothing the site reads: take one before and one
 * after, and `diff` them. Keys are sorted so a reordered object does not show up as a change.
 */
import * as profile from '../content/profile.ts'
import * as projects from '../content/projects.ts'
import * as experience from '../content/experience.ts'
import * as archive from '../content/archive.ts'
import * as now from '../content/now.ts'
import * as writing from '../content/writing.ts'
import * as stack from '../content/stack.ts'
import * as site from '../content/site.ts'

const sorted = (_: string, v: unknown) =>
  v instanceof Map
    ? { __map: [...v.entries()] }
    : v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v

const modules = { profile, projects, experience, archive, now, writing, stack, site }
console.log(JSON.stringify(modules, sorted, 2))
