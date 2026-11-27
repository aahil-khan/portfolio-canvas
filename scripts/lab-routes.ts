/**
 * Every route under `/lab`, for the check. Read from `lib/lab/content.ts` (`routes()`), so a new
 * entry is covered with no edit to the check. Contract: `content/lab/API.md` §2 and §11.
 *
 *   node --experimental-strip-types scripts/lab-routes.ts          # JSON on stdout
 *
 * Until the loaders exist (PR 2), there is nothing to list: `built` is false and `routes` is
 * empty, and the rules that need routes say so instead of passing silently on nothing.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { LabRoute } from '../lib/lab/types.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = path.join(ROOT, 'lib/lab/content.ts')

export interface LabRoutes {
  /** False until `lib/lab/content.ts` exists. */
  built: boolean
  routes: LabRoute[]
}

export async function labRoutes(): Promise<LabRoutes> {
  if (!existsSync(CONTENT)) return { built: false, routes: [] }
  const mod = (await import(pathToFileURL(CONTENT).href)) as { routes?: () => LabRoute[] }
  if (typeof mod.routes !== 'function') throw new Error('lib/lab/content.ts exports no routes()')
  return { built: true, routes: mod.routes() }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await labRoutes(), null, 2))
}
