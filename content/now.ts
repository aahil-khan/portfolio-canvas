import data from './data/now.json' with { type: 'json' }

/*
 * The data lives in `content/data/now.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
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
export const now: { updated: string; lede: string; items: readonly NowItem[]; foot: string } = data
