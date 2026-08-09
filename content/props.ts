/**
 * Things left on the desk.
 *
 * Not cards and not easter eggs — objects, parked at fixed world coordinates, that you only meet
 * by panning somewhere you had no particular reason to go. The canvas is a desk, and a desk with
 * nothing on it but neatly stacked windows is a rendering of a desk rather than one that has
 * been used.
 *
 * They are scenery: `pointer-events: none`, absent from `takenRects`, so they never block a drag,
 * never shift a card's placement, and never drag the framing out when you fit everything. A card
 * may well land on top of one. That is what happens to a coffee ring.
 *
 * Placement is mid-distance on purpose — far enough out that the opening layout never lands on
 * them, close enough that a bit of aimless panning finds one. The deep-space card at (3800,
 * -2400) is the far end of that scale and stays the reward for going much further.
 */

export type PropKind = 'ring' | 'sticky' | 'pencil' | 'doodle' | 'clip'

export interface DeskProp {
  id: string
  kind: PropKind
  /** World coordinates. */
  x: number
  y: number
  /** Degrees. Nothing on a real desk is aligned to anything. */
  rotate?: number
  /** Only the sticky note has anything to say. */
  lines?: readonly [string, string]
}

export const props: readonly DeskProp[] = [
  // north-west: the mug went here, twice
  { id: 'ring-nw', kind: 'ring', x: -1750, y: -980, rotate: -6 },
  // south-west: the note, with the pencil that wrote it
  {
    id: 'sticky-sw',
    kind: 'sticky',
    x: -1480,
    y: 1180,
    rotate: -3,
    lines: ['note to self', 'ship it before you rewrite it a fourth time'],
  },
  { id: 'pencil-sw', kind: 'pencil', x: -1560, y: 1420, rotate: 7 },
  // east: someone was on the phone
  { id: 'doodle-e', kind: 'doodle', x: 2100, y: 340, rotate: -2 },
  // north-east: holding nothing together
  { id: 'clip-ne', kind: 'clip', x: 1650, y: -1250, rotate: 22 },
  // south: a second ring, because one mug is never the whole story
  { id: 'ring-s', kind: 'ring', x: 420, y: 1720, rotate: 11 },
] as const
