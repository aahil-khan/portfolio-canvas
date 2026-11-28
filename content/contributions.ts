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
    /** GitHub's own line, and the block's heading. `{total}` is replaced with the real number. */
    title: '{total} contributions in the last year',
    /**
     * The keyboard stop's name: the strip scrolls sideways on a phone, so it takes focus, and what
     * it announces is the summary. `{total}` is replaced.
     */
    label: '{total} contributions in the last year, one square a day, newest on the right',
    /** The rows that carry a label down the side, Sunday first, as GitHub labels them. */
    weekdays: ['', 'Mon', '', 'Wed', '', 'Fri', ''],
    /**
     * One day's sentence: the hover tooltip, and each square's `<title>` with JavaScript off.
     * `{count}` and `{date}` ("November 3rd") are replaced.
     */
    day: {
      none: 'No contributions on {date}.',
      one: '{count} contribution on {date}.',
      many: '{count} contributions on {date}.',
    },
  },
} as const
