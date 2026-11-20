/*
 * prototype/lab/sky-beyond/sky-beyond.js: Direction 1, the sky beyond the desk.
 *
 * Builds on the kit: DESK (shared/desk.js) owns the camera and the one rAF loop that writes
 * world.style.transform. Everything here reads the camera in DESK.onFrame and moves it only
 * through DESK.flyTo, so pan and zoom never pass through anything but that loop. Maths lives in
 * logic.js (SKYB), so check.mjs can test it without a browser.
 *
 *   world  floor layer   the desk's cream island: a soft core with the grid, then a one-bit
 *                        dithered dissolve into the sky (logic.js ditherCell)
 *          sky layer     constellation lines (one SVG), the chart's rim, 19 star <button>s,
 *                        constellation names, the plate card. Placed by LAB.layout's `disc`
 *                        around a centre derived from the deep-space point alone
 *          windows       pieces, the Lab index and the arcade stub, as ordinary canvas cards
 *          nebula layer  a domain-warped nebula, drawn once into a canvas over the sky
 *   fixed  backdrop      the kit's parallax starfield, behind the world
 *          sky bar       the three-way filter, Index, Back to the desk. Solid, no glass
 *
 * URL (so every screenshot is reproducible): ?at=lab (alias ?lab=1) lands in the sky;
 * ?view=edge the mid-transition camera; ?focus=<slug>; ?shelf=notes|playground;
 * ?open=<slug>[,<slug>] or ?open=index; ?proof=1 adds a 20th piece and shows nothing moved.
 * Console: LAB.pieces.push({...}); renderSky()  — same proof, by hand.
 */
;(() => {
  const { GEO } = SKYB
  // The Lab's chrome strings. In the React build they live in content/lab.ts beside edit.ts;
  // nothing here is per-piece copy. Piece text comes only from shared/pieces.js.
  const COPY = {
    both: 'Both',
    index: 'Index',
    toDesk: 'Back to the desk',
    fitSky: 'Fit the sky',
    open: 'Open',
    close: 'Close',
    linked: 'Linked',
    linkedFrom: 'Linked from',
    project: 'Project page',
    inWork: 'In Work',
    readAt: (host) => `Read on ${host}`,
    visit: (host) => `Open ${host}`,
    indexTitle: 'Lab',
    indexSummary: (n) => `${n} pieces`,
    deskLinks: 'Also on the desk',
    door: 'Open the Lab index',
    kinds: { 'write-up': 'Write-ups', essay: 'Essays', experiment: 'Experiments', scrap: 'Scraps', found: 'Found', game: 'Arcade' },
    kind: { 'write-up': 'Write-up', essay: 'Essay', experiment: 'Experiment', scrap: 'Scrap', found: 'Found', game: 'Game' },
    status: { ongoing: 'Ongoing', shelved: 'Shelved', done: 'Done' },
    arcadeStub: 'Mockup stub: the live Arcade card plays these.',
    play: 'Play',
    prev: 'Previous image',
    next: 'Next image',
    proof: (n, m) => `Piece ${m + 1} added · ${n} of ${m} stars moved`,
    filter: 'Show',
  }
  const ARCADE = { label: 'Arcade', colour: '#DCE8A0' } // content/apps.ts, via DESK.content
  const q = new URLSearchParams(location.search)
  const reduced = () => LAB.sky.reduced
  const phone = () => innerWidth < 700
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const NS = 'http://www.w3.org/2000/svg'
  const sv = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e }
  const byId = (slug) => LAB.pieces.find((p) => p.slug === slug)
  const conName = (id) => (LAB.constellations.find((c) => c.id === id) || {}).name || ''
  const shelfName = (id) => LAB.shelfName(id, 'b' === LAB.params.work ? 'b' : 'a')
  const mark = (shelf, cls = 'sb-mark') => `<span class="lab-mark ${cls}" data-shelf="${shelf}" aria-hidden="true"></span>`
  const host = (u) => { try { return new URL(u).host.replace(/^www\./, '') } catch { return u } }
  const appColour = (id) => ((DESK.content && DESK.content.apps.find((a) => a.id === id)) || {}).colour

  const theme = q.get('theme') === 'jet' ? 'jet' : 'cream'
  // the kit calls onLab() bare, so remember how the last action arrived: a keyboard user who
  // takes the Lab tile lands with focus on the first star
  let lastInput = 'pointer'
  addEventListener('pointerdown', () => (lastInput = 'pointer'), true)
  addEventListener('keydown', () => (lastInput = 'key'), true)
  const desk = DESK.mount({ theme, minScale: 0.035, onLab: () => goSky({ keyboard: lastInput === 'key' }) })
  document.documentElement.classList.add('sb')
  const cam = desk.camera
  const view = () => ({ cx: (innerWidth / 2 - cam.x) / cam.s, cy: (innerHeight / 2 - cam.y) / cam.s, w: innerWidth / cam.s })
  const PLACE = SKYB.skyPlacement(desk.deepSpace)

  // ── flights: van Wijk & Nuij's path, stepped through DESK.flyTo(…, 0) on each frame ─────
  let flightRAF = 0
  const cancelFlight = () => cancelAnimationFrame(flightRAF)
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)
  function fly(to, { ms } = {}) {
    cancelFlight()
    if (reduced()) return desk.flyTo(to.cx, to.cy, to.s, 0)
    const F = SKYB.flight(view(), { cx: to.cx, cy: to.cy, w: innerWidth / to.s })
    const dur = ms || Math.min(1900, Math.max(650, F.S * 430)), t0 = performance.now()
    return new Promise((done) => {
      const step = (now) => {
        const u = Math.min(1, (now - t0) / dur), p = F.at(ease(u))
        desk.flyTo(p.cx, p.cy, innerWidth / p.w, 0)
        if (u < 1) flightRAF = requestAnimationFrame(step)
        else done()
      }
      flightRAF = requestAnimationFrame(step)
    })
  }
  // any hand on the canvas cancels a flight, as the kit's own glide does
  for (const ev of ['pointerdown', 'wheel']) desk.viewport.addEventListener(ev, cancelFlight, { capture: true, passive: true })
  // where the kit's own DESK.fit would land, without moving there
  function probe(fn) {
    const saved = { ...cam }
    fn()
    const at = { ...view(), s: cam.s }
    Object.assign(cam, saved)
    return at
  }

  // ── backdrop: a parallax starfield, fixed behind the world ────────────────────────────
  desk.backdrop.classList.add('lab-sky', 'sb-backdrop')
  const field = makeStarfield(desk.backdrop, 11)

  // ── world layers. addLayer inserts after the grid, so the later call sits lower ───────
  desk.grid.hidden = true // the island draws its own grid, so the sky has none
  const skyLayer = desk.addLayer('sky')
  const nebula = makeNebula(desk.addLayer('nebula'))
  const floorLayer = desk.addLayer('floor')
  skyLayer.classList.add('lab-sky', 'sb-sky')
  buildFloor(floorLayer)

  function buildFloor(layer) {
    const { rx, ry } = GEO.core, reach = GEO.dissolve + 0.25
    const core = h('div', 'sb-core'), k = 0.9
    core.style.cssText = `left:${-rx * k}px;top:${-ry * k}px;width:${rx * 2 * k}px;height:${ry * 2 * k}px`
    const cv = h('canvas', 'sb-dither')
    const W = Math.ceil((rx * reach * 2) / GEO.cell), H = Math.ceil((ry * reach * 2) / GEO.cell)
    cv.width = W; cv.height = H
    cv.style.cssText = `left:${-W * GEO.cell / 2}px;top:${-H * GEO.cell / 2}px;width:${W * GEO.cell}px;height:${H * GEO.cell}px`
    layer.append(cv, core)
    const paint = () => {
      const g = cv.getContext('2d'), img = g.createImageData(W, H)
      const col = getComputedStyle(document.documentElement).getPropertyValue('--canvas-base').trim()
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(col) || [0, 'f7', 'f5', 'ee']
      const [r, gg, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16))
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          const wx = (i - W / 2 + 0.5) * GEO.cell, wy = (j - H / 2 + 0.5) * GEO.cell
          if (!SKYB.ditherCell(wx, wy)) continue
          const o = (j * W + i) * 4
          img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255
        }
      g.putImageData(img, 0, 0)
    }
    paint()
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }

  // ── the sky ───────────────────────────────────────────────────────────────────────────
  const S = { lay: null, stars: {}, els: {}, cons: [], focus: null, shelf: null, prev: null, ghosts: null, bandS: 0, rimR: 0 }

  function renderSky({ ghosts } = {}) {
    const before = S.lay ? Object.fromEntries(Object.entries(S.lay.stars).map(([k, v]) => [k, { ...v }])) : null
    const keepFocus = S.focus
    const lay = LAB.layout(LAB.pieces, { shape: 'disc', centre: PLACE.centre, extent: PLACE.extent })
    S.lay = lay
    S.rimR = Math.max(PLACE.radius, lay.frame.r)
    skyLayer.textContent = ''
    S.els = {}
    S.cons = []
    const C = PLACE.centre, R = S.rimR + 80

    // lines and the rim: one SVG in world units, strokes kept at 1 screen px
    const svg = sv('svg', { class: 'sb-lines', viewBox: `${C.x - R} ${C.y - R} ${R * 2} ${R * 2}`, width: R * 2, height: R * 2, 'aria-hidden': 'true' }, skyLayer)
    svg.style.cssText = `left:${C.x - R}px;top:${C.y - R}px`
    sv('circle', { class: 'rim', cx: C.x, cy: C.y, r: S.rimR }, svg)
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, l = i % 6 ? 14 : 34
      sv('line', { class: 'tick', x1: C.x + Math.cos(a) * S.rimR, y1: C.y + Math.sin(a) * S.rimR, x2: C.x + Math.cos(a) * (S.rimR - l), y2: C.y + Math.sin(a) * (S.rimR - l) }, svg)
    }
    S.lineEls = lay.lines.map((l) => {
      const a = lay.stars[l.from], b = lay.stars[l.to]
      const e = sv('line', { class: 'ln ' + l.kind, x1: a.x, y1: a.y, x2: b.x, y2: b.y }, svg)
      e.dataset.from = l.from; e.dataset.to = l.to
      return e
    })

    // constellation names, at the middle of their members; placeLabels picks the side
    const members = {}
    for (const p of LAB.pieces) if (p.constellation && lay.stars[p.slug]) (members[p.constellation] ||= []).push(p.slug)
    for (const c of LAB.constellations) {
      if (!members[c.id]) continue
      const pts = members[c.id].map((s) => lay.stars[s])
      const box = { x0: Math.min(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), x1: Math.max(...pts.map((p) => p.x)), y1: Math.max(...pts.map((p) => p.y)) }
      const el = h('div', 'sb-pin sb-con')
      el.style.cssText = `left:${(box.x0 + box.x1) / 2}px;top:${(box.y0 + box.y1) / 2}px`
      el.innerHTML = `<span class="sb-con__name t-label" aria-hidden="true">${esc(c.name)}</span>`
      el.dataset.con = c.id
      skyLayer.appendChild(el)
      S.cons.push({ id: c.id, el, label: el.firstChild, box, members: members[c.id] })
    }
    // the sky's own name, for when you are far enough out that the stars are a smudge
    const nm = h('div', 'sb-pin sb-skyname')
    nm.style.cssText = `left:${C.x}px;top:${C.y}px`
    nm.innerHTML = `<span class="sb-skyname__t">${mark('notes')}${esc(COPY.indexTitle)}${mark('playground')}</span>`
    skyLayer.appendChild(nm)
    S.skyName = nm

    // stars, in Tab order: shelf → constellation → date
    for (const p of SKYB.starOrder(LAB.pieces, LAB.constellations, LAB.shelves)) {
      const st = lay.stars[p.slug], rp = markR(st)
      const b = h('button', 'sb-star')
      b.type = 'button'
      b.dataset.slug = p.slug
      b.dataset.shelf = p.shelf
      b.style.cssText = `left:${st.x}px;top:${st.y}px`
      const name = [p.title, shelfName(p.shelf), conName(p.constellation), COPY.kind[p.kind]].filter(Boolean).join(', ')
      b.setAttribute('aria-label', name)
      b.innerHTML = `<svg class="sb-star__mark" width="${rp * 2 + 16}" height="${rp * 2 + 16}" viewBox="${-rp - 8} ${-rp - 8} ${rp * 2 + 16} ${rp * 2 + 16}" aria-hidden="true">` +
        `<circle class="halo" r="${rp + 5}"/><circle class="ring" r="${rp + 6}"/><path d="${LAB.sky.mark(p.shelf, rp)}"/></svg>` +
        `<span class="sb-star__label" aria-hidden="true">${esc(SKYB.truncate(p.title, 24))}</span>`
      if (LAB.visited.has(p.slug)) b.classList.add('is-visited')
      if (ghosts && !ghosts[p.slug]) b.classList.add('is-new')
      skyLayer.appendChild(b)
      S.els[p.slug] = { b, label: b.lastChild, rp, p }
    }
    // the proof: a dashed ring wherever a star was before this render
    if (ghosts) for (const [slug, g] of Object.entries(ghosts)) {
      const el = h('div', 'sb-pin sb-ghost')
      el.style.cssText = `left:${g.x}px;top:${g.y}px`
      el.dataset.slug = slug
      skyLayer.appendChild(el)
    }
    S.bandS = 0
    measureLabels()
    applyFilter(S.shelf)
    syncPlace(true)
    if (keepFocus && S.els[keepFocus]) select(keepFocus, { quiet: true })

    let moved = 0
    if (before) for (const k in before) if (Math.hypot(before[k].x - lay.stars[k].x, before[k].y - lay.stars[k].y) > 0.5) moved++
    const out = { pieces: LAB.pieces.length, moved, of: before ? Object.keys(before).length : 0 }
    S.prev = before
    return out
  }
  const markR = (st) => SKYB.markR(st.r)

  function measureLabels() {
    for (const e of Object.values(S.els)) { e.w = e.label.offsetWidth; e.h = e.label.offsetHeight }
    for (const c of S.cons) { c.w = c.label.offsetWidth; c.h = c.label.offsetHeight }
    S.bandS = 0
  }

  // labels: re-placed whenever the zoom moves by 6%, in screen px at that zoom (logic.js)
  function placeLabels(force) {
    const s = cam.s
    // re-place when the zoom moves 6%, or a pan carries the screen edge across a quarter of it
    const panned = S.bandAt ? Math.hypot(cam.x - S.bandAt.x, cam.y - S.bandAt.y) > Math.min(innerWidth, innerHeight) / 4 : true
    if (!force && S.bandS && Math.abs(Math.log(s / S.bandS)) < 0.06 && !panned) return
    S.bandS = s
    S.bandAt = { x: cam.x, y: cam.y }
    // the screen, in the same px-at-this-zoom space as the labels, minus the chrome
    const bounds = SKYB.labelBounds(cam, innerWidth, innerHeight)
    const lay = S.lay, extra = []
    const d = desk.cards['deep-space']
    if (d) extra.push({ x: d.x * s, y: d.y * s, w: d.w * s, h: d.el.offsetHeight * s, owner: '' })
    // far out, the sky shows only its name
    const discPx = S.rimR * s
    S.skyName.classList.toggle('is-on', discPx < 150)
    S.skyName.style.setProperty('--up', -(discPx + 16) + 'px')
    skyLayer.style.setProperty('--mk', Math.max(0.4, Math.min(1, discPx / 260)))
    const platePinned = S.focus && !plate.hidden
    if (platePinned) {
      // the plate carries the title on a wide screen, and is itself an obstacle
      const st = lay.stars[S.focus]
      const dx = parseFloat(plate.style.getPropertyValue('--dx')) || 0, dy = parseFloat(plate.style.getPropertyValue('--dy')) || 0
      extra.push({ x: st.x * s + dx, y: st.y * s + dy, w: plate.offsetWidth, h: plate.offsetHeight, owner: '' })
      S.els[S.focus].label.classList.add('is-off')
    }
    const out = SKYB.skyLabels({
      s, bounds, tiny: discPx < 150, focus: S.focus, focusLabel: !platePinned, obstacles: extra,
      stars: Object.values(S.els).map((e) => ({ slug: e.p.slug, x: lay.stars[e.p.slug].x, y: lay.stars[e.p.slug].y, r: lay.stars[e.p.slug].r, rp: e.rp, w: e.w, h: e.h, isProject: !!e.p.isProject, date: e.p.date })),
      cons: S.cons.map((c) => ({ id: c.id, box: c.box, w: c.w, h: c.h })),
    })
    for (const [slug, e] of Object.entries(S.els)) {
      const o = out[slug]
      if (slug === S.focus && !plate.hidden) continue
      e.label.classList.toggle('is-off', !o || !o.show)
      if (o) e.label.style.transform = `translate(${o.dx}px, ${o.dy}px)`
    }
    for (const c of S.cons) {
      const o = out['con:' + c.id]
      c.label.classList.toggle('is-off', !o || !o.show)
      if (o) c.label.style.transform = `translate(${o.dx}px, ${o.dy}px)`
    }
  }

  // ── focus, the plate, the filter ─────────────────────────────────────────────────────
  const neighbours = (slug) => new Set(S.lay.lines.filter((l) => l.from === slug || l.to === slug).flatMap((l) => [l.from, l.to]))
  const plate = h('div', 'sb-plate lab-sky')
  plate.hidden = true
  plate.setAttribute('role', 'group')
  const sheet = h('div', 'sb-sheet lab-sky')
  sheet.hidden = true
  sheet.setAttribute('role', 'group')

  function plateHTML(p) {
    const meta = [COPY.kind[p.kind], SKYB.when(p), COPY.status[p.status], conName(p.constellation)].filter(Boolean)
    return `<div class="sb-plate__shelf t-label">${mark(p.shelf)}${esc(shelfName(p.shelf))}</div>` +
      `<h3 class="sb-plate__title">${esc(p.title)}</h3>` +
      (LAB.excerpt(p) ? `<p class="sb-plate__blurb">${esc(LAB.excerpt(p, 140))}</p>` : '') +
      `<div class="sb-chips">${meta.map((m) => `<span class="lab-chip">${esc(m)}</span>`).join('')}</div>` +
      `<button type="button" class="sb-btn sb-btn--go" data-open="${esc(p.slug)}">${esc(COPY.open)} →</button>`
  }

  function select(slug, { quiet } = {}) {
    const e = S.els[slug]
    if (!e) return
    S.focus = slug
    skyLayer.dataset.focus = slug
    const near = neighbours(slug)
    for (const [k, o] of Object.entries(S.els)) {
      o.b.classList.toggle('is-focus', k === slug)
      o.b.classList.toggle('is-near', k !== slug && near.has(k))
    }
    for (const l of S.lineEls) l.classList.toggle('is-hot', l.dataset.from === slug || l.dataset.to === slug)
    for (const c of S.cons) c.el.classList.toggle('is-near', c.members.includes(slug))
    showPlate(e.p)
    placeLabels(true)
    if (!quiet) keepInView(slug)
  }
  function deselect() {
    if (!S.focus) return
    S.focus = null
    delete skyLayer.dataset.focus
    for (const o of Object.values(S.els)) o.b.classList.remove('is-focus', 'is-near')
    for (const l of S.lineEls) l.classList.remove('is-hot')
    for (const c of S.cons) c.el.classList.remove('is-near')
    plate.hidden = true
    sheet.hidden = true
    placeLabels(true)
  }
  function showPlate(p) {
    if (phone()) {
      plate.hidden = true
      sheet.innerHTML = plateHTML(p)
      sheet.hidden = false
      return
    }
    sheet.hidden = true
    const st = S.lay.stars[p.slug], e = S.els[p.slug]
    plate.innerHTML = plateHTML(p)
    plate.style.left = st.x + 'px'
    plate.style.top = st.y + 'px'
    // after the star in the DOM, so Tab goes star → Open → next star
    e.b.after(plate)
    plate.hidden = false
    const sx = st.x * cam.s + cam.x, w = plate.offsetWidth, ph = plate.offsetHeight
    const right = sx + e.rp + 18 + w < innerWidth - 16
    const sy = st.y * cam.s + cam.y
    const dy = Math.max(84 - sy, Math.min(innerHeight - 140 - ph - sy, -ph / 2))
    plate.style.setProperty('--dx', (right ? e.rp + 18 : -e.rp - 18 - w) + 'px')
    plate.style.setProperty('--dy', dy + 'px')
  }
  function keepInView(slug) {
    const st = S.lay.stars[slug], sx = st.x * cam.s + cam.x, sy = st.y * cam.s + cam.y, m = 90
    if (sx < m || sy < 110 || sx > innerWidth - m || sy > innerHeight - 160) desk.flyTo(st.x, st.y, cam.s, 420)
  }

  function applyFilter(shelf) {
    S.shelf = shelf
    if (shelf) skyLayer.dataset.shelf = shelf
    else delete skyLayer.dataset.shelf
    for (const e of Object.values(S.els)) e.b.classList.toggle('is-dim', !!shelf && e.p.shelf !== shelf)
    for (const l of S.lineEls) l.classList.toggle('is-dim', !!shelf && [l.dataset.from, l.dataset.to].some((s) => byId(s) && byId(s).shelf !== shelf))
    for (const c of S.cons) c.el.classList.toggle('is-dim', !!shelf && c.members.every((s) => byId(s).shelf !== shelf))
    if (S.focus && shelf && byId(S.focus).shelf !== shelf) deselect()
    for (const b of bar.querySelectorAll('[data-filter]')) b.setAttribute('aria-pressed', String((b.dataset.filter || null) === (shelf || null)))
    syncTabbable()
  }
  // stars are tabbable only while you are in the sky and their shelf is showing
  function syncTabbable() {
    for (const e of Object.values(S.els)) e.b.tabIndex = S.place === 'sky' && !e.b.classList.contains('is-dim') ? 0 : -1
  }

  // ── windows: ordinary canvas cards, in the sky's jet ──────────────────────────────────
  let zWin = 1000
  function openWindow(id, { title, label, colour, icon, x, y, w, body, from, instant }) {
    const have = desk.cards[id]
    if (have && have.el.isConnected) { raiseWin(have); if (!instant) frameCards([have]); return have }
    const el = h('section', 'desk-card sb-win lab-sky')
    el.dataset.card = id
    el.setAttribute('aria-label', label || title)
    el.style.cssText = `--c:${colour};left:${x}px;top:${y}px;width:${w}px`
    const head = h('header', 'desk-card__head', `<span class="desk-card__ico">${icon}</span><span class="desk-card__name">${esc(title)}</span>`)
    const xb = h('button', 'desk-card__x')
    xb.type = 'button'
    xb.setAttribute('aria-label', COPY.close)
    head.appendChild(xb)
    const bodyEl = h('div', 'desk-card__body sb-win__body', body)
    el.append(head, bodyEl)
    desk.world.appendChild(el)
    const card = { el, x, y, w, from }
    desk.cards[id] = card
    raiseWin(card)
    el.addEventListener('pointerdown', () => raiseWin(card), true)
    xb.addEventListener('click', (e) => { e.stopPropagation(); closeWindow(id) })
    // drag by the title bar; deltas divide by scale (the kit's rule)
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return
      e.stopPropagation()
      head.setPointerCapture(e.pointerId)
      let lx = e.clientX, ly = e.clientY
      const move = (ev) => {
        card.x += (ev.clientX - lx) / cam.s; card.y += (ev.clientY - ly) / cam.s
        lx = ev.clientX; ly = ev.clientY
        el.style.left = card.x + 'px'; el.style.top = card.y + 'px'
      }
      const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up) }
      head.addEventListener('pointermove', move)
      head.addEventListener('pointerup', up)
    })
    wireBody(bodyEl)
    bodyEl.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey || bodyEl.scrollHeight <= bodyEl.clientHeight) return
      e.stopPropagation()
    })
    if (!instant) {
      // FLIP from the star (or the button) that opened it, in world space; opacity only when reduced
      const dur = 320
      if (reduced() || !from) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing: 'linear' })
      else {
        const sx = from.x - x, sy = from.y - y
        el.style.transformOrigin = '0 0'
        el.animate([{ transform: `translate(${sx}px, ${sy}px) scale(0.04)`, opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: dur, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
      }
      frameCards([card]).then(() => xb.focus({ preventScroll: true }))
      raiseWin(card)
    }
    return card
  }
  function raiseWin(card) { card.el.style.zIndex = ++zWin }
  // frame one or more cards under the chrome (the sky bar sits lower than the kit expects)
  const CHROME = () => SKYB.chrome(innerWidth)
  function frameCards(cards, ms = 620) {
    const x0 = Math.min(...cards.map((c) => c.x)), y0 = Math.min(...cards.map((c) => c.y))
    const x1 = Math.max(...cards.map((c) => c.x + c.w)), y1 = Math.max(...cards.map((c) => c.y + c.el.offsetHeight))
    const t = SKYB.fit({ x: x0 - 20, y: y0 - 20, w: x1 - x0 + 40, h: y1 - y0 + 40 }, innerWidth, innerHeight, CHROME())
    return desk.flyTo(t.cx, t.cy, t.s, ms)
  }
  function closeWindow(id) {
    const c = desk.cards[id]
    if (!c) return
    const done = () => { c.el.remove(); delete desk.cards[id] }
    if (reduced()) c.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 }).onfinish = done
    else c.el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.97)' }], { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }).onfinish = done
    const slug = id.startsWith('piece:') ? id.slice(6) : null
    if (slug && S.els[slug]) S.els[slug].b.focus({ preventScroll: true })
  }
  const topWindow = () => Object.entries(desk.cards).filter(([, c]) => c.el.classList.contains('sb-win') && c.el.isConnected)
    .sort((a, b) => +b[1].el.style.zIndex - +a[1].el.style.zIndex)[0]

  // where a window opens: beside its star, nudged below any window already there
  function spotFor(st, w) {
    let x = st.x + 46, y = st.y - 90
    if (st.x > PLACE.centre.x + 200) x = st.x - 46 - w
    for (let i = 0; i < 6; i++) {
      const hit = Object.values(desk.cards).find((c) => c.el.classList.contains('sb-win') && c.el.isConnected &&
        x < c.x + c.w + 24 && x + w + 24 > c.x && y < c.y + c.el.offsetHeight + 24 && y + 300 > c.y)
      if (!hit) break
      if (i < 2) { x = hit.x + hit.w + 40; y = hit.y } else y = hit.y + hit.el.offsetHeight + 40
    }
    return { x, y }
  }

  const ICON = {
    notes: '<svg viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0-9L2.5-2.5 9 0 2.5 2.5 0 9-2.5 2.5-9 0-2.5-2.5Z" fill="currentColor"/></svg>',
    playground: '<svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="6.5" fill="currentColor"/></svg>',
    lab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m5 17 6-6 7 2"/><circle cx="5" cy="17" r="1.6" fill="currentColor"/><circle cx="11" cy="11" r="1.6" fill="currentColor"/><circle cx="18" cy="13" r="1.6" fill="currentColor"/></svg>',
    arcade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="13" rx="2"/><path d="M8 19h8M10 16v3M14 16v3"/><circle cx="12" cy="8" r="1.6"/><path d="M12 9.6V12"/></svg>',
  }
  const SHELF_COLOUR = { notes: '#EDEAE0', playground: '#FFB4A2' } // = jet.css --star-notes / --star-play

  function pieceBody(p) {
    const back = LAB.backlinks(LAB.pieces)[p.slug] || []
    const meta = [COPY.kind[p.kind], SKYB.when(p), COPY.status[p.status], conName(p.constellation)].filter(Boolean)
    const imgs = p.images || []
    let html = `<div class="sb-win__meta t-label">${meta.map((m, i) => `<span>${i ? '· ' : ''}${esc(m)}</span>`).join('')}</div>` +
      `<h2 class="sb-win__title">${esc(p.title)}</h2>`
    if (p.blurb && p.body) html += `<p class="sb-win__blurb">${esc(p.blurb)}</p>`
    if (imgs.length) html += carousel(imgs, p.title)
    if (p.body) html += `<div class="lab-prose">${LAB.body.render(p.body, { href: (s) => '#star-' + s })}</div>`
    else if (p.blurb) html += `<p class="sb-win__blurb">${esc(p.blurb)}</p>`
    const acts = []
    if (p.href) acts.push(`<a class="sb-btn sb-btn--go" href="${esc(p.href)}" rel="noopener">${esc((p.body ? COPY.visit : COPY.readAt)(host(p.href)))} ↗</a>`)
    if (p.project) acts.push(`<a class="sb-btn" href="/work/${esc(p.project)}">${esc(COPY.project)} ↗</a>`, `<button type="button" class="sb-btn" data-desk="work">${esc(COPY.inWork)}</button>`)
    if (acts.length) html += `<div class="sb-acts">${acts.join('')}</div>`
    const refs = (label, slugs) => slugs.length ? `<div class="sb-refs"><span class="t-label">${esc(label)}</span>` +
      slugs.map((s) => byId(s)).filter(Boolean).map((r) => `<button type="button" class="sb-ref" data-star="${esc(r.slug)}">${mark(r.shelf)}${esc(r.title)}</button>`).join('') + '</div>' : ''
    const con = p.constellation ? LAB.pieces.filter((o) => o.constellation === p.constellation && o.slug !== p.slug).map((o) => o.slug) : []
    html += refs(COPY.linked, p.links || []) + refs(COPY.linkedFrom, back) + refs(conName(p.constellation), con.filter((s) => !(p.links || []).includes(s) && !back.includes(s)))
    return html
  }
  function carousel(imgs, title) {
    const fig = (im, i) => `<figure class="sb-car__fig" data-i="${i}"${i ? ' hidden' : ''}><img src="${esc(LAB.asset(im.src))}" alt="${esc(im.caption || title)}" draggable="false">` +
      (im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : '') + '</figure>'
    if (imgs.length === 1) return `<div class="sb-car sb-car--one">${fig(imgs[0], 0)}</div>`
    return `<div class="sb-car" data-n="${imgs.length}" data-at="0">${imgs.map(fig).join('')}` +
      `<div class="sb-car__nav"><button type="button" class="sb-btn sb-btn--sq" data-car="-1" aria-label="${COPY.prev}">←</button>` +
      `<span class="sb-car__count t-label">1 / ${imgs.length}</span>` +
      `<button type="button" class="sb-btn sb-btn--sq" data-car="1" aria-label="${COPY.next}">→</button></div></div>`
  }
  function wireBody(root) {
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-car], [data-star], [data-desk], [data-open], a[href^="#star-"]')
      if (!t) return
      if (t.dataset.car) {
        const car = t.closest('.sb-car'), n = +car.dataset.n, at = (+car.dataset.at + +t.dataset.car + n) % n
        car.dataset.at = at
        car.querySelectorAll('.sb-car__fig').forEach((f) => (f.hidden = +f.dataset.i !== at))
        car.querySelector('.sb-car__count').textContent = `${at + 1} / ${n}`
      } else if (t.dataset.star || t.hash) {
        e.preventDefault()
        const slug = t.dataset.star || t.hash.slice(6)
        flyToStar(slug)
      } else if (t.dataset.desk) toDeskCard(t.dataset.desk)
      else if (t.dataset.open) openPiece(t.dataset.open)
    })
  }

  function openPiece(slug, { instant } = {}) {
    const p = byId(slug)
    if (!p) return
    const st = S.lay.stars[slug]
    LAB.visited.add(slug)
    if (S.els[slug]) S.els[slug].b.classList.add('is-visited')
    plate.hidden = true
    sheet.hidden = true
    const opens = LAB.opens(p)
    if (opens.card === 'arcade') return openArcade(p, st, instant)
    const w = phone() ? 380 : p.images && p.images.length ? 560 : 520
    const at = spotFor(st, w)
    return openWindow('piece:' + slug, { title: shelfName(p.shelf), label: p.title, colour: SHELF_COLOUR[p.shelf], icon: ICON[p.shelf], x: at.x, y: at.y, w, body: pieceBody(p), from: st, instant })
  }
  function openArcade(p, st, instant) {
    const games = LAB.pieces.filter((g) => g.card === 'arcade')
    const body = `<div class="sb-win__meta t-label">${mark('playground')}<span>${esc(shelfName('playground'))}</span><span>· ${esc(conName('arcade'))}</span></div>` +
      `<ul class="sb-games">${games.map((g) => `<li class="${g.slug === p.slug ? 'is-on' : ''}"><span><b>${esc(g.title)}</b><span>${esc(g.blurb || '')}</span></span>` +
        `<button type="button" class="sb-btn${g.slug === p.slug ? ' sb-btn--go' : ''}" disabled>${esc(COPY.play)}</button></li>`).join('')}</ul>` +
      `<p class="sb-stub">${esc(COPY.arcadeStub)}</p>`
    const w = phone() ? 380 : 460, at = spotFor(st, w)
    const card = openWindow('arcade', { title: ARCADE.label, colour: appColour('arcade') || ARCADE.colour, icon: ICON.arcade, x: at.x, y: at.y, w, body, from: st, instant })
    card.el.querySelectorAll('.sb-games li').forEach((li, i) => li.classList.toggle('is-on', games[i].slug === p.slug))
    return card
  }

  function indexBody() {
    const groups = SKYB.indexGroups(LAB.pieces, LAB.shelves)
    return `<p class="sb-index__sum t-label">${esc(COPY.indexSummary(LAB.pieces.length))}</p>` +
      '<div class="sb-index__cols">' + groups.map((g) => `<section class="sb-index__shelf" data-shelf="${g.shelf.id}"><h2 class="sb-index__h">${mark(g.shelf.id)}${esc(shelfName(g.shelf.id))}<span class="sb-index__n">${g.count}</span></h2>` +
        g.kinds.map((k) => `<h3 class="sb-index__kind t-label">${esc(COPY.kinds[k.kind] || k.kind)}</h3><ul class="sb-index__list">` +
          k.rows.map((p) => `<li><button type="button" class="sb-row" data-open="${esc(p.slug)}"><span class="sb-row__t">${esc(p.title)}</span>` +
            `<span class="sb-row__m">${esc(SKYB.when(p))}</span></button>` +
            (p.isProject ? `<button type="button" class="sb-chipbtn t-label" data-desk="work">${esc(COPY.inWork)}</button>` : '') + '</li>').join('') + '</ul>').join('') +
        '</section>').join('') + '</div>' +
      `<div class="sb-index__desk"><span class="t-label">${esc(COPY.deskLinks)}</span>` +
      ['work', 'about'].map((id) => `<button type="button" class="sb-btn" data-desk="${id}"><i style="--c:${appColour(id)}"></i>${esc((DESK.content.apps.find((a) => a.id === id) || {}).label || id)} →</button>`).join('') + '</div>'
  }
  function openIndex({ instant } = {}) {
    const d = desk.cards['deep-space'], w = phone() ? 380 : 880
    return openWindow('lab-index', { title: COPY.indexTitle, colour: '#141414', icon: ICON.lab, x: d.x - w - 70, y: d.y - 60, w, body: indexBody(), from: { x: d.x, y: d.y }, instant })
  }

  // ── going places ─────────────────────────────────────────────────────────────────────
  function skyTarget() {
    const d = desk.cards['deep-space']
    return SKYB.skyFit({ centre: PLACE.centre, rimR: S.rimR, door: { x: d.x, y: d.y, w: d.w, h: d.el.offsetHeight }, vw: innerWidth, vh: innerHeight })
  }
  function goSky({ ms, keyboard } = {}) {
    const t = skyTarget()
    const go = ms === 0 ? desk.flyTo(t.cx, t.cy, t.s, 0) : fly(t)
    // a keyboard user lands on the first star (its plate opens); Shift+Tab reaches the sky bar
    if (keyboard) go.then(() => { const b = skyLayer.querySelector('.sb-star:not(.is-dim)'); if (b) b.focus({ preventScroll: true }) })
    return go
  }
  function goDesk() {
    deselect()
    const t = probe(() => desk.fit(0))
    return fly(t)
  }
  function toDeskCard(id) {
    const c = desk.cards[id]
    if (!c) return
    desk.focusCard(id) // unhides and raises it; the flight below replaces the kit's
    const hgt = c.el.offsetHeight, s = Math.min(1, (innerWidth - 48) / c.w, (innerHeight - 220) / hgt)
    fly({ cx: c.x + c.w / 2, cy: c.y + hgt / 2, s })
  }
  function flyToStar(slug) {
    const st = S.lay.stars[slug]
    if (!st) return
    const s = Math.max(cam.s, phone() ? 0.32 : 0.55)
    fly({ cx: st.x, cy: st.y, s }).then(() => { select(slug, { quiet: true }); S.els[slug].b.focus({ preventScroll: true }) })
  }

  // ── chrome: the sky bar, solid (glass is the dock's and the pill's alone) ─────────────
  const bar = h('div', 'sb-bar lab-sky')
  bar.setAttribute('role', 'toolbar')
  bar.setAttribute('aria-label', COPY.indexTitle)
  bar.innerHTML = `<div class="sb-seg" role="group" aria-label="${COPY.filter}">` +
    `<button type="button" data-filter="" aria-pressed="true">${COPY.both}</button>` +
    LAB.shelves.map((s) => `<button type="button" data-filter="${s.id}" aria-pressed="false">${mark(s.id)}${esc(shelfName(s.id))}</button>`).join('') +
    `</div><div class="sb-bar__acts"><button type="button" class="sb-btn" data-act="index">${ICON.lab}${COPY.index}</button>` +
    `<button type="button" class="sb-btn" data-act="desk">↙ ${COPY.toDesk}</button></div>`
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    if ('filter' in b.dataset) applyFilter(b.dataset.filter || null)
    else if (b.dataset.act === 'index') openIndex()
    else if (b.dataset.act === 'desk') goDesk()
  })
  const badge = h('div', 'sb-badge t-label')
  badge.hidden = true
  document.body.prepend(bar)
  document.body.append(sheet, badge)
  const chrome = [desk.dock, document.querySelector('.desk-pill'), document.querySelector('.desk-zoom'), document.querySelector('.desk-dock__tip'), document.querySelector('.desk-folder')].filter(Boolean)

  // the door: the deep-space card keeps its words and gains the way in
  const door = desk.cards['deep-space']
  door.el.classList.add('sb-door')
  const doorBtn = h('button', 'desk-btn sb-door__btn', esc(COPY.door) + ' →')
  doorBtn.type = 'button'
  doorBtn.addEventListener('click', () => openIndex())
  door.el.querySelector('.desk-card__body').appendChild(doorBtn)

  // ── input ─────────────────────────────────────────────────────────────────────────────
  let pointerFocus = false
  skyLayer.addEventListener('pointerdown', (e) => { if (e.target.closest('.sb-star')) pointerFocus = true }, true)
  skyLayer.addEventListener('focusin', (e) => {
    const b = e.target.closest('.sb-star')
    if (b && !pointerFocus && S.focus !== b.dataset.slug) select(b.dataset.slug)
    pointerFocus = false
  })
  skyLayer.addEventListener('click', (e) => {
    const go = e.target.closest('[data-open]')
    if (go) return openPiece(go.dataset.open)
    const b = e.target.closest('.sb-star')
    if (!b) return
    if (S.focus === b.dataset.slug) openPiece(b.dataset.slug)
    else select(b.dataset.slug, { quiet: true })
  })
  sheet.addEventListener('click', (e) => { const go = e.target.closest('[data-open]'); if (go) openPiece(go.dataset.open) })
  // a click on empty sky (not a drag) clears the focus
  let down = null
  desk.viewport.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY } })
  desk.viewport.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && !e.target.closest('button, a, .desk-card, .sb-plate')) deselect()
    down = null
  })
  // the viewport clips, so a focused star would scroll it; the camera does the moving instead
  desk.viewport.addEventListener('scroll', () => { desk.viewport.scrollTop = 0; desk.viewport.scrollLeft = 0 })
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const top = topWindow()
      if (top) { closeWindow(top[0]); e.preventDefault(); return }
      if (S.focus) { const f = S.focus; deselect(); S.els[f].b.focus({ preventScroll: true }) }
      return
    }
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key]
    const b = document.activeElement && document.activeElement.closest && document.activeElement.closest('.sb-star')
    if (!dir || !b) return
    e.preventDefault()
    const a = S.lay.stars[b.dataset.slug]
    let best = null
    for (const [slug, o] of Object.entries(S.els)) {
      if (slug === b.dataset.slug || o.b.classList.contains('is-dim')) continue
      const st = S.lay.stars[slug], dx = st.x - a.x, dy = st.y - a.y, along = dx * dir[0] + dy * dir[1]
      if (along <= 0) continue
      const score = along + Math.abs(dx * dir[1] - dy * dir[0]) * 2.2
      if (!best || score < best.score) best = { slug, score }
    }
    if (best) S.els[best.slug].b.focus({ preventScroll: true })
  })
  addEventListener('resize', () => { measureLabels(); placeLabels(true) })

  // ── every frame the camera moves (called from DESK's one rAF loop) ─────────────────────
  S.place = null
  function syncPlace(force) {
    const cov = (S.cov = SKYB.coverage(cam, innerWidth, innerHeight))
    const place = S.place === 'sky' ? (cov > 0.45 ? 'desk' : 'sky') : cov < 0.35 ? 'sky' : 'desk'
    if (place === S.place && !force) return
    S.place = place
    document.documentElement.dataset.place = place
    for (const el of chrome) el.classList.toggle('lab-sky', place === 'sky')
    syncTabbable()
  }
  let lastK = 0
  desk.onFrame((c) => {
    // only a zoom touches the sky's style; a pan is a pure transform
    if (c.s !== lastK) { lastK = c.s; skyLayer.style.setProperty('--k', 1 / c.s) }
    if (S.lay) placeLabels()
    syncPlace()
    // while the desk fills the screen the sky behind it costs nothing: no twinkle, no nebula
    const covered = S.cov === 1
    if (covered !== S.covered) { S.covered = covered; desk.backdrop.classList.toggle('is-covered', covered) }
    if (covered) return
    if (!reduced()) field.move(c.x, c.y)
    nebula.draw()
  })

  // ── the starfield ─────────────────────────────────────────────────────────────────────
  // The kit's three seeded depth layers (shared/sky.js: same tile sizes, counts and parallax
  // factors), drawn once each into a bitmap tile instead of as ~60 CSS gradients, and moved by
  // transform instead of background-position. A pan frame then repaints nothing: the
  // compositor slides three textures. See the PR: the kit's version repaints every gradient on
  // every move() and every twinkle frame.
  function makeStarfield(parent, seed) {
    const DEPTHS = [
      { tile: 620, n: 34, size: 0.8, alpha: 0.14, factor: 0.08 },
      { tile: 460, n: 18, size: 1.1, alpha: 0.2, factor: 0.18 },
      { tile: 340, n: 7, size: 1.5, alpha: 0.26, factor: 0.32 },
    ]
    const r = LAB.rand(seed), dpr = Math.min(2, devicePixelRatio || 1)
    const wrap = h('div', 'sb-field')
    wrap.setAttribute('aria-hidden', 'true')
    const layers = DEPTHS.map((d) => {
      const cv = document.createElement('canvas')
      cv.width = cv.height = Math.round(d.tile * dpr)
      const g = cv.getContext('2d')
      g.scale(dpr, dpr)
      for (let i = 0; i < d.n; i++) {
        const x = 2 + r() * (d.tile - 4), y = 2 + r() * (d.tile - 4), a = d.alpha * (0.6 + r() * 0.4)
        g.fillStyle = `rgba(237, 234, 224, ${a.toFixed(3)})`
        g.beginPath(); g.arc(x, y, d.size, 0, Math.PI * 2); g.fill()
      }
      const el = h('div', 'sb-field__layer')
      el.style.cssText = `--t:${d.tile}px;background-image:url(${cv.toDataURL()});background-size:${d.tile}px ${d.tile}px`
      wrap.appendChild(el)
      return { el, d }
    })
    parent.appendChild(wrap)
    const mod = (v, m) => ((v % m) + m) % m - m
    return {
      move(x, y) { for (const { el, d } of layers) el.style.transform = `translate3d(${mod(x * d.factor, d.tile)}px, ${mod(y * d.factor, d.tile)}px, 0)` },
    }
  }

  // ── the nebula ───────────────────────────────────────────────────────────────────────
  // Domain warping, f(p + f(p + f(p))), after Inigo Quilez's article "Domain warping"
  // (iquilezles.org/articles/warp), as the research gallery's #1 shows it. Shader written here.
  // It never drifts, so it is drawn exactly once, the first time the sky shows, into a 640px
  // canvas laid over the sky in world space: from then on pan and zoom only move it, for free.
  // (The research suggested a fixed layer redrawn each frame; a still image needs neither.)
  // Reduced motion has nothing to stop. No WebGL → no nebula; the sky still works.
  function makeNebula(layer) {
    const C = PLACE.centre, E = PLACE.radius * 1.75, N = 640
    const cv = h('canvas', 'sb-nebula')
    cv.width = cv.height = N
    cv.setAttribute('aria-hidden', 'true')
    cv.style.cssText = `left:${C.x - E}px;top:${C.y - E}px;width:${E * 2}px;height:${E * 2}px`
    layer.appendChild(cv)
    let drawn = false
    return {
      draw() {
        if (drawn) return
        drawn = true
        const g = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true })
        if (!g) return
        const FRAG = `precision mediump float;
          uniform float n; uniform float e;
          float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
          float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*ns(p);p=m*p;a*=.5;}return v;}
          void main(){
            vec2 d=(vec2(gl_FragCoord.x, n-gl_FragCoord.y)/n*2.-1.)*e; // -e…e around the sky's centre, in radii
            float fall=smoothstep(1.6,.15,length(d*vec2(1.,1.12)));
            if(fall<=0.){gl_FragColor=vec4(0.);return;}
            vec2 p=d*2.1+vec2(3.7,1.9);
            vec2 q=vec2(fbm(p),fbm(p+vec2(5.2,1.3)));
            vec2 s=vec2(fbm(p+3.5*q+vec2(1.7,9.2)),fbm(p+3.5*q+vec2(8.3,2.8)));
            float f=fbm(p+3.5*s);
            vec3 col=mix(vec3(.10,.07,.16),vec3(.25,.15,.33),clamp(f*f*2.,0.,1.));
            col=mix(col,vec3(.52,.30,.20),clamp(length(q)-.6,0.,1.)*.5);
            col=mix(col,vec3(.80,.74,.64),clamp(s.x*s.x*1.5-.6,0.,1.)*.35);
            float a=smoothstep(.3,.9,f)*fall*.5+(h(gl_FragCoord.xy)-.5)/255.;
            gl_FragColor=vec4(col,clamp(a,0.,1.));}`
        const sh = (type, src) => { const x = g.createShader(type); g.shaderSource(x, src); g.compileShader(x); return x }
        const pr = g.createProgram()
        g.attachShader(pr, sh(g.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'))
        g.attachShader(pr, sh(g.FRAGMENT_SHADER, FRAG))
        g.bindAttribLocation(pr, 0, 'a')
        g.linkProgram(pr)
        if (!g.getProgramParameter(pr, g.LINK_STATUS)) return
        g.useProgram(pr)
        g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer())
        g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW)
        g.enableVertexAttribArray(0)
        g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0)
        g.uniform1f(g.getUniformLocation(pr, 'n'), N)
        g.uniform1f(g.getUniformLocation(pr, 'e'), E / PLACE.radius)
        g.viewport(0, 0, N, N)
        g.drawArrays(g.TRIANGLES, 0, 3)
      },
    }
  }

  // ── boot ─────────────────────────────────────────────────────────────────────────────
  renderSky()
  if (document.fonts) document.fonts.ready.then(() => { measureLabels(); if (S.focus) showPlate(byId(S.focus)); placeLabels(true) })
  window.renderSky = () => {
    const r = renderSky({ ghosts: S.lay ? Object.fromEntries(Object.entries(S.lay.stars).map(([k, v]) => [k, { x: v.x, y: v.y }])) : null })
    badge.textContent = COPY.proof(r.moved, r.of)
    badge.hidden = false
    console.info(`[sky] ${r.pieces} pieces, ${r.moved} of ${r.of} existing stars moved`)
    return r
  }
  window.SKY = { goSky, goDesk, select, openPiece, openIndex, applyFilter, state: S, fly }

  const at = q.get('at') === 'lab' || q.get('lab') === '1'
  const opens = (q.get('open') || '').split(',').filter(Boolean)
  const inSky = at || q.get('focus') || q.get('shelf') || opens.length || q.get('proof')
  if (q.get('view') === 'edge') {
    // the pitch: zoomed out past the desk's edge, the door and the sky coming into view
    const u = PLACE.dir, d = phone() ? 3400 : 2700, s = phone() ? 0.048 : 0.13
    desk.flyTo(u.x * d, u.y * d + (phone() ? 100 : 60), s, 0)
  } else if (inSky) goSky({ ms: 0 })
  if (q.get('proof')) {
    LAB.pieces.push({ slug: 'test-piece', title: 'Test piece', shelf: 'notes', kind: 'write-up', date: '2099-01', constellation: 'hackathons', links: ['sop-opera'] })
    window.renderSky()
    goSky({ ms: 0 })
  }
  if (LAB.params.shelf) applyFilter(LAB.params.shelf)
  if (q.get('focus')) select(q.get('focus'), { quiet: true })
  if (opens.length) {
    const cards = opens.map((id) => (id === 'index' ? openIndex({ instant: true }) : openPiece(id, { instant: true }))).filter(Boolean)
    frameCards(cards, 0) // every window that was asked for
  }
})()
