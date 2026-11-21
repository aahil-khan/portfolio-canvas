/*
 * prototype/lab/notebook/graph.js: the graph's layout, as a pure function. No DOM, no clock.
 * check.mjs runs it in Node; the React build runs the same code at build time (lib/lab/graph.ts)
 * and ships x, y only.
 *
 *   NB.graph.layout(nodes, edges, { seed }) → { pos: { key: [x, y] }, W, H }
 *     nodes [{ key, section, type }]   edges [{ a: key, b: key, kind }]
 *     seed  { key: [x, y] } (graph-seed.js): where each node was last time. A seeded node starts
 *           there and is tethered to it, so adding a note barely moves the others.
 *   .radial(center, list, w, h)       the local graph: the note in the middle, its neighbours round it
 *   .fit(pos, W, H, vw, vh, pad)      { s, x, y }: the transform that shows every node
 *   .R                                a node's radius, by type
 *   .fnv(text)                        the seed hash
 *
 * SETTLED, NOT LIVE. Section gravity wells at fixed anchors (Agent reliability gets the largest
 * share), link springs, O(n²) repulsion, 300 iterations, cooled, then a separation pass so no two
 * nodes overlap, then rounded to 0.1 px. Deterministic: plain arithmetic, no Math.random.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NB = (root_.NB = root_.NB || {})
  const W = 1200, H = 800
  const R = { hub: 9, build: 8, doc: 6, stage: 6.5, topic: 3.5, post: 6.5, walkthrough: 7, log: 4.5 }
  const ANCHOR = { 'agent-reliability': [430, 420], builds: [930, 250], writing: [950, 620], root: [700, 420], tours: [640, 180] }
  const SPREAD = { 'agent-reliability': 300, builds: 120, writing: 90, root: 40, tours: 60 }
  const LABELLED = ['hub', 'doc', 'build', 'post', 'walkthrough']
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h >>> 0 }
  const r1 = (v) => Math.round(v * 10) / 10

  function layout(nodes, edges, { seed = null, iterations = 300 } = {}) {
    const n = nodes.length
    const idx = new Map(nodes.map((d, i) => [d.key, i]))
    const x = new Float64Array(n), y = new Float64Array(n), r = nodes.map((d) => R[d.type] || 5)
    // a node that carries a title on the graph pushes harder, so the titles have room
    const wgt = nodes.map((d) => (LABELLED.includes(d.type) ? 1.9 : 1))
    const tether = new Float64Array(n), tx = new Float64Array(n), ty = new Float64Array(n)
    nodes.forEach((d, i) => {
      const s = seed && seed[d.key]
      if (s) { x[i] = tx[i] = s[0]; y[i] = ty[i] = s[1]; tether[i] = 0.12; return }
      const [ax, ay] = ANCHOR[d.section] || ANCHOR.root, sp = SPREAD[d.section] || 60, h = fnv(d.key)
      const ang = ((h & 0xffff) / 0x10000) * Math.PI * 2, dist = (((h >>> 16) & 0xffff) / 0x10000) * sp
      x[i] = ax + Math.cos(ang) * dist
      y[i] = ay + Math.sin(ang) * dist * 0.8
    })
    // a new node beside its first link, so it doesn't fly across
    if (seed) nodes.forEach((d, i) => {
      if (seed[d.key]) return
      const e = edges.find((e) => (e.a === d.key && seed[e.b]) || (e.b === d.key && seed[e.a]))
      if (e) { const o = seed[e.a === d.key ? e.b : e.a], h = fnv(d.key); x[i] = o[0] + 18 + (h % 7); y[i] = o[1] + 14 + ((h >>> 8) % 7) }
    })
    const E = edges.map((e) => [idx.get(e.a), idx.get(e.b), e.kind === 'tour' ? 0.01 : e.kind === 'typed' ? 0.03 : 0.04]).filter((e) => e[0] != null && e[1] != null)
    const deg = new Float64Array(n)
    for (const [a, b] of E) { deg[a]++; deg[b]++ }
    const fx = new Float64Array(n), fy = new Float64Array(n)
    // a warm start only settles: a short, cool run
    const iters = seed ? Math.min(iterations, 60) : iterations
    for (let it = 0; it < iters; it++) {
      const cool = seed ? 0.15 : 1 - it / iters
      fx.fill(0); fy.fill(0)
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let dx = x[i] - x[j], dy = y[i] - y[j], d2 = dx * dx + dy * dy
        if (d2 < 0.01) { dx = ((i * 7 + j * 13) % 11) / 10 - 0.5; dy = ((i * 3 + j * 5) % 9) / 9 - 0.5; d2 = dx * dx + dy * dy }
        if (d2 > 250000) continue
        const f = (900 * wgt[i] * wgt[j]) / d2, d = Math.sqrt(d2)
        fx[i] += (dx / d) * f; fy[i] += (dy / d) * f; fx[j] -= (dx / d) * f; fy[j] -= (dy / d) * f
      }
      for (const [a, b, k] of E) {
        const dx = x[b] - x[a], dy = y[b] - y[a], d = Math.sqrt(dx * dx + dy * dy) || 1, rest = 46 + r[a] + r[b]
        const f = (d - rest) * k
        fx[a] += (dx / d) * f; fy[a] += (dy / d) * f; fx[b] -= (dx / d) * f; fy[b] -= (dy / d) * f
      }
      for (let i = 0; i < n; i++) {
        const [ax, ay] = ANCHOR[nodes[i].section] || ANCHOR.root
        const g = 0.012 + 0.006 / (1 + deg[i])
        fx[i] += (ax - x[i]) * g; fy[i] += (ay - y[i]) * g
        if (tether[i]) { fx[i] += (tx[i] - x[i]) * tether[i]; fy[i] += (ty[i] - y[i]) * tether[i] }
        const m = Math.hypot(fx[i], fy[i]), cap = 12 * cool + 0.5
        const s = m > cap ? cap / m : 1
        x[i] += fx[i] * s; y[i] += fy[i] * s
        x[i] = Math.min(W - r[i] - 4, Math.max(r[i] + 4, x[i])); y[i] = Math.min(H - r[i] - 4, Math.max(r[i] + 4, y[i]))
      }
    }
    // separation: no two nodes closer than the sum of their radii plus a hair
    for (let pass = 0; pass < 60; pass++) {
      let moved = false
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = x[j] - x[i], dy = y[j] - y[i], d = Math.sqrt(dx * dx + dy * dy), min = r[i] + r[j] + 3
        if (d < min) {
          const ux = d ? dx / d : 1, uy = d ? dy / d : 0, push = (min - d) / 2 + 0.05
          x[i] -= ux * push; y[i] -= uy * push; x[j] += ux * push; y[j] += uy * push
          moved = true
        }
      }
      for (let i = 0; i < n; i++) { x[i] = Math.min(W - r[i] - 4, Math.max(r[i] + 4, x[i])); y[i] = Math.min(H - r[i] - 4, Math.max(r[i] + 4, y[i])) }
      if (!moved) break
    }
    const pos = {}
    nodes.forEach((d, i) => { pos[d.key] = [r1(x[i]), r1(y[i])] })
    return { pos, W, H }
  }

  // the local graph: the centre, then the first hop on a ring in list order, the second hop on an
  // outer ring next to whoever led to it
  function radial(list, w, h) {
    const cx = w / 2, cy = h / 2
    const one = list.filter((l) => l.hop === 1), two = list.filter((l) => l.hop === 2)
    const ring = Math.min(w, h) / 2 - 22, outer = Math.min(w, h) / 2 - 8
    const pos = [[cx, cy]]
    one.forEach((_, i) => { const a = -Math.PI / 2 + (i / Math.max(1, one.length)) * Math.PI * 2; pos.push([r1(cx + Math.cos(a) * ring * (w > h ? 1.6 : 1)), r1(cy + Math.sin(a) * ring)]) })
    two.forEach((_, i) => { const a = -Math.PI / 2 + ((i + 0.5) / Math.max(1, two.length)) * Math.PI * 2; pos.push([r1(cx + Math.cos(a) * outer * (w > h ? 1.75 : 1.05)), r1(cy + Math.sin(a) * outer)]) })
    return pos.map(([px, py]) => [Math.min(w - 8, Math.max(8, px)), Math.min(h - 8, Math.max(8, py))])
  }

  // labels hang to the right of their nodes: `label` world units of room on that side
  function fit(pos, vw, vh, pad = 24, label = 110) {
    const xs = Object.values(pos).map((p) => p[0]), ys = Object.values(pos).map((p) => p[1])
    const x0 = Math.min(...xs) - 14, x1 = Math.max(...xs) + label, y0 = Math.min(...ys) - 14, y1 = Math.max(...ys) + 14
    const s = Math.min((vw - pad * 2) / (x1 - x0), (vh - pad * 2) / (y1 - y0))
    return { s, x: (vw - (x1 - x0) * s) / 2 - x0 * s, y: (vh - (y1 - y0) * s) / 2 - y0 * s }
  }

  NB.graph = { layout, radial, fit, R, W, H, ANCHOR, LABELLED, fnv }
})()
