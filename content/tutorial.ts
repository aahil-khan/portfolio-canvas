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

  groups: [
    {
      label: 'Moving around',
      moves: [
        { keys: 'drag', what: 'the background pans the whole canvas' },
        { keys: '⌘/Ctrl + scroll', what: 'zoom in and out — or pinch, on a trackpad' },
        { keys: 'scroll', what: 'pan up, down and sideways' },
        { keys: 'double-click', what: 'a card flies you into it; again flies you back' },
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
  foot: 'There are five things hidden on this canvas. The Themes card is not one of them.',
} as const
