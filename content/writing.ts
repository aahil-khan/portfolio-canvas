import type { Post } from './types'
import data from './data/writing.json' with { type: 'json' }

/*
 * The data lives in `content/data/writing.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
 *
 * The cast goes through `unknown` on purpose: the type is declared here, never inferred from
 * the JSON's current contents — or a valid edit (emptying a list) would change the type and fail
 * the build. `validateSet` checks the data against the schema at build time instead.
 */

/** Posts. Sorted by `year` descending in the Writing card. */
export const posts = data as unknown as readonly Post[]
