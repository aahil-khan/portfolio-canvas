/**
 * The tutorial card.
 *
 * Copy only. The canvas has a lot of interaction that is invisible until someone tells you —
 * the corner hint carries three of them and then dismisses itself forever, which is right for a
 * nudge and useless as a reference. This is the reference.
 *
 * Modifier keys are written out as `⌘/Ctrl` rather than detected. Sniffing the platform to pick
 * one would either run on the client — a hydration mismatch, which is exactly how the previous
 * build produced React #418 — or force this card to become a client component for the sake of
 * one glyph. The corner hint already spells both out, so this matches it.
 */

export interface Move {
  keys: string
  what: string
}

export const tutorial = {
  lede: 'It behaves like a desk. Nothing here is a page.',

  /**
   * The first-run tour, above the dock.
   *
   * Four steps, in the order someone actually needs them: how to move, how to see everything,
   * where cards come from, and the shortcut that replaces all of it once you know your way
   * around. Anything past four is a manual, and the manual is this card.
   */
  coach: {
    stepOf: (n: number, total: number) => `${n} of ${total}`,
    next: 'Next',
    done: 'Got it',
    skip: 'Skip',
    steps: [
      {
        title: 'This is a desk, not a page',
        body: 'Drag the background to move around. Nothing scrolls here — everything is just somewhere.',
      },
      {
        title: 'Zoom out to see the lot',
        body: '⌘/Ctrl + scroll zooms, and F fits everything on screen at once when you lose your bearings.',
      },
      {
        title: 'The dock opens cards',
        body: 'Every icon down here is a card. Click to open it, click again to put it away. Drag a card by its title bar.',
        tail: true,
      },
      {
        title: 'Or just ask for it',
        body: '⌘/Ctrl + K lists every card and action by name, which is faster than hunting once you know what you want.',
      },
    ],
  },

  /**
   * Shown once the desk is genuinely crowded, and not before.
   *
   * Arrange is useless advice on the three cards you open with — there is nothing to tidy — and
   * a tip that arrives before the problem does is one more thing to dismiss. It retires itself
   * the moment any arrangement is run.
   */
  arrangeTip: {
    badge: 'Tip',
    title: 'Getting crowded',
    body: 'Try Arrange in the top bar — five ways to tidy the desk, or deal it again.',
    dismiss: 'Dismiss',
  },

  groups: [
    {
      label: 'Moving around',
      moves: [
        { keys: 'drag', what: 'the background pans the whole canvas' },
        { keys: '⌘/Ctrl + scroll', what: 'zoom in and out — or pinch, on a trackpad' },
        { keys: 'scroll', what: 'pan up, down and sideways' },
        { keys: 'double-click', what: 'on the top bar of a card, flies you into it; again flies you back' },
      ],
    },
    {
      label: 'Cards',
      moves: [
        { keys: 'drag', what: 'pick a card up and put it anywhere' },
        { keys: 'click', what: 'a dock icon opens it, or closes it if it is out' },
        { keys: 'Go to', what: 'the top bar lists what is open and takes you to it' },
        { keys: 'Arrange', what: 'five ways to tidy the desk, or deal it again' },
      ],
    },
    {
      label: 'Shortcuts',
      moves: [
        { keys: '⌘/Ctrl + K', what: 'every card and action, by name' },
        { keys: 'Esc', what: 'closes the card on top of the pile' },
        { keys: '0  or  F', what: 'fit everything on screen' },
        { keys: '+  /  −', what: 'zoom, without reaching for a modifier' },
      ],
    },
  ],

  /** Shown last. There are eggs, and saying so is more fun than leaving them undiscovered. */
  footLabel: 'Also',
  foot: 'There are nine things hidden on the page, try the Konami Code (¬‿¬)',
} as const
