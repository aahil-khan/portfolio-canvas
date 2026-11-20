/*
 * prototype/lab/night-mode/night.js: the way into the Lab, and the Lab screen itself.
 *
 * THE LAB IS NOT A CANVAS. Night falls over the desk exactly as in #17, and then the desk is
 * replaced by a fixed, full-viewport screen: a status bar, a TUI split (menu.js) and the Lab's
 * own dock. Nothing in it pans, zooms or drags. The camera never moves at all: the desk is left
 * exactly where it was, under the night, and is there again when the night lifts.
 *
 *   NIGHT.mount()          after DESK.mount: builds the Lab screen, its dock tiles and the sky
 *   NIGHT.enter() / .leave() / .toggle() → Promise   (the Lab tile, [← canvas], ~ and the dock)
 *   NIGHT.scrub(t)         holds the transition at t ∈ [0, 1] (?freeze=)
 *   window.renderLab()     re-renders the menu from LAB.pieces and reports what changed
 *                          (the 20th-piece proof; renderShelves() is the same, #17's name)
 *
 * THE TRANSITION, one timeline, a pure function of t (0 → 1 over 1.7 s in, 1 → 0 over 1.35 s back):
 *   0.00–0.62  night falls from the top of the screen (a 160vh blind, a warm dusk edge, cubic
 *              in-out), and each day card makes way as the dusk edge passes it: it drifts out from
 *              the middle of the screen and fades. Only translate, scale and opacity are touched,
 *              never left/top, so on the way back every card lands where it was.
 *   0.30–0.75  the ASCII stars come up behind everything
 *   0.42–0.78  THE DOCK MORPHS in place: the desk's tiles fold away to nothing, the Lab tile turns
 *              into [← canvas], and the Lab's own tiles (work, experiments, writing) open out
 *              beside it. The panel squares off. gh and in stay, as text.
 *   0.60–0.82  the Lab screen is there: the status bar decodes in, then the dock's labels
 *   1.00       the intro plays (intro.js): a random effect, the welcome, then the menu
 * Going back is the same timeline backwards with mirrored easing; the menu decodes out first.
 * REDUCED MOTION (LAB.sky.reduced, the one owner) swaps in an opacity-only timeline: no drift, no
 * blind, no scramble, the dock swaps at the midpoint.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const menu = NIGHT.menu, intro = NIGHT.intro, reader = NIGHT.reader, C = NIGHT.copy
  const R = () => LAB.sky.reduced
  const q = new URLSearchParams(location.search)
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const PALETTES = Object.keys(C.palettes)
  const SECTIONS = NIGHT.model.SECTIONS

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
  // night falling is not a deceleration: a slow symmetric blind, the same both ways
  const FALL = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
  const IN_OUT = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
  const seg = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a))
  let dir = 1 // +1 into night, −1 back to day: easing mirrors so both directions decelerate
  const ease = (p) => (dir > 0 ? EASE(p) : 1 - EASE(1 - p))
  // THE DECODE: the status bar 0.62–0.80, the dock's labels 0.64–0.82; on the way back the menu
  // re-encodes 0.65–0.95 before them
  const DECODE = { bar: [0.62, 0.18], dock: [0.64, 0.12, 0.012], main: [0.65, 0.18, 0.12] }
  const DOCK = [0.42, 0.78]

  const st = { t: 0, anim: 0, queue: [], cards: [], dock: null }
  const phone = () => innerWidth < 700
  let el = {}

  // ── plan: what makes way, from where, and when the dusk edge reaches it ──────────────────
  function planCards() {
    const cam = DESK.camera, s = cam.s
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
  // the blind is 160vh: solid night for 100vh, then a 60vh dusk edge. How far into night a point
  // at screen height y (in vh) is at fall progress b: 0 in daylight, 1 under full night.
  const nightAt = (b, y) => Math.min(1, Math.max(0, (1.6 * b - y) / 0.6))

  // ── the dock: one panel, morphed in place ───────────────────────────────────────────────
  // Widths come from the labels' length in the mono face (measured once it has loaded), never
  // from content: a new piece never changes the dock.
  let chW = { 12: 7.2, 11: 6.6 }
  function measureMono() {
    const c = document.createElement('canvas').getContext('2d')
    for (const px of [12, 11]) { c.font = `500 ${px}px 'JetBrains Mono', ui-monospace, monospace`; chW[px] = c.measureText('0000000000').width / 10 }
  }
  function planDock() {
    const panel = DESK.dock.querySelector('.desk-dock__panel'), cs = getComputedStyle(document.documentElement)
    const size = parseFloat(cs.getPropertyValue('--dock-size')), gap = parseFloat(cs.getPropertyValue('--dock-gap')), pad = parseFloat(cs.getPropertyValue('--dock-pad'))
    const ph = phone(), px = ph ? 11 : 12, padX = ph ? 6 : 10, H1 = ph ? 30 : 32
    const w = (label) => Math.ceil(label.length * chW[px] + padX * 2)
    const items = []
    for (const node of panel.children) {
      if (node.classList.contains('ldock') || node.classList.contains('ldock-sep')) {
        const label = node.classList.contains('ldock-sep') ? '' : node.dataset[ph ? 'short' : 'long']
        items.push({ node, kind: 'grow', w1: label ? w(label) : 1 })
      } else if (node.dataset.id === 'lab') items.push({ node, kind: 'morph', w1: w('← ' + C.canvas) })
      else if (node.tagName === 'A') items.push({ node, kind: 'morph', w1: w('gh') })
      else if (node.classList.contains('desk-dock__item')) items.push({ node, kind: 'fold' })
    }
    st.dock = { panel, size, gap, pad, H1, P1: ph ? 4 : 6, items }
  }
  function dockAt(t) {
    const d = st.dock
    if (!d) return
    const red = R(), k = red ? (t >= 0.5 ? 1 : 0) : ease(seg(t, DOCK[0], DOCK[1]))
    if (t === 0) {
      for (const it of d.items) { for (const p of ['width', 'height', 'margin-right', 'opacity', 'visibility', '--lo', '--io']) it.node.style.removeProperty(p) }
      d.panel.style.removeProperty('padding')
      return
    }
    const hgt = (d.size + (d.H1 - d.size) * k).toFixed(2) + 'px'
    for (const it of d.items) {
      const s = it.node.style
      if (it.kind === 'fold') {
        s.width = (d.size * (1 - k)).toFixed(2) + 'px'; s.height = hgt
        s.marginRight = (-d.gap * k).toFixed(2) + 'px'
        s.opacity = (1 - seg(k, 0, 0.55)).toFixed(3)
        s.visibility = k >= 1 ? 'hidden' : ''
      } else if (it.kind === 'morph') {
        s.width = (d.size + (it.w1 - d.size) * k).toFixed(2) + 'px'; s.height = hgt
        s.setProperty('--io', (1 - seg(k, 0, 0.45)).toFixed(3)) // the day icon goes
        s.setProperty('--lo', seg(k, 0.5, 1).toFixed(3)) // the label comes
      } else {
        s.width = (it.w1 * k).toFixed(2) + 'px'; s.height = d.H1 + 'px'
        s.marginRight = (-d.gap * (1 - k)).toFixed(2) + 'px'
        s.opacity = seg(k, 0.45, 1).toFixed(3)
        s.visibility = k <= 0 ? 'hidden' : ''
      }
    }
    d.panel.style.padding = (d.pad + (d.P1 - d.pad) * k).toFixed(2) + 'px'
  }

  // ── the timeline ─────────────────────────────────────────────────────────────────────────
  function apply(t) {
    st.t = t
    const red = R(), root = document.documentElement
    root.classList.toggle('has-night', t > 0)
    root.classList.toggle('is-night', t >= 0.6)

    // night falls, top to bottom
    const b = red ? 1 : FALL(seg(t, 0, 0.62))
    if (red) { el.blind.style.transform = 'none'; el.blind.style.opacity = seg(t, 0, 0.45) }
    else { el.blind.style.opacity = 1; el.blind.style.transform = `translateY(${((b - 1) * 100).toFixed(3)}%)` }
    el.field.style.opacity = seg(t, 0.3, red ? 0.8 : 0.75)
    DESK.grid.style.opacity = 1 - (red ? seg(t, 0, 0.45) : seg(t, 0.05, 0.5))
    const chromeO = 1 - (red ? seg(t, 0, 0.3) : nightAt(b, 0.06))
    for (const n of [document.querySelector('.desk-pill'), document.querySelector('.desk-zoom')]) {
      if (!n) continue
      n.style.opacity = t ? chromeO : ''
      n.style.visibility = t && chromeO === 0 ? 'hidden' : ''
    }

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

    dockAt(t)

    // the Lab screen: the bar slides down a little as it decodes; the main area is the intro's on
    // the way in (empty until t = 1) and decodes out on the way back
    el.lab.inert = t < 0.6
    el.bar.style.opacity = red ? seg(t, 0.55, 0.9) : seg(t, 0.6, 0.7)
    el.bar.style.translate = red ? '' : `0 ${(-8 * (1 - IN_OUT(seg(t, 0.6, 0.8)))).toFixed(2)}px`
    el.main.style.opacity = dir > 0 ? (t >= 1 ? 1 : 0) : red ? seg(t, 0.55, 1) : seg(t, 0.62, 0.8)
    decodeAt(t, red)
  }

  // ── the decode, one more pure-of-t segment ───────────────────────────────────────────────
  let decoders = []
  const texts = (root) => {
    const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/\S/.test(n.nodeValue) ? 1 : 2) })
    while (w.nextNode()) out.push(w.currentNode)
    return out
  }
  function collectDecoders(leaving) {
    decoders = []
    const [b0, bLen] = DECODE.bar
    texts(el.bar).forEach((n, i) => decoders.push({ node: n, text: n.nodeValue, a: b0, b: b0 + bLen, seed: 7 + i }))
    const [d0, dLen, dStep] = DECODE.dock
    // the Lab tile's label is a CSS string (--g, night.css): written inline while it plays
    const lab = labTile().querySelector('.desk-dock__icon'), links = [...DESK.dock.querySelectorAll('a.desk-dock__item .desk-dock__icon')]
    ;[lab, ...links].forEach((icon, i) => {
      icon.style.removeProperty('--g')
      const g = getComputedStyle(icon).getPropertyValue('--g').trim().replace(/^["']|["']$/g, '')
      if (g) decoders.push({ dock: icon, text: g, a: d0 + i * dStep * 4, b: d0 + i * dStep * 4 + dLen, seed: 101 + i })
    })
    texts(el.ldock).forEach((n, i) => decoders.push({ node: n, text: n.nodeValue, a: d0 + 0.02 + i * dStep, b: d0 + 0.02 + i * dStep + dLen, seed: 201 + i }))
    if (leaving) {
      const [m0, cap, len] = DECODE.main, nodes = texts(el.main).filter((n) => !n.parentElement.closest('.fx, .fx-meta'))
      nodes.forEach((n, j) => { const a = m0 + cap * (j / Math.max(1, nodes.length - 1)); decoders.push({ node: n, text: n.nodeValue, a, b: a + len, seed: 900 + j }) })
    }
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
    st.camera = { ...DESK.camera }
    planCards()
    planDock()
    collectDecoders(false)
  }
  function beginLeave() {
    intro.stop()
    reader.closeNow()
    planDock()
    collectDecoders(true)
  }
  function finish(to) {
    document.documentElement.classList.remove('is-turning')
    const lab = labTile()
    if (to === 1) {
      lab.setAttribute('aria-label', C.canvasLabel)
      setURL(true)
      const a = document.activeElement
      playIntro({ focus: !a || a === document.body || a === lab })
    } else {
      lab.setAttribute('aria-label', 'Lab') // desk.js's own label for it
      setURL(false)
      menu.reveal(1, false)
      const a = document.activeElement
      if (!a || a === document.body || el.lab.contains(a) || DESK.dock.contains(a)) lab.focus({ preventScroll: true })
    }
  }
  // every visit: a fresh effect (?fx= forces one, &hold=<ms> holds a frame, &intro=0 skips it)
  function playIntro({ focus }) {
    const skip = q.get('intro') === '0'
    const p = intro.play({ fx: q.get('fx'), hold: q.get('hold') })
    if (skip) intro.skip()
    return p.then(() => { if (focus) { const n = menu.rowEl(menu.selected()); if (n) n.focus({ preventScroll: true }) } })
  }
  // /lab deep-links into the Lab: here, ?mode=night. file:// refuses replaceState, harmlessly.
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

  // ── the Lab screen ───────────────────────────────────────────────────────────────────────
  function buildLab() {
    const lab = h('div', 'lab')
    lab.id = 'lab'
    lab.inert = true
    const total = () => menu.total ? menu.total() : 0
    lab.innerHTML =
      `<header class="lbar" aria-label="${esc(C.barLabel)}">` +
      `<button type="button" class="lbar__back" aria-label="${esc(C.canvasLabel)}"><span class="lbar__arr" aria-hidden="true">← </span>${esc(C.canvas)}<span class="lbar__key" aria-hidden="true"> ${esc(C.canvasKey)}</span></button>` +
      `<p class="lbar__where"><span class="lbar__who">${esc(C.user)}</span><span class="lbar__colon">:</span><span class="lbar__path">${esc(C.root)}</span></p>` +
      `<span class="lbar__fill"></span>` +
      `<p class="lbar__stat"><span class="lbar__n"></span><span class="lbar__dot" aria-hidden="true"> · </span><time class="lbar__clock"></time></p>` +
      `<div class="palsw" role="group" aria-label="${esc(C.palette)}">${PALETTES.map((id) => `<button type="button" data-palette="${id}" aria-pressed="false" aria-label="${esc(C.palettes[id])}"><span class="palsw__l">${esc(C.palettes[id])}</span><span class="palsw__s" aria-hidden="true">${esc(C.palShort[id])}</span></button>`).join('')}</div>` +
      `</header>` +
      `<div class="lab__main"><div class="motd"></div><div class="stage"><pre class="fx" aria-hidden="true"></pre><p class="fx-meta" aria-hidden="true"><span class="fx-credit"></span><span class="fx-hint"></span></p></div></div>`
    document.body.insertBefore(lab, DESK.dock) // in the Tab order: the bar, the menu, then the dock
    el.lab = lab
    el.bar = lab.querySelector('.lbar')
    el.main = lab.querySelector('.lab__main')
    el.path = lab.querySelector('.lbar__path')
    el.clock = lab.querySelector('.lbar__clock')
    el.count = lab.querySelector('.lbar__n')
    el.palsw = lab.querySelector('.palsw')
    el.back = lab.querySelector('.lbar__back')
    el.back.addEventListener('click', () => NIGHT.leave())
    el.palsw.addEventListener('click', (e) => { const b = e.target.closest('[data-palette]'); if (b) setPalette(b.dataset.palette) })
    const want = q.get('palette')
    setPalette(PALETTES.includes(want) ? want : 'white', true)
    // the menu takes the stage's place once the intro is over
    menu.mount(el.main.querySelector('.stage'))
    intro.mount({ root: lab, stage: lab.querySelector('.fx'), motd: lab.querySelector('.motd'), hint: lab.querySelector('.fx-hint'), credit: lab.querySelector('.fx-credit'), menu: menu.reveal })
    menu.onSelect = (id) => {
      el.path.textContent = `${C.root}/${id}`
      const sec = id.split('/')[0]
      if (el.ldock) for (const b of el.ldock.querySelectorAll('.ldock')) b.toggleAttribute('aria-current', b.dataset.lab === sec)
    }
    const tick = () => {
      el.count.textContent = C.entries(total())
      const d = new Date(), t = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
      if (el.clock.textContent !== t) { el.clock.textContent = t; el.clock.dateTime = t }
    }
    tick()
    setInterval(() => { if (st.t === 1) tick() }, 15000)
    el.tick = tick
  }
  // the Lab's own dock tiles, inside the desk's panel, after the Lab tile; display:none by day
  function buildDock() {
    const panel = DESK.dock.querySelector('.desk-dock__panel'), lab = labTile()
    const group = document.createDocumentFragment()
    const sep = h('span', 'ldock-sep')
    sep.setAttribute('aria-hidden', 'true')
    group.appendChild(sep)
    for (const s of SECTIONS) {
      const b = h('button', 'ldock', `<span class="ldock__k" aria-hidden="true">${esc(s.key)} </span><span class="ldock__l">${esc(C.dock[s.id])}</span><span class="ldock__s" aria-hidden="true">${esc(C.dockShort[s.id])}</span>`)
      b.type = 'button'
      b.dataset.lab = s.id
      b.dataset.long = `${s.key} ${C.dock[s.id]}`
      b.dataset.short = C.dockShort[s.id]
      b.addEventListener('click', () => { if (st.t === 1) { intro.skip(); menu.go(s.id) } })
      group.appendChild(b)
    }
    lab.after(group)
    el.ldock = panel
    el.ldockNodes = [...panel.querySelectorAll('.ldock, .ldock-sep')]
  }
  // THROWAWAY: the palette is for Aahil to judge by eye, not a feature. ?palette=green|amber.
  function setPalette(id, first) {
    document.documentElement.dataset.palette = id
    for (const b of el.palsw.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.palette === id))
    if (!first) {
      bakeStars()
      try { const u = new URL(location.href); u.searchParams.set('palette', id); history.replaceState(null, '', u) } catch { /* file:// */ }
    }
  }

  // ── the sky: fixed, behind everything, ASCII stars. Nothing moves it: there is no camera. ──
  let bakeStars = () => {}
  function buildSky() {
    const n = h('div', 'night lab-sky')
    n.setAttribute('aria-hidden', 'true')
    n.innerHTML = '<div class="night__blind"></div><div class="night__field"><div class="lab-starfield"></div></div>'
    DESK.backdrop.appendChild(n)
    el.blind = n.querySelector('.night__blind')
    el.field = n.querySelector('.night__field')
    // The kit seeds the dots; each layer is dozens of radial-gradients, slow to rasterise. Read them
    // back (same seed, same places) and bake each layer into one bitmap tile, the dots as glyphs:
    // . far, · and + nearer, * nearest. Faint, and nothing twinkles.
    LAB.sky.starfield(n.querySelector('.lab-starfield'), { seed: 11 })
    const depths = [...n.querySelectorAll('.lab-starfield__layer')].map((l, i) => {
      const tile = parseFloat(l.style.backgroundSize) || 400
      const dots = [...l.style.backgroundImage.matchAll(/at ([\d.]+)px ([\d.]+)px, rgba\([^,]+,\s*([\d.]+)\) 0(?:px)? ([\d.]+)px/g)].map((m) => ({ x: +m[1], y: +m[2], a: +m[3] }))
      l.style.backgroundImage = 'none'
      return { l, tile, dots, i }
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
          g.fillStyle = `rgba(${rgb}, ${Math.min(0.5, dot.a * 2).toFixed(3)})`
          g.fillText((GLYPH[d.i] || GLYPH[1])[k % 3], dot.x, dot.y)
        })
        d.l.style.backgroundImage = `url(${c.toDataURL()})`
      }
    }
    bakeStars()
  }

  // ── input that only means something in the Lab ──────────────────────────────────────────
  function bindLab() {
    // the desk's own tiles are folding away while night falls: a click on one does nothing
    document.addEventListener('click', (e) => {
      if (st.t === 0) return
      const item = e.target.closest('.desk-dock__item[data-id], .desk-folder button')
      if (!item || item.dataset.id === 'lab') return
      e.stopImmediatePropagation()
      e.preventDefault()
    }, true)
    // capture, so it runs before desk.js's window listener: the desk's 0 / + / − never zoom at night
    document.addEventListener('keydown', (e) => {
      if (st.t === 0) return
      if (['0', '+', '=', '-'].includes(e.key)) e.stopPropagation()
      if (e.target.closest && e.target.closest('input, textarea')) return
      const canvas = e.key === '~' || e.key === '`'
      if (intro.playing()) {
        intro.skip()
        if (!canvas && e.key !== 'Tab') { e.preventDefault(); e.stopPropagation(); return }
      }
      if (reader.isOpen() || st.t < 1) return
      if (canvas) { e.preventDefault(); NIGHT.leave(); return }
      const s = SECTIONS.find((x) => x.key === e.key)
      if (s && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); menu.go(s.id); return }
      if (e.key === 'Escape' && menu.back()) e.preventDefault()
    }, true)
    // any click skips the intro too (and still does what it was for)
    el.lab.addEventListener('pointerdown', () => intro.skip(), true)
    // nothing in the Lab scrolls the page or pans anything: a wheel or a pinch outside the two
    // columns stops here, and the columns scroll themselves (menu.js)
    el.lab.addEventListener('wheel', (e) => { if (e.ctrlKey || !e.target.closest('.frame__body')) e.preventDefault() }, { passive: false })
    let resizeTimer = 0
    addEventListener('resize', () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => { if (st.t === 1 && !st.anim) { planDock(); dockAt(1) } }, 160)
    })
  }

  // ── proofs (throwaway): a readout of what a screenshot claims ────────────────────────────
  function badge(text, ok = true) {
    let b = document.querySelector('.proof')
    if (!b) { b = h('p', 'proof t-label'); b.setAttribute('role', 'status'); document.body.appendChild(b) }
    b.dataset.ok = ok
    b.textContent = text
  }
  // the 20th piece: push it, call this, and only its row appears
  window.renderLab = window.renderShelves = () => {
    const before = [...el.lab.querySelectorAll('li.ti')].length, dock = el.ldockNodes.map((n) => n.outerHTML).join('')
    const grid = getComputedStyle(el.lab.querySelector('.tui')).gridTemplateColumns
    const out = menu.render()
    for (const id of out.added) { const r = menu.rowEl(id); if (r) r.classList.add('is-new') }
    el.tick()
    const after = el.lab.querySelectorAll('li.ti').length
    const same = dock === el.ldockNodes.map((n) => n.outerHTML).join('') && grid === getComputedStyle(el.lab.querySelector('.tui')).gridTemplateColumns
    const ok = after === before + out.added.length && out.removed.length === 0 && out.kept === before && same
    badge(`${after} rows · +${out.added.length} in ${out.added.map((a) => '~/lab/' + a.split('/')[0]).join(', ') || '—'} · ${out.kept} of ${before} rows untouched · ` +
      `count changed in ${out.changed.join(', ') || '—'} · layout and dock ${same ? 'unchanged' : 'CHANGED'}`, ok)
    return out
  }
  // where every card and the hero are on screen, to the hundredth of a pixel
  const rects = () => Object.fromEntries([...Object.entries(DESK.cards).map(([id, c]) => [id, c.el]), ['hero', document.querySelector('.desk-hero')]]
    .map(([id, n]) => { const r = n.getBoundingClientRect(); return [id, [r.left, r.top, r.width, r.height]] }))
  const settled = () => document.fonts.ready.then(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))))
  function proof(what, before) {
    const now = rects()
    const d = (id) => Math.max(...before[id].map((v, i) => Math.abs(v - now[id][i])))
    const ids = Object.keys(before), off = ids.filter((id) => d(id) >= 0.01), worst = Math.max(...ids.map(d))
    badge(`${what} · ${ids.length - off.length} of ${ids.length} where they were · max Δ ${worst.toFixed(2)} px${off.length ? ' (' + off.join(', ') + ')' : ''}`, !off.length)
  }
  // /lab, or ?mode=night: straight in, no transition; the intro still plays (every visit)
  function land() {
    dir = 1; beginEnter(); apply(1)
    document.documentElement.classList.remove('is-turning')
    labTile().setAttribute('aria-label', C.canvasLabel)
    setURL(true)
    const sel = q.get('sel')
    if (sel && menu.rowEl(sel)) menu.select(sel)
    const deep = /^#\/(writing|experiments)\//.test(location.hash)
    if (deep) { intro.play({ fx: q.get('fx') }); intro.skip() } else playIntro({ focus: true })
    if (q.get('view') === 'detail' && phone()) menu.detail(true)
    if (q.get('add')) {
      // exactly what the brief asks a visitor to type in the console
      LAB.pieces.push({ slug: 'test-piece', title: 'Test piece', shelf: 'playground', kind: 'experiment', date: '2099-01' })
      window.renderLab()
    }
    // #/writing/<slug>: the post, open over the Lab, with no transition (nobody clicked)
    reader.sync({ instant: true })
    if (q.get('toc')) setTimeout(() => reader.toSection && reader.toSection(q.get('toc')), 50)
    if (q.get('fig') != null && reader.figOpen) setTimeout(() => reader.figOpen(+q.get('fig')), 300)
  }

  NIGHT.mount = () => {
    // the dock's text labels are CSS strings (night.css reads them); the words are copy.js's
    const root = document.documentElement.style
    root.setProperty('--lab-tile', JSON.stringify('← ' + C.canvas))
    reader.mount()
    buildLab()
    buildDock()
    menu.onSelect(menu.selected())
    buildSky()
    bindLab()
    if (document.fonts && document.fonts.load) document.fonts.load("12px 'JetBrains Mono'").then(() => { measureMono(); bakeStars(); if (st.t === 1) { planDock(); dockAt(1) } }, () => {})
    measureMono()
    apply(0)

    const freeze = q.get('freeze')
    if (freeze != null) { settled().then(() => { measureMono(); NIGHT.scrub(Math.min(1, Math.max(0, parseFloat(freeze) || 0))) }); return }
    const atNight = q.get('mode') === 'night' || q.get('lab') === '1' || /^#\/(writing|experiments)\//.test(location.hash)
    if (atNight && q.get('then') === 'desk') {
      // record the desk once it has painted, land in the Lab, go back, measure every card
      settled().then(() => {
        const desk = rects()
        land()
        setTimeout(() => NIGHT.leave().then(settled).then(() => proof(C.proof.back, desk)), 900)
      })
    } else if (atNight) settled().then(() => { measureMono(); land() })
    else if (q.get('roundtrip')) {
      // as a visitor would: drag a card, pan a little, then the Lab and back
      const about = DESK.cards.about
      about.x += 140; about.y += 50
      about.el.style.left = about.x + 'px'; about.el.style.top = about.y + 'px'
      const cam = DESK.camera
      DESK.flyTo((innerWidth / 2 - cam.x) / cam.s + 60, (innerHeight / 2 - cam.y) / cam.s - 30, cam.s, 0)
      settled().then(() => {
        const before = rects()
        return NIGHT.enter().then(() => new Promise((ok) => setTimeout(ok, 400))).then(() => NIGHT.leave()).then(settled).then(() => proof(C.proof.round, before))
      })
    } else if (q.get('enter')) setTimeout(() => NIGHT.enter(), 500)
  }
})()
