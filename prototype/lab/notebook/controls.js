/*
 * prototype/lab/notebook/controls.js: the reader's quality-of-life controls (round 4). Quiet by
 * design: nothing here moves or speaks unless the reader asks, and the reading stays the focus.
 *
 *   NB.controls.mount()          the Aa panel, the progress hairline, the toast (after the shell)
 *   .toggleAa(from) .closeAa()   the Aa panel (Q1 size, Q2 theme, Q7 width, Q6 focus, sounds): a
 *                                popover under the bar on desktop, a sheet from the TOP on a phone.
 *                                Every control writes through NB.prefs; CSS reads the attributes.
 *   .rendered(note, q)           after the reader draws a note: heading links (Q8), the clock
 *   .arrived(note, q)            after the router: resume (Q10), the tour step, the hairline
 *   .share() .copyLink(url)      Q8: Web Share on a phone, otherwise copy, with a toast at the top
 *   .top()                       Q12: back to the top (the bar's title, "↑ top" at the note's end)
 *   .toast(html, ms)             one line under the bar, polite to a screen reader
 *   .resumeHtml()                start-here's "Continue W1 at step N →", when there is history
 *   .scroller() .scrollTop()     the column (desktop) or the document (phone)
 *
 * PROGRESS (Q4) is one 2 px scaleX in the section colour under the bar, and "N min left" in the
 * kicker, both written from one rAF per scroll. Resume stores the position per note (try/catch
 * storage, the last 40 notes) and the last tour step. The arithmetic is NB.reading's (reading.js).
 */
;(() => {
  const NB = (window.NB = window.NB || {})
  const C = NB.copy, P = NB.prefs, R = NB.reading, esc = NB.md.escape
  const S = () => NB.shell, el = () => NB.shell.el, V = () => NB.vault
  const phone = () => innerWidth < 900
  const reduced = () => !!(window.LAB && LAB.sky && LAB.sky.reduced)
  const K = (NB.controls = {})
  const READ_KEY = 'nb-read', TOUR_KEY = 'nb-tour', KEEP = 40

  // ── where the page scrolls ────────────────────────────────────────────────────────────
  K.scroller = () => (phone() ? document.scrollingElement : el().main)
  K.scrollTop = () => K.scroller().scrollTop
  const view = () => (phone() ? innerHeight : el().main.clientHeight)
  const height = () => K.scroller().scrollHeight
  const scrollToY = (y, smooth) => { const s = K.scroller(); s.scrollTo({ top: y, behavior: smooth && !reduced() ? 'smooth' : 'auto' }) }

  // ── mount ─────────────────────────────────────────────────────────────────────────────
  let aa = null, bar = null, toastEl = null
  K.mount = () => {
    const head = el().head
    bar = document.createElement('div')
    bar.className = 'nb-readbar'
    bar.setAttribute('aria-hidden', 'true')
    bar.innerHTML = '<i></i>'
    el().bar.appendChild(bar)
    toastEl = document.createElement('div')
    toastEl.className = 'nb-toast'
    toastEl.setAttribute('role', 'status')
    toastEl.setAttribute('aria-live', 'polite')
    toastEl.hidden = true
    head.appendChild(toastEl)
    el().main.addEventListener('scroll', kick, { passive: true })
    addEventListener('scroll', kick, { passive: true })
    addEventListener('resize', kick)
    addEventListener('pagehide', () => save())
    P.onChange((kind) => { keepPlace(kind); syncAa(); kick() })
    document.addEventListener('click', (e) => {
      if (aa && !aa.hidden && !e.target.closest('.nb-aa, [data-act="aa"]')) K.closeAa()
      const h = e.target.closest('[data-hlink]')
      if (h) { e.preventDefault(); K.copyLink(urlFor(S().state.note, h.dataset.hlink)) }
      if (e.target.closest('[data-act="totop"]')) { K.top(); hideToast() }
    })
  }

  // ── the Aa panel ──────────────────────────────────────────────────────────────────────
  const T = C.panel
  const seg = (name, items) => `<div class="nb-aa__seg" role="group" aria-label="${esc(name)}">${items.join('')}</div>`
  function buildAa() {
    aa = document.createElement('div')
    aa.className = 'nb-aa'
    aa.id = 'nbAa'
    aa.setAttribute('role', 'dialog')
    aa.setAttribute('aria-label', T.label)
    aa.hidden = true
    const sizes = P.SIZES.map((px, i) => `<button type="button" data-size="${i}" aria-label="${esc(`${T.size} ${T.sizeStep(px)}`)}" style="--step:${px}px"><span aria-hidden="true">${esc(C.aa)}</span></button>`)
    const modes = P.MODES.map((m) => `<button type="button" data-mode="${m}">${esc(T.modes[m])}</button>`)
    const widths = Object.keys(P.WIDTHS).map((w) => `<button type="button" data-width="${w}">${esc(T.widths[w])}</button>`)
    aa.innerHTML = `
      <div class="nb-aa__row"><p class="nb-aa__k">${esc(T.size)} <span class="nb-aa__v" data-v="size"></span></p>${seg(T.size, sizes)}</div>
      <div class="nb-aa__row"><p class="nb-aa__k">${esc(T.theme)} <span class="nb-aa__v" data-v="mode"></span></p>${seg(T.theme, modes)}</div>
      <div class="nb-aa__row nb-aa__row--width"><p class="nb-aa__k">${esc(T.width)}</p>${seg(T.width, widths)}</div>
      <div class="nb-aa__row nb-aa__row--toggles">
        <button type="button" class="nb-aa__tog" data-act="focus" aria-pressed="false"><span class="nb-aa__t"></span><span class="nb-aa__v" aria-hidden="true">${esc(T.focusKey)}</span></button>
        <button type="button" class="nb-aa__tog" data-act="snd" aria-pressed="false"></button>
      </div>
      <div class="nb-aa__foot"><button type="button" class="nb-aa__done" data-aa-close>${esc(T.close)}</button></div>`
    aa.addEventListener('click', (e) => {
      const b = e.target.closest('button')
      if (!b) return
      if (b.dataset.size != null) P.setSize(+b.dataset.size)
      else if (b.dataset.mode) P.setMode(b.dataset.mode)
      else if (b.dataset.width) P.setWidth(b.dataset.width)
      else if (b.hasAttribute('data-aa-close')) K.closeAa()
      // focus and sounds are the shell's own [data-act] (the click bubbles to it)
      setTimeout(syncAa, 0)
    })
    el().head.appendChild(aa)
  }
  function syncAa() {
    if (!aa) return
    const size = P.size(), mode = P.mode(), width = P.width()
    for (const b of aa.querySelectorAll('[data-size]')) b.setAttribute('aria-pressed', String(+b.dataset.size === size))
    for (const b of aa.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode))
    for (const b of aa.querySelectorAll('[data-width]')) b.setAttribute('aria-pressed', String(b.dataset.width === width))
    aa.querySelector('[data-v="size"]').textContent = T.sizeStep(P.SIZES[size])
    aa.querySelector('[data-v="mode"]').textContent = mode === 'auto' ? T.autoHint : ''
    const f = aa.querySelector('[data-act="focus"]'), on = S().isFocus()
    f.setAttribute('aria-pressed', String(on)); f.setAttribute('aria-label', T.focusLabel(on)); f.querySelector('.nb-aa__t').textContent = T.focus(on)
    S().flags()
  }
  K.syncAa = syncAa
  K.isAaOpen = () => !!aa && !aa.hidden
  K.toggleAa = (from) => {
    if (!aa) buildAa()
    if (!aa.hidden) return K.closeAa()
    aa.hidden = false
    syncAa()
    const btn = el().bar.querySelector('[data-act="aa"]')
    btn.setAttribute('aria-expanded', 'true')
    S().layer(aa, from || btn, () => btn.setAttribute('aria-expanded', 'false'))
    const cur = aa.querySelector('[data-size][aria-pressed="true"]')
    if (cur) cur.focus({ preventScroll: true })
    if (NIGHT.sound) NIGHT.sound.cue('chirp-open')
  }
  K.closeAa = () => { if (aa && !aa.hidden) S().closeLayer(aa) }

  // a size or width change keeps the paragraph the reader was on where it was on screen
  let anchor = null
  function keepPlace(kind) {
    if (kind !== 'size' && kind !== 'width') return
    if (anchor) { const a = anchor; anchor = null; const r = a.el.getBoundingClientRect(); K.scroller().scrollTop += r.top - a.top; return }
    NB.reader.tables()
  }
  // NB.prefs changes the attribute first, so the anchor is taken by the panel's pointerdown / key
  K.markPlace = () => {
    const head = el().head.getBoundingClientRect().bottom
    const ps = [...el().col.querySelectorAll('[data-say]')]
    const i = R.firstInView(ps.map((p) => p.getBoundingClientRect()), head, innerHeight)
    const p = ps[i]
    anchor = p && K.scrollTop() > 0 ? { el: p, top: p.getBoundingClientRect().top } : null
  }
  document.addEventListener('pointerdown', (e) => { if (e.target.closest('.nb-aa [data-size], .nb-aa [data-width]')) K.markPlace() }, true)

  // ── progress: the hairline and the kicker's clock, from one rAF ───────────────────────
  let raf = 0, savedAt = 0
  function kick() { if (!raf) raf = requestAnimationFrame(frame) }
  K.kick = kick
  let lastClock = ''
  function frame() {
    raf = 0
    const st = S().state, note = st.note
    const on = st.view === 'note' && !!note
    bar.hidden = !on
    if (!on) return
    const p = R.progress(K.scrollTop(), height(), view())
    bar.firstChild.style.transform = `scaleX(${p.toFixed(4)})`
    K.progress = p
    const k = el().col.querySelector('.nb-k--read')
    if (k) {
      const c = R.left(V().clock(note).read, p)
      const key = `${c.kind}${c.n}`
      if (key !== lastClock || !k.dataset.kind) {
        lastClock = key
        k.dataset.kind = c.kind
        k.querySelector('.nb-k__n').textContent = c.kind === 'end' ? C.endUnit : c.kind === 'left' ? C.minLeft(c.n) : C.minShort(c.n)
        k.querySelector('.nb-k__unit').textContent = c.kind === 'end' ? '' : c.kind === 'left' ? C.leftUnit : C.readUnit
      }
    }
    if (performance.now() - savedAt > 400) save()
    NB.share.tick()
  }

  // ── resume ────────────────────────────────────────────────────────────────────────────
  const reads = () => P.get(READ_KEY) || {}
  K.save = () => save()
  function save() {
    savedAt = performance.now()
    const st = S().state
    if (st.view !== 'note' || !st.note || restoring) return
    const all = reads(), r = st.note.route
    const top = Math.round(K.scrollTop()), done = R.progress(top, height(), view()) >= 0.98
    const prev = all[r]
    if (prev && prev.top === top && !!prev.done === done) return
    delete all[r]
    all[r] = { top, done }
    const keys = Object.keys(all)
    for (const x of keys.slice(0, Math.max(0, keys.length - KEEP))) delete all[x]
    P.set(READ_KEY, all)
  }
  let restoring = false
  K.arrived = (note, q) => {
    lastClock = ''
    if (!note) { kick(); return }
    const w = q.get('w'), ts = w && V().tourStep(note, w)
    if (ts) P.set(TOUR_KEY, { w, step: ts.i + 1, n: ts.n, route: note.route })
    const narrating = NB.narrator && NB.narrator.active()
    if (S().state.view === 'note' && !q.get('a') && !narrating) {
      const saved = reads()[note.route]
      restoring = true
      requestAnimationFrame(() => {
        const y = R.resumeAt(saved, height(), view())
        if (y > 0) {
          scrollToY(y, false)
          K.toast(`<button type="button" class="nb-toast__btn" data-act="totop" aria-label="${esc(C.toTopLabel)}">${esc(C.toTop)}</button>`, 2000)
        }
        restoring = false
        kick()
      })
    } else kick()
  }
  K.resumeHtml = () => {
    const t = P.get(TOUR_KEY), v = V()
    const n = t && v.get(t.route), tour = t && v.resolve(t.w)
    if (!n || !tour || !v.tourStep(n, t.w)) return ''
    return `<p class="nb-resume"><a href="${esc(S().href(n.route, `w=${t.w}`))}">${esc(C.continueTour(tour.id, t.step))} ${esc(C.next)}</a></p>`
  }

  // ── links, share, the toast, back to top ──────────────────────────────────────────────
  const urlFor = (note, a) => {
    const w = S().state.q.get('w')
    const q = [a ? `a=${a}` : '', w ? `w=${w}` : ''].filter(Boolean).join('&')
    return location.href.split('#')[0] + S().href(note ? note.route : '', q)
  }
  K.urlFor = urlFor
  K.rendered = (note) => {
    lastClock = ''
    if (!note || note.route === '') return
    for (const hd of el().col.querySelectorAll('.nb-body h2[id], .nb-body h3[id]')) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'nb-hlink'
      b.dataset.hlink = hd.id
      b.setAttribute('aria-label', C.headLink(hd.textContent.trim()))
      hd.prepend(b)
    }
  }
  K.last = null
  K.copyLink = async (url) => {
    K.last = url
    let done = false
    // the async clipboard can wait forever for a permission (a file:// page): give it 400 ms
    try { done = await Promise.race([navigator.clipboard.writeText(url).then(() => true), new Promise((r) => setTimeout(() => r(false), 400))]) } catch { /* no clipboard: fall back */ }
    if (!done) {
      const t = document.createElement('textarea')
      t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'
      document.body.appendChild(t); t.select()
      try { done = document.execCommand('copy') } catch { done = false }
      t.remove()
    }
    K.toast(esc(done ? C.copied : C.copyFailed), 1500)
    return done
  }
  // round 6: sharing is share.js's (the native sheet, otherwise the menu)
  K.share = (from) => NB.share.open(from)
  K.top = () => { scrollToY(0, true); const t = el().col.querySelector('.nb-title'); if (t) t.focus({ preventScroll: true }) }
  let tt = 0
  K.toast = (html, ms = 1500) => {
    clearTimeout(tt)
    toastEl.innerHTML = html
    toastEl.hidden = false
    tt = setTimeout(hideToast, ms)
  }
  function hideToast() { clearTimeout(tt); toastEl.hidden = true; toastEl.innerHTML = '' }
  K.hideToast = hideToast
})()
