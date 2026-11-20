/*
 * prototype/lab/sky-beyond/logic.js: everything in the sky that is maths, not DOM.
 * Pure functions, no document access, so `check.mjs` runs them in Node and the React build can
 * port them as lib/lab/sky.ts. sky-beyond.js wires them to the desk.
 *
 *   SKYB.GEO                    the fixed geometry: desk island radii, the door, the sky's centre
 *   SKYB.skyPlacement(door)     → { centre, extent, radius } for LAB.layout. Derived from the
 *                               deep-space point alone, never from the data, so a new piece can
 *                               never shift the sky (append-stability survives the world map)
 *   SKYB.islandE(x, y)          elliptical radius of a world point: 1 = the cream core's edge
 *   SKYB.coverage(cam, w, h)    how much of the screen is still desk (0…1), sampled on a grid
 *   SKYB.ditherCell(x, y)       1 if the dissolve paints this cell cream (Bayer 8×8 + coastline)
 *   SKYB.starOrder(pieces, cons)   DOM / Tab order: shelf → constellation → date
 *   SKYB.placeLabels(labels, obstacles)   greedy, deterministic label collision (see below)
 *   SKYB.flight(a, b)           van Wijk & Nuij's smooth zoom-and-pan path between two views
 *   SKYB.fit(rect, vw, vh, pad) → { x, y, s } that frames a world rect under the chrome
 *   SKYB.when(piece)            the display date: `when`, else `date` as "Aug 2026"
 *   SKYB.indexGroups(pieces, shelves)   the index window's structure: shelf → kind → rows
 *   SKYB.truncate(text, n)      a word-boundary cut for star labels (the plate shows it whole)
 */
;(function (root) {
  const SKYB = {}

  // ── geometry (world px). The desk's hero is centred on 0,0 (shared/desk.js). ──────────
  const GEO = {
    desk: { x: 0, y: 0 },
    core: { rx: 2100, ry: 1400 }, // solid cream to here: the whole fitted desk sits well inside
    dissolve: 1.7, // the dithered edge runs from e = 1 to e = 1.7, then it is all sky
    cell: 12, // one dither square, in world px: 9px on a fitted desk, 2px fully zoomed out
    doorSize: { w: 420, h: 210 }, // the deep-space card (desk.js builds it 420 wide)
    skyRadius: 1300, // world radius reserved for the disc: a constant, never measured from stars
    skyGap: 260, // clear space between the door's centre and the disc's rim
    extent: 1200, // LAB.layout's extent: native 800 → 1.5 world px per layout unit
  }
  SKYB.GEO = GEO

  SKYB.skyPlacement = (door) => {
    const dc = { x: door.x + GEO.doorSize.w / 2, y: door.y + GEO.doorSize.h / 2 }
    const dx = dc.x - GEO.desk.x, dy = dc.y - GEO.desk.y, d = Math.hypot(dx, dy)
    const u = { x: dx / d, y: dy / d }, far = GEO.skyRadius + GEO.skyGap
    return { centre: { x: dc.x + u.x * far, y: dc.y + u.y * far }, extent: GEO.extent, radius: GEO.skyRadius, door: dc, dir: u }
  }

  SKYB.islandE = (x, y) => Math.hypot((x - GEO.desk.x) / GEO.core.rx, (y - GEO.desk.y) / GEO.core.ry)

  // 0 = the screen is all sky, 1 = all desk. A 6×6 grid of screen points is plenty.
  SKYB.coverage = (cam, w, h) => {
    let n = 0
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++) {
        const sx = ((i + 0.5) / 6) * w, sy = ((j + 0.5) / 6) * h
        if (SKYB.islandE((sx - cam.x) / cam.s, (sy - cam.y) / cam.s) < (1 + GEO.dissolve) / 2) n++
      }
    return n / 36
  }

  // One-bit dissolve. The threshold matrix is Bayer's (1973), the idea from the research gallery's
  // dithered moon (#4, after Surma's "Ditherpunk"). A little value noise bends the ellipse into a
  // coastline, so the edge reads as the desk thinning out, not as a vignette. Code ours.
  const BAYER = (() => {
    const m = [[0]]
    let b = m
    for (let n = 1; n < 8; n *= 2) {
      const next = []
      for (let y = 0; y < n * 2; y++) {
        next.push([])
        for (let x = 0; x < n * 2; x++) {
          const q = (y < n ? 0 : 2) + (x < n ? 0 : 1)
          next[y].push(4 * b[y % n][x % n] + [0, 2, 3, 1][q])
        }
      }
      b = next
    }
    return b
  })()
  const vhash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return s - Math.floor(s)
  }
  const vnoise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
    const a = vhash(ix, iy), b = vhash(ix + 1, iy), c = vhash(ix, iy + 1), d = vhash(ix + 1, iy + 1)
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
  }
  SKYB.ditherCell = (x, y) => {
    const e = SKYB.islandE(x, y)
    if (e < 0.92) return 1
    if (e > GEO.dissolve + 0.25) return 0
    const coast = (vnoise(x / 520, y / 520) - 0.5) * 0.26 + (vnoise(x / 170, y / 170) - 0.5) * 0.08
    const q = (e - 1 + coast) / (GEO.dissolve - 1) // 0 at the core's edge, 1 at the sky
    const density = 1 - Math.min(1, Math.max(0, q)) ** 0.8
    const cx = Math.floor(x / GEO.cell), cy = Math.floor(y / GEO.cell)
    const t = (BAYER[((cy % 8) + 8) % 8][((cx % 8) + 8) % 8] + 0.5) / 64
    return density > t ? 1 : 0
  }

  // shelf (in LAB.shelves order) → constellation (in LAB.constellations order, loose last) → date
  SKYB.starOrder = (pieces, cons, shelves) => {
    const S = (shelves || [{ id: 'notes' }, { id: 'playground' }]).map((s) => s.id)
    const K = Object.fromEntries((cons || []).map((c, i) => [c.id, i]))
    return pieces.map((p, i) => ({ p, i })).sort((a, b) =>
      S.indexOf(a.p.shelf) - S.indexOf(b.p.shelf) ||
      (K[a.p.constellation] ?? 99) - (K[b.p.constellation] ?? 99) ||
      (a.p.date < b.p.date ? -1 : a.p.date > b.p.date ? 1 : a.i - b.i)).map((o) => o.p)
  }

  /*
   * Label collision. Labels arrive in priority order, each with an anchor (screen px), a size,
   * a list of candidate offsets and whether it may be dropped. Each takes its first candidate
   * that stays clear of every obstacle (star marks, the door card) and every label already
   * placed. A droppable label with no clear spot is hidden; it comes back when zooming in gives
   * it room. A label that must show (a constellation name) takes its least-overlapping
   * candidate instead. The same input always gives the same answer.
   *   label    { id, x, y, w, h, cands: [{ dx, dy, align }], drop, owner }
   *            dx, dy = the box's top-left relative to the anchor
   *   obstacle { x, y, w, h, owner }   owner: a label ignores obstacles it owns (its own star)
   *   → { [id]: { dx, dy, show } }
   */
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  SKYB.placeLabels = (labels, obstacles, bounds) => {
    const placed = [], out = {}
    for (const l of labels) {
      let best = null
      for (const c of l.cands) {
        const box = { x: l.x + c.dx, y: l.y + c.dy, w: l.w, h: l.h }
        let cost = 0
        for (const o of obstacles) if (o.owner !== l.owner) cost += overlap(box, o)
        for (const p of placed) cost += overlap(box, p) * 2
        // off-screen counts as covered: a label you cannot see is no label
        if (bounds) cost += box.w * box.h - overlap(box, bounds)
        if (!best || cost < best.cost) best = { c, box, cost }
        if (cost === 0) break
      }
      const show = best.cost < 1 || !l.drop
      out[l.id] = { dx: best.c.dx, dy: best.c.dy, align: best.c.align, show }
      if (show) placed.push(best.box)
    }
    return out
  }
  // the eight spots around a mark of radius r, for a w×h box: right first, as star charts do
  SKYB.aroundMark = (r, w, h, gap = 6) => [
    { dx: r + gap, dy: -h / 2, align: 'start' },
    { dx: -r - gap - w, dy: -h / 2, align: 'end' },
    { dx: -w / 2, dy: r + gap, align: 'mid' },
    { dx: -w / 2, dy: -r - gap - h, align: 'mid' },
    { dx: r + gap - 2, dy: r - 2, align: 'start' },
    { dx: r + gap - 2, dy: -r - h + 2, align: 'start' },
    { dx: -r - gap - w + 2, dy: r - 2, align: 'end' },
    { dx: -r - gap - w + 2, dy: -r - h + 2, align: 'end' },
  ]

  /*
   * The sky's labels at one zoom, in priority order: the focused star's title, the constellation
   * names (kept unless the sky is a smudge), then star titles, projects and brighter stars first.
   * Everything is in screen px at scale s (world × s), so it is the same maths at any zoom.
   *   stars [{ slug, x, y, r, rp, w, h, isProject, date }]   x, y world; rp = mark radius in px
   *   cons  [{ id, box: { x0, y0, x1, y1 }, w, h }]          box = the members' world extent
   *   → placeLabels' answer, keyed by slug and 'con:' + id
   */
  SKYB.skyLabels = ({ stars, cons, s, bounds, tiny, focus, focusLabel = true, obstacles = [] }) => {
    const obs = stars.map((t) => ({ x: t.x * s - t.rp - 2, y: t.y * s - t.rp - 2, w: t.rp * 2 + 4, h: t.rp * 2 + 4, owner: t.slug })).concat(obstacles)
    const labels = []
    const f = focus && stars.find((t) => t.slug === focus)
    if (f && focusLabel) labels.push({ id: f.slug, owner: f.slug, x: f.x * s, y: f.y * s, w: f.w, h: f.h, cands: SKYB.aroundMark(f.rp + 4, f.w, f.h), drop: false })
    if (!tiny) for (const c of cons) {
      const x = ((c.box.x0 + c.box.x1) / 2) * s, y = ((c.box.y0 + c.box.y1) / 2) * s
      const hw = ((c.box.x1 - c.box.x0) / 2) * s + 10, hh = ((c.box.y1 - c.box.y0) / 2) * s + 10
      labels.push({ id: 'con:' + c.id, owner: '', x, y, w: c.w, h: c.h, drop: false, cands: [
        { dx: -c.w / 2, dy: -hh - c.h - 4 }, { dx: -c.w / 2, dy: hh + 4 },
        { dx: hw + 6, dy: -c.h / 2 }, { dx: -hw - 6 - c.w, dy: -c.h / 2 },
        { dx: -c.w / 2, dy: -hh - c.h - 22 }, { dx: -c.w / 2, dy: hh + 22 },
        { dx: hw - 4, dy: -hh - c.h }, { dx: -hw - c.w + 4, dy: hh },
      ] })
    }
    if (!tiny) {
      const rank = stars.filter((t) => t.slug !== focus)
        .sort((a, b) => (b.isProject ? 1 : 0) - (a.isProject ? 1 : 0) || b.r - a.r || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      for (const t of rank) labels.push({ id: t.slug, owner: t.slug, x: t.x * s, y: t.y * s, w: t.w, h: t.h, cands: SKYB.aroundMark(t.rp + 1, t.w, t.h), drop: true })
    }
    return SKYB.placeLabels(labels, obs, bounds)
  }

  /*
   * Flights: van Wijk & Nuij, "Smooth and efficient zooming and panning" (InfoVis 2003). The
   * camera zooms out as far as the distance needs and back in, along the path a viewer reads as
   * shortest. a, b = { cx, cy, w } (world centre and visible width). Returns { S, at(u) } where
   * u ∈ [0, 1] and S is the path length (in log-width units), which sets the duration.
   */
  SKYB.flight = (a, b, rho = 1.4) => {
    const dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy), w0 = a.w, w1 = b.w
    const r2 = rho * rho, r4 = r2 * r2
    if (d < 1e-6) {
      const S = Math.abs(Math.log(w1 / w0)) / rho
      return { S, at: (u) => ({ cx: a.cx, cy: a.cy, w: w0 * Math.exp(rho * u * S * Math.sign(w1 - w0 || 1)) }) }
    }
    const b0 = (w1 * w1 - w0 * w0 + r4 * d * d) / (2 * w0 * r2 * d)
    const b1 = (w1 * w1 - w0 * w0 - r4 * d * d) / (2 * w1 * r2 * d)
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1)
    const S = (r1 - r0) / rho
    return {
      S,
      at(u) {
        const s = u * S, c0 = Math.cosh(r0)
        const k = (w0 / (r2 * d)) * (c0 * Math.tanh(rho * s + r0) - Math.sinh(r0))
        return { cx: a.cx + dx * k, cy: a.cy + dy * k, w: (w0 * c0) / Math.cosh(rho * s + r0) }
      },
    }
  }

  // a star's mark radius in screen px, from layout.js's data-derived size
  SKYB.markR = (r) => 2.6 + (r / (GEO.extent / 800)) * 0.52

  // the chrome each screen keeps clear: the pill and sky bar above, the dock below
  SKYB.chrome = (vw) => (vw < 700 ? { top: 142, bottom: 80, side: 8, labelTop: 150, labelBottom: 84 } : { top: 136, bottom: 120, side: 40, labelTop: 128, labelBottom: 112 })
  // the sky, fitted: the disc, plus the door on a wide screen (a phone keeps the stars bigger)
  SKYB.skyFit = ({ centre, rimR, door, vw, vh }) => {
    const R = rimR + 40, phone = vw < 700
    let r = { x: centre.x - R, y: centre.y - R, w: R * 2, h: R * 2 }
    if (!phone && door) {
      const x0 = Math.min(r.x, door.x), y1 = Math.max(r.y + r.h, door.y + door.h)
      r = { x: x0, y: r.y, w: r.x + r.w - x0, h: y1 - r.y }
    }
    return SKYB.fit(r, vw, vh, phone ? { top: 108, bottom: 78, side: 10 } : { top: 120, bottom: 120, side: 40 })
  }
  // the screen, in labels' px-at-this-zoom space (world × s), minus the chrome
  SKYB.labelBounds = (cam, vw, vh) => {
    const c = SKYB.chrome(vw)
    return { x: -cam.x + 8, y: -cam.y + c.labelTop, w: vw - 16, h: vh - c.labelTop - c.labelBottom }
  }

  SKYB.fit = (r, vw, vh, pad = {}) => {
    const t = pad.top ?? 80, btm = pad.bottom ?? 130, side = pad.side ?? 24
    const s = Math.min(pad.max ?? 1, (vw - side * 2) / r.w, (vh - t - btm) / r.h)
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - (t - btm) / 2 / s
    return { cx, cy, s }
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  SKYB.when = (p) => p.when || (/^\d{4}-\d{2}$/.test(p.date || '') ? MONTHS[+p.date.slice(5) - 1] + ' ' + p.date.slice(0, 4) : '')

  SKYB.truncate = (t, n = 24) => {
    if (t.length <= n) return t
    const cut = t.lastIndexOf(' ', n - 1)
    return t.slice(0, cut > 8 ? cut : n - 1).replace(/[\s,.:;–-]+$/, '') + '…'
  }

  // shelf → kind → rows, newest first, pinned first. Kinds keep the order they first appear in.
  SKYB.indexGroups = (pieces, shelves) => shelves.map((s) => {
    const mine = pieces.filter((p) => p.shelf === s.id)
    const kinds = [...new Set(mine.map((p) => p.kind))]
    return {
      shelf: s,
      count: mine.length,
      kinds: kinds.map((k) => ({
        kind: k,
        rows: mine.filter((p) => p.kind === k).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
      })),
    }
  })

  root.SKYB = SKYB
  if (typeof module === 'object' && module.exports) module.exports = SKYB
})(typeof window !== 'undefined' ? window : globalThis)
