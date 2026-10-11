import type { ToolGroup } from './types'
import data from './data/stack.json' with { type: 'json' }

/*
 * The data lives in `content/data/stack.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
 *
 * The cast goes through `unknown` on purpose: the type is declared here, never inferred from
 * the JSON's current contents — or a valid edit (emptying a list) would change the type and fail
 * the build. `validateSet` checks the data against the schema at build time instead.
 */

/**
 * The toolbox, grouped as it appears on the Stack card.
 *
 * `invert: true` is for assets that ship white-on-transparent for dark UIs. Run `npm run check`
 * to detect new ones — it measures each asset's luminance rather than trusting the flag.
 */
export const toolGroups = data as unknown as readonly ToolGroup[]

/** Flat lookup, so a project's `stack` entry can find its logo. */
export const toolsByName = new Map(
  toolGroups.flatMap((g) => g.tools.map((t) => [t.name, t] as const)),
)
