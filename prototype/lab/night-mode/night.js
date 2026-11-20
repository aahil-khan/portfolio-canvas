/*
 * prototype/lab/night-mode/night.js: the way into the Lab, and the Lab screen itself.
 *
 * THE LAB IS NOT A CANVAS. Night falls over the desk as in #17, quickly now, and the desk is
 * replaced by a fixed, full-viewport screen: the home (home.js, the directory; the compass behind
 * a flag), the toy (toy.js) and THE DECK (deck.js): the desk's own dock, morphed into a status line
 * of controls. The deck is not navigation; its ← canvas is the one way back. Nothing in the screen
 * pans or zooms, and the camera never moves: the desk is left exactly where it was, under the
 * night, and is there again when the night lifts.
 *
 *   NIGHT.mount()          after DESK.mount: builds the Lab screen, the deck's cells and the sky
 *   NIGHT.enter() / .leave() / .toggle() → Promise   (the Lab tile, ← canvas and ~)
 *   NIGHT.scrub(t)         holds the transition at t ∈ [0, 1] (?freeze=)
 *   NIGHT.setPalette(id)   white | green | amber (the deck's pal: flag; ?palette=)
 *   NIGHT.timing           { in, out }: how long the last trip each way took, measured (ms)
 *   window.renderLab()     re-renders the home from LAB.pieces and reports what changed
 *
 * THE TRANSITION, one timeline, a pure function of t: 0 → 1 over 0.7 s in, 1 → 0 over 0.6 s back,
 * and nothing plays after it (the old full-screen intro is gone).
 *   0.00–0.60  night falls from the top (a 160vh blind, a warm dusk edge), and each day card makes
 *              way as the dusk edge passes it. Only translate, scale and opacity, never left/top,
 *              so on the way back every card lands where it was.
 *   0.25–0.70  the ASCII stars come up
 *   0.30–0.78  THE DOCK MORPHS in place into the deck: the desk's tiles fold away, the Lab tile turns
 *              into ← canvas and the deck's cells open out before it
 *   0.50–0.80  the Lab screen fades in, and its words decode in place, done by t = 1
 * Going back is the same timeline backwards with mirrored easing. The toy starts at once.
 * REDUCED MOTION (LAB.sky.reduced, the one owner): a 0.32 s crossfade. No drift, no blind, no
 * scramble; the dock swaps at the midpoint.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const home = NIGHT.home, toy = NIGHT.toy, reader = NIGHT.reader, deck = NIGHT.deck, C = NIGHT.copy
  const R = () => LAB.sky.reduced
  const q = new URLSearchParams(location.search)
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const PALETTES = Object.keys(C.palettes)
  const SECTIONS = NIGHT.model.SECTIONS
  const MS = { in: 700, out: 600, calm: 320 }

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
  const seg = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a))
  let dir = 1 // +1 into night, −1 back to day: easing mirrors so both directions decelerate
  const ease = (p) => (dir > 0 ? EASE(p) : 1 - EASE(1 - p))
  // THE DECODE: the screen's words staggered 0.52–1.00; the deck's words
  // 0.57–0.84. On the way back the same windows play backwards.
  const DECODE = { main: [0.52, 0.22, 0.26], dock: [0.55, 0.15, 0.12] }
  const DOCK = [0.3, 0.78], SCREEN = [0.5, 0.8]

  const st = { t: 0, anim: 0, queue: [], cards: [], dock: null }
  const phone = () => innerWidth < 700
  // under 1180 px the deck is its narrow form: mode, ▸, ⋯ and ← canvas
  const narrow = () => innerWidth < 1180
  let el = {}
  NIGHT.timing = { in: null, out: null }

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

  // ── the dock becomes the deck ───────────────────────────────────────────────────────────
  // The desk's panel morphs in place: its tiles fold away, the Lab tile turns into ← canvas, and
  // the deck's cells open out before it. Each cell's width is a fixed count of characters in the
  // mono face (data-ch wide, data-chp narrow; measured once the face has loaded), never content:
  // a ticking clock or a new piece never changes the deck.
  let chW = { 12: 7.2, 11: 6.6 }
  function measureMono() {
    const c = document.createElement('canvas').getContext('2d')
    for (const px of [12, 11]) { c.font = `500 ${px}px 'JetBrains Mono', ui-monospace, monospace`; chW[px] = c.measureText('0000000000').width / 10 }
  }
  function planDock() {
    const panel = DESK.dock.querySelector('.desk-dock__panel'), cs = getComputedStyle(document.documentElement)
    const size = parseFloat(cs.getPropertyValue('--dock-size')), gap = parseFloat(cs.getPropertyValue('--dock-gap')), pad = parseFloat(cs.getPropertyValue('--dock-pad'))
    const nw = narrow(), ph = phone(), px = ph ? 11 : 12, padX = ph ? 8 : 10, H1 = 34
    document.documentElement.dataset.deck = nw ? 'narrow' : 'wide'
    const w = (chars) => Math.ceil(chars * chW[px] + padX * 2)
    const items = []
    for (const node of panel.children) {
      if (node.classList.contains('ldock')) {
        const ch = +node.dataset[nw ? 'chp' : 'ch'] || 0
        items.push(ch ? { node, kind: 'grow', w1: w(ch) } : { node, kind: 'skip' })
      } else if (node.classList.contains('ldock-sep')) items.push(+node.dataset[nw ? 'chp' : 'ch'] ? { node, kind: 'grow', w1: 1 } : { node, kind: 'skip' })
      else if (node.dataset.id === 'lab') items.push({ node, kind: 'morph', w1: w(('← ' + C.canvas).length) })
      else if (node.classList.contains('desk-dock__item') || node.classList.contains('desk-dock__sep')) items.push({ node, kind: 'fold' })
    }
    st.dock = { panel, size, gap, pad, H1, P1: ph ? 4 : 6, items }
  }
  const DOCK_PROPS = ['width', 'height', 'margin-right', 'opacity', 'visibility', '--lo', '--io']
  function dockDay(d) {
    for (const it of d.items) for (const p of DOCK_PROPS) it.node.style.removeProperty(p)
    d.panel.style.removeProperty('padding')
  }
  function dockAt(t) {
    const d = st.dock
    if (!d) return
    if (t === 0) { dockDay(d); return }
    const k = R() ? (t >= 0.5 ? 1 : 0) : ease(seg(t, DOCK[0], DOCK[1]))
    const hgt = (d.size + (d.H1 - d.size) * k).toFixed(2) + 'px'
    for (const it of d.items) {
      const s = it.node.style
      if (it.kind === 'skip') { for (const p of DOCK_PROPS) s.removeProperty(p); continue }
      if (it.kind === 'fold') {
        const sep = it.node.classList.contains('desk-dock__sep')
        if (!sep) { s.width = (d.size * (1 - k)).toFixed(2) + 'px'; s.height = hgt }
        s.marginRight = (-d.gap * k).toFixed(2) + 'px'
        s.opacity = (1 - seg(k, 0, 0.55)).toFixed(3)
        s.visibility = k >= 1 ? 'hidden' : ''
        if (sep && k >= 1) s.width = '0px'
        else if (sep) s.removeProperty('width')
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
    root.classList.toggle('is-night', t >= SCREEN[0])

    // night falls, top to bottom (reduced motion: it fades)
    const b = red ? 1 : FALL(seg(t, 0, 0.6))
    if (red) { el.blind.style.transform = 'none'; el.blind.style.opacity = seg(t, 0, 0.5) }
    else { el.blind.style.opacity = 1; el.blind.style.transform = `translateY(${((b - 1) * 100).toFixed(3)}%)` }
    // the stars stay faint: with no panels, text sits right on the sky
    el.field.style.opacity = (0.5 * seg(t, 0.25, 0.7)).toFixed(3)
    DESK.grid.style.opacity = 1 - (red ? seg(t, 0, 0.5) : seg(t, 0.04, 0.45))
    const chromeO = 1 - (red ? seg(t, 0, 0.4) : nightAt(b, 0.06))
    for (const n of [document.querySelector('.desk-pill'), document.querySelector('.desk-zoom')]) {
      if (!n) continue
      n.style.opacity = t ? chromeO : ''
      n.style.visibility = t && chromeO === 0 ? 'hidden' : ''
    }

    // the desk makes way: each card goes as the dusk edge passes it, and comes back as dawn does
    for (const c of st.cards) {
      const s = c.node.style
      if (t === 0) { s.opacity = s.translate = s.scale = s.visibility = ''; continue }
      const p = red ? seg(t, 0, 0.5) : nightAt(b, c.sy), e = EASE(p)
      s.opacity = (1 - p).toFixed(3)
      s.translate = red ? '' : `${(c.dx * e).toFixed(2)}px ${(c.dy * e).toFixed(2)}px`
      s.scale = red ? '' : (1 - 0.06 * e).toFixed(4)
      s.visibility = p >= 1 ? 'hidden' : ''
    }

    dockAt(t)

    // the Lab screen fades in (out) and its words decode
    el.lab.inert = t < SCREEN[0]
    el.lab.style.opacity = red ? seg(t, 0.4, 1) : seg(t, SCREEN[0], SCREEN[1])
    decodeAt(t, red)
  }

  // ── the decode, one more pure-of-t segment ───────────────────────────────────────────────
  let decoders = []
  const texts = (root) => {
    const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/\S/.test(n.nodeValue) && !n.parentElement.closest('.toy__fx, [hidden]') ? 1 : 2) })
    while (w.nextNode()) out.push(w.currentNode)
    return out
  }
  // only what is on screen decodes (an open category can run below the fold); the rest just fades
  const onScreen = (n) => { const r = n.parentElement.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0 }
  function collectDecoders() {
    decoders = []
    const [m0, cap, len] = DECODE.main, nodes = texts(el.main).filter(onScreen).slice(0, 160)
    nodes.forEach((n, j) => { const a = m0 + cap * (j / Math.max(1, nodes.length - 1)); decoders.push({ node: n, text: n.nodeValue, a, b: Math.min(1, a + len), seed: 900 + j }) })
    const [d0, dLen, dStep] = DECODE.dock
    // the Lab tile's label is a CSS string (--g, night.css): written inline while it plays
    const lab = labTile().querySelector('.desk-dock__icon')
    lab.style.removeProperty('--g')
    const g = getComputedStyle(lab).getPropertyValue('--g').trim().replace(/^["']|["']$/g, '')
    if (g) decoders.push({ dock: lab, text: g, a: d0, b: d0 + dLen, seed: 101 })
    // the deck's words, staggered over dStep in all (there are dozens): done by t = 0.84
    const dn = el.ldockNodes.filter((n) => +n.dataset[narrow() ? 'chp' : 'ch'] > 0).flatMap((n) => texts(n))
    dn.forEach((n, i) => { const a = d0 + 0.02 + dStep * (i / Math.max(1, dn.length - 1)); decoders.push({ node: n, text: n.nodeValue, a, b: a + dLen, seed: 201 + i }) })
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
      const from = st.t, ms = (R() ? MS.calm : dir > 0 ? MS.in : MS.out) * Math.abs(to - from), t0 = performance.now()
      const step = (now) => {
        const p = ms ? Math.min(1, (now - t0) / ms) : 1
        apply(from + (to - from) * p)
        if (p < 1) { st.anim = requestAnimationFrame(step); return }
        st.anim = 0
        finish(to)
        // measured from the click's frame to the last frame, decode included
        NIGHT.timing[to === 1 ? 'in' : 'out'] = Math.round(performance.now() - t0)
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
    planCards()
    planDock()
    toy.start({ fx: q.get('fx') })
    collectDecoders()
  }
  function beginLeave() {
    toy.stop()
    deck.close()
    NIGHT.voice.stop()
    reader.closeNow()
    planDock()
    collectDecoders()
  }
  function finish(to) {
    document.documentElement.classList.remove('is-turning')
    const lab = labTile(), a = document.activeElement
    home.live()
    if (to === 1) {
      lab.setAttribute('aria-label', C.canvasLabel)
      setURL(true)
      // came in by keyboard: focus goes to the first row of the directory (the way back is ~,
      // or the deck's ← canvas, which is the tile that was just pressed)
      if (!a || a === document.body || a === lab) { const f = home.first(); (f || lab).focus({ preventScroll: true }) }
      if (NIGHT.sound) NIGHT.sound.cue('boot')
    } else {
      lab.setAttribute('aria-label', 'Lab') // desk.js's own label for it
      setURL(false)
      if (!a || a === document.body || el.lab.contains(a) || DESK.dock.contains(a)) lab.focus({ preventScroll: true })
    }
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

  // ── the Lab screen: the home, and the deck in the desk's dock ───────────────────────────
  function buildLab() {
    const lab = h('div', 'lab')
    lab.id = 'lab'
    lab.inert = true
    lab.setAttribute('aria-label', C.labLabel)
    lab.setAttribute('role', 'region')
    lab.innerHTML = `<div class="lab__main"></div>`
    document.body.insertBefore(lab, DESK.dock) // in the Tab order: the home, then the deck
    el.lab = lab
    el.main = lab.querySelector('.lab__main')
    const want = q.get('palette')
    NIGHT.setPalette(PALETTES.includes(want) ? want : 'white', true)
    toy.mount()
    const radial = q.get('home') === 'radial'
    home.mount(el.main, { home: radial ? 'radial' : 'dir', radialFlag: radial })
  }
  // the deck's cells, inside the desk's panel, before the Lab tile; display:none by day
  function buildDock() {
    deck.mount()
    if (q.get('home') === 'radial') deck.setRadial(true)
    el.ldock = DESK.dock.querySelector('.desk-dock__panel')
    el.ldockNodes = [...el.ldock.querySelectorAll('.ldock')]
  }
  // the palette: the deck's pal: flag cycles it. ?palette=green|amber.
  NIGHT.setPalette = (id, first) => {
    if (!PALETTES.includes(id)) return
    document.documentElement.dataset.palette = id
    if (!first) {
      bakeStars()
      try { const u = new URL(location.href); u.searchParams.set('palette', id); history.replaceState(null, '', u) } catch { /* file:// */ }
    }
  }
  NIGHT.lab = { live: () => st.t === 1 && !st.anim }

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
      if (reader.isOpen() || st.t < 1) return
      // the deck's keys first (space , . [ ] v n / ? and Esc for an open popover)
      if (deck.key(e)) return
      if (e.target.closest && e.target.closest('input, textarea, select')) return
      if (e.metaKey || e.ctrlKey || e.altKey || deck.popOpen()) return
      if (e.key === '~' || e.key === '`') { e.preventDefault(); NIGHT.leave(); return }
      const s = SECTIONS.find((x) => x.key === e.key)
      if (s) { e.preventDefault(); if (!home.commitKey(e.key)) home.go(s.id); return }
      if (e.key === 'r' && !(e.target.closest && e.target.closest('.toy__fx')) && toy.key('r')) { e.preventDefault(); return }
      if (e.key === 'Escape' && home.back()) e.preventDefault()
    }, true)
    // a pinch (ctrl + wheel) never zooms anything in the Lab; plain wheels scroll its own columns
    el.lab.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault() }, { passive: false })
    reader.onchange = () => toy.wake()
  }

  // ── proofs (throwaway): a readout of what a screenshot claims ────────────────────────────
  function badge(text, ok = true) {
    let b = document.querySelector('.proof')
    if (!b) { b = h('p', 'proof t-label'); b.setAttribute('role', 'status'); document.body.appendChild(b) }
    b.dataset.ok = ok
    b.textContent = text
  }
  // the 20th piece: push it, call this, and only its row appears (its category opens)
  window.renderLab = window.renderShelves = () => {
    const dock = el.ldockNodes.map((n) => n.outerHTML).join('')
    const out = home.render()
    for (const id of out.added) { const r = home.root().querySelector(`[data-row="${CSS.escape(id)}"]`); if (r) { r.classList.add('is-new'); r.scrollIntoView({ block: 'center' }) } }
    const same = dock === el.ldockNodes.map((n) => n.outerHTML).join('')
    const ok = out.added.length > 0 && out.removed.length === 0 && out.kept === out.before && same
    badge(`directory · +${out.added.length} in ${out.added.map((a) => a.split('/')[0]).join(', ') || '—'} · ${out.kept} of ${out.before} rows untouched · ` +
      `count changed in ${out.changed.join(', ') || '—'} · deck ${same ? 'unchanged' : 'CHANGED'}`, ok)
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
  // /lab, or ?mode=night: straight in, no transition
  function land() {
    dir = 1; beginEnter(); apply(1)
    document.documentElement.classList.remove('is-turning')
    labTile().setAttribute('aria-label', C.canvasLabel)
    setURL(true)
    home.live()
    const sel = q.get('sel')
    if (sel) home.select(sel)
    if (q.get('voice')) NIGHT.voice.use(q.get('voice'))
    // a popover open on arrival, for screenshots (?pop=voice|knobs|ask|cmd|help|more). Never ▸.
    if (q.get('pop')) setTimeout(() => deck.open(q.get('pop'), labTile()), 60)
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
    document.documentElement.style.setProperty('--lab-tile', JSON.stringify('← ' + C.canvas))
    reader.mount()
    buildLab()
    buildDock()
    buildSky()
    bindLab()
    if (document.fonts && document.fonts.load) document.fonts.load("12px 'JetBrains Mono'").then(() => { measureMono(); bakeStars(); if (st.t === 1) { planDock(); dockAt(1) } }, () => {})
    measureMono()
    apply(0)
    let resizeTimer = 0
    addEventListener('resize', () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => { if (st.t === 1 && !st.anim) { planDock(); dockAt(1) } }, 160)
    })

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
        return NIGHT.enter().then(() => new Promise((ok) => setTimeout(ok, 400))).then(() => NIGHT.leave()).then(settled).then(() => {
          proof(C.proof.round, before)
          const b = document.querySelector('.proof')
          b.textContent += ' · ' + C.proof.trip(NIGHT.timing.in, NIGHT.timing.out)
        })
      })
    } else if (q.get('enter')) setTimeout(() => NIGHT.enter(), 500)
  }
})()
