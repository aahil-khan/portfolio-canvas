import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { FILES } from '../../content/schema/index.ts'
import { fakeGit, type FakeGit } from './fake-github.ts'

/**
 * The in-memory repo behind `EDIT_DEV_FAKE`: a copy of this working tree's content and public/
 * taken on first use. Saves land here and vanish on restart — nothing is written to disk.
 */

let git: FakeGit | null = null

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

export function devGit(): FakeGit {
  if (git) return git
  // turbopackIgnore: this only runs under EDIT_DEV_FAKE in `next dev`; without it the production
  // build traces the whole repo into the server bundle
  const root = process.cwd()
  const files: Record<string, Uint8Array> = {}
  for (const f of FILES) files[f.path] = readFileSync(path.join(/*turbopackIgnore: true*/ root, f.path))
  for (const abs of walk(path.join(/*turbopackIgnore: true*/ root, 'public'))) files[path.relative(root, abs).split(path.sep).join('/')] = readFileSync(abs)
  git = fakeGit(files)
  return git
}
