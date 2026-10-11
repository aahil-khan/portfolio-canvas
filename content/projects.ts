import type { Project } from './types'
import data from './data/projects.json' with { type: 'json' }

/*
 * The data lives in `content/data/projects.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
 *
 * The cast goes through `unknown` on purpose: the type is declared here, never inferred from
 * the JSON's current contents — or a valid edit (emptying a list) would change the type and fail
 * the build. `validateSet` checks the data against the schema at build time instead.
 */

/** Selected work. The Work card sorts by `year`, newest first. */
export const projects = data as unknown as readonly Project[]
