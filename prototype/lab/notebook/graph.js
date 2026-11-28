/*
 * prototype/lab/notebook/graph.js: the graph's layout, as a pure function. No DOM, no clock.
 * check.mjs runs it in Node; the React build runs the same code at build time (lib/lab/graph.ts)
 * and ships x, y only.
 *
 *   NB.graph.layout(nodes, edges, { seed }) → { pos: { key: [x, y] }, W, H }
 *     nodes [{ key, section, type, r? }]   edges [{ a: key, b: key, kind }]
 *     seed  { key: [x, y] } (graph-seed.js): where each node was last time. A seeded node starts
 *           there and is tethered to it, so adding a note barely moves the others.
 *   .view(notes, edges, expanded)     what the map draws: the study topics grouped into one node per
 *                                     track ('track:<folder>'), except the tracks in `expanded` (a Set)
 *   .seedTopics(pos, groups)          a topic's seat round its track, for the warm start on expanding
 *   .wrap(text, 24)                   a label as at most 2 lines of 24 characters
 *   .place(items, discs)              labels that fit: each tries right, left, below, above, else hides
 *   .fit(pos, vw, vh, pad)            { s, x, y }: the transform that shows every node
 *   .R / .radius(node)                a node's radius, by type (a track's by its topic count)
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
  const R = { hub: 9, build: 8, doc: 6, stage: 6.5, topic: 4.5, post: 6.5, walkthrough: 7, log: 4.5, track: 9 }
  const radius = (d) => d.r || R[d.type] || 5
  const ANCHOR = { 'agent-reliability': [470, 430], builds: [850, 190], writing: [850, 680], root: [690, 430], tours: [640, 170] }
  const SPREAD = { 'agent-reliability': 300, builds: 120, writing: 90, root: 40, tours: 60 }
  const LABELLED = ['hub', 'doc', 'build', 'post', 'walkthrough', 'track', 'stage']
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h >>> 0 }
  const r1 = (v) => Math.round(v * 10) / 10

  function layout(nodes, edges, { seed = null, iterations = 300 } = {}) {
    const n = nodes.length
    const idx = new Map(nodes.map((d, i) => [d.key, i]))
    const x = new Float64Array(n), y = new Float64Array(n), r = nodes.map((d) => d.r || R[d.type] || 5)
    // a node that carries a title on the graph pushes harder, so the titles have room
    const wgt = nodes.map((d) => (LABELLED.includes(d.type) ? 3.2 : 1.2))
    const tether = new Float64Array(n), tx = new Float64Array(n), ty = new Float64Array(n)
    nodes.forEach((d, i) => {
      const s = seed && seed[d.key]
      if (s) { x[i] = tx[i] = s[0]; y[i] = ty[i] = s[1]; tether[i] = 0.3; return }
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
        const dx = x[b] - x[a], dy = y[b] - y[a], d = Math.sqrt(dx * dx + dy * dy) || 1, rest = 70 + r[a] + r[b]
        const f = (d - rest) * k
        fx[a] += (dx / d) * f; fy[a] += (dy / d) * f; fx[b] -= (dx / d) * f; fy[b] -= (dy / d) * f
      }
      for (let i = 0; i < n; i++) {
        const [ax, ay] = ANCHOR[nodes[i].section] || ANCHOR.root
        const g = 0.012 + 0.006 / (1 + deg[i])
        fx[i] += (ax - x[i]) * g * 1.5; fy[i] += (ay - y[i]) * g * 0.75
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

  // ── the map's nodes: a study track is one node until it is expanded ───────────────────
  // notes [{ route, section, type, folder }]; a track is a folder of ≥ 2 topics. Edges to a
  // collapsed topic go to its track; duplicates and self-loops go.
  function view(notes, edges, expanded = new Set()) {
    // a note kept out of the tree (the glossary, `tree: false`) is kept off the map too
    notes = notes.filter((n) => !n.fm || n.fm.tree !== false)
    const byFolder = new Map()
    for (const n of notes) if (n.type === 'topic') { const g = byFolder.get(n.folder) || []; g.push(n); byFolder.set(n.folder, g) }
    const groups = [...byFolder].filter(([, g]) => g.length >= 2).map(([folder, g]) => ({ key: `track:${folder}`, folder, topics: g, open: expanded.has(`track:${folder}`) }))
    const into = new Map()
    for (const t of groups) if (!t.open) for (const n of t.topics) into.set(n.route, t.key)
    const nodes = []
    for (const n of notes) { if (!into.has(n.route)) nodes.push({ key: n.route, section: n.section, type: n.type }) }
    for (const t of groups) nodes.push({ key: t.key, section: t.topics[0].section, type: 'track', r: r1(5 + 1.6 * Math.sqrt(t.topics.length)), track: t })
    const seen = new Map(), out = [], keep = new Set(notes.map((n) => n.route))
    for (const e of edges) {
      if (!keep.has(e.a) || !keep.has(e.b)) continue
      const a = into.get(e.a) || e.a, b = into.get(e.b) || e.b
      if (a === b) continue
      const k = a < b ? `${a}|${b}` : `${b}|${a}`
      // a pair drawn once; a real link between them beats a tour step
      if (seen.has(k)) { const o = seen.get(k); if (o.kind === 'tour' && e.kind !== 'tour') o.kind = e.kind; continue }
      const o = { a, b, kind: e.kind }
      seen.set(k, o); out.push(o)
    }
    // an open track keeps a spoke to each of its topics, so the group reads as one
    for (const t of groups) if (t.open) for (const n of t.topics) out.push({ a: t.key, b: n.route, kind: 'track' })
    return { nodes, edges: out, groups }
  }
  // a topic's seat round its track: an arc on the side away from the centre of the world
  function seedTopics(pos, groups) {
    const seed = {}
    for (const t of groups) {
      const c = pos[t.key]
      if (!c) continue
      const n = t.topics.length, ring = 60 + n * 9
      const base = Math.atan2(c[1] - H / 2, c[0] - W / 2)
      t.topics.forEach((x, i) => { const a = base + ((i - (n - 1) / 2) / Math.max(1, n)) * Math.PI * 1.6; seed[x.route] = [r1(c[0] + Math.cos(a) * ring), r1(c[1] + Math.sin(a) * ring)] })
    }
    return seed
  }

  // ── labels ────────────────────────────────────────────────────────────────────────────
  // at most `lines` lines of `max` characters, broken at spaces; a longer title ends in …
  function wrap(text, max = 24, lines = 2) {
    const words = String(text).split(/\s+/).filter(Boolean), out = []
    let cur = ''
    for (const w of words) {
      if (!cur) cur = w
      else if ((cur + ' ' + w).length <= max) cur += ' ' + w
      else { out.push(cur); cur = w }
    }
    if (cur) out.push(cur)
    const cut = (l) => (l.length > max ? l.slice(0, max - 1) + '…' : l)
    if (out.length > lines) { const keep = out.slice(0, lines).map(cut); const l = keep[lines - 1]; keep[lines - 1] = (l.length >= max ? l.slice(0, max - 1) : l) + '…'; return keep }
    return out.map(cut)
  }
  // items [{ key, x, y, r, w, h, fixed? }] in priority order; discs [{ x, y, r }] every node.
  // Each label tries its node's right, left, below and above, and takes the first spot that hits
  // no placed label and no node; a label with no room is hidden (it shows on hover and focus).
  // Everything is in world units, so the answer holds at every zoom.
  // frame { x0, y0, x1, y1 }: a label must stay inside it (the nodes' extent and a margin), so a
  // label never widens the map, and the fit, by hanging off its edge
  function place(items, discs, gap = 3, frame = null) {
    const boxes = [], res = {}
    const out = (b) => frame && (b.x < frame.x0 || b.y < frame.y0 || b.x + b.w > frame.x1 || b.y + b.h > frame.y1)
    const hit = (b) => out(b) || boxes.some((o) => b.x < o.x + o.w + gap && o.x < b.x + b.w + gap && b.y < o.y + o.h + gap && o.y < b.y + b.h + gap)
      || discs.some((d) => { const cx = Math.max(b.x, Math.min(d.x, b.x + b.w)), cy = Math.max(b.y, Math.min(d.y, b.y + b.h)); return Math.hypot(cx - d.x, cy - d.y) < d.r + 1.5 })
    for (const it of items) {
      const p = it.r + 4
      // a label first tries the side that faces the middle of the world, so the map stays compact
      const R_ = [[it.x + p, it.y - it.h / 2], [it.x + p, it.y - it.h + 2], [it.x + p, it.y - 2]], L_ = [[it.x - p - it.w, it.y - it.h / 2], [it.x - p - it.w, it.y - it.h + 2], [it.x - p - it.w, it.y - 2]]
      const V_ = [[it.x - it.w / 2, it.y + p], [it.x - it.w / 2, it.y - p - it.h]]
      const spots = it.spots ? it.spots : it.fixed ? [[it.x, it.y]] : it.x > W / 2 ? [L_[0], R_[0], ...V_, L_[1], L_[2], R_[1], R_[2]] : [R_[0], L_[0], ...V_, R_[1], R_[2], L_[1], L_[2]]
      const at = spots.map(([x, y]) => ({ x, y, w: it.w, h: it.h })).find((bx) => it.fixed || !hit(bx)) || (it.spots && { x: it.spots[0][0], y: it.spots[0][1], w: it.w, h: it.h })
      if (at) { boxes.push(at); res[it.key] = { x: r1(at.x), y: r1(at.y), shown: true } }
      else res[it.key] = { x: r1(it.x + p), y: r1(it.y - it.h / 2), shown: false }
    }
    return res
  }

  // labels hang to the right of their nodes: `label` world units of room on that side
  function fit(pos, vw, vh, pad = 24, label = 110) {
    const xs = Object.values(pos).map((p) => p[0]), ys = Object.values(pos).map((p) => p[1])
    const x0 = Math.min(...xs) - 14, x1 = Math.max(...xs) + label, y0 = Math.min(...ys) - 14, y1 = Math.max(...ys) + 14
    const s = Math.min((vw - pad * 2) / (x1 - x0), (vh - pad * 2) / (y1 - y0))
    return { s, x: (vw - (x1 - x0) * s) / 2 - x0 * s, y: (vh - (y1 - y0) * s) / 2 - y0 * s }
  }

  // the map's labels: who keeps a label when two want the same room. An expanded track's topics
  // outrank everything (the reader asked for them), then overviews, tracks, entries, stages.
  // lines(node) → the label's lines; F the font size in world units; cw a character's width in em
  // (a generous estimate for Space Grotesk, so a real label never runs past its box)
  const PRI = { hub: 5, track: 4, build: 3, post: 3, doc: 3, walkthrough: 3, stage: 2, topic: 1, log: 1 }
  // regions [{ key, text, section }]: a section's name, over (else under) its nodes, placed first
  // measure(line, size) → its width in world units (the browser's real metrics); else an estimate
  function labels(nodes, pos, lines, { F = 14, cw = 0.6, lh = 1.2, open = new Set(), regions = [], RF = 20, margin = 60, measure = null } = {}) {
    const width = (l, size, k) => (measure ? measure(l, size) * 1.04 + 2 : l.length * size * k)
    const topicOf = new Map()
    for (const n of nodes) if (n.type === 'track' && n.track && open.has(n.key)) for (const t of n.track.topics) topicOf.set(t.route, true)
    const items = nodes.map((n, i) => {
      const ls = lines(n), [x, y] = pos[n.key]
      return { key: n.key, x, y, r: radius(n), w: Math.max(...ls.map((l) => width(l, F, cw))), h: ls.length * F * lh, pri: n.type === 'track' && open.has(n.key) ? 7 : topicOf.has(n.key) ? 6 : PRI[n.type] || 1, i, lines: ls }
    }).sort((a, b) => b.pri - a.pri || a.i - b.i)
    const regs = regions.map((g) => {
      const ps = nodes.filter((n) => n.section === g.section).map((n) => pos[n.key])
      const x0 = Math.min(...ps.map((p) => p[0])), x1 = Math.max(...ps.map((p) => p[0])), y0 = Math.min(...ps.map((p) => p[1])), y1 = Math.max(...ps.map((p) => p[1]))
      const w = width(g.text, RF, 0.62), h = RF * lh, cx = (x0 + x1) / 2 - w / 2
      return { key: g.key, w, h, r: 0, lines: [g.text], region: true, spots: [[cx, y0 - h - 22], [x0 - 10, y0 - h - 22], [cx, y1 + 26], [x1 - w + 10, y0 - h - 22]] }
    })
    const all = [...regs, ...items]
    const ps = nodes.map((n) => pos[n.key]), m = margin
    const frame = { x0: Math.min(...ps.map((p) => p[0])) - m, y0: Math.min(...ps.map((p) => p[1])) - m - RF * lh, x1: Math.max(...ps.map((p) => p[0])) + m, y1: Math.max(...ps.map((p) => p[1])) + m }
    const at = place(all, nodes.map((n) => ({ x: pos[n.key][0], y: pos[n.key][1], r: radius(n) })), 3, frame)
    return Object.fromEntries(all.map((it) => [it.key, { ...at[it.key], lines: it.lines, w: it.w, h: it.h, region: !!it.region }]))
  }

  // the label size, in world units, that is at least `px` on screen once the map is fitted to a
  // vw × vh view: a narrow window gets bigger world labels (and more of them hide), never small ones
  function labelSize(nodes, pos, vw, vh, { px = 13.5, pad = 20, lh = 1.2 } = {}) {
    const ps = nodes.map((n) => pos[n.key]), nw = Math.max(...ps.map((p) => p[0])) - Math.min(...ps.map((p) => p[0])), nh = Math.max(...ps.map((p) => p[1])) - Math.min(...ps.map((p) => p[1]))
    let F = 14
    for (let i = 0; i < 5; i++) { const m = (60 * F) / 14, s = Math.min((vw - pad * 2) / (nw + 2 * m), (vh - pad * 2) / (nh + 2 * m + 1.43 * F * lh)); F = Math.max(14, Math.min(40, px / s)) }
    F = Math.ceil(F * 2) / 2
    return { F, margin: Math.round((60 * F) / 14) }
  }

  NB.graph = { layout, view, labels, labelSize, seedTopics, wrap, place, fit, R, radius, W, H, ANCHOR, LABELLED, fnv }
})()
