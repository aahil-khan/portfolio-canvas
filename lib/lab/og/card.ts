/**
 * A share card, drawn: PR 3's approved template (`prototype/lab-v2b-extras/extras.css`, "share
 * cards") as the element tree satori draws, every size copied from there. One framed window on the
 * theme's ground: a title bar with the AK mark and the page's address; the kind, the title and the
 * lede; the handwritten date, the meta and the author at the foot; beside them an entry's image,
 * fitted whole, or a chapter's outlined numeral.
 *
 * Plain objects rather than JSX, so Node runs this file as it is and `npm test` holds the layout:
 * `layoutCard` counts each block's lines from the font's own advances (`metrics.ts`) and picks the
 * title's size and the lede's lines so nothing runs out of the card, whatever the content.
 *
 * Relative `.ts` imports, for Node.
 */
import { clampText, countLines, type FontMetrics } from './metrics.ts'
import type { CardModel } from './model.ts'
import type { Palette } from './palette.ts'

export const OG_SIZE = { width: 1200, height: 630 } as const

/** PR 3's geometry, in px at 1200 × 630. */
export const G = {
  pad: 56,
  edge: 3,
  radius: 22,
  offset: 10,
  bar: 72,
  mark: 46,
  body: { top: 34, right: 48, bottom: 30, left: 48 },
  gap: 40,
  /** The image column, and the numeral's. */
  still: 360,
  numeral: 280,
  stillEdge: 3,
  stillOffset: 5,
  stillRadius: 12,
  eyebrow: { size: 24, lh: 1.25, tracking: 0.12, padTop: 2 },
  /** Title sizes, largest first: a title that would take more than three lines steps down. */
  title: { sizes: [70, 60, 52], large: [84, 72, 60], lh: 1.02, lhLarge: 1.04, tracking: -0.03, gap: 14, maxLines: 3, nudge: 5 },
  lede: { size: 28, lh: 1.32, gap: 14, maxLines: 2, nudge: 4, after: -2 },
  foot: { top: 18, date: 38, size: 24, gap: 22 },
  chips: { top: 25, after: 2, size: 24, lh: 1.2, padX: 18, padY: 8, gap: 12, offset: 3 },
  numeralSize: 220,
} as const

const windowW = OG_SIZE.width - 2 * G.pad
const windowH = OG_SIZE.height - 2 * G.pad
/** The window's body, inside its padding: where the words and the image go. */
export const BODY = {
  w: windowW - 2 * G.edge - G.body.left - G.body.right,
  h: windowH - 2 * G.edge - G.bar - G.edge - G.body.top - G.body.bottom,
}

/** The fonts' metrics, by role. */
export interface CardMetrics {
  regular: FontMetrics
  medium: FontMetrics
  bold: FontMetrics
}

/** The largest size, inside `maxW` × `maxH`, of a `w` × `h` picture kept whole: never cropped, never enlarged. */
export function fitWhole(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  const s = Math.min(1, maxW / w, maxH / h)
  return { w: Math.max(1, Math.floor(w * s)), h: Math.max(1, Math.floor(h * s)) }
}

/** The room a picture has inside the image column, its frame and offset taken off. */
export const STILL_BOX = {
  w: G.still - 2 * G.stillEdge - G.stillOffset,
  h: BODY.h - 2 * G.stillEdge - G.stillOffset,
}

/** A picture ready to draw: a data URL, at the size it is drawn. */
export interface Still {
  src: string
  w: number
  h: number
}

export interface CardLayout {
  /** The text column's width. */
  textW: number
  titleSize: number
  titleLh: number
  titleLines: number
  /** The address's segments as drawn, each with its slash; middle ones fold into `…/` when it would run over. */
  address: string[]
  /** The words as drawn: cut at a word with an ellipsis where they would run over. */
  title: string
  eyebrow: string
  lede: string
  ledeLines: number
  chipRows: number
  /** The column's height as laid out: never more than `BODY.h`. */
  height: number
}

/**
 * Satori gives a line box no negative half-leading: where a browser sets a 70px title at line
 * height 1.02 into 71px and lets the glyphs overhang, satori's first line starts about 9px lower.
 * PR 3's cards were drawn by a browser, so the title and what follows it are pulled up by this much
 * to sit where they sit there (measured against PR 3's cards, to the pixel).
 */
const CONTENT = 1.276 // Space Grotesk's ascender + descender, in em (hhea: 984 + 292 of 1000)
export const pull = (size: number, lh: number) => Math.max(0, Math.round(((CONTENT - lh) / 2) * size))

const eyebrowH = G.eyebrow.size * G.eyebrow.lh + G.eyebrow.padTop
const footH = G.foot.top + G.foot.date
const chipH = G.chips.size * G.chips.lh + 2 * G.chips.padY + 2 * G.edge

/** How many rows the chips wrap to in `width`. */
function chipRows(m: CardMetrics, chips: readonly string[], width: number): number {
  if (!chips.length) return 0
  let rows = 1
  let x = 0
  for (const c of chips) {
    const w = countWidth(m.medium, c, G.chips.size) + 2 * G.chips.padX + 2 * G.edge + G.chips.offset
    if (x && x + G.chips.gap + w > width) {
      rows++
      x = w
    } else x += (x ? G.chips.gap : 0) + w
  }
  return rows
}
const countWidth = (m: FontMetrics, s: string, size: number) => [...s].reduce((w, ch) => w + m.advance(ch), 0) * size

/** The room the address has in the title bar, beside the mark. */
export const ADDRESS_W = windowW - 2 * G.edge - 22 - 18 - G.mark - 18

/**
 * The address's segments, each with its slash. One too long for the bar keeps its host and as many
 * segments after it as fit beside the bold last one, and folds the rest into `…/`.
 */
export function fitAddress(m: CardMetrics, lead: string, last: string): string[] {
  const segs = lead.split(/(?<=\/)/).filter(Boolean)
  const width = (xs: string[]) => countWidth(m.medium, xs.join(''), 26) + countWidth(m.bold, last, 26)
  let out = segs
  for (let keep = segs.length - 1; keep >= 2 && width(out) > ADDRESS_W; keep--) out = [...segs.slice(0, keep - 1), '…/']
  return out
}

/**
 * Sizes the card's words to its room: the title at the largest size that keeps it to three lines
 * and still leaves the lede a line (or, on the home, its chips), then as many lede lines, up to
 * two, as fit under it. Text that would still run over is cut at a word and given an ellipsis here,
 * rather than mid-word by satori's own clamp, which also marks text that fits exactly once
 * `textWrap: balance` is on.
 *
 * Heights are satori's: a title's line box carries `pull` below it as well as above, which the
 * lede's margin takes back.
 */
export function layoutCard(model: CardModel, m: CardMetrics, still: Still | null): CardLayout {
  const side = model.numeral ? G.numeral : still ? G.still : 0
  const textW = BODY.w - (side ? side + G.gap : 0)
  const sizes = model.large ? G.title.large : G.title.sizes
  const lh = model.large ? G.title.lhLarge : G.title.lh
  const ledeLine = G.lede.size * G.lede.lh
  const ledeWant = model.lede ? Math.min(G.lede.maxLines, countLines(m.regular, model.lede, G.lede.size, textW)) : 0
  const rows = chipRows(m, model.chips, textW)
  const chipsH = rows ? G.chips.top + rows * chipH + (rows - 1) * G.chips.gap + G.chips.after : 0
  const eyebrow = clampText(m.medium, model.eyebrow.toUpperCase(), G.eyebrow.size, textW, 1, G.eyebrow.tracking)
  const fixed = eyebrowH + chipsH + footH
  const address = fitAddress(m, model.address.lead, model.address.last)

  let pick: CardLayout | null = null
  for (const size of sizes) {
    const need = countLines(m.bold, model.title, size, textW, G.title.tracking)
    const lines = Math.min(G.title.maxLines, need)
    const p = pull(size, lh)
    const titleH = G.title.gap - G.title.nudge + lines * size * lh + p
    const left = BODY.h - fixed - titleH
    const ledeRoom = left - (G.lede.gap - p - G.lede.nudge) - G.lede.after
    const ledeLines = ledeWant ? Math.max(0, Math.min(ledeWant, Math.floor(ledeRoom / ledeLine))) : 0
    pick = {
      textW,
      address,
      titleSize: size,
      titleLh: lh,
      titleLines: lines,
      title: need > lines ? clampText(m.bold, model.title, size, textW, lines, G.title.tracking) : model.title,
      eyebrow,
      ledeLines,
      lede: ledeLines ? clampText(m.regular, model.lede, G.lede.size, textW, ledeLines) : '',
      chipRows: rows,
      height: fixed + titleH + (ledeLines ? G.lede.gap - p - G.lede.nudge + ledeLines * ledeLine + G.lede.after : 0),
    }
    if (need <= G.title.maxLines && left >= 0 && (!ledeWant || ledeLines > 0)) break
  }
  return pick as CardLayout
}

/* ---------- the element tree ---------- */

type Style = Record<string, string | number>
export interface Node {
  type: string
  props: { style?: Style; children?: Child | Child[]; src?: string; width?: number; height?: number; alt?: string }
}
type Child = Node | string

const h = (type: string, style: Style, ...children: Child[]): Node => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
})

/** The font family names the card's fonts are registered under (`fonts.ts`). */
export const FAMILY = { sans: 'Space Grotesk', hand: 'Caveat' } as const

export function cardTree(model: CardModel, p: Palette, m: CardMetrics, still: Still | null, mark: string): Node {
  const L = layoutCard(model, m, still)
  const edge = `${G.edge}px solid ${p.border}`

  const ground: Style = {
    display: 'flex',
    width: OG_SIZE.width,
    height: OG_SIZE.height,
    padding: G.pad,
    backgroundColor: p.canvas,
    fontFamily: FAMILY.sans,
    color: p.ink,
  }
  if (p.grid) {
    ground.backgroundImage = `linear-gradient(${p.grid} 1px, transparent 1px), linear-gradient(90deg, ${p.grid} 1px, transparent 1px)`
    ground.backgroundSize = '48px 48px'
  }

  const bar = h(
    'div',
    { display: 'flex', alignItems: 'center', gap: 18, height: G.bar, flexShrink: 0, padding: '0 22px 0 18px', backgroundColor: p.titlebar, borderBottom: edge },
    h(
      'div',
      { display: 'flex', alignItems: 'center', justifyContent: 'center', width: G.mark, height: G.mark, flexShrink: 0, borderRadius: 11, backgroundColor: p.accent, color: p.accentInk, border: edge, fontSize: 18, fontWeight: 700 },
      mark,
    ),
    h(
      'div',
      // one span per segment, and no tracking: satori's box for a long span runs a little wider than the
      // glyphs it draws, which opened a visible gap before the bold last segment
      { display: 'flex', fontSize: 26, fontWeight: 500, color: p.ink, whiteSpace: 'nowrap', overflow: 'hidden' },
      ...L.address.map((seg) => h('span', { flexShrink: 0 }, seg)),
      h('span', { fontWeight: 700, flexShrink: 0 }, model.address.last),
    ),
  )

  const words: Child[] = [
    h(
      'div',
      { display: 'block', paddingTop: G.eyebrow.padTop, fontSize: G.eyebrow.size, lineHeight: G.eyebrow.lh, fontWeight: 500, letterSpacing: `${G.eyebrow.tracking}em`, textTransform: 'uppercase', color: p.inkMuted, flexShrink: 0 },
      L.eyebrow,
    ),
    h(
      'div',
      { display: 'block', marginTop: G.title.gap - pull(L.titleSize, L.titleLh) - G.title.nudge, fontSize: L.titleSize, lineHeight: L.titleLh, letterSpacing: `${G.title.tracking}em`, fontWeight: 700, color: p.ink, textWrap: 'balance', flexShrink: 0 },
      L.title,
    ),
  ]
  if (L.ledeLines)
    words.push(
      h(
        'div',
        { display: 'block', marginTop: G.lede.gap - pull(L.titleSize, L.titleLh) - G.lede.nudge, fontSize: G.lede.size, lineHeight: G.lede.lh, marginBottom: G.lede.after, fontWeight: 400, color: p.inkMuted, flexShrink: 0 },
        L.lede,
      ),
    )
  if (L.chipRows)
    words.push(
      h(
        'div',
        { display: 'flex', flexWrap: 'wrap', gap: G.chips.gap, marginTop: G.chips.top, marginBottom: G.chips.after, flexShrink: 0 },
        ...model.chips.map((c) =>
          h(
            'div',
            { display: 'flex', fontSize: G.chips.size, lineHeight: G.chips.lh, fontWeight: 500, padding: `${G.chips.padY}px ${G.chips.padX}px`, border: edge, borderRadius: 999, boxShadow: `${G.chips.offset}px ${G.chips.offset}px 0 0 ${p.shadow}`, backgroundColor: p.surface, color: p.ink },
            c,
          ),
        ),
      ),
    )
  const foot: Child[] = []
  if (model.date) foot.push(h('div', { display: 'flex', fontFamily: FAMILY.hand, fontWeight: 500, fontSize: G.foot.date, lineHeight: 1, color: p.ink }, model.date))
  if (model.meta) foot.push(h('div', { display: 'flex' }, model.meta))
  foot.push(h('div', { display: 'flex', marginLeft: 'auto', color: p.ink }, model.by))
  words.push(
    h(
      'div',
      { display: 'flex', alignItems: 'baseline', gap: G.foot.gap, paddingTop: G.foot.top, fontSize: G.foot.size, fontWeight: 500, color: p.inkMuted, flexShrink: 0 },
      ...foot,
    ),
  )

  const body: Child[] = [h('div', { display: 'flex', flexDirection: 'column', width: L.textW, height: BODY.h, flexShrink: 0 }, ...words)]
  if (model.numeral)
    body.push(
      h(
        'div',
        { display: 'flex', width: G.numeral, height: BODY.h, alignItems: 'flex-end', justifyContent: 'flex-end', flexShrink: 0 },
        h(
          'div',
          { display: 'flex', fontSize: G.numeralSize, fontWeight: 700, lineHeight: 0.78, letterSpacing: '-0.06em', color: p.surface, WebkitTextStroke: `${G.edge * 2}px ${p.inkSubtle}` },
          model.numeral,
        ),
      ),
    )
  else if (still)
    body.push(
      h(
        'div',
        { display: 'flex', width: G.still, height: BODY.h, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
        {
          type: 'img',
          props: {
            src: still.src,
            width: still.w + 2 * G.stillEdge,
            height: still.h + 2 * G.stillEdge,
            style: { border: `${G.stillEdge}px solid ${p.border}`, borderRadius: G.stillRadius, boxShadow: `${G.stillOffset}px ${G.stillOffset}px 0 0 ${p.shadow}` },
          },
        },
      ),
    )

  return h(
    'div',
    ground,
    h(
      'div',
      { display: 'flex', flexDirection: 'column', flexGrow: 1, border: edge, borderRadius: G.radius, backgroundColor: p.surface, boxShadow: `${G.offset}px ${G.offset}px 0 0 ${p.shadow}`, overflow: 'hidden' },
      bar,
      h('div', { display: 'flex', flexGrow: 1, gap: G.gap, padding: `${G.body.top}px ${G.body.right}px ${G.body.bottom}px ${G.body.left}px` }, ...body),
    ),
  )
}
