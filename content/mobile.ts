/**
 * Copy for the phone.
 *
 * A phone gets the résumé first and the canvas only on request, so these are the words that
 * explain the swap in both directions. Kept together rather than scattered across `profile.ts`
 * and the components, per the rule that nothing in `components/` should contain a sentence.
 */
export const mobile = {
  /** Under the hero, once the interactive version is showing. */
  heroNote: 'Best viewed on desktop',

  /** The offer above the résumé. */
  offerTitle: 'There is an interactive version of this',
  offerBody:
    'A desktop on an infinite canvas — windows you drag around, pan and zoom. It wants a pointer and room to move, so it is at its best on a real desktop.',
  offerAction: 'Try it anyway',

  /** Getting back out of it. */
  backToResume: 'Back to the résumé',
} as const
