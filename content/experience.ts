import type { Education, Job } from './types'
import json from './data/experience.json' with { type: 'json' }

/*
 * The data lives in `content/data/experience.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
 *
 * The cast goes through `unknown` on purpose: the type is declared here, never inferred from
 * the JSON's current contents — or a valid edit (emptying a list) would change the type and fail
 * the build. `validateSet` checks the data against the schema at build time instead.
 */

const data = json as unknown as {
  jobs: Job[]
  education: Education[]
  awards: { title: string; event: string }[]
}

/** Roles. Sorted by `year` descending in the Experience card. */
export const jobs: readonly Job[] = data.jobs

/** Shown as quieter rows beneath the roles. */
export const education: readonly Education[] = data.education

/** Standalone awards. Project-specific ones live on the project itself. */
export const awards: readonly { title: string; event: string }[] = data.awards
