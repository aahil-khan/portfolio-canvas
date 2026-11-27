/**
 * Runs `validateLab` over **both** sets, the real one and the demo one, whichever is active
 * (API.md, "Demo mode"), and names each issue's file. Called by `content/validate.ts` (at
 * `next build`) and `scripts/check-content.ts` (`npm run content:check`).
 *
 * Plain TypeScript with relative `.ts` imports, so Node runs it with `--experimental-strip-types`.
 */
import fs from 'node:fs'
import path from 'node:path'

import { loadSet, SET_PATHS, type LabSet, type SetName } from './content.ts'
import { validateLab, type LabIssue } from './rules.ts'

export interface LabSetIssue extends LabIssue {
  set: SetName
  /** The file to fix, relative to the repo root. */
  file: string
}

/** The file an issue's path points into. */
function fileOf(set: LabSet, issue: LabIssue): string {
  const p = SET_PATHS[set.name]
  const [head, key] = issue.path.split(/[.[]/)
  if (head === 'bodies') return set.bodyFiles[key] ?? p.bodies
  if (head === 'terms') return p.terms
  if (head === 'figures') return p.figures
  if (head === 'unfurls') return p.unfurls
  if (head === 'studies') return `${p.studies}/${key}.json`
  if (head === 'copy') return SET_PATHS.real.content
  return p.content
}

export function validateLabSets({ root = process.cwd(), sets = ['real', 'demo'] as SetName[] } = {}): LabSetIssue[] {
  const exists = (publicPath: string) => fs.existsSync(path.join(root, 'public', publicPath.slice(1)))
  return sets.flatMap((name) => {
    const set = loadSet(name, { root })
    // `copy` is shared, so its issues are reported once, with the real set
    return validateLab(set.lab, set.bodies, exists)
      .filter((i) => name === 'real' || !i.path.startsWith('copy'))
      .map((i) => ({ ...i, set: name, file: fileOf(set, i) }))
  })
}

export const formatLabIssue = (i: LabSetIssue) => `${i.file}: ${i.path}: ${i.message} [${i.set} set, rule ${i.rule}]`
