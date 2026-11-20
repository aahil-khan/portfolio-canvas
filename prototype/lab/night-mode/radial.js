/*
 * prototype/lab/night-mode/radial.js: THE COMPASS, research ★2A. EXPERIMENTAL: it is the home only
 * behind ?home=radial or the deck's radial:on flag. The directory is always the default.
 *
 * The whole screen is the menu. The direction from the screen's centre to the pointer lights one
 * of four categories, on N / E / S / W; a click anywhere commits it. Hover never commits.
 *   - dead zone 14 px (inside it nothing changes) and 5° of hysteresis (logic.wedge)
 *   - reverse video on the lit label, a line from the centre, the category previewed in the middle
 *   - keys 1–4 commit; arrows light a wedge and Enter commits it; Esc goes to the list
 *   - TOUCH HAS NO DIRECTION before a touch, so on a touch-only device the compass is never shown:
 *     the directory is, with one line saying why
 * The pointer lives in a variable and a rAF loop, never in markup: the loop writes one data
 * attribute and the line's transform. The four labels are real <button>s, in the DOM order 1–4.
 *
 *   NIGHT.radial.mount(root, metas)   builds it into root
 *   .start() / .stop()                the pointer loop runs only while the compass shows
 *   .supported()                      false on touch-only devices
 *   .onCommit = fn(catId)             what a commit does (home.js: the directory, that category open)
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const C = () => NIGHT.copy
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const DIRS = ['n', 'e', 's', 'w']
  const Rd = (NIGHT.radial = { DEAD: 14, HYST: 5 })
  const st = { on: false, x: null, y: null, wedge: null, raf: 0, metas: [] }
  let root = null, el = {}

  Rd.supported = () => !(matchMedia('(hover: none)').matches && matchMedia('(pointer: coarse)').matches)
  Rd.mount = (r, metas) => {
    root = r
    st.metas = metas
    root.innerHTML = `<nav class="rad" aria-label="${esc(C().radial.label)}" data-wedge="">` +
      // the wedges' true boundaries, at 45° from the centre (not the screen's corners)
      `<span class="rad__ax rad__ax--a" aria-hidden="true"></span><span class="rad__ax rad__ax--b" aria-hidden="true"></span>` +
      `<span class="rad__line" aria-hidden="true"></span>` +
      metas.map((m, i) => `<button type="button" class="rad__w rad__w--${DIRS[i]}" data-w="${i}" data-cat="${m.id}" data-sec="${m.id}">` +
        `<span class="rad__k" aria-hidden="true">${esc(m.key)}</span><span class="rad__t">${esc(m.id)}/</span><span class="rad__n">${esc(m.unit)}</span></button>`).join('') +
      `<div class="rad__mid" aria-live="polite"><p class="rad__ring" aria-hidden="true">( · )</p><p class="rad__pv"></p><p class="rad__hint">${esc(C().radial.hint)}</p></div></nav>`
    el = { nav: root.querySelector('.rad'), line: root.querySelector('.rad__line'), pv: root.querySelector('.rad__pv'), btns: [...root.querySelectorAll('.rad__w')] }
    // a click anywhere on the compass commits the lit wedge; a click on a label commits that label
    el.nav.addEventListener('click', (e) => {
      const b = e.target.closest('.rad__w')
      const w = b ? +b.dataset.w : st.wedge
      if (w != null) commit(w)
    })
    el.nav.addEventListener('keydown', (e) => {
      const k = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key]
      if (k != null) { e.preventDefault(); light(k); el.btns[k].focus({ preventScroll: true }) }
    })
    el.nav.addEventListener('focusin', (e) => { const b = e.target.closest('.rad__w'); if (b) light(+b.dataset.w) })
  }
  function light(w) {
    if (w === st.wedge) return
    st.wedge = w
    el.nav.dataset.wedge = w == null ? '' : DIRS[w]
    el.btns.forEach((b, i) => b.classList.toggle('is-lit', i === w))
    const m = w == null ? null : st.metas[w]
    el.pv.textContent = m ? `${m.id}/ · ${m.blurb} · ${C().updated(m.upd)}` : ''
    if (w != null && NIGHT.sound) NIGHT.sound.cue('cursor', w)
  }
  function commit(w) {
    if (NIGHT.sound) NIGHT.sound.cue('select')
    if (Rd.onCommit) Rd.onCommit(st.metas[w].id)
  }
  Rd.commitKey = (key) => { const i = st.metas.findIndex((m) => m.key === key); if (i >= 0) { commit(i); return true } return false }
  Rd.light = (w) => light(w)

  // ── the pointer: a variable and a rAF loop ───────────────────────────────────────────────
  const move = (e) => { if (e.pointerType === 'touch') return; st.x = e.clientX; st.y = e.clientY; if (!st.raf) st.raf = requestAnimationFrame(frame) }
  function frame() {
    st.raf = 0
    if (!st.on || st.x == null) return
    const r = el.nav.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const dx = st.x - cx, dy = st.y - cy
    light(NIGHT.logic.wedge(dx, dy, st.wedge, { dead: Rd.DEAD, hyst: Rd.HYST }))
    const len = Math.hypot(dx, dy)
    el.line.style.transform = len < Rd.DEAD ? 'scaleX(0)' : `rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${len.toFixed(1)})`
  }
  Rd.start = () => { if (st.on) return; st.on = true; addEventListener('pointermove', move, { passive: true }) }
  Rd.stop = () => { st.on = false; removeEventListener('pointermove', move); if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0 }
  Rd.state = () => ({ on: st.on, wedge: st.wedge })
})()
