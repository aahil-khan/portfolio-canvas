/*
 * prototype/lab/night-mode/toy.js: the small ASCII toy in the Lab's top-right corner.
 *
 *   NIGHT.toy.mount()            builds the toy once (night.js); layouts move it into their slot
 *   NIGHT.toy.node               the element to place: <figure class="toy">
 *   NIGHT.toy.start({ fx })      a visit: a random toy (never last visit's), or ?fx=<id>
 *   NIGHT.toy.next()             [next]: the following toy in the pool, in order
 *   NIGHT.toy.set(id), .current(), .stop(), .active()
 *
 * fx.js draws; this file owns the state, the input and the clock. The clock runs only while the
 * toy can be seen: the Lab is open, no post is over it, the tab is visible, and the box is on
 * screen (an IntersectionObserver; the page layout scrolls it away). At most 30 frames a second.
 *
 * INPUT. The box is one Tab stop. Mouse, touch and keys all reach every toy:
 *   donut   drag to spin it (it coasts, then settles to an idle spin)    ← → ↑ ↓ spin
 *   warp    point (touch: drag) to steer                                 ← → ↑ ↓ steer
 *   life    click a cell to flip it, drag to draw; r reseeds             ← → ↑ ↓ cursor, space flips
 *   nebula  move (touch: drag) to stir it                                ← → ↑ ↓ stir
 *   moon    drag sideways to change the phase                            ← → phase
 * Nothing on the page moves: a drag here rewrites the box's own text, and only that.
 *
 * REDUCED MOTION (LAB.sky.reduced, the one owner): no clock at all. One still frame, redrawn when
 * a drag, a click or a key changes it: the donut turns as far as you drag and stops, the warp's
 * heading moves with no stars flying, life flips cells without running generations.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const C = () => NIGHT.copy
  const FX = () => NIGHT.fx
  const R = () => LAB.sky.reduced
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const touch = () => matchMedia('(hover: none)').matches
  // the box, in cells: 34 × 16 on a desk-sized screen, 22 × 11 on a phone
  const dims = () => (innerWidth < 700 ? { cols: 22, rows: 11 } : { cols: 34, rows: 16 })

  const T = (NIGHT.toy = {})
  const st = { id: null, s: null, last: null, run: 0, t: 0, seen: true, on: false, input: {}, cur: null, dims: null, seed: 3 }
  let el = {}

  T.mount = () => {
    const f = document.createElement('figure')
    f.className = 'toy'
    f.innerHTML = `<pre class="toy__fx" tabindex="0" role="img"></pre>` +
      `<figcaption class="toy__meta"><span class="toy__name"></span><span class="toy__hint"></span>` +
      `<button type="button" class="act toy__next" aria-label="${esc(C().toy.nextLabel)}">${esc(C().toy.next)}</button></figcaption>` +
      `<p class="toy__credit"></p>`
    el = { f, pre: f.querySelector('.toy__fx'), name: f.querySelector('.toy__name'), hint: f.querySelector('.toy__hint'), next: f.querySelector('.toy__next'), credit: f.querySelector('.toy__credit') }
    T.node = f
    el.next.addEventListener('click', () => T.next())
    bind()
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { st.seen = es[es.length - 1].isIntersecting; loop() }).observe(el.pre)
    document.addEventListener('visibilitychange', loop)
    addEventListener('resize', () => { const d = dims(); if (st.id && (d.cols !== st.dims.cols || d.rows !== st.dims.rows)) T.set(st.id) })
  }

  // ── which toy ────────────────────────────────────────────────────────────────────────────
  T.start = ({ fx } = {}) => {
    const forced = FX().ids.includes(fx)
    st.seed = forced ? 3 : 1 + Math.floor(Math.random() * 9999)
    T.set(forced ? fx : FX().pick(st.last))
    st.on = true
    loop()
  }
  T.set = (id) => {
    st.id = id
    st.last = id
    st.dims = dims()
    const { cols, rows } = st.dims
    st.s = FX().init(id, cols, rows, st.seed, NIGHT.moonPhase ? NIGHT.moonPhase() : 0.5)
    st.input = {}
    st.cur = id === 'life' ? [cols >> 1, rows >> 1] : null
    const meta = FX().list.find((x) => x.id === id), copy = C().toy.hints[id]
    el.f.dataset.fx = id
    el.name.textContent = meta.name
    el.hint.textContent = touch() ? copy.touch : copy.mouse
    el.credit.textContent = meta.credit
    el.pre.setAttribute('aria-label', C().toy.label(meta.name, copy.keys))
    paint()
  }
  T.next = () => { const ids = FX().ids; T.set(ids[(ids.indexOf(st.id) + 1) % ids.length]); loop() }
  T.current = () => st.id
  T.state = () => st.s
  T.stop = () => { st.on = false; loop() }
  T.active = () => !!st.run

  // ── the clock ────────────────────────────────────────────────────────────────────────────
  const visible = () => st.on && st.seen && !document.hidden && !(NIGHT.reader && NIGHT.reader.isOpen())
  function loop() {
    const go = visible() && !R()
    if (go && !st.run) { st.t = performance.now(); st.run = requestAnimationFrame(tick) }
    else if (!go && st.run) { cancelAnimationFrame(st.run); st.run = 0 }
  }
  T.wake = loop
  function tick(now) {
    st.run = 0
    if (!visible() || R()) return
    const dt = (now - st.t) / 1000
    if (dt >= 1 / 31) {
      st.t = now
      advance(dt)
      paint()
    }
    st.run = requestAnimationFrame(tick)
  }
  // fold what the pointer and keys did since the last frame into one step
  function advance(dt) {
    const i = st.input
    st.s = FX().step(st.id, st.s, dt, { held: i.held, dx: i.dx || 0, dy: i.dy || 0, aim: i.aim || i.kaim || null, stir: i.stir || null, flip: i.flip, reseed: i.reseed, paused: false })
    i.dx = i.dy = 0
    i.flip = null
    i.reseed = false
    if (i.stir) i.stir = { ...i.stir, m: 0 }
    if (i.kaim && performance.now() > i.kaimUntil) i.kaim = null
  }
  // reduced motion: the same input, applied at once, with no time passing
  function still() {
    if (!R()) { loop(); return }
    const i = st.input
    if (st.id === 'warp' && (i.aim || i.kaim)) { const a = i.aim || i.kaim; st.s = { ...st.s, hx: a.x, hy: a.y } }
    else st.s = FX().step(st.id, st.s, 0, { held: true, dx: i.dx || 0, dy: i.dy || 0, stir: i.stir, flip: i.flip, reseed: i.reseed, paused: true })
    i.dx = i.dy = 0; i.flip = null; i.reseed = false
    if (i.stir) i.stir = { ...i.stir, m: 0 }
    paint()
  }
  function paint() {
    let text = FX().draw(st.id, st.s, st.dims.cols, st.dims.rows)
    // life's keyboard cursor, while the box has focus
    if (st.cur && document.activeElement === el.pre) {
      const [c, r] = st.cur, k = r * (st.dims.cols + 1) + c
      text = text.slice(0, k) + (text[k] === 'o' ? '@' : '+') + text.slice(k + 1)
    }
    if (el.pre.textContent !== text) el.pre.textContent = text
  }

  // ── input ────────────────────────────────────────────────────────────────────────────────
  const cellAt = (e) => {
    const r = el.pre.getBoundingClientRect()
    return { c: Math.floor(((e.clientX - r.left) / r.width) * st.dims.cols), r: Math.floor(((e.clientY - r.top) / r.height) * st.dims.rows), x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, w: r.width, h: r.height }
  }
  function bind() {
    const pre = el.pre
    let down = null, lastCell = null
    pre.addEventListener('pointerdown', (e) => {
      if (e.button) return
      e.preventDefault()
      pre.focus({ preventScroll: true, focusVisible: false }) // a click is not a keyboard visit: no ring
      pre.setPointerCapture(e.pointerId)
      const p = cellAt(e)
      down = { x: e.clientX, y: e.clientY, p }
      st.input.held = st.id === 'donut'
      if (st.id === 'life') { st.input.flip = [[p.c, p.r]]; lastCell = p.c + ',' + p.r; st.cur = [p.c, p.r] }
      if (st.id === 'warp' || st.id === 'nebula') steer(e, p)
      still()
    })
    pre.addEventListener('pointermove', (e) => {
      const p = cellAt(e)
      if (down) {
        const cw = p.w / st.dims.cols, ch = p.h / st.dims.rows
        const dx = (e.clientX - down.x) / cw, dy = (e.clientY - down.y) / ch
        down.x = e.clientX; down.y = e.clientY
        st.input.dx = (st.input.dx || 0) + dx
        st.input.dy = (st.input.dy || 0) + dy
        if (st.id === 'life') {
          const key = p.c + ',' + p.r
          // drawing: each new cell the drag enters comes alive (flipping would flicker)
          if (key !== lastCell && st.s.a[p.r * st.dims.cols + p.c] === 0) (st.input.flip = st.input.flip || []).push([p.c, p.r])
          lastCell = key
        }
      }
      // the warp and the nebula answer a hovering mouse too; touch has no hover, so it drags
      if (down || e.pointerType === 'mouse') steer(e, p)
      if (down || e.pointerType === 'mouse') still()
    })
    const up = (e) => {
      if (!down) return
      down = null
      st.input.held = false
      if (e.pointerType !== 'mouse') { st.input.aim = null }
    }
    pre.addEventListener('pointerup', up)
    pre.addEventListener('pointercancel', up)
    pre.addEventListener('pointerleave', (e) => { if (!down && e.pointerType === 'mouse') st.input.aim = null })
    pre.addEventListener('keydown', key)
    pre.addEventListener('focus', paint)
    pre.addEventListener('blur', paint)
  }
  function steer(e, p) {
    if (st.id === 'warp') st.input.aim = { x: Math.max(-1, Math.min(1, p.x * 2 - 1)), y: Math.max(-1, Math.min(1, p.y * 2 - 1)) }
    if (st.id === 'nebula') {
      const prev = st.input.stir, m = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0
      st.input.stir = { x: p.x, y: p.y, m: (prev ? prev.m || 0 : 0) + m }
    }
  }
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  function key(e) {
    const a = ARROWS[e.key], i = st.input
    if (a) {
      const [x, y] = a
      if (st.id === 'donut') { if (R()) { i.dx = x * 4; i.dy = y * 4 } else st.s = { ...st.s, vb: st.s.vb + x * 1.4, va: st.s.va + y * 1.4 } }
      else if (st.id === 'warp') { const k = i.kaim || { x: 0, y: 0 }; i.kaim = { x: Math.max(-1, Math.min(1, k.x + x * 0.5)), y: Math.max(-1, Math.min(1, k.y + y * 0.5)) }; i.kaimUntil = performance.now() + 1500 }
      else if (st.id === 'life') { st.cur = [(st.cur[0] + x + st.dims.cols) % st.dims.cols, (st.cur[1] + y + st.dims.rows) % st.dims.rows]; paint() }
      else if (st.id === 'nebula') { const s0 = i.stir || { x: 0.5, y: 0.5, m: 0 }; i.stir = { x: Math.max(0, Math.min(1, s0.x + x * 0.08)), y: Math.max(0, Math.min(1, s0.y + y * 0.12)), m: (s0.m || 0) + 0.1 } }
      // the phase is a step, not a motion: it changes at once, with or without the clock
      else if (st.id === 'moon') { st.s = FX().step('moon', st.s, 0, { dx: x * 3 }); paint() }
    } else if ((e.key === ' ' || e.key === 'Enter') && st.id === 'life') i.flip = [st.cur]
    else if (e.key === 'r' && st.id === 'life') i.reseed = true
    else return
    e.preventDefault()
    e.stopPropagation()
    still()
  }
  // r reseeds life from anywhere in the Lab (night.js forwards it); the box need not have focus
  T.key = (k) => { if (k === 'r' && st.id === 'life' && st.on) { st.input.reseed = true; still(); return true } return false }
})()
