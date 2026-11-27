/**
 * The GitHub contributions calendar, on the canvas card and on the front page.
 *
 * Copy and configuration only — the calendar itself is fetched at request time in
 * `lib/github.ts`. See CLAUDE.md: nothing in `components/` should contain a sentence.
 */

export const contributions = {
  login: 'aahil-khan',
  /** `{total}` is replaced with the real number. */
  lede: '{total} contributions in the last year.',
  /** Shown when there is no token configured, or GitHub is unreachable. */
  empty: 'Contribution data is off right now.',
  emptyHint: 'It needs a GitHub token; the rest of the card works without one.',
  less: 'Less',
  more: 'More',

  /**
   * The front page's block, at the end of Work. It has no empty state: without data the block is
   * left out, because a front page that apologises for a missing token reads as broken.
   */
  home: {
    title: 'On GitHub this year',
    /** The calendar's text alternative. `{total}` is replaced with the real number. */
    label: '{total} contributions in the last year, one square a day',
    /** Names the strip that scrolls sideways on a phone, for the keyboard stop it needs. */
    scroll: 'Contribution calendar, newest weeks on the right',
    /** One day's tooltip. `{count}` and `{date}` (YYYY-MM-DD) are replaced. */
    day: '{count} on {date}',
  },
} as const
