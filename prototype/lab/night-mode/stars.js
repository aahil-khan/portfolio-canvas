/*
 * prototype/lab/night-mode/stars.js: the night sky, drawn into the desk's own world.
 *
 * Needs ../shared/{pieces,layout,sky}.js and labels.js. No coordinates are typed here: every
 * star comes from LAB.layout(LAB.pieces, { shape: 'islands', centre, extent }), centred on the
 * desk (the hero sits at world 0,0), so the sky is in the same world the cards were in.
 *
 * Pure (no DOM; check.mjs runs these in Node):
 *   NIGHT.sky.geometry(pieces, portrait)   the layout, transposed on a portrait screen
 *   NIGHT.sky.model(geo, pieces)           stars, lines, shelf and constellation names, in
 *                                          shelf → constellation → date order (the Tab order)
 *   NIGHT.sky.planLabels(model, cam, { sizeOf, obstacles, viewport })
 *                                          where every word goes for a camera, collision-free
 * DOM:
 *   NIGHT.sky.mount(layer)      build the containers inside a DESK.addLayer() layer
 *   NIGHT.sky.render()          (re)place every star from LAB.pieces. window.renderSky calls it.
 *                               The camera is left alone, so a re-render can't fake stability.
 *   NIGHT.sky.fit()             { cx, cy, s }: the camera that fits the sky between bar and dock
 *   NIGHT.sky.frame(cam)        per camera frame: keeps marks and words at screen size
 *   NIGHT.sky.relabel(cam?)     lays the words out for the live camera, or one a flight will reach
 *   NIGHT.sky.filter(shelf)     null | 'notes' | 'playground': dims the other half, never removes it
 *   NIGHT.sky.focus(slug)       brightens a star, its lines and neighbours; dims the rest
 *   NIGHT.sky.onPick            set by night.js: called with a slug when a star is chosen
 *
 * Orientation: the islands shape puts Notes & write-ups left and Playground right. On a portrait
 * screen the whole layout is transposed (x ↔ y), so the shelves stack top and bottom and the sky
 * fills a phone instead of a 230px strip of it. A pure function of the layout's output, so it is
 * just as append-stable.
 *
 * Marks and words are counter-scaled (scale(1/s), --inv, written once per camera frame), so
 * stars keep 28px (44px on touch) hit areas and 12px labels at every zoom, as on a real map.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  const LABS = () => root_.LAB
  const CENTRE = { x: 0, y: 0 }, EXTENT = 1100
  const NS = 'http://www.w3.org/2000/svg'
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const sv = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e }
  const conName = (id) => ((LABS().constellations || []).find((c) => c.id === id) || { name: id }).name

  const sky = (NIGHT.sky = { stars: {}, list: [], lines: [], names: [], shelves: [], geo: null, shelf: null, focused: null })
  let root, linesSvg, wordsEl, starsEl, ringsEl, lastLabelScale = 0

  // ── pure ────────────────────────────────────────────────────────────────────────────────
  sky.geometry = (pieces, portrait) => {
    const g = LABS().layout(pieces, { shape: 'islands', centre: CENTRE, extent: EXTENT })
    g.portrait = !!portrait
    if (g.portrait) {
      const T = (p) => { const x = p.x; p.x = CENTRE.x + (p.y - CENTRE.y); p.y = CENTRE.y + (x - CENTRE.x) }
      for (const s of Object.values(g.stars)) T(s)
      for (const a of g.anchors) T(a)
      g.bounds = { x: CENTRE.x + (g.bounds.y - CENTRE.y), y: CENTRE.y + (g.bounds.x - CENTRE.x), w: g.bounds.h, h: g.bounds.w }
    }
    // The open sky between the halves' facing edges: the seam and the moon go there. Decoration
    // only, so it may shift when a piece lands near the gap; no star does.
    const axis = g.portrait ? 'y' : 'x', of = (shelf) => pieces.filter((p) => p.shelf === shelf && g.stars[p.slug]).map((p) => g.stars[p.slug][axis])
    const n = of('notes'), pg = of('playground')
    g.gap = n.length && pg.length ? (Math.max(...n) + Math.min(...pg)) / 2 : g.frame.divideX
    return g
  }

  // screen radius of a star's mark, from the layout's data-derived size (kind, links, project)
  const markR = (g, s) => 4 + (s.r / g.scale) * 0.9

  sky.model = (g, pieces) => {
    const K = Object.fromEntries((LABS().constellations || []).map((c, i) => [c.id, i]))
    const S = { notes: 0, playground: 1 }
    const byDate = (a, b) => (a.p.date < b.p.date ? -1 : a.p.date > b.p.date ? 1 : a.i - b.i)
    const ix = pieces.map((p, i) => ({ p, i }))
    const ordered = ix.slice().sort((a, b) => (S[a.p.shelf] - S[b.p.shelf]) || ((K[a.p.constellation] ?? 99) - (K[b.p.constellation] ?? 99)) || byDate(a, b)).map((o) => o.p)
    const rank = Object.fromEntries(ix.slice().sort(byDate).map((o, r) => [o.p.slug, r]))
    const list = ordered.map((p) => { const s = g.stars[p.slug]; return { slug: p.slug, piece: p, x: s.x, y: s.y, r: markR(g, s), rank: rank[p.slug] } })
    const date = Object.fromEntries(pieces.map((p) => [p.slug, p.date]))
    // lines run from the older star, so they can grow out of it
    const lines = g.lines.map((l) => {
      const [from, to] = date[l.from] <= date[l.to] ? [l.from, l.to] : [l.to, l.from]
      return { from, to, kind: l.kind, a: g.stars[from], z: g.stars[to] }
    })
    const shelves = ['notes', 'playground'].map((id) => ({ shelf: id, members: ordered.filter((p) => p.shelf === id).map((p) => p.slug) })).filter((s) => s.members.length)
    // one name per cluster per half (The web has members on both shelves)
    const names = g.anchors.map((a) => ({ shelf: a.shelf, constellation: a.constellation, members: ordered.filter((p) => p.constellation === a.constellation && p.shelf === a.shelf).map((p) => p.slug) }))
    return { list, lines, shelves, names }
  }

  // Requests in priority order: shelf names, constellation names (both required), then titles,
  // biggest star first (projects, then by links), newest breaking ties.
  sky.planLabels = (m, cam, { sizeOf, obstacles = [], viewport }) => {
    const at = Object.fromEntries(m.list.map((st) => [st.slug, st]))
    const scr = (st) => ({ x: st.x * cam.s + cam.x, y: st.y * cam.s + cam.y })
    const bbox = (slugs) => {
      const pts = slugs.map((s) => at[s]).filter(Boolean).map((st) => ({ ...scr(st), r: st.r }))
      const x0 = Math.min(...pts.map((p) => p.x - p.r)), x1 = Math.max(...pts.map((p) => p.x + p.r))
      const y0 = Math.min(...pts.map((p) => p.y - p.r)), y1 = Math.max(...pts.map((p) => p.y + p.r))
      return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
    }
    const marks = m.list.map((st) => { const p = scr(st), r = st.r + 2; return { x: p.x - r, y: p.y - r, w: r * 2, h: r * 2, owner: st.slug } })
    const req = []
    for (const s of m.shelves) {
      const id = 'shelf:' + s.shelf, b = bbox(s.members), { w, h: hh } = sizeOf(id), lift = 34
      req.push({ id, w, h: hh, required: true, candidates: [
        { x: b.cx - w / 2, y: b.y0 - hh - lift, side: 'above' },
        { x: b.x0, y: b.y0 - hh - lift, side: 'above' },
        { x: b.x1 - w, y: b.y0 - hh - lift, side: 'above' },
        { x: b.cx - w / 2, y: b.y1 + lift, side: 'below' },
      ] })
    }
    for (const n of m.names) {
      const id = 'name:' + n.shelf + '/' + n.constellation, b = bbox(n.members), { w, h: hh } = sizeOf(id)
      req.push({ id, w, h: hh, required: true, candidates: [
        { x: b.cx - w / 2, y: b.y0 - hh - 10, side: 'above' },
        { x: b.cx - w / 2, y: b.y1 + 10, side: 'below' },
        { x: b.x1 + 12, y: b.cy - hh / 2, side: 'right' },
        { x: b.x0 - 12 - w, y: b.cy - hh / 2, side: 'left' },
        { x: b.x0 - w * 0.25, y: b.y0 - hh - 22, side: 'above' },
        { x: b.x1 - w * 0.75, y: b.y0 - hh - 22, side: 'above' },
      ] })
    }
    for (const st of m.list.slice().sort((a, b) => b.r - a.r || (a.piece.date < b.piece.date ? 1 : -1))) {
      const id = 'star:' + st.slug, p = scr(st), { w, h: hh } = sizeOf(id)
      req.push({ id, w, h: hh, slug: st.slug, candidates: NIGHT.around(p.x, p.y, st.r, w, hh) })
    }
    const placed = NIGHT.placeLabels(req, { obstacles: [...marks, ...obstacles], bounds: viewport })
    return { placed, req, scr: (slug) => scr(at[slug]) }
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────────────────
  const portrait = () => innerHeight > innerWidth * 1.1

  sky.mount = (layer) => {
    root = layer
    root.classList.add('sky', 'lab-sky')
    root.setAttribute('role', 'group')
    root.setAttribute('aria-label', 'The Lab, as a night sky')
    linesSvg = sv('svg', { class: 'sky__lines', width: 1, height: 1, 'aria-hidden': 'true' })
    ringsEl = h('div', 'sky__rings'); ringsEl.setAttribute('aria-hidden', 'true')
    wordsEl = h('div', 'sky__words'); wordsEl.setAttribute('aria-hidden', 'true')
    starsEl = h('div', 'sky__stars')
    root.append(linesSvg, ringsEl, wordsEl, starsEl)
    root.addEventListener('keydown', arrows)
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.star')
      if (b && sky.onPick) sky.onPick(b.dataset.slug, b)
    })
  }

  sky.render = () => {
    const LAB = LABS(), g = (sky.geo = sky.geometry(LAB.pieces, portrait())), m = sky.model(g, LAB.pieces)
    sky.stars = {}; sky.list = []; sky.lines = []; sky.names = []; sky.shelves = []; sky.words = {}
    linesSvg.textContent = ''; wordsEl.textContent = ''; starsEl.textContent = ''
    sky.m = m

    // the seam: a faint dashed line through the open sky between the two halves
    const b = g.bounds, pad = 260
    linesSvg.appendChild(g.portrait
      ? sv('line', { class: 'sky__divide', x1: b.x - pad, x2: b.x + b.w + pad, y1: g.gap, y2: g.gap })
      : sv('line', { class: 'sky__divide', y1: b.y - pad, y2: b.y + b.h + pad, x1: g.gap, x2: g.gap }))

    for (const l of m.lines) {
      const el = sv('line', { class: 'sky__line', 'data-kind': l.kind, x1: l.a.x, y1: l.a.y, x2: l.z.x, y2: l.z.y })
      linesSvg.appendChild(el)
      sky.lines.push({ ...l, el })
    }
    for (const s of m.shelves) {
      const el = h('span', 'sky__shelf', `<span class="lab-mark" data-shelf="${s.shelf}"></span>${esc(LAB.shelfName(s.shelf))}<span class="sky__count">${s.members.length}</span>`)
      el.dataset.shelf = s.shelf
      wordsEl.appendChild(el)
      sky.shelves.push({ ...s, el })
      sky.words['shelf:' + s.shelf] = el
    }
    for (const n of m.names) {
      const el = h('span', 'sky__name', esc(conName(n.constellation)))
      el.dataset.shelf = n.shelf
      wordsEl.appendChild(el)
      sky.names.push({ ...n, el })
      sky.words['name:' + n.shelf + '/' + n.constellation] = el
    }
    // stars: real buttons, in shelf → constellation → date order
    for (const st of m.list) {
      const p = st.piece, box = Math.ceil(st.r + 2)
      const btn = h('button', 'star')
      btn.type = 'button'
      btn.dataset.slug = p.slug
      btn.dataset.shelf = p.shelf
      if (LAB.visited.has(p.slug)) btn.dataset.visited = ''
      btn.style.left = st.x + 'px'
      btn.style.top = st.y + 'px'
      btn.style.setProperty('--r', st.r + 'px')
      btn.setAttribute('aria-label', `${p.title}. ${LAB.shelfName(p.shelf)}${p.constellation ? ', ' + conName(p.constellation) : ''}`)
      btn.innerHTML = `<svg class="star__mark" viewBox="${-box} ${-box} ${box * 2} ${box * 2}" width="${box * 2}" height="${box * 2}" aria-hidden="true">` +
        `<path d="${LAB.sky.mark(p.shelf, st.r)}"/></svg><span class="star__label" aria-hidden="true">${esc(p.title)}</span>`
      starsEl.appendChild(btn)
      const item = { ...st, el: btn, label: btn.lastChild }
      sky.stars[p.slug] = item
      sky.list.push(item)
      sky.words['star:' + p.slug] = item.label
    }
    applyFilter(); applyFocus()
    lastLabelScale = 0
    if (window.DESK && DESK.world) { sky.frame(DESK.camera); sky.relabel() }
    return g
  }

  // ── camera: fit and per-frame ───────────────────────────────────────────────────────────
  sky.chrome = () => {
    const phone = innerWidth < 700
    const bar = document.querySelector('.nightbar')
    // room under the bar for the shelf names, which sit above each half's highest star
    const top = bar ? bar.getBoundingClientRect().bottom + (phone ? 68 : 80) : 140
    return { top, bottom: phone ? 96 : 132, side: phone ? 22 : 64 }
  }
  sky.fit = () => {
    const b = sky.geo.bounds, c = sky.chrome()
    const s = Math.min(1, (innerWidth - c.side * 2) / b.w, (innerHeight - c.top - c.bottom) / b.h)
    return { cx: b.x + b.w / 2, cy: b.y + b.h / 2 - (c.top - c.bottom) / 2 / s, s }
  }
  sky.frame = (cam) => {
    if (!root) return
    root.style.setProperty('--inv', (1 / cam.s).toFixed(5))
    if (lastLabelScale && Math.abs(cam.s / lastLabelScale - 1) > 0.015) scheduleRelabel()
  }
  let relabelTimer = 0
  const scheduleRelabel = () => { clearTimeout(relabelTimer); relabelTimer = setTimeout(() => sky.relabel(), 140) }

  // ── labels: measure, plan (pure), apply ─────────────────────────────────────────────────
  sky.relabel = (at = DESK.camera) => {
    if (!root || !sky.list.length) return
    const cam = { x: at.x, y: at.y, s: at.s }
    lastLabelScale = cam.s
    // fixed chrome: the night bar, the dock, the zoom pill, the moon (fixed: no offsetParent)
    const obstacles = []
    for (const sel of ['.nightbar', '#deskDock .desk-dock__panel', '.desk-zoom', '.night__moon canvas']) {
      const el = document.querySelector(sel), r = el && el.getBoundingClientRect()
      if (r && r.width && getComputedStyle(el).display !== 'none') obstacles.push({ x: r.left, y: r.top, w: r.width, h: r.height })
    }
    const sizes = {}
    for (const [id, el] of Object.entries(sky.words)) sizes[id] = { w: el.offsetWidth, h: el.offsetHeight }
    const { placed, req, scr } = sky.planLabels(sky.m, cam, { sizeOf: (id) => sizes[id], obstacles, viewport: { x: 8, y: 8, w: innerWidth - 16, h: innerHeight - 16 } })
    for (const q of req) {
      const box = placed[q.id], el = sky.words[q.id]
      if (q.slug) {
        // a title is a child of its star, offset in screen px from the star's centre
        const p = scr(q.slug), st = sky.stars[q.slug]
        if (box) { el.style.left = `calc(50% + ${(box.x - p.x).toFixed(1)}px)`; el.style.top = `calc(50% + ${(box.y - p.y).toFixed(1)}px)`; delete el.dataset.hidden; el.dataset.side = box.side }
        else { el.dataset.hidden = ''; delete el.dataset.side; el.style.left = `calc(50% + ${st.r + 6}px)`; el.style.top = `calc(50% - ${q.h / 2}px)` }
      } else {
        // a name sits at its own world point, drawn at screen size from there
        el.style.left = (box.x - cam.x) / cam.s + 'px'
        el.style.top = (box.y - cam.y) / cam.s + 'px'
      }
    }
    sky.placed = placed
    return placed
  }

  // ── filter and focus ────────────────────────────────────────────────────────────────────
  function applyFilter() {
    if (!root) return
    const f = sky.shelf
    root.dataset.shelf = f || 'both'
    for (const st of sky.list) {
      const off = !!f && st.piece.shelf !== f
      st.el.inert = off
      st.el.classList.toggle('is-off', off)
    }
    for (const l of sky.lines) l.el.classList.toggle('is-off', !!f && (sky.stars[l.from].piece.shelf !== f || sky.stars[l.to].piece.shelf !== f))
    for (const w of [...sky.names, ...sky.shelves]) w.el.classList.toggle('is-off', !!f && w.shelf !== f)
  }
  sky.filter = (shelf) => { sky.shelf = shelf || null; applyFilter() }

  function applyFocus() {
    if (!root) return
    const f = sky.focused && sky.stars[sky.focused] ? sky.focused : null
    if (f) root.dataset.focus = f; else delete root.dataset.focus
    document.documentElement.classList.toggle('has-focus', !!f)
    const near = new Set(f ? [f] : [])
    for (const l of sky.lines) {
      const hot = !!f && (l.from === f || l.to === f)
      l.el.classList.toggle('is-hot', hot)
      if (hot) { near.add(l.from); near.add(l.to) }
    }
    for (const st of sky.list) {
      st.el.classList.toggle('is-near', near.has(st.slug))
      st.el.classList.toggle('is-focus', st.slug === f)
      if (st.slug === f) st.el.setAttribute('aria-pressed', 'true'); else st.el.removeAttribute('aria-pressed')
    }
  }
  sky.focus = (slug) => { sky.focused = slug || null; applyFocus() }
  sky.neighbours = (slug) => [...new Set(sky.lines.flatMap((l) => (l.from === slug ? [l.to] : l.to === slug ? [l.from] : [])))]

  // Arrow keys move to the nearest live star that way, linked stars first (plan: "arrow keys
  // follow links")
  function arrows(e) {
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key]
    const cur = e.target.closest && e.target.closest('.star')
    if (!dir || !cur) return
    e.preventDefault()
    const a = sky.stars[cur.dataset.slug], linked = sky.neighbours(a.slug)
    let best = null, bestScore = Infinity
    for (const st of sky.list) {
      if (st === a || st.el.inert) continue
      const dx = st.x - a.x, dy = st.y - a.y, d = Math.hypot(dx, dy), cos = (dx * dir[0] + dy * dir[1]) / d
      if (cos < 0.35) continue
      const score = d * (1 + 2 * (1 - cos)) * (linked.includes(st.slug) ? 0.6 : 1)
      if (score < bestScore) { bestScore = score; best = st }
    }
    if (best) best.el.focus({ preventScroll: true })
  }

  // The 20th-piece proof: hollow rings where stars were before a re-render
  sky.rings = (before) => {
    ringsEl.textContent = ''
    let moved = 0
    for (const [slug, o] of Object.entries(before)) {
      const n = sky.geo.stars[slug]
      if (!n) continue
      if (Math.hypot(o.x - n.x, o.y - n.y) > 0.5) moved++
      const ring = h('span', 'sky__ring')
      ring.style.left = o.x + 'px'
      ring.style.top = o.y + 'px'
      ringsEl.appendChild(ring)
    }
    return moved
  }
})()
