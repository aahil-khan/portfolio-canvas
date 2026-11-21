/*
 * prototype/lab/night-mode/dial.js: THE DIAL, experimental. A small rotary dial (184 px) with four
 * notches, work N · experiments E · research S · writing W, that exists only while it is
 * summoned, centred where it was summoned:
 *
 *   hold space (anywhere in the Lab)   right-click   long-press (touch, 450 ms, still)
 *
 * The pointer's direction from the dial's centre turns the needle to a notch, with a dead zone
 * (16 px) and hysteresis (8°, NIGHT.logic.wedge). Letting go commits the lit notch; letting go in
 * the dead zone cancels. A right-click let go at once leaves it open: then a click commits (or
 * cancels, in the dead zone). Keys while it is open: 1–4 commit, arrows point, Esc cancels.
 * A commit opens that category (NIGHT.home.go), nothing else.
 *
 * OFF by default: ?dial=1, or `experimental dial:on` inside the ? keys popover. Never in the deck.
 * The pointer lives in a variable; one rAF writes the needle's transform and one data attribute.
 * A short press of space is still space (NIGHT.deck.tap): the dial only takes a hold.
 *
 *   NIGHT.dial.mount({ on })   .setEnabled(on)  .enabled()  .isOpen()  .lit()
 *   .open(x, y, how)  .close()  .key(e) → bool  .keyup(e)
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const C = () => NIGHT.copy
  const G = () => NIGHT.logic
  const cue = (n, i) => NIGHT.sound && NIGHT.sound.cue(n, i)
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const SIZE = 184, DEAD = 16, HYST = 8, HOLD = 260, PRESS = 450, SLOP = 10
  const D = (NIGHT.dial = {})
  const st = { on: false, open: false, how: null, x: 0, y: 0, px: 0, py: 0, lit: null, sticky: false, raf: 0, spaceT: 0, spaceTgt: null, pressT: 0, press: null, seen: false }
  let el = null, secs = []

  const live = () => NIGHT.state && NIGHT.state.t === 1 && !(NIGHT.reader && NIGHT.reader.isOpen())
  const inLab = (n) => n && n.closest && n.closest('#lab, #deskDock, .deckpop, .dial')
  function build() {
    secs = NIGHT.model.SECTIONS.map((s) => s.id)
    el = document.createElement('div')
    el.className = 'dial'
    el.hidden = true
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-label', C().dial.label)
    el.innerHTML = `<div class="dial__face" aria-hidden="true"><span class="dial__ring"></span>` +
      secs.map((id, i) => `<span class="dial__tick" data-n="${i}" data-sec="${id}"></span><span class="dial__l" data-n="${i}" data-sec="${id}"><span class="dial__k">${i + 1}</span>${esc(id)}</span>`).join('') +
      `<span class="dial__needle"></span><span class="dial__hub"></span></div>` +
      `<p class="dial__out" aria-live="polite"></p><p class="dial__hint">${esc(C().dial.hint)}</p>`
    document.body.appendChild(el)
  }
  function paint() {
    el.dataset.lit = st.lit == null ? '' : st.lit
    for (const n of el.querySelectorAll('.dial__l, .dial__tick')) n.classList.toggle('is-lit', +n.dataset.n === st.lit)
    const out = el.querySelector('.dial__out')
    const s = st.lit != null && NIGHT.home.sections().find((x) => x.id === secs[st.lit])
    out.textContent = s ? `→ ${s.id}/ · ${s.count}` : C().dial.idle
  }
  // the one loop: the pointer, read from a variable, turns the needle
  function frame() {
    st.raf = 0
    if (!st.open) return
    if (!st.kbd) {
      const next = G().wedge(st.px - st.x, st.py - st.y, st.lit, { dead: DEAD, hyst: HYST })
      if (next !== st.lit) { st.lit = next; paint(); cue('cursor', next || 0) }
    }
    el.querySelector('.dial__needle').style.transform = `rotate(${st.lit == null ? 0 : st.lit * 90}deg)`
    el.querySelector('.dial__needle').style.opacity = st.lit == null ? '0.35' : '1'
  }
  const kick = () => { if (!st.raf) st.raf = requestAnimationFrame(frame) }

  D.open = (x, y, how) => {
    if (!st.on || !live() || st.open) return false
    if (NIGHT.deck.popOpen()) NIGHT.deck.close()
    const m = SIZE / 2 + 28, mx = Math.min(innerWidth / 2, SIZE / 2 + 70)
    st.x = Math.max(mx, Math.min(innerWidth - mx, x))
    st.y = Math.max(m, Math.min(innerHeight - m - 60, y))
    st.px = x; st.py = y
    st.open = true; st.how = how; st.lit = null; st.sticky = false; st.kbd = false
    el.style.left = st.x + 'px'
    el.style.top = st.y + 'px'
    el.hidden = false
    document.documentElement.classList.add('has-dial')
    paint()
    frame()
    if (!LAB.sky.reduced) el.querySelector('.dial__face').animate([{ opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1 }], { duration: 140, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
    cue('chirp-open')
    NIGHT.deck.paint()
    return true
  }
  D.close = () => {
    if (!st.open) return false
    st.open = false; st.how = null; st.sticky = false
    el.hidden = true
    document.documentElement.classList.remove('has-dial')
    NIGHT.deck.paint()
    return true
  }
  function commit(i) {
    const id = i == null ? null : secs[i]
    D.close()
    if (id) { cue('enter'); NIGHT.home.go(id) } else cue('chirp-close')
  }
  const release = () => commit(st.lit)

  // ── summoning ────────────────────────────────────────────────────────────────────────────
  D.key = (e) => {
    if (!st.on) return false
    const k = e.key
    if (st.open) {
      if (k === 'Escape') { e.preventDefault(); commit(null); return true }
      if (/^[1-4]$/.test(k)) { e.preventDefault(); commit(+k - 1); return true }
      const a = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[k]
      if (a != null) { e.preventDefault(); st.lit = a; st.kbd = true; paint(); frame(); return true }
      if (k === ' ') { e.preventDefault(); return true }
      if (k === 'Enter') { e.preventDefault(); release(); return true }
      return true // nothing else while it is open
    }
    if (k === ' ' && !e.repeat && !(e.target.closest && e.target.closest('input, textarea, select'))) {
      e.preventDefault()
      st.spaceTgt = e.target
      clearTimeout(st.spaceT)
      st.spaceT = setTimeout(() => { st.spaceT = 0; if (!D.open(st.seen ? st.px : innerWidth / 2, st.seen ? st.py : innerHeight / 2, 'space')) st.spaceTgt = null }, HOLD)
      return true
    }
    if (k === ' ' && e.repeat) { e.preventDefault(); return true }
    return false
  }
  D.keyup = (e) => {
    if (!st.on || e.key !== ' ') return
    if (st.spaceT) { clearTimeout(st.spaceT); st.spaceT = 0; e.preventDefault(); NIGHT.deck.tap(st.spaceTgt); st.spaceTgt = null; return }
    if (st.open && st.how === 'space') { e.preventDefault(); release() }
  }
  function bind() {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || st.open) { st.px = e.clientX; st.py = e.clientY; st.seen = true }
      if (st.press && Math.hypot(e.clientX - st.press.x, e.clientY - st.press.y) > SLOP) { clearTimeout(st.pressT); st.press = null }
      if (st.open) { st.kbd = false; kick() }
    }, { passive: true })
    document.addEventListener('pointerdown', (e) => {
      if (!st.on || !live()) return
      if (st.open) {
        // open and sticky: a click commits (or cancels, in the dead zone); a click elsewhere too
        if (e.button === 0 || e.pointerType === 'touch') { e.preventDefault(); e.stopPropagation(); st.swallow = true; st.px = e.clientX; st.py = e.clientY; frame(); release() }
        return
      }
      if (!inLab(e.target)) return
      if (e.button === 2) { st.px = e.clientX; st.py = e.clientY; D.open(e.clientX, e.clientY, 'right'); st.downAt = performance.now(); return }
      if (e.pointerType === 'touch') {
        st.press = { x: e.clientX, y: e.clientY }
        clearTimeout(st.pressT)
        st.pressT = setTimeout(() => { if (st.press) { st.px = st.press.x; st.py = st.press.y; D.open(st.press.x, st.press.y, 'touch') } st.press = null }, PRESS)
      }
    }, true)
    document.addEventListener('pointerup', (e) => {
      clearTimeout(st.pressT); st.press = null
      if (!st.open) return
      if (st.how === 'right' && e.button === 2) {
        // let go at once, without leaving the dead zone: it stays open for a click
        if (st.lit == null && performance.now() - st.downAt < 350) { st.sticky = true; return }
        release()
      } else if (st.how === 'touch') { e.preventDefault(); release() }
    }, true)
    document.addEventListener('pointercancel', () => { clearTimeout(st.pressT); st.press = null; if (st.open && st.how === 'touch') commit(null) }, true)
    // the dial's own right-click: never the browser's menu, inside the Lab, while the flag is on
    document.addEventListener('contextmenu', (e) => { if (st.on && (st.open || (live() && inLab(e.target)))) e.preventDefault() }, true)
    // a long-press that opened the dial: the finger turns it, it never scrolls the page
    document.addEventListener('touchmove', (e) => { if (st.open) e.preventDefault() }, { passive: false })
    // the click that follows a sticky commit's pointerdown lands on nothing
    document.addEventListener('click', (e) => { if (st.swallow) { st.swallow = false; e.preventDefault(); e.stopPropagation() } }, true)
  }

  D.mount = ({ on = false } = {}) => { build(); bind(); D.setEnabled(on) }
  D.setEnabled = (on) => {
    st.on = !!on
    document.documentElement.dataset.dial = st.on ? 'on' : 'off'
    if (!st.on) D.close()
    if (NIGHT.deck && NIGHT.deck.paint) NIGHT.deck.paint()
  }
  D.enabled = () => st.on
  D.isOpen = () => st.open
  D.lit = () => st.lit
  D.pos = () => ({ x: st.x, y: st.y })
})()
