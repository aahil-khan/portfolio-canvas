/*
 * prototype/lab/notebook/motion.js: every animation the notebook runs in JS, and the one place
 * that decides how it runs (round 5 of the readability fixes, M1–M8). CSS transitions (hover,
 * the tree's bar, chevrons, the drawer) are notebook.css's, on the same easing and durations.
 *
 *   NB.motion.reduced()               LAB.sky.reduced: the one owner of prefers-reduced-motion
 *   NB.motion.EASE, .ease(t)          DIRECTION's one easing, as CSS and as a function (rAF)
 *   NB.motion.D                       the durations, ms; .R is the reduced cap (120)
 *   NB.motion.play(el, frames, ms, o) WAAPI on the easing. Nothing is ever left filled, so at rest
 *                                     document.getAnimations() is empty
 *   NB.motion.swap(o)                 M1 note to note: the old column fades out (120), the scroll
 *                                     resets while nothing shows, the new one rises in (220)
 *   NB.motion.panes(apply, out, ps)   M7 focus mode and the sidebar: panes leave, then the grid
 *                                     switches once; they come back the other way round
 *   NB.motion.strip(el, show, done)   M3 the narration strip's row, 0 → its height (180)
 *   NB.motion.fadeIn(el, ms, delay)   a plain opacity fade in
 *   NB.motion.flash(target, host)     M8 an anchor jump's target: a highlight fading over 600
 *   NB.motion.snap(fn)                runs fn with CSS transitions off (a theme change): what the
 *                                     reader did not point at never colour-fades. A navigation does
 *                                     the same for just the rows it changes (shell.js markTree)
 *   NB.motion.camera(from, to, w, h, write, done)   M5 the graph's camera over 450 (rAF)
 *
 * SUBTLE means it never delays reading: nothing waits for an animation before it is in the DOM,
 * focusable and measurable (the router stays synchronous; M1 fades a ghost of the old column).
 * Only transform and opacity animate, apart from the strip's one row. Reduced motion: M1 is a
 * 120 ms crossfade, M3 and M7 are opacity only, scrolls are instant, the graph shows whole, and
 * nothing runs longer than 120 ms. The progress hairline is not motion (it is position) and stays.
 */
;(() => {
  const NB = (window.NB = window.NB || {})
  const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
  const D = { out: 120, in: 220, rise: 8, bar: 180, hover: 180, strip: 180, stripIn: 120, stripLag: 60, word: 120, mark: 180, cluster: 320, stagger: 40, filter: 180, camera: 450, pane: 320, shift: 12, scrim: 180, chev: 180, kids: 120, spy: 180, flash: 600 }
  const RED = 120
  const reduced = () => !!(window.LAB && LAB.sky && LAB.sky.reduced)

  // cubic-bezier(0.16, 1, 0.3, 1) as y(x): Newton on x(t), bisection when the slope is flat
  const bez = (p1, p2) => (t) => 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t
  const bezD = (p1, p2) => (t) => 3 * (1 - t) * (1 - t) * p1 + 6 * (1 - t) * t * (p2 - p1) + 3 * t * t * (1 - p2)
  const X = bez(0.16, 0.3), DX = bezD(0.16, 0.3), Y = bez(1, 1)
  const ease = (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) { const d = DX(t), e = X(t) - x; if (Math.abs(e) < 1e-6) return Y(t); if (Math.abs(d) < 1e-6) break; t -= e / d }
    let lo = 0, hi = 1
    t = x
    for (let i = 0; i < 30; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-6) break; if (e > 0) hi = t; else lo = t; t = (lo + hi) / 2 }
    return Y(t)
  }

  const cap = (ms) => (reduced() ? Math.min(ms, RED) : ms)
  // WAAPI, on the one easing. fill is 'backwards' at most (to hold a delayed start), never
  // 'forwards': a finished animation is gone from getAnimations(), and the element's own style is
  // where it ends. Resolves when it finishes or is cancelled.
  function play(el, frames, ms, o = {}) {
    if (!el || !el.animate) return Promise.resolve()
    const a = el.animate(frames, { duration: ms, delay: o.delay || 0, easing: o.easing || EASE, fill: o.fill || (o.delay ? 'backwards' : 'none'), pseudoElement: o.pseudo })
    if (o.id) a.id = o.id
    return a.finished.then(() => a, () => a)
  }
  const fadeIn = (el, ms = D.in, delay = 0) => play(el, [{ opacity: 0 }, { opacity: 1 }], cap(ms), { delay, id: 'fade' })

  // ── M1: note to note ──────────────────────────────────────────────────────────────────
  // The old column's nodes move (not copied) into a ghost pinned where they were, so render() can
  // draw the new note at once: the DOM, focus and scroll are the new note's from the first frame.
  // Only what was on screen moves: the rest of the old note is dropped, so the ghost costs a
  // screenful of layout, not the whole note's.
  let ghost = null
  function swap({ root, col, clip, sec, render }) {
    if (ghost) { ghost.remove(); ghost = null }
    for (const a of col.getAnimations()) a.cancel()
    const r = clip.getBoundingClientRect(), top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight)
    const cr = col.getBoundingClientRect()
    const g = document.createElement('div')
    g.className = 'nb-ghost'
    g.setAttribute('aria-hidden', 'true')
    g.inert = true
    g.dataset.sec = sec
    Object.assign(g.style, { left: `${r.left}px`, top: `${top}px`, width: `${r.width}px`, height: `${Math.max(0, bottom - top)}px` })
    const inner = col.cloneNode(false)
    inner.removeAttribute('id')
    Object.assign(inner.style, { position: 'absolute', left: `${cr.left - r.left}px`, top: `${cr.top - top}px`, width: `${cr.width}px`, margin: '0', maxWidth: 'none' })
    // blocks wholly off screen are dropped; what stays keeps its place through spacers of the
    // dropped blocks' height, so nothing on screen moves when the ghost replaces the column
    // measured first, written after: one layout, not one per block
    const drop = []
    const walk = (box) => {
      for (const e of box.children) {
        const b = e.getBoundingClientRect()
        if (b.bottom > top && b.top < bottom) { if (e.classList.contains('nb-note') || e.classList.contains('nb-body')) walk(e); continue }
        const cs = getComputedStyle(e)
        drop.push([e, b.height, cs.marginTop, cs.marginBottom])
      }
    }
    walk(col)
    for (const [e, hh, mt, mb] of drop) {
      const sp = document.createElement('div')
      sp.style.cssText = `height:${hh}px;margin:${mt} 0 ${mb}`
      e.replaceWith(sp)
    }
    while (col.firstChild) inner.appendChild(col.firstChild)
    g.appendChild(inner)
    root.appendChild(g)
    ghost = g
    render()
    play(g, [{ opacity: 1 }, { opacity: 0 }], reduced() ? RED : D.out, { id: 'm1-out' }).then(() => { g.remove(); if (ghost === g) ghost = null })
    rise(col, D.out)
  }
  // the way in: the column fades as one, and what a reader first sees rises 8 px. The rise is on
  // the first blocks, not the column: a phone's column is the whole note (5000+ px), and moving
  // one layer that tall costs a frame each step, where a dozen small ones cost nothing
  const RISE_BLOCKS = 12
  function rise(col, delay) {
    if (reduced()) { play(col, [{ opacity: 0 }, { opacity: 1 }], RED, { id: 'm1-in' }); return }
    play(col, [{ opacity: 0 }, { opacity: 1 }], D.in, { delay, id: 'm1-in' })
    const blocks = [...col.querySelectorAll('.nb-note > :not(.nb-body), .nb-body > *, .nb-maplist > *')].slice(0, RISE_BLOCKS)
    for (const b of blocks) play(b, [{ transform: `translateY(${D.rise}px)` }, { transform: 'none' }], D.in, { delay, id: 'm1-rise' })
  }
  // arriving from the graph: only the way in (the graph has nothing worth fading out)
  const arrive = (col) => rise(col, 0)

  // ── M7: panes out, then the grid switches once; the grid back, then panes in ─────────────
  // ps: [[el, side]] with side −1 (leaves to the left) or +1 (to the right). Only panes on screen
  // move. A second call while one runs finishes the first at once.
  let paneRun = null
  const shown = (e) => e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'
  function panes(apply, out, ps) {
    if (paneRun) paneRun.finish()
    const red = reduced(), ms = red ? RED : D.pane
    const off = (s) => (red ? { opacity: 0 } : { opacity: 0, transform: `translateX(${s * D.shift}px)` })
    const on = red ? { opacity: 1 } : { opacity: 1, transform: 'none' }
    if (!out) {
      apply()
      for (const [e, s] of ps) if (shown(e)) play(e, [off(s), on], ms, { id: 'm7-in' })
      return
    }
    const vis = ps.filter(([e]) => shown(e))
    if (!vis.length) { apply(); return }
    const anims = vis.map(([e, s]) => e.animate([on, off(s)], { duration: ms, easing: EASE, fill: 'forwards' }))
    for (const a of anims) a.id = 'm7-out'
    let done = false
    const finish = () => {
      if (done) return
      done = true
      paneRun = null
      apply()
      // the panes are gone from the grid in this same frame, so dropping the fill shows nothing
      for (const a of anims) a.cancel()
    }
    paneRun = { finish }
    Promise.all(anims.map((a) => a.finished)).then(finish, () => {})
  }

  // ── M3: the strip's row grows, then its contents fade in ──────────────────────────────
  let stripRun = null
  function strip(el, show, done) {
    const box = el.firstElementChild
    if (show) {
      if (stripRun) { stripRun.cancel(); stripRun = null }
      if (!el.hidden) return
      el.hidden = false
      if (!reduced()) {
        const h = el.offsetHeight
        play(el, [{ height: '0px' }, { height: `${h}px` }], D.strip, { id: 'm3-row' })
        play(box, [{ opacity: 0 }, { opacity: 1 }], D.stripIn, { delay: D.stripLag, id: 'm3-in' })
      } else play(box, [{ opacity: 0 }, { opacity: 1 }], RED, { id: 'm3-in' })
      return
    }
    if (el.hidden || stripRun) return
    if (reduced()) { el.hidden = true; if (done) done(); return }
    const a = el.animate([{ height: `${el.offsetHeight}px` }, { height: '0px' }], { duration: D.strip, easing: EASE })
    a.id = 'm3-row'
    stripRun = a
    a.finished.then(() => { stripRun = null; el.hidden = true; if (done) done() }, () => {})
  }

  // ── M8: an anchor's target flashes the highlight, then lets it go ──────────────────────
  // An overlay in the column (opacity only), never the row's own background.
  function flash(target, host) {
    if (reduced() || !target || !host) return Promise.resolve()
    for (const x of host.querySelectorAll(':scope > .nb-flash')) x.remove()
    const hr = host.getBoundingClientRect(), r = target.getBoundingClientRect()
    const f = document.createElement('div')
    f.className = 'nb-flash'
    f.setAttribute('aria-hidden', 'true')
    Object.assign(f.style, { left: `${r.left - hr.left}px`, top: `${r.top - hr.top}px`, width: `${r.width}px`, height: `${r.height}px` })
    host.appendChild(f)
    return play(f, [{ opacity: 1 }, { opacity: 0 }], D.flash, { id: 'm8-flash' }).then(() => f.remove())
  }

  // ── a style change with transitions off (the theme) ────────────────────────────────────────────────
  // The class is on while fn runs and the style is flushed (the layout the next frame would do
  // anyway, done now); taking it off changes no value, so no transition starts.
  function snap(fn) {
    const h = document.documentElement
    if (h.classList.contains('nb-snap')) return fn()
    h.classList.add('nb-snap')
    try { return fn() } finally { void h.offsetHeight; h.classList.remove('nb-snap') }
  }

  // ── M5: the graph's camera, through the one transform ──────────────────────────────────
  // The point at the view's centre moves in a straight line and the scale geometrically, so a
  // zoom and a pan together read as one move. write(cam) is the graph's own rAF writer.
  function camera(from, to, w, h, write, done) {
    if (reduced()) { write(to); if (done) done(); return { stop() {}, on: () => false } }
    const c0 = [(w / 2 - from.x) / from.s, (h / 2 - from.y) / from.s], c1 = [(w / 2 - to.x) / to.s, (h / 2 - to.y) / to.s]
    let t0 = null, raf = 0, live = true
    const step = (now) => {
      if (t0 == null) t0 = now
      const p = Math.min(1, (now - t0) / D.camera), e = ease(p)
      const s = from.s * Math.pow(to.s / from.s, e), cx = c0[0] + (c1[0] - c0[0]) * e, cy = c0[1] + (c1[1] - c0[1]) * e
      write(p >= 1 ? to : { s, x: w / 2 - cx * s, y: h / 2 - cy * s })
      if (p < 1) raf = requestAnimationFrame(step)
      else { live = false; if (done) done() }
    }
    raf = requestAnimationFrame(step)
    return { stop() { if (live) { live = false; cancelAnimationFrame(raf) } }, on: () => live }
  }

  NB.motion = { EASE, D, R: RED, reduced, ease, play, fadeIn, swap, arrive, panes, strip, flash, snap, camera, cap }
})()
