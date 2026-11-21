/*
 * prototype/lab/notebook/trip.js: the way from the canvas into the notebook and back.
 *
 *   NB.trip.mount()        after DESK.mount and NB.shell.mount: the sky, then where to start
 *   NB.trip.enter() / .leave() → Promise   the Lab tile (or L), ← canvas (or ~)
 *   NB.trip.scrub(t, back) hold the trip at t ∈ [0, 1] (?freeze=)
 *   NB.trip.live()         the Lab is up and still (keys work only then)
 *   NB.trip.timing         { in, out }: how long the last trip each way took, measured (ms)
 *   NB.trip.frame()        what a frozen frame shows: the bar's clip, the dock's top, … (e2e)
 *
 * ONE TIMELINE, a pure function of t: 0 → 1 over 1.2 s in, 1 → 0 over 1.2 s back, with
 * DIRECTION's easing, mirrored on the way back. Only transform, opacity and clip-path move, so the
 * way back lands every card exactly where it was (Δ0).
 *   0.00–0.60  night falls (a 160vh blind); each day card makes way as the dusk edge passes it
 *   0.10–0.45  the desk dock leaves: down by its height + --dock-bottom + 8 px, fading out
 *   0.25–0.70  ASCII stars come up, faint
 *   0.30–0.78  THE PILL BECOMES THE BAR. The full-width bar exists from t = 0; its
 *              clip-path: inset(… round r) runs from the pill's screen rect (measured once at the
 *              trip's start) to the whole bar. The pill fades 0.30–0.42 as the bar fades in; the
 *              bar's cells decode 0.55–0.84. Nothing reflows; the bar's text never wraps.
 *   0.50–0.85  the sidebar slides in from the left (desktop; on phone the drawer stays shut)
 *   0.52–1.00  the note decodes in place
 * THE THEME: the trip always lands in night (NB.prefs.trip); the sky is night on every theme.
 * REDUCED MOTION (LAB.sky.reduced, the one owner): a 0.32 s crossfade; the dock and the pill swap
 * at the midpoint; no decode.
 */
;(() => {
  const NB = (window.NB = window.NB || {})
  const C = NB.copy
  const R = () => LAB.sky.reduced
  const q = new URLSearchParams(location.search)
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const MS = { in: 1200, out: 1200, calm: 320 }
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
  const FALL = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
  const seg = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a))
  let dir = 1
  const ease = (p) => (dir > 0 ? EASE(p) : 1 - EASE(1 - p))
  const W = { dock: [0.1, 0.45], pill: [0.3, 0.78], pillFade: [0.3, 0.42], bar: [0.55, 0.84], side: [0.5, 0.85], note: [0.52, 1] }
  const nightAt = (b, y) => Math.min(1, Math.max(0, (1.6 * b - y) / 0.6))
  const phone = () => innerWidth < 900
  const T = (NB.trip = { timing: { in: null, out: null }, W })
  const st = { t: 0, anim: 0, queue: [], cards: [], pill: null, bar: null, dockDrop: 0, frame: null }
  let el = {}

  // ── plan, once per trip ─────────────────────────────────────────────────────────────────
  function planCards() {
    const cam = DESK.camera, s = cam.s
    const parts = [...Object.values(DESK.cards).map((c) => c.el), document.querySelector('.desk-hero')].filter(Boolean)
    st.cards = parts.map((node) => {
      const x = parseFloat(node.style.left) || 0, y = parseFloat(node.style.top) || 0
      const sx = (x + node.offsetWidth / 2) * s + cam.x, sy = (y + node.offsetHeight / 2) * s + cam.y
      let dx = sx - innerWidth / 2, dy = sy - innerHeight / 2
      const d = Math.hypot(dx, dy) || 1
      dx /= d; dy /= d
      const push = 150 / s
      return { node, dx: dx * push, dy: dy * push + 30 / s, sy: sy / innerHeight }
    })
  }
  function planChrome() {
    const pill = document.querySelector('.desk-pill')
    const was = pill.style.opacity
    pill.style.opacity = ''
    const p = pill.getBoundingClientRect()
    pill.style.opacity = was
    const b = el.bar.getBoundingClientRect()
    const prevT = el.bar.style.clipPath
    st.pill = { top: p.top, left: p.left, right: p.right, bottom: p.bottom, r: p.height / 2 }
    st.bar = { top: b.top, left: 0, right: innerWidth, bottom: b.bottom }
    el.bar.style.clipPath = prevT
    const dock = DESK.dock
    dock.style.transform = ''
    const dr = dock.getBoundingClientRect()
    const bottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-bottom')) || 28
    st.dockDrop = dr.height + bottom + 8
  }

  // ── the timeline ─────────────────────────────────────────────────────────────────────────
  function apply(t) {
    st.t = t
    const red = R(), root = document.documentElement
    root.classList.toggle('has-night', t > 0)
    root.classList.toggle('is-night', t > 0)
    const b = red ? 1 : FALL(seg(t, 0, 0.6))
    if (red) { el.blind.style.transform = 'none'; el.blind.style.opacity = seg(t, 0, 0.5) }
    else { el.blind.style.opacity = 1; el.blind.style.transform = `translateY(${((b - 1) * 100).toFixed(3)}%)` }
    // the stars stay only behind the full graph: they come up, then thin out by t = 1
    const stars = red ? 0 : 0.5 * seg(t, 0.25, 0.7) * (1 - 0.7 * seg(t, 0.7, 1))
    el.field.style.opacity = stars.toFixed(3)
    DESK.grid.style.opacity = 1 - (red ? seg(t, 0, 0.5) : seg(t, 0.04, 0.45))
    const zoom = document.querySelector('.desk-zoom')
    if (zoom) { const o = 1 - (red ? seg(t, 0, 0.4) : nightAt(b, 0.06)); zoom.style.opacity = t ? o : ''; zoom.style.visibility = t && o === 0 ? 'hidden' : '' }
    for (const c of st.cards) {
      const s = c.node.style
      if (t === 0) { s.opacity = s.translate = s.scale = s.visibility = ''; continue }
      const p = red ? seg(t, 0, 0.5) : nightAt(b, c.sy), e = EASE(p)
      s.opacity = (1 - p).toFixed(3)
      s.translate = red ? '' : `${(c.dx * e).toFixed(2)}px ${(c.dy * e).toFixed(2)}px`
      s.scale = red ? '' : (1 - 0.06 * e).toFixed(4)
      s.visibility = p >= 1 ? 'hidden' : ''
    }

    // the dock leaves: one transform on DESK.dock, no Lab dock in its place
    const dock = DESK.dock
    const dp = red ? (t >= 0.5 ? 1 : 0) : ease(seg(t, ...W.dock))
    dock.style.transform = t === 0 ? '' : `translateX(-50%) translateY(${(dp * st.dockDrop).toFixed(2)}px)`
    dock.style.opacity = t === 0 ? '' : (1 - (red ? dp : seg(t, 0.1, 0.45))).toFixed(3)
    dock.style.pointerEvents = t > 0 ? 'none' : ''
    dock.style.visibility = t > 0 && dp >= 1 ? 'hidden' : ''

    // the pill becomes the bar: clip-path from the pill's rect to the bar's, and a crossfade
    const pill = document.querySelector('.desk-pill')
    const pp = red ? (t >= 0.5 ? 1 : 0) : ease(seg(t, ...W.pill))
    const P = st.pill || { top: 0, left: 0, right: innerWidth, bottom: 44, r: 0 }, B = st.bar || { top: 0, left: 0, right: innerWidth, bottom: 44 }
    const lerp = (a, z) => a + (z - a) * pp
    const top = Math.max(0, lerp(P.top - B.top, 0)), left = lerp(P.left, 0), right = lerp(innerWidth - P.right, 0), bottom = Math.max(0, lerp((B.bottom - B.top) - (P.bottom - B.top), 0)), rad = lerp(P.r, 0)
    st.frame = { t, clip: [top, right, bottom, left, rad], dockTop: dock.getBoundingClientRect ? null : null }
    el.bar.style.clipPath = t >= 1 ? '' : `inset(${top.toFixed(2)}px ${right.toFixed(2)}px ${bottom.toFixed(2)}px ${left.toFixed(2)}px round ${rad.toFixed(2)}px)`
    const fade = red ? (t >= 0.5 ? 1 : 0) : seg(t, ...W.pillFade)
    if (pill) { pill.style.opacity = t === 0 ? '' : (1 - fade).toFixed(3); pill.style.visibility = t > 0 && fade >= 1 ? 'hidden' : ''; pill.style.pointerEvents = t > 0 ? 'none' : '' }
    el.bar.style.opacity = t >= 1 ? '' : fade.toFixed(3)
    el.strip.style.opacity = t >= 1 ? '' : seg(t, 0.8, 1).toFixed(3)

    // the sidebar slides in (desktop); the panes fade up under the note
    const sp = red ? seg(t, 0.4, 1) : ease(seg(t, ...W.side))
    el.side.style.transform = t >= 1 || phone() ? '' : `translateX(${(-(1 - sp) * 100).toFixed(2)}%)`
    el.side.style.opacity = t >= 1 ? '' : phone() ? '' : (red ? sp : Math.min(1, sp * 1.5)).toFixed(3)
    const np = red ? seg(t, 0.4, 1) : seg(t, 0.5, 0.8)
    for (const n of [el.main, el.margin, el.bg]) n.style.opacity = t >= 1 ? '' : np.toFixed(3)
    el.root.inert = t < 1
    decodeAt(t, red)
  }

  // ── the decode: what is on screen, staggered; the bar's cells in their own window ─────────
  let decoders = []
  const texts = (root) => {
    const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/\S/.test(n.nodeValue) ? 1 : 2) })
    while (w.nextNode()) out.push(w.currentNode)
    return out
  }
  const onScreen = (n) => { const r = n.parentElement.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0 }
  function collectDecoders() {
    decoders = []
    const main = [...texts(el.main), ...texts(el.margin)].filter(onScreen).slice(0, 220)
    main.forEach((n, j) => { const a = W.note[0] + 0.24 * (j / Math.max(1, main.length - 1)); decoders.push({ node: n, text: n.nodeValue, a, b: Math.min(1, a + 0.24), seed: 900 + j }) })
    const bar = texts(el.bar)
    bar.forEach((n, i) => { const a = W.bar[0] + 0.15 * (i / Math.max(1, bar.length - 1)); decoders.push({ node: n, text: n.nodeValue, a, b: Math.min(W.bar[1], a + 0.14), seed: 201 + i }) })
  }
  function decodeAt(t, red) {
    for (const d of decoders) {
      const p = red || t === 0 || t >= 1 ? 1 : seg(t, d.a, d.b)
      const v = NIGHT.decode(d.text, p, d.seed)
      if (d.node.nodeValue !== v) d.node.nodeValue = v
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
        T.timing[to === 1 ? 'in' : 'out'] = Math.round(performance.now() - t0)
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
    if (!/^#\//.test(location.hash)) setHash('#/')
    NB.shell.show()
    planCards()
    planChrome()
    collectDecoders()
  }
  function beginLeave() {
    NB.narrator.stop()
    NB.shell.closeDrawer(true)
    while (NB.shell.closeLayer()) { /* every layer */ }
    document.documentElement.classList.remove('nb-on')
    scrollTo(0, 0)
    el.main.scrollTop = 0
    planCards()
    planChrome()
    collectDecoders()
  }
  function finish(to) {
    const root = document.documentElement
    root.classList.remove('is-turning')
    decoders = []
    if (to === 1) {
      root.classList.add('nb-on')
      const t = document.querySelector('.nb-title')
      if (t) t.focus({ preventScroll: true })
      if (NIGHT.sound) NIGHT.sound.cue('boot')
    } else {
      root.classList.remove('nb-on')
      setHash('#desk')
      document.title = C.title(C.trip.tile)
      const a = document.activeElement
      if (!a || a === document.body || el.root.contains(a)) labTile().focus({ preventScroll: true })
    }
  }
  function setHash(hh) { try { history.replaceState(null, '', hh) } catch { location.hash = hh } }

  // the trip lands in night, whatever was chosen (NB.prefs; not stored, so a reload keeps the choice)
  T.enter = () => { if (st.t === 0 && !st.anim) NB.prefs.trip(); return run(1) }
  T.leave = () => run(0)
  T.toggle = () => (st.t > 0.5 || (st.anim && dir > 0) ? run(0) : T.enter())
  T.scrub = (t, back = false) => { if (st.t === 0) { dir = back ? -1 : 1; beginEnter() } dir = back ? -1 : 1; apply(t) }
  T.live = () => st.t === 1 && !st.anim
  T.state = st
  T.frame = () => {
    const d = DESK.dock.getBoundingClientRect(), b = el.bar.getBoundingClientRect(), s = el.side.getBoundingClientRect()
    const cells = [...el.bar.querySelectorAll('.nb-bar__cell')].filter((c) => c.offsetParent !== null).map((c) => c.getBoundingClientRect())
    return { t: st.t, clip: st.frame ? st.frame.clip : null, pill: st.pill, bar: st.bar, dockTop: d.top, dockOpacity: +getComputedStyle(DESK.dock).opacity, barBottom: b.bottom, sideTop: s.top, sideShown: getComputedStyle(el.side).visibility !== 'hidden' && s.right > 0, cellsTop: cells.map((r) => r.top), cellsH: cells.map((r) => r.height), iw: innerWidth, ih: innerHeight }
  }

  // ── the sky ─────────────────────────────────────────────────────────────────────────────
  T.bakeStars = () => {}
  function buildSky() {
    const n = h('div', 'night lab-sky')
    n.setAttribute('aria-hidden', 'true')
    n.innerHTML = '<div class="night__blind"></div><div class="night__field"><div class="lab-starfield"></div></div>'
    DESK.backdrop.appendChild(n)
    el.blind = n.querySelector('.night__blind')
    el.field = n.querySelector('.night__field')
    LAB.sky.starfield(n.querySelector('.lab-starfield'), { seed: 11 })
    const depths = [...n.querySelectorAll('.lab-starfield__layer')].map((l, i) => {
      const tile = parseFloat(l.style.backgroundSize) || 400
      const dots = [...l.style.backgroundImage.matchAll(/at ([\d.]+)px ([\d.]+)px, rgba\([^,]+,\s*([\d.]+)\) 0(?:px)? ([\d.]+)px/g)].map((m) => ({ x: +m[1], y: +m[2], a: +m[3] }))
      l.style.backgroundImage = 'none'
      return { l, tile, dots, i }
    })
    const GLYPH = [['.', '.', '·'], ['·', '·', '+'], ['+', '*', '+']], SIZE = [11, 12, 14]
    T.bakeStars = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      const rgb = getComputedStyle(document.documentElement).getPropertyValue('--lab-star').trim() || '237, 234, 224'
      for (const d of depths) {
        const c = document.createElement('canvas'), g = c.getContext('2d')
        c.width = c.height = Math.round(d.tile * dpr)
        g.scale(dpr, dpr)
        g.font = `${SIZE[d.i] || 12}px 'JetBrains Mono', ui-monospace, monospace`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        d.dots.forEach((dot, k) => { g.fillStyle = `rgba(${rgb}, ${Math.min(0.5, dot.a * 2).toFixed(3)})`; g.fillText((GLYPH[d.i] || GLYPH[1])[k % 3], dot.x, dot.y) })
        d.l.style.backgroundImage = `url(${c.toDataURL()})`
      }
    }
    T.bakeStars()
  }

  // ── proofs (throwaway): a readout of what was measured ──────────────────────────────────
  T.badge = (text, ok = true) => {
    let b = document.querySelector('.proof')
    if (!b) { b = h('p', 'proof'); b.setAttribute('role', 'status'); document.body.appendChild(b) }
    b.dataset.ok = ok
    b.textContent = text
  }
  const rects = () => Object.fromEntries([...Object.entries(DESK.cards).map(([id, c]) => [id, c.el]), ['hero', document.querySelector('.desk-hero')]]
    .map(([id, n]) => { const r = n.getBoundingClientRect(); return [id, [r.left, r.top, r.width, r.height]] }))
  T.rects = rects
  const settled = () => document.fonts.ready.then(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))))
  function proof(what, before) {
    const now = rects()
    const d = (id) => Math.max(...before[id].map((v, i) => Math.abs(v - now[id][i])))
    const ids = Object.keys(before), off = ids.filter((id) => d(id) >= 0.01), worst = Math.max(...ids.map(d))
    T.lastDelta = worst
    T.badge(`${what} · ${ids.length - off.length} of ${ids.length} where they were · max Δ ${worst.toFixed(2)} px${off.length ? ' (' + off.join(', ') + ')' : ''}`, !off.length)
  }

  // a direct link: the Lab, at once, with the desk mounted (untouched) under it at t = 1
  function land() {
    dir = 1
    beginEnter()
    apply(1)
    finish(1)
    if (q.get('add')) NB.shell.addProof()
    // a direct landing never painted the desk: decode its images while idle, so the way back
    // does not decode them mid-trip
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200))
    idle(() => { for (const img of DESK.world.querySelectorAll('img')) if (img.decode) img.decode().catch(() => {}) })
  }

  T.mount = () => {
    el = {
      root: NB.shell.el.root, bar: NB.shell.el.bar, strip: NB.shell.el.strip, side: NB.shell.el.side, main: NB.shell.el.main, margin: NB.shell.el.margin,
      bg: NB.shell.el.root.querySelector('.nb-panes-bg'),
    }
    buildSky()
    if (document.fonts && document.fonts.load) document.fonts.load("12px 'JetBrains Mono'").then(() => T.bakeStars(), () => {})
    // L on the desk opens the Lab (only while the desk is up)
    addEventListener('keydown', (e) => {
      if (st.t !== 0 || st.anim || e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input, textarea'))) return
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); T.enter() }
    })
    apply(0)
    const freeze = q.get('freeze')
    if (freeze != null) { settled().then(() => T.scrub(Math.min(1, Math.max(0, parseFloat(freeze) || 0)), q.get('back') === '1')); return }
    if (q.get('roundtrip')) {
      if (location.hash !== '#desk') setHash('#desk')
      const about = DESK.cards.about
      about.x += 140; about.y += 50
      about.el.style.left = about.x + 'px'; about.el.style.top = about.y + 'px'
      const cam = DESK.camera
      DESK.flyTo((innerWidth / 2 - cam.x) / cam.s + 60, (innerHeight / 2 - cam.y) / cam.s - 30, cam.s, 0)
      settled().then(() => {
        const before = rects()
        return T.enter().then(() => new Promise((ok) => setTimeout(ok, 400))).then(() => T.leave()).then(settled).then(() => {
          proof(C.proof.round, before)
          document.querySelector('.proof').textContent += ' · ' + C.proof.trip(T.timing.in, T.timing.out)
          T.roundtrip = { delta: T.lastDelta, in: T.timing.in, out: T.timing.out }
        })
      })
      return
    }
    if (location.hash === '#desk') { document.title = C.title(C.trip.tile); if (q.get('enter')) setTimeout(() => T.enter(), 500); return }
    settled().then(land)
  }
})()
