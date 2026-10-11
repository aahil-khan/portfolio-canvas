import type { Profile, Stat } from './types'
import json from './data/profile.json' with { type: 'json' }
import { awards } from './experience.ts'

/*
 * The data lives in `content/data/profile.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
 *
 * The cast goes through `unknown` on purpose: the type is declared here, never inferred from
 * the JSON's current contents — or a valid edit (emptying a list) would change the type and fail
 * the build. `validateSet` checks the data against the schema at build time instead.
 */

/** A headline number as stored: typed, or `derived` from other content. */
type StoredStat = { value?: string; derived?: string; label: string }
const data = json as unknown as { profile: Profile; headlineStats: StoredStat[] }

/** Identity. The hero, the About card and the front page all read from here. */
export const profile: Profile = data.profile

/**
 * Numbers computed from the content rather than typed, so they cannot fall out of step with it.
 * A stat in the JSON with `"derived": "wins"` becomes the number of awards.
 */
const DERIVED: Record<string, () => string> = {
  wins: () => String(awards.length),
}

/**
 * Numbers worth leading with. Shown as the stat strip on the Work card.
 * Keep this to three — it is a highlight reel, not a report.
 */
export const headlineStats: readonly Stat[] = data.headlineStats.map((s) => ({
  value: s.derived ? (DERIVED[s.derived]?.() ?? '') : (s.value ?? ''),
  label: s.label,
}))
