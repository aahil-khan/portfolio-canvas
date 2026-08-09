/**
 * The arcade — four small things to do instead of reading a résumé.
 *
 * Copy and configuration only. See CLAUDE.md: nothing in `components/` should contain a
 * sentence. Board dimensions live here too, because they are the numbers that keep each card's
 * measured height honest and they should be visible in one place.
 */

export const arcade = {
  lede: 'Four small things to do instead of reading a résumé.',
  games: [
    {
      id: 'typing',
      label: 'Typing Test',
      sub: 'Words per minute, on a global board',
      tag: 'WPM',
    },
    {
      id: 'mines',
      label: 'Minesweeper',
      sub: '9×9, ten mines, right-click or hold to flag',
      tag: 'Best',
    },
    { id: 'snake', label: 'Snake', sub: 'Arrow keys, WASD or swipe', tag: 'Best' },
    { id: '2048', label: '2048', sub: 'Swipe or arrow keys. You will not get 2048.', tag: 'Best' },
  ],
  /** Shown in place of a best score before the game has ever been played. */
  noScore: '—',
} as const

/**
 * The global boards — one per game, because "best" means a different number in each.
 *
 * `lowerWins` is Minesweeper's: its score is a completion time, so the fastest run is the
 * smallest number. The Redis sorted set only knows how to keep the largest, so a lower-wins
 * board is stored negated and flipped back on the way out. That is confined to the API route;
 * nothing else in the app ever sees a negative score.
 *
 * `max` is a sanity ceiling, not a difficulty rating. A client can claim any number it likes, so
 * these only exist to throw out the obviously fabricated — each is set comfortably above what
 * the game can actually produce (snake tops out at 253 food on a 16×16, 2048 at just under 4M).
 * Anything more would need the games server-simulated, which is a lot of machinery for a toy.
 */
export const boards = {
  typing: { lowerWins: false, max: 400, kind: 'points' },
  mines: { lowerWins: true, max: 3600, kind: 'time' },
  snake: { lowerWins: false, max: 700, kind: 'points' },
  '2048': { lowerWins: false, max: 4_000_000, kind: 'points' },
} as const satisfies Record<string, { lowerWins: boolean; max: number; kind: 'points' | 'time' }>

export type BoardId = keyof typeof boards

/** Copy for the score strip every game carries. */
export const scoreboard = {
  score: 'Score',
  run: 'This run',
  yours: 'Your best',
  world: 'World best',
  /** The badge on the world column when the record on it is the visitor's own. */
  mine: 'yours',
  namePlaceholder: 'Name for the board',
  submit: 'Post score',
  posting: 'Posting…',
  posted: 'On the board',
  failed: 'Board unreachable',
  /** Appended to the end-of-run hint when the run beat the visitor's own stored best. */
  newBest: 'new personal best',
} as const

export const typing = {
  hint: 'Tap or click the text, then start typing',
  restart: 'Restart',
  done: 'Again',
  wpm: 'WPM',
  accuracy: 'Accuracy',
  elapsed: 'Elapsed',
  namePlaceholder: 'Name for the board',
  submit: 'Post score',
  posted: 'On the board',
  boardTitle: 'Fastest so far',
  boardEmpty: 'No scores yet.',
  /**
   * Deliberately lowercase and unpunctuated — a typing test that demands capitals and commas is
   * measuring your shift key, not your typing.
   */
  quotes: [
    'the best interfaces feel like they were discovered rather than designed which is a very generous way of describing something that took eleven attempts',
    'a canvas is a promise that nothing is off screen forever which is why the fit button matters more than any of the pretty animations around it',
    'every hand picked height in the prototype turned out to be wrong so now the cards measure themselves and nobody argues about it anymore',
    'good retrieval is mostly knowing what to throw away and the rest is pretending you knew that from the beginning',
    'the sound is synthesised because shipping audio files for eight small clicks felt like a lot of bytes to ask a stranger to download',
  ],
} as const

export const mines = {
  cols: 9,
  rows: 9,
  count: 10,
  hint: '10 mines · right-click or hold to flag · click a solved number to clear round it',
  reset: 'New',
  won: 'Cleared',
  lost: 'Boom',
  flagsLeft: 'Left',
} as const

export const snake = {
  grid: 16,
  /** ms per step. Lower is faster; drops as the snake grows. */
  startSpeed: 170,
  minSpeed: 80,
  /** A bonus apple every this many points, worth this much, alive for this many steps. */
  bonusEvery: 5,
  bonusWorth: 5,
  bonusSteps: 34,
  hint: 'Arrow keys, WASD or swipe · edges wrap · space to pause',
  reset: 'New',
  over: 'Ate itself',
  paused: 'Paused',
} as const

export const g2048 = {
  size: 4,
  hint: 'Swipe, arrow keys or WASD',
  reset: 'New',
  over: 'No moves left',
  won: '2048!',
} as const
