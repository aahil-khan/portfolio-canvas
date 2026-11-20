/*
 * prototype/lab/night-mode/labels.js: where the sky's words go, so none sits on another.
 *
 * Pure: boxes in, boxes out. No DOM, so it loads in Node (check.mjs runs it) and ports as is.
 *
 *   NIGHT.placeLabels(requests, { obstacles, bounds, gap })
 *     requests   [{ id, w, h, candidates: [{ x, y, side }], required }] in priority order.
 *                Each candidate is a top-left corner in screen px.
 *     obstacles  [{ x, y, w, h }] that nothing may cover: star marks, the night bar, the dock.
 *     bounds     { x, y, w, h } the screen, or omit. A candidate must fit inside it.
 *     → { [id]: { x, y, w, h, side } | null }
 *
 * Greedy, first fit, in the order given: a placed label becomes an obstacle for the rest. A
 * `required` label (a shelf or constellation name) that fits nowhere takes its first candidate
 * anyway, since the brief needs every constellation named; an optional one (a star's title)
 * is left out and shows when its star is focused. Deterministic: same input, same layout.
 *
 *   NIGHT.around(x, y, r, w, h)   the eight spots around a point, right first: the order a
 *                                 reader expects a star map's labels in.
 *   NIGHT.overlaps(boxes)          pairs that intersect, for the check and the console.
 */
;(() => {
  const root = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root.NIGHT = root.NIGHT || {})

  const hit = (a, b, gap = 0) =>
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
  const inside = (a, r) => !r || (a.x >= r.x && a.y >= r.y && a.x + a.w <= r.x + r.w && a.y + a.h <= r.y + r.h)

  NIGHT.around = (x, y, r, w, h) => {
    const d = r + 6, e = r * 0.72 + 4
    return [
      { x: x + d, y: y - h / 2, side: 'right' },
      { x: x - d - w, y: y - h / 2, side: 'left' },
      { x: x - w / 2, y: y + d - 2, side: 'below' },
      { x: x - w / 2, y: y - d + 2 - h, side: 'above' },
      { x: x + e, y: y - e - h, side: 'ne' },
      { x: x + e, y: y + e, side: 'se' },
      { x: x - e - w, y: y - e - h, side: 'nw' },
      { x: x - e - w, y: y + e, side: 'sw' },
    ]
  }

  NIGHT.placeLabels = (requests, { obstacles = [], bounds = null, gap = 3 } = {}) => {
    const taken = obstacles.slice(), out = {}
    for (const q of requests) {
      let pick = null
      for (const c of q.candidates) {
        const box = { x: c.x, y: c.y, w: q.w, h: q.h }
        if (inside(box, bounds) && !taken.some((o) => o.owner !== q.id && hit(box, o, gap))) { pick = { ...box, side: c.side }; break }
      }
      if (!pick && q.required && q.candidates.length) {
        const c = q.candidates[0]
        pick = { x: c.x, y: c.y, w: q.w, h: q.h, side: c.side, forced: true }
      }
      out[q.id] = pick
      if (pick) taken.push({ ...pick, owner: q.id })
    }
    return out
  }

  NIGHT.overlaps = (boxes, gap = 0) => {
    const list = Object.entries(boxes).filter(([, b]) => b), bad = []
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++)
        if (hit(list[i][1], list[j][1], gap)) bad.push([list[i][0], list[j][0]])
    return bad
  }
})()
