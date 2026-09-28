import type { Project } from './types'
import data from './data/projects.json' with { type: 'json' }

/*
 * The data lives in `content/data/projects.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
 */

/** Selected work. The Work card sorts by `year`, newest first. */
export const projects: readonly Project[] = data as Project[]
