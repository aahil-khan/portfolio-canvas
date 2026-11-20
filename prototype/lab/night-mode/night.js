/*
 * prototype/lab/night-mode/night.js: night mode. The Lab is not a page: it is the desk at night.
 *
 *   NIGHT.mount()          after DESK.mount: builds the night layer, the shelf cards and the bar
 *   NIGHT.enter() / .leave() / .toggle() → Promise   (the Lab dock tile toggles)
 *   NIGHT.scrub(t)         sets the transition to t ∈ [0, 1] and holds it there (?freeze=)
 *   window.renderShelves() re-renders both shelf cards from LAB.pieces and reports what changed
 *                          (the 20th-piece proof)
 *
 * THE TRANSITION is one timeline, a pure function of t, so it runs both ways and can be frozen
 * on any frame for a screenshot. t goes 0 → 1 over 1.7 s into night and 1 → 0 over 1.35 s back.
 *   0.00–0.62  night falls from the top of the screen: a 160vh blind, solid night above a
 *              warm dusk edge, eased in-out (a fall is not a deceleration)
 *     …        each day card makes way exactly as the dusk edge passes it: drifts outward from
 *              the middle of the screen, settles a little and fades. Only `translate`, `scale`
 *              and `opacity` are touched (never left/top), so on the way back every card lands
 *              where it was, dragged or not. The grid and the desk's pill go with the night.
 *   0.25–0.75  the camera eases to fit the shelf cards, in the same world, from wherever you were
 *   0.25–0.85  the starfield and the dithered moon come up, the moon rising a little. Both are
 *              background: fixed behind the world, never clickable, never a piece.
 *   0.60–0.92  Notes & write-ups opens out of the Lab tile (an explicit FLIP from the tile's
 *              screen rect to the card's, as a canvas card opens from its dock icon)
 *   0.68–1.00  the Playground does the same, a beat later
 * Going back is the same timeline run backwards with mirrored easing, so it decelerates into
 * day: the shelves fold back into the Lab tile, the camera returns to exactly where it was, the
 * day cards come back, the blind lifts.
 *
 * REDUCED MOTION (LAB.sky.reduced, the one owner) swaps in an opacity-only timeline: the desk
 * fades out, the camera cuts while nothing is on screen, the shelves fade in. No drift, no
 * growth, no blind, no moonrise.
 *
 * The camera stays the desk's: every frame goes through DESK.flyTo(…, 0), which writes the one
 * world transform from the desk's rAF loop. React state would never see any of this.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const shelves = NIGHT.shelves, win = NIGHT.win, reader = NIGHT.reader
  const R = () => LAB.sky.reduced
  const q = new URLSearchParams(location.search)
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  // UI words for this mockup (the React build takes them from content/, like every other string)
  const COPY = {
    back: 'cd ~/desk, back to the desk', bar: 'The Lab', where: '~/lab', cmd: 'cd ~/desk', key: '⏎',
    palette: 'Palette (mockup)', palettes: { white: 'white', green: 'green', amber: 'amber' }, cat: (s) => `$ cat ${s}.md`,
  }
  const PALETTES = Object.keys(COPY.palettes)

  // cubic-bezier(0.16, 1, 0.3, 1), solved for x by Newton's method
  const bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx
    return (x) => {
      if (x <= 0) return 0
      if (x >= 1) return 1
      let t = x
      for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d }
      return Y(Math.min(1, Math.max(0, t)))
    }
  }
  const EASE = bezier(0.16, 1, 0.3, 1)
  // Night falling is not a deceleration (DIRECTION's curve would drop it in 200ms): it is a
  // slow, symmetric blind, so it gets a cubic in-out, and runs the same both ways.
  const FALL = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
  const seg = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a))
  let dir = 1 // +1 into night, −1 back to day: easing mirrors so both directions decelerate
  const ease = (p) => (dir > 0 ? EASE(p) : 1 - EASE(1 - p))
  // when each pane opens, in shelves.SECTIONS order
  const OPENS = [[0.6, 0.9], [0.64, 0.95], [0.68, 1]]
  // THE DECODE: the Lab's UI types itself in as dusk settles, and scrambles out on the way back.
  // t 0.60–0.93 (≈ 560 ms of the 1.7 s into night, ≈ 445 ms of the 1.35 s back):
  //   the dock's glyphs 0.60–0.74, the prompt 0.62–0.78, each pane's text 0.63–0.93, line by line
  const DECODE = { dock: [0.6, 0.1, 0.004], bar: [0.62, 0.16], pane: [0.63, 0.12, 0.03, 0.12] }

  const st = { t: 0, A: null, B: null, cards: [], anim: 0, queue: [], tile: null }
  const view = () => ({ cx: (innerWidth / 2 - DESK.camera.x) / DESK.camera.s, cy: (innerHeight / 2 - DESK.camera.y) / DESK.camera.s, s: DESK.camera.s })
  const camOf = (v) => ({ s: v.s, x: innerWidth / 2 - v.cx * v.s, y: innerHeight / 2 - v.cy * v.s })
  const setView = (v) => DESK.flyTo(v.cx, v.cy, v.s, 0)
  const lerpView = (a, b, k) => ({ cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k) })
  const phone = () => innerWidth < 700
  // the screen band between the night bar and the dock
  const band = () => ({ top: el.bar ? el.bar.getBoundingClientRect().bottom + (phone() ? 12 : 28) : 90, bottom: phone() ? 84 : 124, side: phone() ? 12 : 40 })

  let el = {} // night layer parts and chrome

  // ── plan: what makes way, from where, and when the dusk edge reaches it ──────────────────
  function planCards() {
    const v = st.A, s = v.s, cam = camOf(v)
    const parts = [...Object.values(DESK.cards).map((c) => c.el), document.querySelector('.desk-hero')].filter(Boolean)
    st.cards = parts.map((node) => {
      const x = parseFloat(node.style.left) || 0, y = parseFloat(node.style.top) || 0
      const sx = (x + node.offsetWidth / 2) * s + cam.x, sy = (y + node.offsetHeight / 2) * s + cam.y
      let dx = sx - innerWidth / 2, dy = sy - innerHeight / 2
      const d = Math.hypot(dx, dy) || 1
      dx /= d; dy /= d
      const push = 150 / s // screen px, in world units
      return { node, dx: dx * push, dy: dy * push + 30 / s, sy: sy / innerHeight }
    })
  }
  // The blind is 160vh tall: solid night for its first 100vh, then a 60vh dusk edge. At fall
  // progress b its solid part ends at (1.6b − 0.6)·vh and the dusk begins at 1.6b·vh.
  // How far into night a point at screen height y (in vh) is: 0 in daylight, 1 under full night.
  const nightAt = (b, y) => Math.min(1, Math.max(0, (1.6 * b - y) / 0.6))

  // ── the timeline ─────────────────────────────────────────────────────────────────────────
  function apply(t) {
    st.t = t
    const red = R(), root = document.documentElement
    root.classList.toggle('has-night', t > 0)
    root.classList.toggle('is-night', t >= 0.6)

    // camera
    const k = red ? (t >= 0.5 ? 1 : 0) : ease(seg(t, 0.25, 0.75))
    setView(k === 0 ? st.A : k === 1 ? st.B : lerpView(st.A, st.B, k))
    const cam = camOf(k === 0 ? st.A : k === 1 ? st.B : lerpView(st.A, st.B, k)) // what flyTo just set

    // night falls, top to bottom
    const b = red ? 1 : FALL(seg(t, 0, 0.62))
    if (red) { el.blind.style.transform = 'none'; el.blind.style.opacity = seg(t, 0, 0.45) }
    else { el.blind.style.opacity = 1; el.blind.style.transform = `translateY(${((b - 1) * 100).toFixed(3)}%)` }
    el.field.style.opacity = seg(t, 0.25, red ? 0.8 : 0.7)
    const m = seg(t, 0.4, 0.85)
    el.moonWrap.style.opacity = m
    el.moonWrap.style.translate = red ? '0 0' : `0 ${((1 - ease(m)) * 40).toFixed(2)}px`
    DESK.grid.style.opacity = 1 - (red ? seg(t, 0, 0.45) : seg(t, 0.05, 0.5))
    const pill = document.querySelector('.desk-pill')
    if (pill) { const o = 1 - (red ? seg(t, 0, 0.3) : nightAt(b, 0.06)); pill.style.opacity = t ? o : ''; pill.style.visibility = t && o === 0 ? 'hidden' : '' }

    // the desk makes way: each card goes as the dusk edge passes it, and comes back as dawn does
    for (const c of st.cards) {
      const s = c.node.style
      if (t === 0) { s.opacity = s.translate = s.scale = s.visibility = ''; continue }
      const p = red ? seg(t, 0, 0.45) : nightAt(b, c.sy), e = EASE(p)
      s.opacity = (1 - p).toFixed(3)
      s.translate = red ? '' : `${(c.dx * e).toFixed(2)}px ${(c.dy * e).toFixed(2)}px`
      s.scale = red ? '' : (1 - 0.06 * e).toFixed(4)
      s.visibility = p >= 1 ? 'hidden' : ''
    }

    // the shelves open out of the Lab tile: a FLIP, written as translate + scale on the card.
    // The tile is fixed on screen and the camera may be moving, so the start is converted into
    // the card's world space on every frame (screen delta ÷ scale, as every canvas move is).
    const ids = shelves.SECTIONS.map((s) => s.id)
    ids.forEach((id, i) => {
      const c = shelves.cards[id], s = c.el.style
      const [a0, a1] = OPENS[i] || OPENS[OPENS.length - 1]
      const p = red ? seg(t, 0.55, 1) : ease(seg(t, a0, a1))
      c.el.classList.toggle('is-out', p <= 0)
      if (red || p >= 1 || p <= 0) { s.translate = s.scale = ''; s.opacity = red ? p.toFixed(3) : p >= 1 ? '' : '0'; return }
      const tile = st.tile, w = c.w * cam.s
      const sx = c.x * cam.s + cam.x, sy = c.y * cam.s + cam.y // the card's top-left on screen
      const k0 = tile.width / w, sc = k0 + (1 - k0) * p
      // origin is the card's top-left (CSS), so moving it onto the tile's top-left is enough
      s.translate = `${(((tile.left - sx) * (1 - p)) / cam.s).toFixed(2)}px ${(((tile.top - sy) * (1 - p)) / cam.s).toFixed(2)}px`
      s.scale = sc.toFixed(4)
      s.opacity = Math.min(1, p / 0.35).toFixed(3)
    })
    decodeAt(t, red)
  }

  // ── the decode, one more pure-of-t segment ───────────────────────────────────────────────
  // Every text node in the panes and the prompt, and the dock's glyphs, collected when a turn
  // begins (so a re-rendered pane is picked up) with the slice of t it decodes over.
  let decoders = []
  function collectDecoders() {
    decoders = []
    const [d0, dLen, dStep] = DECODE.dock
    // the dock's glyphs are CSS strings (night.css, --g on each tile); the decode writes them
    // inline while it plays and removes them at rest, so the stylesheet stays the one source
    labDock().forEach((icon, i) => {
      icon.style.removeProperty('--g')
      const g = getComputedStyle(icon).getPropertyValue('--g').trim().replace(/^["']|["']$/g, '')
      if (g) decoders.push({ dock: icon, text: g, a: d0 + i * dStep, b: d0 + i * dStep + dLen, seed: 101 + i })
    })
    const texts = (root) => {
      const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/\S/.test(n.nodeValue) ? 1 : 2) })
      while (w.nextNode()) out.push(w.currentNode)
      return out
    }
    const [b0, bLen] = DECODE.bar
    texts(el.bar).forEach((n, i) => decoders.push({ node: n, text: n.nodeValue, a: b0, b: b0 + bLen, seed: 7 + i }))
    const [p0, cap, step, len] = DECODE.pane
    shelves.SECTIONS.forEach((s, i) => {
      const nodes = texts(shelves.cards[s.id].el)
      nodes.forEach((n, j) => {
        const a = p0 + i * step + cap * (j / Math.max(1, nodes.length - 1))
        decoders.push({ node: n, text: n.nodeValue, a, b: a + len, seed: 1000 * (i + 1) + j })
      })
    })
  }
  function decodeAt(t, red) {
    for (const d of decoders) {
      const p = red ? 1 : seg(t, d.a, d.b)
      if (d.dock) {
        if (p >= 1 || t === 0) d.dock.style.removeProperty('--g')
        else d.dock.style.setProperty('--g', `"${NIGHT.decode(d.text, p, d.seed)}"`)
      } else {
        const v = NIGHT.decode(d.text, t === 0 ? 1 : p, d.seed)
        if (d.node.nodeValue !== v) d.node.nodeValue = v
      }
    }
  }
  const labDock = () => [...document.querySelectorAll('#deskDock .desk-dock__icon')]

  function run(to) {
    return new Promise((resolve) => {
      if (st.anim) { st.queue.push([to, resolve]); return }
      if (st.t === to) return resolve()
      dir = to > st.t ? 1 : -1
      if (dir > 0) beginEnter(); else beginLeave()
      document.documentElement.classList.add('is-turning')
      const from = st.t, ms = (R() ? 560 : dir > 0 ? 1700 : 1350) * Math.abs(to - from), t0 = performance.now()
      const step = (now) => {
        const p = ms ? Math.min(1, (now - t0) / ms) : 1
        apply(from + (to - from) * p)
        if (p < 1) { st.anim = requestAnimationFrame(step); return }
        st.anim = 0
        finish(to)
        resolve()
        const next = st.queue.shift()
        if (next) run(next[0]).then(next[1])
      }
      st.anim = requestAnimationFrame(step)
    })
  }

  const labTile = () => document.querySelector('.desk-dock__item[data-id="lab"]')
  function beginEnter() {
    if (st.t > 0) return
    const folder = document.querySelector('.desk-folder')
    if (folder) folder.hidden = true
    st.A = view()
    // the shelves open around wherever you are looking: no layout data, no fixed spot
    shelves.layout({ x: Math.round(st.A.cx), y: Math.round(st.A.cy) })
    st.B = fitView()
    st.tile = labTile().querySelector('.desk-dock__icon').getBoundingClientRect()
    planCards()
    placeMoon()
    collectDecoders()
  }
  function beginLeave() {
    win.closeAll({ instant: true })
    st.B = view() // leave from wherever the night was panned to
    st.tile = labTile().querySelector('.desk-dock__icon').getBoundingClientRect()
    collectDecoders()
    // a pane you dragged folds back from where it is now
  }
  function finish(to) {
    document.documentElement.classList.remove('is-turning')
    const lab = labTile()
    if (to === 1) {
      lab.dataset.open = 'true'
      setURL(true)
      if (document.activeElement === lab) el.back.focus({ preventScroll: true })
    } else {
      setView(st.A)
      lab.dataset.open = 'false'
      setURL(false)
      const a = document.activeElement
      if (!a || a === document.body || el.bar.contains(a) || shelvesLayer.contains(a)) lab.focus({ preventScroll: true })
    }
  }
  // /lab deep-links into night mode: here, ?mode=night. file:// refuses replaceState, harmlessly.
  function setURL(night) {
    try {
      const u = new URL(location.href)
      if (night) u.searchParams.set('mode', 'night'); else { u.searchParams.delete('mode'); u.searchParams.delete('lab') }
      history.replaceState(null, '', u)
    } catch { /* file:// */ }
  }

  NIGHT.enter = () => run(1)
  NIGHT.leave = () => run(0)
  NIGHT.toggle = () => run(st.t > 0.5 || (st.anim && dir > 0) ? 0 : 1)
  NIGHT.scrub = (t) => { if (st.t === 0) { dir = 1; beginEnter() } apply(t) }
  NIGHT.state = st

  const fitView = () => shelves.fit(shelves.rects(), { vw: innerWidth, vh: innerHeight, ...band() })
  const flyFit = () => { const f = fitView(); st.B = f; return DESK.flyTo(f.cx, f.cy, f.s, 620) }

  // ── the moon: background, up in the corner of the sky, far away (it barely moves on a pan) ──
  let moonAt = null
  function placeMoon() {
    const B = camOf(st.B || fitView()), rs = shelves.rects()
    let base
    if (phone()) {
      // up in the top band, between the prompt and the right edge
      const r = el.back.getBoundingClientRect(), right = el.palsw.getBoundingClientRect().left || innerWidth
      base = { x: Math.round((Math.max(r.right, 140) + right) / 2), y: 34 }
    } else {
      // low in the sky, under whichever pane leaves the most of it open; it is background, so it
      // may read the panes' heights (placement of the panes themselves never does)
      const dockTop = innerHeight - 124
      const gaps = rs.map((r) => ({ r, top: (r.y + r.h) * B.s + B.y })).map((g) => ({ ...g, gap: dockTop - g.top })).sort((a, b) => b.gap - a.gap)
      const g = gaps[0]
      base = g && g.gap >= 170
        ? { x: (g.r.x + g.r.w / 2) * B.s + B.x, y: g.top + g.gap * 0.48 }
        : { x: innerWidth - 90, y: 96 }
    }
    moonAt = { base, cam0: B }
    moveMoon(DESK.camera)
  }
  function moveMoon(cam) {
    if (!moonAt) return
    const k = 0.05 // parallax: far away
    el.moonWrap.style.left = (moonAt.base.x + (cam.x - moonAt.cam0.x) * k).toFixed(1) + 'px'
    el.moonWrap.style.top = (moonAt.base.y + (cam.y - moonAt.cam0.y) * k).toFixed(1) + 'px'
  }

  // ── opening things ───────────────────────────────────────────────────────────────────────
  const worldOf = (node) => {
    if (!node || !node.getBoundingClientRect) return null
    const r = node.getBoundingClientRect(), c = DESK.camera
    return { x: (r.left + r.width / 2 - c.x) / c.s, y: (r.top + r.height / 2 - c.y) / c.s }
  }
  // a window sits over the middle of the panes, a little down, cascading if several are open
  function windowAt(width) {
    const rs = shelves.rects()
    const x0 = Math.min(...rs.map((r) => r.x)), x1 = Math.max(...rs.map((r) => r.x + r.w)), y0 = Math.min(...rs.map((r) => r.y))
    const n = win.open_.length, step = phone() ? 14 : 28
    return { x: Math.round((x0 + x1) / 2 - width / 2 + n * step), y: Math.round(y0 + (phone() ? 44 : 36) + n * step) }
  }
  // the row a window opens for is scrolled into sight inside its pane (only that pane's body
  // scrolls: never the viewport, whose scroll would desync the world from the camera)
  const reveal = (row) => {
    const body = row && row.closest('.shelf__body')
    if (!body) return
    const top = row.offsetTop - body.offsetTop, bottom = top + row.offsetHeight
    if (top < body.scrollTop) body.scrollTop = top - 8
    else if (bottom > body.scrollTop + body.clientHeight) body.scrollTop = bottom - body.clientHeight + 8
  }
  const rowFor = (slug) => shelvesLayer.querySelector(`.log[data-open="${CSS.escape(slug)}"]`)
  // an experiment opens as a terminal window; anything else in the Lab is a post
  function openPiece(slug, opener) {
    const p = LAB.pieces.find((x) => x.slug === slug)
    if (!p || !shelves.inLab(p)) return
    if (p.kind !== 'experiment') return reader.go(slug, opener)
    if (phone() && shelves.current() !== 'experiments') shelves.tab('experiments', false)
    opener = opener || rowFor(slug)
    reveal(rowFor(slug))
    LAB.visited.add(slug)
    const width = Math.min(560, innerWidth - 24)
    return win.open({ id: 'piece:' + slug, cmd: COPY.cat(slug), title: p.title, width, body: win.piece(p), from: worldOf(opener), at: windowAt(width), opener })
  }
  // a desk card from the Lab: back to the desk first, then the desk's own focusCard
  function toDesk(card) { return run(0).then(() => card && DESK.focusCard(card)) }
  const onAction = (a, from) => {
    if (a.read) return reader.go(a.read, from)
    if (a.open) return openPiece(a.open, from)
  }
  win.onAction(onAction)
  shelves.onAction(onAction)
  // phone: switching tabs re-fits, so a shorter pane isn't left floating
  shelves.onTab = () => { if (st.t === 1 && !st.anim) flyFit() }

  // ── chrome: the prompt, the one clear way back, and the mockup's palette switch ────────
  function buildBar() {
    const bar = h('div', 'nightbar')
    bar.setAttribute('role', 'toolbar')
    bar.setAttribute('aria-label', COPY.bar)
    bar.innerHTML = `<button type="button" class="nb-back" aria-label="${COPY.back}">` +
      `<span class="nb-where">${COPY.where}</span> <span class="nb-ps">$</span> <span class="nb-cmd">${COPY.cmd}</span><span class="nb-cur" aria-hidden="true"></span> <span class="nb-key">${COPY.key}</span></button>`
    document.body.prepend(bar) // first in the Tab order: back, then the panes
    bar.querySelector('.nb-back').addEventListener('click', () => NIGHT.leave())
    el.bar = bar
    el.back = bar.querySelector('.nb-back')
  }
  // THROWAWAY: the palette is for Aahil to judge by eye, not a feature. ?palette=green|amber.
  function buildPalette() {
    const sw = h('div', 'palsw')
    sw.setAttribute('role', 'group')
    sw.setAttribute('aria-label', COPY.palette)
    sw.innerHTML = PALETTES.map((id) => `<button type="button" data-palette="${id}" aria-pressed="false">${COPY.palettes[id]}</button>`).join('')
    document.body.appendChild(sw) // last in the Tab order: after the panes and the dock
    sw.addEventListener('click', (e) => { const b = e.target.closest('[data-palette]'); if (b) setPalette(b.dataset.palette) })
    el.palsw = sw
    const want = q.get('palette')
    setPalette(PALETTES.includes(want) ? want : 'white', true)
  }
  function setPalette(id, first) {
    document.documentElement.dataset.palette = id
    for (const b of el.palsw.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.palette === id))
    if (!first) {
      bakeStars()
      paintMoon()
      try { const u = new URL(location.href); u.searchParams.set('palette', id); history.replaceState(null, '', u) } catch { /* file:// */ }
    }
  }

  // ── the night layer: fixed, behind the world, never transformed by the camera ────────────
  function buildNight() {
    const n = h('div', 'night lab-sky')
    n.setAttribute('aria-hidden', 'true')
    n.innerHTML = '<div class="night__blind"></div><div class="night__field"><div class="lab-starfield"></div></div><div class="night__moon"><canvas></canvas></div>'
    DESK.backdrop.appendChild(n)
    el.blind = n.querySelector('.night__blind')
    el.field = n.querySelector('.night__field')
    el.moonWrap = n.querySelector('.night__moon')
    // The kit seeds the dots; parallax is ours. Its move() writes background-position, which
    // repaints three full-screen layers of radial-gradients every frame (headless: the
    // transition ran at ~15 fps with it, ~55 without). Here the same depths move by transform
    // on layers one tile larger than the screen, which only composites. FACTORS are the kit's
    // DEPTHS (shared/sky.js), far to near. Reported as a kit fix in the PR.
    LAB.sky.starfield(n.querySelector('.lab-starfield'), { seed: 11 })
    const FACTORS = [0.08, 0.18, 0.32]
    // Each kit layer is dozens of radial-gradients, slow to rasterise. Read the dots back from the
    // gradients the kit wrote (same seed, same places) and bake each layer into one bitmap tile,
    // so a tile paints as an image. In the Lab the dots are glyphs: . far, · and + nearer, * nearest.
    const depths = [...n.querySelectorAll('.lab-starfield__layer')].map((l, i) => {
      const tile = parseFloat(l.style.backgroundSize) || 400
      const dots = [...l.style.backgroundImage.matchAll(/at ([\d.]+)px ([\d.]+)px, rgba\([^,]+,\s*([\d.]+)\) 0(?:px)? ([\d.]+)px/g)].map((m) => ({ x: +m[1], y: +m[2], a: +m[3] }))
      l.style.backgroundImage = 'none'
      l.style.inset = `-${tile}px`
      l.style.willChange = 'transform'
      return { l, tile, dots, i, f: FACTORS[i] || 0.2 }
    })
    const GLYPH = [['.', '.', '·'], ['·', '·', '+'], ['+', '*', '+']], SIZE = [11, 12, 14]
    bakeStars = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      const rgb = getComputedStyle(document.documentElement).getPropertyValue('--lab-star').trim() || '237, 234, 224'
      for (const d of depths) {
        const c = document.createElement('canvas'), g = c.getContext('2d')
        c.width = c.height = Math.round(d.tile * dpr)
        g.scale(dpr, dpr)
        g.font = `${SIZE[d.i] || 12}px 'JetBrains Mono', ui-monospace, monospace`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        d.dots.forEach((dot, k) => {
          // glyph strokes are thinner than the kit's discs, so they carry a little more alpha;
          // still faint, and nothing twinkles
          g.fillStyle = `rgba(${rgb}, ${Math.min(0.62, dot.a * 2.4).toFixed(3)})`
          g.fillText((GLYPH[d.i] || GLYPH[1])[k % 3], dot.x, dot.y)
        })
        d.l.style.backgroundImage = `url(${c.toDataURL()})`
      }
    }
    bakeStars()
    // once the mono face has landed, bake again in it (the first bake used the fallback)
    if (document.fonts && document.fonts.load) document.fonts.load("12px 'JetBrains Mono'").then(bakeStars, () => {})
    const wrap = (v, m) => ((v % m) + m) % m
    const field = { move: (x, y) => { for (const d of depths) d.l.style.transform = `translate3d(${wrap(x * d.f, d.tile).toFixed(1)}px, ${wrap(y * d.f, d.tile).toFixed(1)}px, 0)` } }
    el.moonCanvas = n.querySelector('canvas')
    paintMoon()
    DESK.onFrame((cam) => {
      if (st.t === 0) return
      field.move(cam.x, cam.y)
      moveMoon(cam)
    })
  }

  let bakeStars = () => {}
  // the dithered moon, in the palette's ink
  function paintMoon() {
    const rgb = (getComputedStyle(document.documentElement).getPropertyValue('--lab-star').trim() || '237, 234, 224').split(',').map((v) => +v)
    NIGHT.paintMoon(el.moonCanvas, { size: phone() ? 48 : 64, ink: rgb })
  }

  // ── input that only means something at night ────────────────────────────────────────────
  function bindNight() {
    // dock tiles in the Lab: every desk card, the Arcade too, is back on the desk, so a tile goes
    // back there first (the fun stuff stays on the desk and never enters the Lab)
    document.addEventListener('click', (e) => {
      if (st.t === 0) return
      const item = e.target.closest('.desk-dock__item[data-id], .desk-folder button')
      if (!item || item.dataset.id === 'lab' || item.dataset.folder !== undefined) return
      e.stopImmediatePropagation()
      toDesk(null).then(() => item.click())
    }, true)
    document.addEventListener('keydown', (e) => {
      if (st.t === 0 || reader.isOpen() || (e.target.closest && e.target.closest('input, textarea'))) return
      if (e.key === 'Escape') {
        const top = win.top()
        if (top) { e.preventDefault(); win.close(top) }
      } else if (e.key === '0') { e.stopPropagation(); win.closeAll({}); flyFit() } // the desk's 0 fits the desk
    }, true)
    // Tab onto a row that is off-screen: the browser would scroll the viewport and desync the
    // world from the camera. Undo the scroll, and bring the card into view with the camera.
    DESK.viewport.addEventListener('scroll', () => { DESK.viewport.scrollTop = DESK.viewport.scrollLeft = 0 })
    DESK.viewport.addEventListener('focusin', (e) => {
      const card = e.target.closest('.shelf')
      if (!card || st.t < 1) return
      const r = e.target.getBoundingClientRect(), b = band()
      if (r.left < 8 || r.right > innerWidth - 8 || r.top < b.top - 20 || r.bottom > innerHeight - b.bottom + 20) {
        const c = shelves.cards[card.dataset.shelf], s = DESK.camera.s
        DESK.flyTo(c.x + c.w / 2, (r.top + r.height / 2 - DESK.camera.y) / s, s, 420)
      }
    })
    let resizeTimer = 0
    addEventListener('resize', () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (st.t !== 1 || st.anim) return
        shelves.layout(shelves.at)
        setView((st.B = fitView()))
        placeMoon()
      }, 160)
    })
  }

  // ── proofs (throwaway): a readout of what a screenshot claims ────────────────────────────
  function badge(text, ok = true) {
    let b = document.querySelector('.proof')
    if (!b) { b = h('p', 'proof t-label'); b.setAttribute('role', 'status'); document.body.appendChild(b) }
    b.dataset.ok = ok
    b.textContent = text
  }
  // the 20th piece: push it, call this, and only its entry appears
  window.renderShelves = () => {
    const pos = () => JSON.stringify(Object.values(shelves.cards).map((c) => [c.x, c.y, c.w, c.el.style.left, c.el.style.top]))
    const entries = () => shelvesLayer.querySelectorAll('[data-entry]').length
    const before = pos(), rows = entries()
    const out = shelves.render()
    for (const a of out.added) { const [slug, pane] = a.split('@'); const r = shelves.cards[pane].body.querySelector(`[data-entry="${CSS.escape(slug)}"]`); if (r) r.classList.add('is-new') }
    const after = entries(), still = pos() === before
    const where = out.added.map((a) => '~/lab/' + a.split('@')[1])
    const ok = after === rows + out.added.length && out.removed.length === 0 && out.kept === rows && still
    badge(`${after} entries · +${out.added.length} in ${where.join(', ') || '—'} · ${out.kept} of ${rows} untouched · ` +
      `${out.changed.length} of ${Object.keys(shelves.cards).length} panes re-rendered · panes ${still ? 'unmoved' : 'MOVED'}`, ok)
    return out
  }
  // where every card and the hero are on screen, to the hundredth of a pixel
  const rects = () => Object.fromEntries([...Object.entries(DESK.cards).map(([id, c]) => [id, c.el]), ['hero', document.querySelector('.desk-hero')]]
    .map(([id, n]) => { const r = n.getBoundingClientRect(); return [id, [r.left, r.top, r.width, r.height]] }))
  // measure once the web font has landed (it re-wraps the cards) and the desk has painted the
  // camera, which it writes on its next frame
  const settled = () => document.fonts.ready.then(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))))
  function proof(what, before) {
    const now = rects()
    const d = (id) => Math.max(...before[id].map((v, i) => Math.abs(v - now[id][i])))
    const ids = Object.keys(before), off = ids.filter((id) => d(id) >= 0.01), worst = Math.max(...ids.map(d))
    badge(`${what} · ${ids.length - off.length} of ${ids.length} where they were · max Δ ${worst.toFixed(2)} px${off.length ? ' (' + off.join(', ') + ')' : ''}`, !off.length)
  }
  // /lab, or ?mode=night: straight into night, no transition, then any screenshot switches
  function land() {
    dir = 1; beginEnter(); apply(1); finish(1)
    if (q.get('tab')) shelves.tab(q.get('tab'))
    if (q.get('add')) {
      // exactly what the brief asks a visitor to type in the console
      LAB.pieces.push({ slug: 'test-piece', title: 'Test piece', shelf: 'playground', kind: 'experiment', date: '2099-01' })
      window.renderShelves()
    }
    const o = q.get('open')
    if (o) openPiece(o)
    // #/writing/<slug>: the post, open over the Lab, with no transition (nobody clicked)
    reader.sync({ instant: true })
  }

  let shelvesLayer
  NIGHT.mount = () => {
    buildBar()
    reader.mount()
    win.mount(DESK.addLayer('night-windows'))
    shelvesLayer = DESK.addLayer('night-shelves') // addLayer inserts under earlier layers: shelves below windows
    shelvesLayer.classList.add('shelves')
    shelves.mount(shelvesLayer)
    shelves.layout({ x: 0, y: 0 })
    buildPalette()
    buildNight()
    bindNight()
    st.A = st.B = view()
    st.tile = labTile().querySelector('.desk-dock__icon').getBoundingClientRect()
    apply(0) // the panes start folded away

    const freeze = q.get('freeze')
    if (freeze != null) { settled().then(() => NIGHT.scrub(Math.min(1, Math.max(0, parseFloat(freeze) || 0)))); return }
    // a post's link is a Lab link: #/writing/<slug> lands at night with the post open
    const atNight = q.get('mode') === 'night' || q.get('lab') === '1' || /^#\/writing\//.test(location.hash)
    if (atNight && q.get('then') === 'desk') {
      // record the desk once it has painted, land at night, go back, measure every card
      settled().then(() => {
        const desk = rects()
        land()
        setTimeout(() => NIGHT.leave().then(settled).then(() => proof('Back on the desk', desk)), 700)
      })
    } else if (atNight) settled().then(land)
    else if (q.get('roundtrip')) {
      // as a visitor would: drag a card, pan a little, then night and back
      const about = DESK.cards.about
      about.x += 140; about.y += 50
      about.el.style.left = about.x + 'px'; about.el.style.top = about.y + 'px'
      const v = view(); setView({ ...v, cx: v.cx + 60, cy: v.cy - 30 })
      settled().then(() => {
        const before = rects()
        return NIGHT.enter().then(() => NIGHT.leave()).then(settled).then(() => proof('Round trip, About dragged', before))
      })
    } else if (q.get('enter')) setTimeout(() => NIGHT.enter(), 500)
  }
})()
