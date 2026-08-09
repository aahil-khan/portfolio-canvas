/**
 * Easter eggs — the terminal and the card in deep space.
 *
 * Copy only. See CLAUDE.md: nothing in `components/` should contain a sentence.
 */

export const deepSpace = {
  lede: 'You went looking!',
  body: 'Most people never pan this far out. There\'s nothing useful here, thats the point :)',
  claim: 'I found it',
  /** `{n}` is the number of OTHER people, so these read naturally at 0, 1 and many. */
  claimedFirst: "You're the first",
  claimedOne: 'You and one other',
  claimedMany: 'You and {n} others',
  soFar: '{n} so far',
  /** World coordinates. Far enough out that you only arrive here on purpose. */
  at: { x: 3800, y: -2400 },
} as const

export const terminal = {
  boot: 'canvas 1.0 — type `help` for commands',
  prompt: '$',
  unknown: (cmd: string) => `${cmd}: command not found`,
  help: [
    'help              this',
    'whoami            who built this',
    'ls                every card on the canvas',
    'open <card>       open one of them',
    'theme <name>      set the theme, or `theme list`',
    'eggs              what you have found',
    'sudo              no',
    'clear             wipe the scrollback',
  ],
  whoami: 'aahil khan',
  sudo: 'nice try',
  cleared: '',
  themeUsage: 'usage: theme <name> · try `theme list`',
  themeSet: (id: string) => `theme set to ${id}`,
  themeUnknown: (id: string) => `no theme called ${id}`,
  openUsage: 'usage: open <card> · try `ls`',
  openUnknown: (id: string) => `no card called ${id}`,
  opened: (id: string) => `opening ${id}`,
  eggsNone: 'nothing found yet. keep poking.',
  /*
   * The magic word from Colossal Cave, 1977, which teleported you between two points and is the
   * oldest easter egg in software. It does nothing here either — that is the joke, and the
   * response is the same one the original gives when you say it in the wrong place.
   */
  xyzzy: 'nothing happens.',
} as const
