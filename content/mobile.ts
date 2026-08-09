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
   * How to get the real canvas on a phone.
   *
   * The answer is the browser's own setting, not a mode of ours. Serving the canvas ourselves
   * meant overriding the very guard that keeps a 717px dock off a 390px screen, re-pinning the
   * control pill so it could be reached at all, and adding an escape button because the canvas
   * offers no exit a thumb can use. All of that to reproduce, badly, a switch every mobile
   * browser already has.
   *
   * No browser is named: the wording differs (Chrome says "Desktop site", Safari "Request
   * Desktop Website") and guessing wrong is worse than describing the shape of it.
   */
  desktopMode: 'Desktop',
  desktopModeLabel: 'How to view the desktop version',
  desktopHelp:
    'This is the phone version. For the full canvas, turn on desktop site in your browser’s menu and reload — it wants a pointer, so it is best on a real computer.',
  desktopHelpDismiss: 'Got it',
} as const
