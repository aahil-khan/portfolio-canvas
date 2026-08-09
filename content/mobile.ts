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

  /**
   * Getting back out of it.
   *
   * One word, not four. The bar holds three controls on a 390px screen, and the full phrase
   * pushed every one of them into an ellipsis — "…ack to the ré…" tells a visitor less than
   * "Résumé" does. The long form survives as the accessible name.
   */
  backToResume: 'Résumé',
  backToResumeLabel: 'Back to the résumé',

  /**
   * Switching to the real canvas on a phone, and the way back.
   *
   * Offered rather than hidden: the touch shell is the better phone experience and the canvas is
   * genuinely awkward with a thumb, but "this is the cut-down one" is a fair thing to suspect,
   * and the answer to it should be a button rather than a paragraph.
   */
  desktopMode: 'Desktop',
  desktopModeLabel: 'Switch to desktop mode',
  desktopModeHint: 'The real canvas — drag, pan and zoom, on a screen it was not built for.',
  phoneMode: 'Phone mode',
} as const
