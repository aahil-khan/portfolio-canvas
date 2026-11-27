/**
 * Validates `content/data/*.json` with the same rules `/edit` and `next build` use.
 *
 *   npm run content:check
 *
 * The Lab's two sets (real and demo) go through `validateLab` too.
 *
 * Seconds instead of a full build — the quick check after a hand edit, and the one the
 * update-content skill runs before it commits.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { validateSet } from '../lib/edit/rules.ts'
import { FILES, type ContentSet } from '../content/schema/index.ts'
import { formatLabIssue, validateLabSets } from '../lib/lab/validate-sets.ts'

const root = path.resolve(import.meta.dirname, '..')
const set = {} as ContentSet
for (const f of FILES) {
  try {
    set[f.id] = JSON.parse(readFileSync(path.join(root, f.path), 'utf8'))
  } catch (e) {
    console.error(`${f.path}: not valid JSON — ${(e as Error).message}`)
    process.exit(1)
  }
}

const issues = validateSet(set, (p) => existsSync(path.join(root, 'public', p.slice(1))))
const lab = validateLabSets({ root })
if (issues.length || lab.length) {
  for (const i of issues) console.error(`  • ${i.path}: ${i.message}`)
  for (const i of lab) console.error(`  • ${formatLabIssue(i)}`)
  const n = issues.length + lab.length
  console.error(`\n${n} problem${n === 1 ? '' : 's'} in content/data/ and the Lab's sets`)
  process.exit(1)
}
console.log(`content/data: ${FILES.length} files valid; the Lab: real and demo sets valid`)
