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
  hint: '10 mines · click to open, right-click or hold to flag',
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
  hint: 'Arrow keys, WASD or swipe · space to pause',
  reset: 'New',
  score: 'Score',
  best: 'Best',
  over: 'Ate itself',
  paused: 'Paused',
} as const

export const g2048 = {
  size: 4,
  hint: 'Swipe, arrow keys or WASD',
  reset: 'New',
  score: 'Score',
  best: 'Best',
  over: 'No moves left',
  won: '2048!',
} as const
