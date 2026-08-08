/**
 * The "now" card — what you are actually doing at the moment.
 *
 * EDIT THIS FILE. Everything below is seeded from what the repo already knows (the newest entry
 * in projects.ts, and this site) precisely so it is never a claim nobody checked. It is the one
 * card that is wrong by default: a "now" page that has not moved in a year says something worse
 * about a portfolio than having no "now" page at all.
 *
 * `updated` is rendered as a plain month, not "3 days ago". Relative time has to be computed
 * against the reader's clock, which means either a client component or a hydration mismatch,
 * and the honest signal here is the month anyway.
 */

export interface NowItem {
  /** Two or three words. Rendered as the label chip. */
  label: string
  what: string
}

export const now = {
  /** `YYYY-MM`. Shown as e.g. "August 2026", and it is the whole point — keep it current. */
  updated: '2026-08',

  lede: 'A snapshot, kept deliberately short.',

  items: [
    {
      label: 'Building',
      what: 'SOP Opera — compound-risk detection for industrial safety, and the parts of it that have to stay deterministic.',
    },
    {
      label: 'Also building',
      what: 'This canvas. It is the fourth attempt at a portfolio and the first one I have not deleted.',
    },
    {
      label: 'Thinking about',
      what: 'Where retrieval should stop guessing and start refusing to answer.',
    },
  ] satisfies NowItem[],

  /** Optional. Set to '' to hide the line. */
  foot: 'Borrowed from Derek Sivers, who has been telling people to keep one of these for years.',
} as const
