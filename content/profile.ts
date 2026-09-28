import type { Profile, Stat } from './types'
import data from './data/profile.json' with { type: 'json' }
import { awards } from './experience.ts'

/*
 * The data lives in `content/data/profile.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
 */

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
export const headlineStats: readonly Stat[] = data.headlineStats.map((s) =>
  'derived' in s && s.derived ? { value: DERIVED[s.derived](), label: s.label } : { value: String(s.value), label: s.label },
)
