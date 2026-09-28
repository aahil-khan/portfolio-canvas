import { check, type Issue } from './schema.ts'
import { FILES, SCHEMAS, type ContentSet } from '../../content/schema/index.ts'

/**
 * Every rule the editable content must pass, as one pure function.
 *
 * Pure so it can run in three places on three different sources of truth: at `next build` over
 * the files on disk, in the API over what is on GitHub with your change applied, and in the
 * browser as you type. `fileExists` is the only thing that differs between them.
 *
 * The schema catches a bad field; the rules below catch content that is fine file by file and
 * wrong together — a project naming a tool you just deleted from the shelf, say.
 */

/**
 * Typos that shipped for months in the old backend: a capital i read as a lowercase L ("Al
 * Powered" for "AI Powered"), and "non-based" for "n8n-based".
 */
const FORBIDDEN: [RegExp, string][] = [
  [/\bAl\b/, '"Al" — that is a capital i mis-typed as a lowercase L. Write "AI".'],
  [/non-based/i, '"non-based" — should be "n8n-based".'],
]

type Obj = Record<string, unknown>
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : [])
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [])

function walkStrings(value: unknown, path: string, visit: (s: string, path: string) => void): void {
  if (typeof value === 'string') visit(value, path)
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${path}[${i}]`, visit))
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) walkStrings(v, path ? `${path}.${k}` : k, visit)
}

export function validateSet(set: ContentSet, fileExists: (publicPath: string) => boolean): Issue[] {
  const out: Issue[] = []
  for (const { id } of FILES) out.push(...check(SCHEMAS[id], set[id], id))

  const profileFile = obj(set.profile)
  const profile = obj(profileFile.profile)
  const projects = arr(set.projects)
  const experience = obj(set.experience)
  const jobs = arr(experience.jobs)
  const archive = arr(set.archive)
  const posts = arr(set.writing)
  const groups = arr(set.stack)

  const dupes = (file: string, items: Obj[], key: string) => {
    const seen = new Set<unknown>()
    items.forEach((it, i) => {
      if (seen.has(it[key])) out.push({ path: `${file}[${i}].${key}`, message: `duplicate slug "${it[key]}"` })
      seen.add(it[key])
    })
  }
  dupes('projects', projects, 'slug')
  dupes('experience.jobs', jobs, 'slug')
  dupes('writing', posts, 'slug')
  dupes('archive', archive, 'id')

  // a stack entry that matches no tool silently loses its logo, so make it loud
  const tools = groups.flatMap((g) => arr(g.tools))
  const known = new Set(tools.map((t) => t.name))
  const stackRefs = (file: string, items: Obj[]) =>
    items.forEach((it, i) =>
      strs(it.stack).forEach((name, j) => {
        if (!known.has(name))
          out.push({
            path: `${file}[${i}].stack[${j}]`,
            message: `"${it.slug}" lists stack "${name}", which is not a tool on the Stack shelf`,
          })
      }),
    )
  stackRefs('projects', projects)
  stackRefs('experience.jobs', jobs)
  const toolNames = new Set<unknown>()
  tools.forEach((t) => {
    if (toolNames.has(t.name)) out.push({ path: 'stack', message: `the tool "${t.name}" is on the shelf twice` })
    toolNames.add(t.name)
  })

  const mustExist = (p: unknown, path: string) => {
    if (typeof p === 'string' && p.startsWith('/') && !fileExists(p))
      out.push({ path, message: `file not found in public/ → ${p}` })
  }
  for (const key of ['resumePdf', 'portrait', 'portraitHidden'])
    mustExist(profile[key], `profile.profile.${key}`)
  projects.forEach((p, i) => strs(p.images).forEach((f, j) => mustExist(f, `projects[${i}].images[${j}]`)))
  jobs.forEach((jb, i) => strs(jb.images).forEach((f, j) => mustExist(f, `experience.jobs[${i}].images[${j}]`)))
  archive.forEach((a, i) => {
    mustExist(a.image, `archive[${i}].image`)
    arr(a.images).forEach((shot, j) =>
      mustExist(typeof shot === 'string' ? shot : shot.src, `archive[${i}].images[${j}]`),
    )
  })
  groups.forEach((g, i) => arr(g.tools).forEach((t, j) => mustExist(t.logo, `stack[${i}].tools[${j}].logo`)))

  // mailto: is fine on the profile, but a project chip is always a web link
  projects.forEach((p, i) =>
    arr(p.links).forEach((l, j) => {
      if (typeof l.href === 'string' && !/^https?:\/\//.test(l.href))
        out.push({ path: `projects[${i}].links[${j}].href`, message: `"${l.label}" is not a web address → ${l.href}` })
    }),
  )

  arr(profileFile.headlineStats).forEach((s, i) => {
    const has = (k: string) => typeof s[k] === 'string' && (s[k] as string).trim() !== ''
    if (has('value') === has('derived'))
      out.push({ path: `profile.headlineStats[${i}]`, message: 'give either a value or "Computed from", not both' })
  })

  walkStrings({ profile: set.profile, projects, experience, writing: posts, stack: groups, archive, now: set.now }, '', (s, path) => {
    for (const [re, why] of FORBIDDEN) if (re.test(s)) out.push({ path, message: `forbidden text ${why}` })
  })

  return out
}
