import data from './data/now.json' with { type: 'json' }

/*
 * The data lives in `content/data/now.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
 *
 * The cast goes through `unknown` on purpose: the type is declared here, never inferred from
 * the JSON's current contents — or a valid edit (emptying a list) would change the type and fail
 * the build. `validateSet` checks the data against the schema at build time instead.
 */

export interface NowItem {
  /** Two or three words. Rendered as the label chip. */
  label: string
  what: string
}

/**
 * The "now" card — what you are actually doing at the moment. It is the one card that is wrong
 * by default, so keep `updated` (YYYY-MM) current.
 */
export const now = data as unknown as { updated: string; lede: string; items: readonly NowItem[]; foot: string }
