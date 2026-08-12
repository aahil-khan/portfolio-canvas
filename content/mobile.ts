/**
 * Copy for `/canvas` on a phone.
 *
 * The desk is not usable on a touch screen, and the two previous attempts at working around that
 * are both gone: the résumé-first landing (the scrolling site at `/` is that now) and the
 * cut-down touch shell (it was never finished, and a half-canvas is worse than an honest no).
 *
 * So a phone gets one screen that says so, and points at the switch every mobile browser already
 * has. No browser is named: the wording differs — Chrome says "Desktop site", Safari "Request
 * Desktop Website" — and guessing wrong is worse than describing the shape of it.
 */
export const mobile = {
  /** Under the hero on the front page, and on the canvas notice. */
  heroNote: 'Best viewed on desktop',

  /** The `/canvas` notice, on a phone. */
  onlyDesktopTitle: 'This part is desktop only',
  onlyDesktopBody:
    'The desk is an infinite canvas — windows you drag around, pan and zoom. It needs a pointer and room to move, and a phone has neither.',
  onlyDesktopTry:
    'Want to try it anyway? Turn on desktop site in your browser’s menu and reload this page.',
  onlyDesktopBack: 'Back to the site',
} as const
