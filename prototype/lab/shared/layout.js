/*
 * prototype/lab/shared/layout.js: where every star goes, computed, never typed.
 *
 *   LAB.layout(pieces, { shape: 'horizon' | 'islands' | 'disc' })
 *     → { stars: { [slug]: { x, y, r } }, lines: [{ from, to, kind: 'link' | 'figure' }],
 *         anchors: [{ constellation, shelf, x, y }], frame, bounds: { x, y, w, h } }
 *
 * World units are arbitrary; a view scales `bounds` to fit. In order:
 *   1. Each shelf has a region. `horizon`: notes above a line, playground below. `islands`:
 *      notes left, playground right. `disc`: one circle that both shelves share.
 *   2. Constellation k (its index in LAB.constellations) owns slot k in every region. A slot
 *      depends on k alone, never on what else exists, so it never moves.
 *   3. Members sit on a sunflower around their slot in date order: r ∝ √i, θ = i·137.5°.
 *      A newer piece takes the next index, so it lands outside the ones already there.
 *   4. Loose stars (no constellation) start at a point hashed from their slug and probe outward
 *      in rings for a spot clear of every slot and every earlier loose star (findFreeSpot's
 *      idea). They avoid slots, not members, so a member added later can never displace one.
 *   5. Size comes from data: project, then kind, then link count.
 *   Lines: explicit `links`, plus faint `figure` lines chaining each constellation by date.
 *
 * Append-stable: adding a piece dated on or after its neighbours moves no existing star, in any
 * shape. Two edits can move stars, both deliberate and local: back-dating a piece shifts the
 * later members of its own constellation, and adding a constellation may nudge loose stars.
 * No physics, no library, deterministic: the React build ports this as lib/lab/layout.ts.
 */
;(() => {
  const LAB = (window.LAB = window.LAB || {})
  const GOLDEN = (137.5 * Math.PI) / 180
  const sunflower = (c, sx, sy) => (reg, k) => ({
    x: reg.cx + Math.cos(k * GOLDEN) * c * Math.sqrt(k) * sx,
    y: reg.cy + Math.sin(k * GOLDEN) * c * Math.sqrt(k) * sy,
  })

  const SHAPES = {
    horizon: {
      frame: { horizonY: 720 },
      regions: {
        notes: { cx: 0, cy: 340, spread: [760, 220], inside: (x, y) => y >= 0 && y <= 640 },
        playground: { cx: 0, cy: 960, spread: [720, 150], inside: (x, y) => y >= 800 && y <= 1200 },
      },
      // outward from the middle along each band: 0, +1, −1, +2, −2 …
      slot: (reg, k) => {
        const d = k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) : 0
        return { x: reg.cx + d * 440, y: reg.cy + (k % 2 ? -50 : 50) }
      },
      spiral: [88, 1, 0.8], reserve: 150,
    },
    islands: {
      frame: { divideX: 0 },
      regions: {
        notes: { cx: -800, cy: 0, spread: [340, 480], inside: (x) => x <= -130 },
        playground: { cx: 800, cy: 0, spread: [340, 480], inside: (x) => x >= 130 },
      },
      slot: sunflower(260, 0.8, 1), spiral: [88, 1, 1], reserve: 170,
    },
    disc: {
      frame: { cx: 0, cy: 0 },
      shared: true, // one sky for both shelves: shape and hue tell them apart, not position
      regions: { all: { cx: 0, cy: 0, spread: [560, 560], inside: () => true } },
      slot: sunflower(290, 1, 1), spiral: [88, 1, 1], reserve: 170,
    },
  }
  const SIZE = { 'write-up': 7, essay: 7, experiment: 6, found: 5.5, scrap: 5 }

  const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0
  // lib/canvas/geometry.ts makeRandom, verbatim
  const makeRandom = (seed) => {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  LAB.layout = (pieces, opts = {}) => {
    const shape = opts.shape || 'horizon', S = SHAPES[shape]
    if (!S) throw new Error('unknown shape ' + shape)
    const cons = LAB.constellations || [], K = {}
    cons.forEach((c, k) => (K[c.id] = k))
    const regionOf = (p) => (S.shared ? 'all' : p.shelf === 'playground' ? 'playground' : 'notes')
    // date order, ties broken by position in the file, so appending never reorders anyone
    const order = pieces.map((p, i) => ({ p, i }))
      .sort((a, b) => (a.p.date < b.p.date ? -1 : a.p.date > b.p.date ? 1 : a.i - b.i)).map((o) => o.p)

    const degree = {}
    for (const p of pieces) for (const s of p.links || []) for (const e of [p.slug, s]) degree[e] = (degree[e] || 0) + 1
    const size = (p) => (p.isProject ? 10 : SIZE[p.kind] || 5) + Math.min(degree[p.slug] || 0, 4) * 0.75

    const stars = {}, groups = {}, anchors = [], loose = []
    for (const p of order) {
      const k = K[p.constellation]
      if (k === undefined) { loose.push(p); continue }
      const key = regionOf(p) + '/' + p.constellation
      const g = groups[key] || (groups[key] = { n: 0, at: S.slot(S.regions[regionOf(p)], k) })
      if (!g.n) anchors.push({ constellation: p.constellation, shelf: S.shared ? null : p.shelf, ...g.at })
      const r = S.spiral[0] * Math.sqrt(g.n), a = g.n * GOLDEN + k * 1.1
      stars[p.slug] = { x: g.at.x + Math.cos(a) * r * S.spiral[1], y: g.at.y + Math.sin(a) * r * S.spiral[2], r: size(p) }
      g.n++
    }

    // every slot is reserved in every region, used or not, so a new cluster never lands on a loose star
    const reserved = Object.values(S.regions).flatMap((reg) => cons.map((c, k) => S.slot(reg, k)))
    const placed = []
    const clear = (reg, x, y) => reg.inside(x, y) &&
      reserved.every((s) => Math.hypot(x - s.x, y - s.y) >= S.reserve) &&
      placed.every((s) => Math.hypot(x - s.x, y - s.y) >= 110)
    for (const p of loose) {
      const reg = S.regions[regionOf(p)], rand = makeRandom(hash(p.slug))
      const x0 = reg.cx + (rand() * 2 - 1) * reg.spread[0], y0 = reg.cy + (rand() * 2 - 1) * reg.spread[1]
      let x = x0, y = y0
      search: for (let ring = 1; !clear(reg, x, y) && ring <= 80; ring++) {
        for (let i = 0, n = 8 + ring * 4; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + ring * 0.7
          x = x0 + Math.cos(a) * ring * 30
          y = y0 + Math.sin(a) * ring * 30
          if (clear(reg, x, y)) break search
        }
      }
      placed.push({ x, y })
      stars[p.slug] = { x, y, r: size(p) }
    }

    const lines = [], seen = new Set()
    const add = (from, to, kind) => {
      const id = [from, to].sort().join('|')
      if (seen.has(id) || !stars[from] || !stars[to] || from === to) return
      seen.add(id)
      lines.push({ from, to, kind })
    }
    for (const p of pieces) for (const s of p.links || []) add(p.slug, s, 'link')
    for (const c of cons) {
      const m = order.filter((p) => p.constellation === c.id)
      for (let i = 1; i < m.length; i++) add(m[i - 1].slug, m[i].slug, 'figure')
    }

    const all = Object.values(stars), pad = 90
    const xs = all.map((s) => s.x), ys = all.map((s) => s.y)
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, frame = { shape, ...S.frame }
    if (shape === 'disc') frame.r = Math.max(...all.map((s) => Math.hypot(s.x, s.y))) + pad
    return { stars, lines, anchors, frame, bounds: { x: x0, y: y0, w: Math.max(...xs) + pad - x0, h: Math.max(...ys) + pad - y0 } }
  }
  LAB.layout.shapes = Object.keys(SHAPES)
})()
