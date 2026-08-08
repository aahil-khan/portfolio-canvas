/**
 * The GitHub contributions card.
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
} as const
