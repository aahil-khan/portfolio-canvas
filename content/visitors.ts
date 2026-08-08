/**
 * The visitors card.
 *
 * Copy and configuration only — the numbers are counted in `lib/store.ts` and served by
 * `app/api/visitors/route.ts`. See CLAUDE.md: nothing in `components/` should contain a sentence.
 */

export const visitors = {
  /**
   * `{n}` is replaced with the all-time unique count; the other two avoid "1 people".
   *
   * All three must fit ONE line beside the live pill. The card's height is measured from the
   * skeleton, which is one line — a lede that wraps makes the real card taller than the box
   * every placement calculation was given.
   */
  lede: '{n} people have opened this canvas.',
  ledeOne: 'One other person has been here.',
  ledeNone: 'You are the first one here.',

  /** `{n}` is how many people loaded a page in the last five minutes, you included. */
  online: '{n} here now',
  onlineOne: 'just you',

  /** `{n}` is the length of the chart window. */
  chartStart: '{n} days ago',
  chartEnd: 'today',

  /** `{n}` is how many countries are not shown as their own chip. */
  moreCountries: '+{n} more',

  stats: {
    today: 'today',
    views: 'views',
    perVisitor: 'views each',
    countries: 'countries',
  },

  /**
   * Your own history. Counted in your browser's localStorage and never sent anywhere — the
   * server has no idea which of its visitors you are, and that is the point of saying so.
   */
  youFirst: 'Your first time here. This line is counted in your browser, not on the server.',
  /** `{nth}` becomes 2nd / 3rd / 11th, `{ago}` becomes one of the spans below. */
  you: 'Your {nth} visit — the first was {ago}.',
  ago: {
    today: 'earlier today',
    yesterday: 'yesterday',
    /** `{n}` days, then weeks, then months. */
    days: '{n} days ago',
    weeks: '{n} weeks ago',
    months: '{n} months ago',
  },

  /**
   * English ordinal suffixes, keyed by `Intl.PluralRules(type: 'ordinal')`. A table rather than a
   * hardcoded 'th' because "your 3th visit" is exactly the kind of thing nobody proofreads.
   */
  ordinals: { one: 'st', two: 'nd', few: 'rd', other: 'th' },

  /** Shown while the first fetch is in flight. Same shape as the real thing, so nothing jumps. */
  loading: 'Counting…',
  /** Shown when no shared store is configured, matching the contributions card's empty state. */
  empty: 'Counting is off right now',
  emptyHint: 'This card needs the shared store. Everything else on the canvas works without it.',
} as const
