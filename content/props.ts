/**
 * Things left on the desk.
 *
 * Not cards and not easter eggs — objects, parked at fixed world coordinates, that you only meet
 * by panning somewhere you had no particular reason to go. The canvas is a desk, and a desk with
 * nothing on it but neatly stacked windows is a rendering of a desk rather than one that has
 * been used.
 *
 * Mostly notes, because a note is the only thing on a desk that can say something. There were
 * coffee rings and a biro scribble here too; they were texture without content, and texture is
 * not worth panning to find.
 *
 * They are scenery: `pointer-events: none`, absent from `takenRects`, so they never block a drag,
 * never shift a card's placement, and never drag the framing out when you fit everything. A card
 * may well land on top of one. That is what happens to a note.
 *
 * Scattered in different directions on purpose, so they are found one at a time rather than as a
 * pile. Mid-distance: past where the opening layout ever lands, short of the deep-space card at
 * (3800, -2400), which stays the reward for going properly far.
 */

export type PropKind = 'sticky' | 'pencil' | 'clip'

/** Pad colours. Objects keep their own colour on every theme, the way a real pad would. */
export type StickyTint = 'yellow' | 'pink' | 'blue' | 'green'

export interface DeskProp {
  id: string
  kind: PropKind
  /** World coordinates. */
  x: number
  y: number
  /** Degrees. Nothing on a real desk is aligned to anything. */
  rotate?: number
  tint?: StickyTint
  /** The heading, then what it says. Stickies only. */
  lines?: readonly [string, string]
}

export const props: readonly DeskProp[] = [
  // south-west, with the pencil that wrote it
  {
    id: 'note-ship',
    kind: 'sticky',
    tint: 'yellow',
    x: -1480,
    y: 1180,
    rotate: -3,
    lines: ['note to self', 'ship it before you rewrite it a fourth time'],
  },
  { id: 'pencil', kind: 'pencil', x: -1560, y: 1430, rotate: 7 },

  // north-west
  {
    id: 'note-tests',
    kind: 'sticky',
    tint: 'pink',
    x: -2050,
    y: -1150,
    rotate: 2,
    lines: ['todo', 'write the tests. you have been saying this since march'],
  },

  // south-east
  {
    id: 'note-2am',
    kind: 'sticky',
    tint: 'blue',
    x: 2150,
    y: 820,
    rotate: -1.5,
    lines: ['2am', 'every good idea turns up at 2am and none of them survive breakfast'],
  },

  // due north, the one that acknowledges you got here
  {
    id: 'note-hello',
    kind: 'sticky',
    tint: 'green',
    x: 150,
    y: -1900,
    rotate: 3,
    lines: ['hello', 'you panned a long way to find this. that was the whole point of it'],
  },

  // north-east, on the road out to the deep-space card
  {
    id: 'note-further',
    kind: 'sticky',
    tint: 'yellow',
    x: 2500,
    y: -1550,
    rotate: -2,
    lines: ['do not forget', 'deep space is further out than you think. keep going'],
  },

  // due south, holding nothing together
  { id: 'clip', kind: 'clip', x: 1180, y: 1650, rotate: 22 },
] as const
