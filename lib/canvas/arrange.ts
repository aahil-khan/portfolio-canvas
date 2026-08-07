import { type Rect, findFreeSpot } from './geometry'

/**
 * Canvas arrangements.
 *
 * Pure: given the sizes of what's on the canvas, each returns where everything should go.
 * No DOM, no React — the caller animates the result. Positions are in world coordinates and
 * centred on the origin, so the camera can simply fit whatever comes back.
 */

export interface Item {
  id: string
  w: number
  h: number
}

export interface Placement {
  x: number
  y: number
  rot: number
}

export type Layout = Record<string, Placement>

export interface Arrangement {
  id: string
  label: string
  hint: string
  run: (items: readonly Item[], rand: () => number) => Layout
}

const GAP = 40

/** Centre a finished layout on the origin, so "fit" always frames it symmetrically. */
function centre(layout: Layout, items: readonly Item[]): Layout {
  const boxes = items.map((i) => ({ ...layout[i.id], w: i.w, h: i.h })).filter(Boolean)
  if (!boxes.length) return layout
  const minX = Math.min(...boxes.map((b) => b.x))
  const maxX = Math.max(...boxes.map((b) => b.x + b.w))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxY = Math.max(...boxes.map((b) => b.y + b.h))
  const dx = -(minX + maxX) / 2
  const dy = -(minY + maxY) / 2
  const out: Layout = {}
  for (const id of Object.keys(layout)) out[id] = { ...layout[id], x: layout[id].x + dx, y: layout[id].y + dy }
  return out
}

/**
 * Shelf-pack into rows of roughly equal width. Cards are different widths and heights, so a
 * strict grid leaves ragged holes; packing by row and centring each row reads as deliberate.
 *
 * Order is NOT sorted here — the caller passes items in reading order (hero, then About, Work,
 * Experience… as a résumé runs), and tidy preserves it. That predictability is the whole point:
 * tidy should produce the same, legible hierarchy every time.
 */
function tidy(items: readonly Item[]): Layout {
  const [head, ...rest] = items
  const cols = Math.max(1, Math.round(Math.sqrt(Math.max(rest.length, 1))))
  const targetW = rest.slice(0, cols).reduce((a, i) => a + i.w + GAP, 0) || (head?.w ?? 0)

  const rows: Item[][] = []
  // the hero gets a row of its own — it is the heading, not a peer of the cards
  if (head) rows.push([head])
  let row: Item[] = []
  let w = 0
  for (const item of rest) {
    if (row.length && w + item.w > targetW) {
      rows.push(row)
      row = []
      w = 0
    }
    row.push(item)
    w += item.w + GAP
  }
  if (row.length) rows.push(row)

  const layout: Layout = {}
  let y = 0
  for (const r of rows) {
    const rowW = r.reduce((a, i) => a + i.w, 0) + GAP * (r.length - 1)
    let x = -rowW / 2
    const rowH = Math.max(...r.map((i) => i.h))
    for (const item of r) {
      // vertically centred within the row, and perfectly upright — that's the point of tidy
      layout[item.id] = { x, y: y + (rowH - item.h) / 2, rot: 0 }
      x += item.w + GAP
    }
    y += rowH + GAP
  }
  return centre(layout, items)
}

/**
 * Random, but collision-free and gently tilted.
 *
 * The first version of this was not actually random: it sorted by area and spiralled out from a
 * fixed origin, so both the order and the search were deterministic and every "scatter" produced
 * the same picture. Randomness now enters in two places that matter — the order cards are
 * placed, and each card's preferred point — while `findFreeSpot` still guarantees no overlaps.
 */
function scatter(items: readonly Item[], rand: () => number): Layout {
  const layout: Layout = {}
  const taken: Rect[] = []
  const spread = Math.sqrt(items.reduce((a, i) => a + i.w * i.h, 0)) * 0.7

  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  for (const item of shuffled) {
    const prefer = { x: (rand() - 0.5) * spread * 2.2, y: (rand() - 0.5) * spread * 1.3 }
    const spot = findFreeSpot(item.w, item.h, prefer, taken)
    taken.push({ ...spot, w: item.w, h: item.h })
    layout[item.id] = { ...spot, rot: (rand() - 0.5) * 3.4 }
  }
  return centre(layout, items)
}

/** Deliberately messy: overlaps allowed, hard tilts, everything thrown at the wall. */
function chaos(items: readonly Item[], rand: () => number): Layout {
  const area = items.reduce((a, i) => a + i.w * i.h, 0)
  const span = Math.sqrt(area) * 1.9
  const layout: Layout = {}
  for (const item of items) {
    layout[item.id] = {
      x: (rand() - 0.5) * span * 1.5 - item.w / 2,
      y: (rand() - 0.5) * span - item.h / 2,
      rot: (rand() - 0.5) * 26,
    }
  }
  return centre(layout, items)
}

/** A single overlapping pile, like a deck fanned across a desk. */
function cascade(items: readonly Item[], rand: () => number): Layout {
  const layout: Layout = {}
  items.forEach((item, i) => {
    layout[item.id] = {
      x: i * 52 - item.w / 2,
      y: i * 46 - item.h / 2,
      rot: (rand() - 0.5) * 5,
    }
  })
  return centre(layout, items)
}

/**
 * Ring around whatever is first in the list — the hero, in practice.
 *
 * Radius comes from circumference, not from a guess. Each satellite is given an arc
 * proportional to its own width, and the ring is sized so those arcs sum to a full turn:
 * `r = Σ(width + gap) / 2π`. Because a chord is always shorter than its arc, that guarantees
 * neighbours clear each other without a fudge factor.
 *
 * A closed-form radius is not enough on its own, because the ellipse squash pulls neighbours
 * together and card heights vary — two formula-based attempts both left cards overlapping. So
 * the arc estimate sets the starting radius, and then each card is nudged straight outwards
 * until it clears everything already placed. That is guaranteed correct rather than
 * approximately correct, and it only pushes out where the ring is actually crowded.
 */
function ring(items: readonly Item[], rand: () => number): Layout {
  const [centreItem, ...rest] = items
  const layout: Layout = {}
  if (!centreItem) return layout
  layout[centreItem.id] = { x: -centreItem.w / 2, y: -centreItem.h / 2, rot: 0 }
  const n = rest.length
  if (!n) return centre(layout, items)

  const widths = rest.map((i) => i.w + GAP)
  const total = widths.reduce((a, w) => a + w, 0)

  // the ring must also clear the hero itself, on each axis
  const tallest = Math.max(...rest.map((i) => i.h))
  const rx = Math.max(total / (2 * Math.PI), centreItem.w / 2 + Math.max(...rest.map((i) => i.w)) / 2 + GAP)
  const ry = Math.max(rx * 0.78, centreItem.h / 2 + tallest / 2 + GAP)

  const placed: Rect[] = [{ x: -centreItem.w / 2, y: -centreItem.h / 2, w: centreItem.w, h: centreItem.h }]
  const hits = (box: Rect) =>
    placed.some((b) => {
      const g = GAP * 0.5
      return (
        box.x < b.x + b.w + g &&
        box.x + box.w + g > b.x &&
        box.y < b.y + b.h + g &&
        box.y + box.h + g > b.y
      )
    })

  let acc = 0
  rest.forEach((item, i) => {
    // sit each card at the MIDDLE of its own arc, so wide cards get wide berths
    const share = (widths[i] / total) * Math.PI * 2
    const a = acc + share / 2 - Math.PI / 2
    acc += share

    let box: Rect = { x: 0, y: 0, w: item.w, h: item.h }
    for (let k = 1; k <= 2.6; k += 0.05) {
      box = {
        x: Math.cos(a) * rx * k - item.w / 2,
        y: Math.sin(a) * ry * k - item.h / 2,
        w: item.w,
        h: item.h,
      }
      if (!hits(box)) break
    }
    placed.push(box)
    layout[item.id] = { x: box.x, y: box.y, rot: (rand() - 0.5) * 4 }
  })
  return centre(layout, items)
}

export const arrangements: readonly Arrangement[] = [
  { id: 'tidy', label: 'Tidy', hint: 'aligned rows, nothing tilted', run: (i) => tidy(i) },
  { id: 'scatter', label: 'Scatter', hint: 'random, never overlapping', run: scatter },
  { id: 'ring', label: 'Ring', hint: 'orbiting the hero', run: ring },
  { id: 'cascade', label: 'Cascade', hint: 'one fanned pile', run: cascade },
  { id: 'chaos', label: 'Chaos', hint: 'no rules at all', run: chaos },
]
