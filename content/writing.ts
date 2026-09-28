import type { Post } from './types'
import data from './data/writing.json' with { type: 'json' }

/*
 * The data lives in `content/data/writing.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
 */

/** Posts. Sorted by `year` descending in the Writing card. */
export const posts: readonly Post[] = data
