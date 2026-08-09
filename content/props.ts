/**
 * Notes left on the desk.
 *
 * Not cards and not easter eggs — paper, parked at fixed world coordinates, that you only meet by
 * panning somewhere you had no particular reason to go. The canvas is a desk, and a desk with
 * nothing on it but neatly stacked windows is a rendering of a desk rather than one that has
 * been used.
 *
 * Only notes. There were coffee rings and a biro scribble here, then a drawer's worth of objects
 * — a pencil, a paperclip, an eraser, a resistor. All of it was texture: you pan a long way, you
 * find a AA battery, and it has nothing to say to you. A note is the only thing on a desk that
 * answers back, which is the only reason any of this is worth walking to.
 *
 * They are scenery: `pointer-events: none`, absent from `takenRects`, so they never block a drag,
 * never shift a card's placement, and never drag the framing out when you fit everything. A card
 * may well land on top of one. That is what happens to a note.
 *
 * Scattered in different directions on purpose, so they are found one at a time rather than as a
 * pile. Mid-distance: past where the opening layout ever lands, short of the deep-space card at
 * (3800, -2400), which stays the reward for going properly far.
 */

/** Pad colours. A pad does not restyle itself to match the desk, so these hold on every theme. */
export type StickyTint = 'yellow' | 'pink' | 'blue' | 'green'

export interface DeskProp {
  id: string
  /** World coordinates. */
  x: number
  y: number
  /** Degrees. Nothing on a real desk is aligned to anything. */
  rotate?: number
  tint?: StickyTint
  /** The heading, then what it says. */
  lines?: readonly [string, string]
  /**
   * A single glyph instead of words, for when the reply is the whole joke.
   * Mutually exclusive with `lines`.
   */
  glyph?: string
}

export const props: readonly DeskProp[] = [
  // south-west
  {
    id: 'note-ship',
    tint: 'yellow',
    x: -1480,
    y: 1180,
    rotate: -3,
    lines: ['note to self', 'pls stop adding random stuff that no one will ever see'],
  },
  /*
   * The reply, stuck ON the note it answers rather than beside it.
   *
   * Beside it, it read as a second unrelated note. Overlapping the corner — smaller, tilted the
   * other way, and painted after so it lands on top — is what makes it obviously an answer:
   * somebody physically slapped this onto that.
   */
  { id: 'note-shush', tint: 'pink', x: -1372, y: 1268, rotate: 9, glyph: '🤫' },

  // north-west
  {
    id: 'note-tests',
    tint: 'pink',
    x: -2050,
    y: -1150,
    rotate: 2,
    lines: ['quick question (tough)', "what's 2 + 2?"],
  },

  // due north, the one that acknowledges you got here
  {
    id: 'note-hello',
    tint: 'green',
    x: 150,
    y: -1900,
    rotate: 3,
    lines: ['are you bored?', 'do you like mindlessly panning around, or is this your idea of fun?'],
  },

  // north-east, on the road out to the deep-space card
  {
    id: 'note-further',
    tint: 'yellow',
    x: 2500,
    y: -1550,
    rotate: -2,
    lines: ['did you drink water today?', 'go drink some'],
  },
] as const
