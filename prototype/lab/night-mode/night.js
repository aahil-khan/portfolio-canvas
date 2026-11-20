/*
 * prototype/lab/night-mode/night.js: night mode. The Lab is not a page: it is the desk at night.
 *
 *   NIGHT.mount()          after DESK.mount: builds the sky, the night layer and the night bar
 *   NIGHT.enter() / .leave() / .toggle() → Promise   (the Lab dock tile toggles)
 *   NIGHT.scrub(t)         sets the transition to t ∈ [0, 1] and holds it there (?freeze=)
 *   window.renderSky()     re-places the sky from LAB.pieces, rings where stars were, and
 *                          reports how many moved (the 20th-piece proof)
 *
 * THE TRANSITION is one timeline, a pure function of t, so it runs both ways and can be frozen
 * on any frame for a screenshot. t goes 0 → 1 over 1.7 s into night and 1 → 0 over 1.35 s back.
 *   0.00–0.62  night falls from the top of the screen: a 160vh blind, solid night above a
 *              warm dusk edge, eased in-out (a fall is not a deceleration)
 *     …        each card makes way exactly as the dusk edge passes it: drifts outward from the
 *              middle of the screen, settles a little and fades. Only `translate`, `scale` and
 *              `opacity` are touched (never left/top), so on the way back every card lands where
 *              it was, dragged or not. The grid and the desk's pill go with the night.
 *   0.30–1.00  the camera eases out to fit the sky, in the same world, from wherever you were
 *   0.25–0.85  the starfield and the dithered moon come up, the moon rising a little
 *   0.24–0.92  stars come out one by one, oldest first like an evening, and only where it is
 *              already dark
 *   0.66–0.90  constellation lines grow out of the older star of each pair
 *   0.80–1.00  names and labels
 * Going back is the same timeline run backwards with mirrored easing, so it decelerates into
 * day: labels go, stars go, the camera returns to exactly where it was, the cards come back,
 * the blind lifts.
 * Every segment eases with DIRECTION.md's one curve, cubic-bezier(0.16, 1, 0.3, 1).
 *
 * REDUCED MOTION (LAB.sky.reduced, the one owner) swaps in an opacity-only timeline: the desk
 * fades out, the camera cuts while nothing is on screen, the sky fades in. No drift, no growth,
 * no blind, no moonrise.
 *
 * The camera stays the desk's: every frame goes through DESK.flyTo(…, 0), which writes the one
 * world transform from the desk's rAF loop. React state would never see any of this.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const sky = NIGHT.sky, win = NIGHT.win
  const R = () => LAB.sky.reduced
  const q = new URLSearchParams(location.search)
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }

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

  const st = { t: 0, A: null, B: null, cards: [], anim: 0, queue: [], plate: null, ready: false }
  const view = () => ({ cx: (innerWidth / 2 - DESK.camera.x) / DESK.camera.s, cy: (innerHeight / 2 - DESK.camera.y) / DESK.camera.s, s: DESK.camera.s })
  const camOf = (v) => ({ s: v.s, x: innerWidth / 2 - v.cx * v.s, y: innerHeight / 2 - v.cy * v.s })
  const setView = (v) => DESK.flyTo(v.cx, v.cy, v.s, 0)
  const lerpView = (a, b, k) => ({ cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k) })

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
    const k = red ? (t >= 0.5 ? 1 : 0) : ease(seg(t, 0.3, 1))
    setView(k === 0 ? st.A : k === 1 ? st.B : lerpView(st.A, st.B, k))
    const cam = DESK.camera

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

    // the sky comes out: oldest first, and only where it is already dark
    const n = sky.list.length
    for (const s of sky.list) {
      const a = 0.24 + 0.46 * (n > 1 ? s.rank / (n - 1) : 0)
      // 1 once the solid night is over the star, 0 until the dusk edge is within a quarter screen
      const dark = red || b >= 1 ? 1 : Math.min(1, Math.max(0, (1.6 * b - 0.6 + 0.25 - (s.y * cam.s + cam.y) / innerHeight) / 0.25))
      const p = red ? seg(t, 0.55, 1) : ease(seg(t, a, a + 0.22)) * dark
      s.el.style.setProperty('--o', p.toFixed(3))
      s.el.style.setProperty('--pop', red ? 1 : (0.25 + 0.75 * p).toFixed(3))
    }
    const lp = red ? seg(t, 0.6, 1) : ease(seg(t, 0.66, 0.9))
    for (const l of sky.lines) {
      const g = red ? 1 : lp
      l.el.setAttribute('x2', l.a.x + (l.z.x - l.a.x) * g)
      l.el.setAttribute('y2', l.a.y + (l.z.y - l.a.y) * g)
      l.el.style.setProperty('--lo', lp.toFixed(3))
    }
    el.skyLayer.style.setProperty('--labels', (red ? seg(t, 0.6, 1) : seg(t, 0.8, 1)).toFixed(3))
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

  function beginEnter() {
    if (st.t > 0) return
    const folder = document.querySelector('.desk-folder')
    if (folder) folder.hidden = true
    st.A = view()
    if (sky.geo.portrait !== (innerHeight > innerWidth * 1.1)) sky.render()
    st.B = fitView()
    planCards()
    placeMoon()
    sky.relabel(camOf(st.B))
  }
  function beginLeave() {
    hidePlate(false)
    win.closeAll({ instant: true })
    st.B = view() // leave from wherever the sky was panned to
    sky.focus(null)
  }
  function finish(to) {
    document.documentElement.classList.remove('is-turning')
    const lab = document.querySelector('.desk-dock__item[data-id="lab"]')
    if (to === 1) {
      lab.dataset.open = 'true'
      sky.relabel()
      setURL(true)
      if (document.activeElement === lab) el.back.focus({ preventScroll: true })
    } else {
      setView(st.A)
      lab.dataset.open = 'false'
      setURL(false)
      if (!document.activeElement || document.activeElement === document.body || el.bar.contains(document.activeElement)) lab.focus({ preventScroll: true })
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

  function fitView() { return sky.fit() }
  const flyFit = () => { const f = fitView(); st.B = f; return DESK.flyTo(f.cx, f.cy, f.s, 620) }

  // ── the moon sits in the gap between the two halves, far away: it barely moves when you pan
  let moonAt = null
  function placeMoon() {
    const g = sky.geo, b = g.bounds, B = camOf(st.B || fitView())
    const wp = g.portrait ? { x: b.x + b.w * 0.5, y: g.gap } : { x: g.gap, y: b.y + b.h * 0.32 }
    moonAt = { wp, base: { x: wp.x * B.s + B.x, y: wp.y * B.s + B.y } }
    moveMoon(DESK.camera)
  }
  function moveMoon(cam) {
    if (!moonAt) return
    const px = moonAt.wp.x * cam.s + cam.x, py = moonAt.wp.y * cam.s + cam.y
    el.moonWrap.style.left = (moonAt.base.x + (px - moonAt.base.x) * 0.05).toFixed(1) + 'px'
    el.moonWrap.style.top = (moonAt.base.y + (py - moonAt.base.y) * 0.05).toFixed(1) + 'px'
  }

  // ── the plate: a focused star's card ─────────────────────────────────────────────────────
  const phone = () => innerWidth < 700
  function showPlate(slug, opener) {
    const p = LAB.pieces.find((x) => x.slug === slug), s = sky.stars[slug]
    if (!p || !s) return
    st.plate = { slug, opener: opener || s.el }
    sky.focus(slug)
    const con = p.constellation && LAB.constellations.find((c) => c.id === p.constellation)
    const opens = LAB.opens(p)
    const label = opens.card ? 'Open the ' + DESK.content.apps.find((a) => a.id === opens.card).label : 'Open'
    el.plate.dataset.shelf = p.shelf
    el.plate.innerHTML =
      `<button type="button" class="plate__x" aria-label="Close"></button>` +
      `<p class="plate__shelf t-label"><span class="lab-mark" data-shelf="${p.shelf}"></span>${esc(LAB.shelfName(p.shelf))}</p>` +
      `<h2 class="plate__title" id="plateTitle">${esc(p.title)}</h2>` +
      (LAB.excerpt(p, 140) ? `<p class="plate__blurb">${esc(LAB.excerpt(p, 140))}</p>` : '') +
      `<p class="plate__meta"><span class="lab-chip">${esc(p.kind)}</span><span class="t-label">${esc(p.when || p.date)}</span>` +
      (con ? `<span class="t-label">· ${esc(con.name)}</span>` : '') + `</p>` +
      `<button type="button" class="nbtn nbtn--primary plate__open">${esc(label)} →</button>`
    el.plate.hidden = false
    el.plate.querySelector('.plate__x').onclick = () => hidePlate(true)
    el.plate.querySelector('.plate__open').onclick = () => openPiece(slug, s.el)
    positionPlate()
    if (phone()) {
      // lift the star above the sheet, same zoom
      const sheet = el.plate.offsetHeight, target = (innerHeight - sheet) / 2 + 20
      const v = view()
      DESK.flyTo(s.x, s.y + (innerHeight / 2 - target) / v.s, v.s, 520)
    }
    el.plate.querySelector('.plate__open').focus({ preventScroll: true })
  }
  function hidePlate(restore) {
    if (!st.plate) return
    const o = st.plate
    st.plate = null
    el.plate.hidden = true
    sky.focus(null)
    if (restore && o.opener && o.opener.isConnected) o.opener.focus({ preventScroll: true })
  }
  function positionPlate() {
    if (!st.plate || phone()) { el.plate.style.left = el.plate.style.top = ''; return }
    const s = sky.stars[st.plate.slug], cam = DESK.camera
    const x = s.x * cam.s + cam.x, y = s.y * cam.s + cam.y, w = el.plate.offsetWidth, hh = el.plate.offsetHeight
    const right = x + 30 + w < innerWidth - 16
    const top = Math.min(innerHeight - hh - 120, Math.max(el.bar.getBoundingClientRect().bottom + 12, y - hh / 2))
    el.plate.style.left = (right ? x + 30 : x - 30 - w) + 'px'
    el.plate.style.top = top + 'px'
    el.plate.dataset.side = right ? 'right' : 'left'
  }

  // ── opening things ───────────────────────────────────────────────────────────────────────
  const markSvg = (shelf) => `<span class="lab-mark" data-shelf="${shelf}"></span>`
  const dockIcon = (id) => { const s = document.querySelector(`.desk-dock__item[data-id="${id}"] svg`); return s ? s.outerHTML : '' }
  function openPiece(slug, opener) {
    const p = LAB.pieces.find((x) => x.slug === slug)
    if (!p) return
    hidePlate(false)
    const s = sky.stars[slug]
    LAB.visited.add(slug)
    if (s) s.el.dataset.visited = ''
    if (LAB.opens(p).card) return openArcade(p, opener)
    sky.focus(slug)
    return win.open({
      id: 'piece:' + slug, title: p.title, tone: p.shelf, icon: markSvg(p.shelf),
      colour: p.shelf === 'playground' ? 'var(--star-play)' : 'var(--star-notes)',
      body: win.piece(p), from: s ? { x: s.x, y: s.y } : null, near: s ? { x: s.x, y: s.y } : null, opener: opener || (s && s.el),
    })
  }
  function openArcade(p, opener) {
    const a = DESK.content.apps.find((x) => x.id === 'arcade'), s = p && sky.stars[p.slug]
    const near = s ? { x: s.x, y: s.y } : null
    const existing = win.open_.find((w) => w.id === 'arcade')
    if (existing) win.close(existing, { instant: true, keepCamera: true })
    return win.open({ id: 'arcade', title: a.label, tone: 'arcade', icon: dockIcon('arcade'), colour: a.colour, width: a.width, body: win.arcade(p), from: near || worldOf(opener), near, opener })
  }
  function openIndex(opener) {
    hidePlate(false)
    return win.open({ id: 'index', title: 'Lab', tone: 'index', icon: dockIcon('lab'), colour: '#141414', width: 600, body: win.index(), from: worldOf(opener), opener })
  }
  const worldOf = (node) => {
    if (!node || !node.getBoundingClientRect) return null
    const r = node.getBoundingClientRect(), c = DESK.camera
    return { x: (r.left + r.width / 2 - c.x) / c.s, y: (r.top + r.height / 2 - c.y) / c.s }
  }
  // a desk card from night mode: back to the desk first, then the desk's own focusCard
  function toDesk(card) { return run(0).then(() => card && DESK.focusCard(card)) }

  win.onAction((a, from) => {
    if (a.open) return openPiece(a.open, from)
    if (a.desk) return toDesk(a.desk)
    if (a.star) { win.closeAll({}).then(() => { flyFit(); showPlate(a.star) }) }
  })

  // ── chrome: the night bar ───────────────────────────────────────────────────────────────
  const SUN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>'
  function buildBar() {
    const bar = h('div', 'nightbar lab-sky')
    bar.setAttribute('role', 'toolbar')
    bar.setAttribute('aria-label', 'Night mode')
    const shelves = (LAB.shelves || []).map((s) => `<button type="button" data-shelf="${s.id}" aria-pressed="false">${markSvg(s.id)}${esc(LAB.shelfName(s.id))}</button>`).join('')
    bar.innerHTML =
      `<button type="button" class="nb-back">${SUN}<span>Back to the desk</span></button>` +
      `<div class="nb-seg" role="group" aria-label="Show"><button type="button" data-shelf="" aria-pressed="true">Both</button>${shelves}</div>` +
      `<div class="nb-tools"><button type="button" class="nb-btn" data-act="index">Index</button><button type="button" class="nb-btn" data-act="fit">Fit</button></div>`
    document.body.prepend(bar) // first in the Tab order: back, filter, index, fit, then the stars
    bar.querySelector('.nb-back').addEventListener('click', () => NIGHT.leave())
    bar.querySelector('.nb-seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setShelf(b.dataset.shelf || null) })
    bar.querySelector('[data-act="index"]').addEventListener('click', (e) => openIndex(e.currentTarget))
    bar.querySelector('[data-act="fit"]').addEventListener('click', () => { hidePlate(false); win.closeAll({}); flyFit() })
    el.bar = bar
    el.back = bar.querySelector('.nb-back')
  }
  function setShelf(shelf) {
    sky.filter(shelf)
    for (const b of el.bar.querySelectorAll('.nb-seg button')) b.setAttribute('aria-pressed', String((b.dataset.shelf || null) === (shelf || null)))
    if (st.plate && shelf && LAB.pieces.find((p) => p.slug === st.plate.slug).shelf !== shelf) hidePlate(false)
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
    // Each kit layer is dozens of radial-gradients, slow to rasterise. Bake each into one bitmap
    // tile (same dots: read back from the gradients the kit wrote), so a tile paints as an image.
    const dpr = Math.min(2, devicePixelRatio || 1)
    const depths = [...n.querySelectorAll('.lab-starfield__layer')].map((l, i) => {
      const tile = parseFloat(l.style.backgroundSize) || 400
      const c = document.createElement('canvas'), g = c.getContext('2d')
      c.width = c.height = Math.round(tile * dpr)
      g.scale(dpr, dpr)
      for (const m of l.style.backgroundImage.matchAll(/at ([\d.]+)px ([\d.]+)px, rgba\([^,]+,\s*([\d.]+)\) 0(?:px)? ([\d.]+)px/g)) {
        g.fillStyle = `rgba(237, 234, 224, ${m[3]})`
        g.beginPath(); g.arc(+m[1], +m[2], +m[4] + 0.3, 0, Math.PI * 2); g.fill()
      }
      l.style.backgroundImage = `url(${c.toDataURL()})`
      l.style.inset = `-${tile}px`
      l.style.willChange = 'transform'
      return { l, tile, f: FACTORS[i] || 0.2 }
    })
    const wrap = (v, m) => ((v % m) + m) % m
    const field = { move: (x, y) => { for (const d of depths) d.l.style.transform = `translate3d(${wrap(x * d.f, d.tile).toFixed(1)}px, ${wrap(y * d.f, d.tile).toFixed(1)}px, 0)` } }
    NIGHT.paintMoon(n.querySelector('canvas'), { size: innerWidth < 700 ? 48 : 64 })
    el.plate = h('aside', 'plate lab-card lab-sky')
    el.plate.hidden = true
    el.plate.setAttribute('aria-labelledby', 'plateTitle')
    document.body.appendChild(el.plate)
    DESK.onFrame((cam) => {
      if (st.t === 0) return
      sky.frame(cam)
      field.move(cam.x, cam.y)
      moveMoon(cam)
      if (st.plate) positionPlate()
    })
  }

  // ── input that only means something at night ────────────────────────────────────────────
  function bindNight() {
    // dock tiles at night: a desk card takes you back to the desk first; the Arcade opens here
    document.addEventListener('click', (e) => {
      if (st.t === 0) return
      const item = e.target.closest('.desk-dock__item[data-id], .desk-folder button')
      if (!item || item.dataset.id === 'lab' || item.dataset.folder !== undefined) return
      e.stopImmediatePropagation()
      if (item.dataset.id === 'arcade') return openArcade(null, item)
      toDesk(null).then(() => item.click())
    }, true)
    document.addEventListener('keydown', (e) => {
      if (st.t === 0 || (e.target.closest && e.target.closest('input, textarea'))) return
      if (e.key === 'Escape') {
        const top = win.top()
        if (top) { e.preventDefault(); win.close(top) }
        else if (st.plate) { e.preventDefault(); hidePlate(true) }
      } else if (e.key === '0') { e.stopPropagation(); hidePlate(false); flyFit() } // the desk's 0 fits the desk
    }, true)
    // a click on empty sky (not a drag) puts the plate away
    let down = null
    DESK.viewport.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY } })
    DESK.viewport.addEventListener('click', (e) => {
      if (!st.plate || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
      if (!e.target.closest('.star, .nwin')) hidePlate(false)
    })
    // Tab into an off-screen star: the browser would scroll the viewport and desync the world
    // from the camera. Undo the scroll, and bring the star into view with the camera instead.
    DESK.viewport.addEventListener('scroll', () => { DESK.viewport.scrollTop = DESK.viewport.scrollLeft = 0 })
    DESK.viewport.addEventListener('focusin', (e) => {
      const b = e.target.closest('.star')
      if (!b || st.t < 1) return
      const r = b.getBoundingClientRect(), c = sky.chrome()
      if (r.left < 16 || r.right > innerWidth - 16 || r.top < c.top - 30 || r.bottom > innerHeight - c.bottom) {
        const s = sky.stars[b.dataset.slug]
        DESK.flyTo(s.x, s.y, DESK.camera.s, 420)
      }
    })
    let resizeTimer = 0
    addEventListener('resize', () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const portrait = innerHeight > innerWidth * 1.1
        if (st.t !== 1 || st.anim) { if (sky.geo.portrait !== portrait && st.t === 0) sky.render(); return }
        if (sky.geo.portrait !== portrait) { sky.render(); setView(fitView()) }
        placeMoon(); sky.relabel()
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
  const snapshot = () => JSON.parse(JSON.stringify(sky.geo.stars))
  let lastStars = null
  window.renderSky = () => {
    const before = lastStars || snapshot(), count = Object.keys(before).length
    sky.render()
    const moved = sky.rings(before)
    for (const s of sky.list) s.el.classList.toggle('is-new', !before[s.slug])
    apply(st.t)
    lastStars = snapshot()
    badge(`${sky.list.length} stars · ${moved} of ${count} moved`, moved === 0)
    return moved
  }
  // where every card and the hero are on screen, to the hundredth of a pixel
  const rects = () => Object.fromEntries([...Object.entries(DESK.cards).map(([id, c]) => [id, c.el]), ['hero', document.querySelector('.desk-hero')]]
    .map(([id, n]) => { const r = n.getBoundingClientRect(); return [id, [r.left, r.top, r.width, r.height]] }))
  // measure once the web font has landed (it re-wraps the cards) and the desk has painted the
  // camera, which it writes on its next frame
  const settled = () => document.fonts.ready.then(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))))
  function compare(a, b) {
    let worst = 0, same = 0
    for (const id in a) { const d = Math.max(...a[id].map((v, i) => Math.abs(v - b[id][i]))); worst = Math.max(worst, d); if (d < 0.01) same++ }
    return { worst, same, n: Object.keys(a).length }
  }

  function proof(what, before) {
    const now = rects(), c = compare(before, now)
    const off = Object.keys(before).filter((id) => Math.max(...before[id].map((v, i) => Math.abs(v - now[id][i]))) >= 0.01)
    badge(`${what} · ${c.same} of ${c.n} where they were · max Δ ${c.worst.toFixed(2)} px${off.length ? ' (' + off.join(', ') + ')' : ''}`, c.same === c.n)
  }
  // /lab, or ?mode=night: straight into night, no transition, then any screenshot switches
  function land() {
    dir = 1; beginEnter(); apply(1); finish(1)
    if (q.get('add')) {
      // exactly what the brief asks a visitor to type in the console
      LAB.pieces.push({ slug: 'test-piece', title: 'Test piece', shelf: 'playground', kind: 'experiment', date: '2099-01', constellation: 'hardware', links: ['usb-camera'] })
      window.renderSky()
    }
    const f = q.get('focus'), o = q.get('open')
    if (f && sky.stars[f]) showPlate(f)
    if (o === 'index') openIndex(el.bar.querySelector('[data-act="index"]'))
    else if (o === 'arcade') openArcade(null, null)
    else if (o) openPiece(o)
  }

  NIGHT.mount = () => {
    buildBar()
    win.mount(DESK.addLayer('night-windows'))
    el.skyLayer = DESK.addLayer('night-sky') // addLayer inserts under earlier layers: sky below windows
    sky.mount(el.skyLayer)
    sky.onPick = (slug, b) => showPlate(slug, b)
    sky.render()
    lastStars = snapshot()
    buildNight()
    bindNight()
    if (LAB.params.shelf) setShelf(LAB.params.shelf)

    const freeze = q.get('freeze')
    if (freeze != null) { NIGHT.scrub(Math.min(1, Math.max(0, parseFloat(freeze) || 0))); return }
    const atNight = q.get('mode') === 'night' || q.get('lab') === '1'
    if (atNight && q.get('then') === 'desk') {
      // record the desk once it has painted, land at night, go back, measure every card
      settled().then(() => {
        const desk = rects()
        land()
        setTimeout(() => NIGHT.leave().then(settled).then(() => proof('Back on the desk', desk)), 700)
      })
    } else if (atNight) land()
    else if (q.get('roundtrip')) {
      // as a visitor would: drag a card, pan a little, then night and back
      const about = DESK.cards.about
      about.x += 140; about.y += 50
      about.el.style.left = about.x + 'px'; about.el.style.top = about.y + 'px'
      const v = view(); setView({ ...v, cx: v.cx + 60, cy: v.cy - 30 })
      settled().then(() => {
        const before = rects()
        return NIGHT.enter().then(() => NIGHT.leave()).then(settled).then(() => proof('Round trip', before))
      })
    } else if (q.get('enter')) setTimeout(() => NIGHT.enter(), 500)
  }
})()
