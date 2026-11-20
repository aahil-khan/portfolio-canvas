/*
 * prototype/lab/night-mode/intro.js: what plays every time the Lab opens.
 *
 *   NIGHT.intro.mount({ stage, motd, hint, credit, menu })   the parts night.js built
 *   NIGHT.intro.play({ fx, hold }) → Promise    one visit: an effect, the welcome, then the menu
 *   NIGHT.intro.skip()                          straight to the end state (any key or click does it)
 *   NIGHT.intro.stop()                          leave without finishing (going back to the canvas)
 *   NIGHT.intro.at(ms, reduced)                 PURE: the whole intro's state at a moment, so
 *                                               ?hold=<ms> holds any frame and check.mjs tests it
 *
 * THE TIMELINE (ms). Full motion:
 *      0 – 2800   the effect (fx.js), on its own fade envelope
 *   1300 – 3250   the welcome types on: the first line at a reading pace, the rest quickly
 *   3050 – 3700   the menu decodes in where the effect was (menu.reveal), and the intro is over
 * Reduced motion (LAB.sky.reduced, the one owner): one still frame of the effect fades in, the
 * welcome is there whole from the start, and the menu replaces the effect by opacity at 1.5 s.
 * Nothing types, nothing scrambles, nothing moves.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const C = () => NIGHT.copy
  const seg = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a))
  const FULL = { fxEnd: 2800, type0: 1300, cps0: 28, pause: 140, cps1: 150, menu: [3050, 3700] }
  const CALM = { menu: [1500, 1800] }
  const R = (NIGHT.intro = {})
  let el = {}, st = { run: 0, t0: 0, fx: null, hold: null, done: null, skipped: false, last: null }

  // ── the pure part ────────────────────────────────────────────────────────────────────────
  // How many characters of each welcome line show at `ms`.
  // the welcome as this screen says it (a phone swaps the last line for its own)
  const lines = () => { const w = C().welcome; return typeof innerWidth !== 'undefined' && innerWidth < 700 && C().welcomeTouch ? [...w.slice(0, -1), C().welcomeTouch] : w }
  R.lines = lines
  const typed = (ms) => {
    const lines_ = lines()
    let t = ms - FULL.type0
    return lines_.map((l, i) => {
      const cps = i === 0 ? FULL.cps0 : FULL.cps1
      if (t <= 0) return 0
      const n = Math.min(l.length, Math.floor((t / 1000) * cps))
      t -= (l.length / cps) * 1000 + (i === 0 ? FULL.pause : 0)
      return n
    })
  }
  const end = (reduced) => (reduced ? CALM.menu[1] : FULL.menu[1])
  R.at = (ms, reduced) => {
    if (reduced) {
      return { fxT: NIGHT.fx.STILL, fxAlpha: seg(ms, 0, 200) * (1 - seg(ms, CALM.menu[0], CALM.menu[1])), typed: lines().map((l) => l.length),
        motd: seg(ms, 0, 200), menu: seg(ms, CALM.menu[0], CALM.menu[1]), scramble: false, done: ms >= end(true) }
    }
    return { fxT: Math.min(ms, FULL.fxEnd) / 1000, fxAlpha: ms >= FULL.fxEnd ? 0 : NIGHT.fx.alpha(ms / 1000), typed: typed(ms),
      motd: 1, menu: seg(ms, FULL.menu[0], FULL.menu[1]), scramble: true, done: ms >= end(false) }
  }
  R.END = end

  // ── the DOM part ─────────────────────────────────────────────────────────────────────────
  R.mount = (parts) => {
    el = parts
    el.lines = lines().map((text) => {
      const p = document.createElement('p')
      p.className = 'motd__l'
      // the rest of the line is laid out but invisible, so typing never reflows the menu
      p.innerHTML = '<span class="motd__on"></span><span class="motd__cur" aria-hidden="true"></span><span class="motd__rest" aria-hidden="true"></span>'
      p.dataset.text = text
      el.motd.appendChild(p)
      return p
    })
    el.hint.textContent = innerWidth < 700 ? C().skipTouch : C().skip
  }

  // cell metrics of the stage's face, measured, so cols × rows fills it exactly
  let cell = null
  const measure = () => {
    const probe = document.createElement('span')
    probe.textContent = '0'.repeat(40)
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre'
    el.stage.appendChild(probe)
    const r = probe.getBoundingClientRect(), lh = parseFloat(getComputedStyle(el.stage).lineHeight)
    probe.remove()
    cell = { w: r.width / 40, h: lh || r.height }
  }
  const size = () => {
    if (!cell) measure()
    const r = el.stage.getBoundingClientRect()
    return { cols: Math.max(8, Math.floor(r.width / cell.w)), rows: Math.max(4, Math.floor(r.height / cell.h)) }
  }

  let grid = null, lastDraw = -1
  function draw(ms, force) {
    const red = LAB.sky.reduced, s = R.at(ms, red)
    // the effect: at most 30 frames a second; a held frame draws once
    if (s.fxAlpha > 0) {
      const tick = Math.floor(ms / 33)
      if (force || tick !== lastDraw) {
        lastDraw = tick
        if (!grid) grid = size()
        el.stage.textContent = NIGHT.fx.frame(st.fx, s.fxT, grid.cols, grid.rows, { seed: 3, phase: NIGHT.moonPhase ? NIGHT.moonPhase() : 0.5 })
      }
    } else if (el.stage.textContent) el.stage.textContent = ''
    el.stage.style.opacity = s.fxAlpha.toFixed(3)
    el.credit.style.opacity = el.hint.style.opacity = (s.fxAlpha * (red ? 1 : seg(ms, 500, 900))).toFixed(3)
    el.motd.style.opacity = s.motd.toFixed(3)
    el.lines.forEach((p, i) => {
      const text = p.dataset.text, n = s.typed[i], [on, cur, rest] = p.children
      if (on.textContent.length !== n) { on.textContent = text.slice(0, n); rest.textContent = text.slice(n) }
      // the block cursor sits on the line being typed, and blinks nowhere
      const typing = n > 0 && n < text.length, next = n === 0 && i > 0 && s.typed[i - 1] === el.lines[i - 1].dataset.text.length && s.typed.slice(i + 1).every((x) => x === 0)
      cur.hidden = !(s.scramble && !s.done && (typing || next || (i === el.lines.length - 1 && n === text.length && s.menu < 1)))
    })
    el.menu(s.menu, s.scramble)
    return s
  }

  function finish(skipped) {
    cancelAnimationFrame(st.run)
    st.run = 0
    const red = LAB.sky.reduced
    draw(end(red) + 1, true)
    el.root.classList.remove('is-intro')
    el.root.dataset.fx = st.fx
    const done = st.done
    st.done = null
    st.skipped = !!skipped
    if (done) done({ fx: st.fx, skipped: !!skipped })
  }

  R.play = ({ fx, hold } = {}) => {
    R.stop()
    st.fx = NIGHT.fx.ids.includes(fx) ? fx : NIGHT.fx.pick(st.last)
    st.last = st.fx
    grid = null; lastDraw = -1
    el.root.classList.add('is-intro')
    el.root.dataset.fx = st.fx
    const meta = NIGHT.fx.list.find((x) => x.id === st.fx)
    el.credit.textContent = `fx: ${meta.name} · ${meta.credit}`
    return new Promise((resolve) => {
      st.done = resolve
      if (hold != null) { draw(+hold, true); return } // held for a screenshot: never finishes on its own
      st.t0 = performance.now()
      const red = LAB.sky.reduced
      const step = (now) => {
        const ms = now - st.t0, s = draw(ms)
        if (s.done || ms > end(red)) return finish(false)
        st.run = requestAnimationFrame(step)
      }
      st.run = requestAnimationFrame(step)
    })
  }
  R.playing = () => !!st.done
  R.skip = () => { if (st.done) finish(true) }
  R.stop = () => {
    cancelAnimationFrame(st.run)
    st.run = 0
    st.done = null
    if (el.root) el.root.classList.remove('is-intro')
  }
  R.current = () => st.fx
  // the stage is a different size on a phone turned sideways: measure again
  if (typeof addEventListener === 'function') addEventListener('resize', () => { cell = null; grid = null })
})()
