/*
 * prototype/lab/night-mode/windows.js: night mode's canvas windows: a piece, or the Arcade.
 * They are desk windows (desk.css's .desk-card chrome, dragged by the title bar with deltas
 * divided by scale), in the same world as the shelf cards and in the same cream card style.
 *
 *   NIGHT.win.open({ id, title, icon, colour, body, from, at, width, opener }) → win
 *       from    world point the window grows out of (the row that opened it)
 *       at      world point for its top-left; omitted = the middle of the screen
 *   NIGHT.win.close(win, { instant })   shrinks back into `from`, camera returns
 *   NIGHT.win.closeAll({ instant }), NIGHT.win.top(), NIGHT.win.open_ (the live list)
 *   NIGHT.win.piece(p) / .arcade(p)     the bodies, built from LAB data only
 *   NIGHT.win.onAction(fn)   night.js handles { open: slug } / { desk: cardId }
 *
 * Open and close are an explicit FLIP, as CLAUDE.md asks (never Motion's layoutId): the start
 * transform is measured from the row's point and the window's rect, both in world space, which
 * is screen space divided by the one camera transform they share. Reduced motion: opacity only.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
  const reduced = () => LAB.sky.reduced
  const app = (id) => DESK.content.apps.find((a) => a.id === id)
  // UI words for this mockup (the React build takes them from content/, like every other string)
  const COPY = {
    readOn: (host) => `Read on ${host}`, project: 'Project page', inWork: (w) => `In ${w}, on the desk`,
    linked: 'Linked', stub: 'Stub · the live Arcade card plays these here',
  }
  const host = (u) => { try { return new URL(u).host.replace(/^www\./, '') } catch { return u } }

  const win = (NIGHT.win = { open_: [] })
  let layer, z = 100, act = () => {}
  win.mount = (l) => { layer = l }
  win.onAction = (fn) => { act = fn }

  const view = () => ({ cx: (innerWidth / 2 - DESK.camera.x) / DESK.camera.s, cy: (innerHeight / 2 - DESK.camera.y) / DESK.camera.s, s: DESK.camera.s })
  const band = () => {
    const bar = document.querySelector('.nightbar'), phone = innerWidth < 700
    return { top: (bar ? bar.getBoundingClientRect().bottom : 80) + (phone ? 12 : 20), bottom: phone ? 84 : 118 }
  }

  win.top = () => win.open_[win.open_.length - 1] || null
  const raise = (w) => {
    w.el.style.zIndex = ++z
    win.open_ = [...win.open_.filter((o) => o !== w), w]
  }

  win.open = (o) => {
    const had = win.open_.find((w) => w.id === o.id)
    if (had) { raise(had); flyTo(had); had.el.querySelector('.nwin__title').focus({ preventScroll: true }); return had }
    const w = Math.min(o.width || 560, innerWidth - 24)
    const el = h('section', 'desk-card nwin')
    el.dataset.win = o.id
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-label', o.title)
    const head = h('header', 'desk-card__head', `<span class="desk-card__ico">${o.icon || ''}</span><span class="desk-card__name">${esc(o.title)}</span>`)
    const x = h('button', 'desk-card__x'); x.type = 'button'; x.setAttribute('aria-label', 'Close')
    head.appendChild(x)
    const body = h('div', 'desk-card__body nwin__body')
    if (typeof o.body === 'string') body.innerHTML = o.body; else body.appendChild(o.body)
    el.append(head, body)

    // where: night.js says (beside the shelves); else the middle of the screen
    const v = view()
    const wx = o.at ? o.at.x : v.cx - w / 2, wy = o.at ? o.at.y : v.cy - 260
    el.style.cssText = `left:${wx}px;top:${wy}px;width:${w}px;--c:${o.colour || '#fff'}`
    layer.appendChild(el)
    // the body scrolls inside the band between bar and dock; the head is measured, since a long
    // title wraps to two lines on a phone
    const b = band()
    body.style.maxHeight = Math.max(240, innerHeight - b.top - b.bottom - head.offsetHeight - 8) + 'px'

    const item = { id: o.id, el, x: wx, y: wy, w, from: o.from || { x: wx + w / 2, y: wy }, opener: o.opener, prev: { ...v } }
    raise(item) // also adds it to win.open_, on top
    bind(item, head, x, body)

    const hgt = el.offsetHeight
    if (reduced()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'linear' })
    else {
      const dx = item.from.x - (wx + w / 2), dy = item.from.y - (wy + hgt / 2)
      el.animate([{ translate: `${dx}px ${dy}px`, scale: 0.04, opacity: 0 }, { translate: '0 0', scale: 1, opacity: 1 }], { duration: 320, easing: EASE })
    }
    flyTo(item)
    el.querySelector('.nwin__title').focus({ preventScroll: true })
    return item
  }

  function flyTo(item) {
    const b = band(), hgt = item.el.offsetHeight
    const s = Math.min(1, (innerWidth - 24) / item.w, (innerHeight - b.top - b.bottom) / hgt)
    const centre = (b.top + innerHeight - b.bottom) / 2
    return DESK.flyTo(item.x + item.w / 2, item.y + hgt / 2 - (centre - innerHeight / 2) / s, s, 620)
  }

  win.close = (item, { instant = false, keepCamera = false } = {}) => new Promise((done) => {
    if (!item || !win.open_.includes(item)) return done()
    win.open_ = win.open_.filter((o) => o !== item)
    // finish once, on the animation's end or, if a starved frame loop never delivers it, a timer
    let over = false
    const el = item.el, finish = () => { if (over) return; over = true; el.remove(); done() }
    if (!instant) setTimeout(finish, 600)
    if (instant) finish()
    else if (reduced()) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'linear' }).onfinish = finish
    else {
      const r = { w: el.offsetWidth, h: el.offsetHeight }
      const dx = item.from.x - (item.x + r.w / 2), dy = item.from.y - (item.y + r.h / 2)
      el.animate([{ translate: '0 0', scale: 1, opacity: 1 }, { translate: `${dx}px ${dy}px`, scale: 0.04, opacity: 0 }], { duration: 260, easing: EASE }).onfinish = finish
    }
    if (!keepCamera && !instant) DESK.flyTo(item.prev.cx, item.prev.cy, item.prev.s, 620)
    const next = win.top()
    if (next) next.el.querySelector('.nwin__title').focus({ preventScroll: true })
    else if (item.opener && item.opener.isConnected && !item.opener.inert) item.opener.focus({ preventScroll: true })
  })
  win.closeAll = (o) => Promise.all(win.open_.slice().map((w) => win.close(w, { ...o, keepCamera: true })))

  function bind(item, head, x, body) {
    const el = item.el
    el.addEventListener('pointerdown', () => raise(item), true)
    x.addEventListener('click', (e) => { e.stopPropagation(); win.close(item) })
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return
      e.stopPropagation()
      head.setPointerCapture(e.pointerId)
      head.classList.add('is-dragging')
      let lx = e.clientX, ly = e.clientY
      const move = (ev) => {
        item.x += (ev.clientX - lx) / DESK.camera.s
        item.y += (ev.clientY - ly) / DESK.camera.s
        lx = ev.clientX; ly = ev.clientY
        el.style.left = item.x + 'px'
        el.style.top = item.y + 'px'
      }
      const up = () => { head.classList.remove('is-dragging'); head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up) }
      head.addEventListener('pointermove', move)
      head.addEventListener('pointerup', up)
    })
    // a long piece scrolls inside its window instead of panning the sky
    body.addEventListener('wheel', (e) => { if (!(e.ctrlKey || e.metaKey) && body.scrollHeight > body.clientHeight) e.stopPropagation() })
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-open], [data-desk], a.lab-ref')
      if (!t) return
      if (t.matches('a.lab-ref')) { e.preventDefault(); return act({ open: t.getAttribute('href').slice(1) }, t) }
      if (t.dataset.open) act({ open: t.dataset.open }, t)
      else if (t.dataset.desk) act({ desk: t.dataset.desk }, t)
    })
  }


  // ── bodies: everything below comes from LAB.pieces / DESK.content, nothing typed per piece ──
  const shelf = (id) => (NIGHT.shelves.model(LAB.pieces).find((s) => s.id === id) || {})
  const swatch = (id) => `<i class="nwin__swatch" style="--c:${shelf(id).colour || '#fff'}"></i>`
  const meta = (p) => `<p class="nwin__meta">` +
    `<span class="nwin__shelf t-label">${swatch(p.shelf)}${esc(LAB.shelfName(p.shelf))}</span>` +
    `<span class="desk-chip" style="--t:${shelf(p.shelf).tint}">${esc(p.kind)}</span>` +
    `<span class="t-label nwin__dim">${esc(p.when || p.date)}</span>` +
    (p.status ? `<span class="desk-chip nwin__status">${esc(p.status)}</span>` : '') + `</p>`

  const gallery = (p) => {
    const imgs = p.images || []
    if (!imgs.length) return ''
    const fig = (im, cls) => `<figure class="${cls}"><img src="${esc(LAB.asset(im.src))}" alt="${esc(im.caption || p.title)}" loading="lazy">` +
      (im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : '') + `</figure>`
    if (imgs.length === 1) return `<div class="nwin__gallery">${fig(imgs[0], 'nwin__hero')}</div>`
    return `<div class="nwin__gallery">${fig(imgs[0], 'nwin__hero')}<div class="nwin__thumbs" style="--n:${imgs.length - 1}">` +
      imgs.slice(1).map((im) => fig(im, 'nwin__thumb')).join('') + `</div></div>`
  }

  // links one way in lab.json, backlinks computed, [[slug]]s in the body: all one list
  win.related = (p) => {
    const back = LAB.backlinks()[p.slug] || []
    const linked = [...new Set([...(p.links || []), ...LAB.body.refs(p.body), ...back])].filter((s) => s !== p.slug)
    return linked.map((s) => LAB.pieces.find((x) => x.slug === s)).filter(Boolean)
  }

  win.piece = (p) => {
    const linked = win.related(p)
    const chip = (x) => `<button type="button" class="nwin__link" data-open="${esc(x.slug)}">${swatch(x.shelf)}${esc(x.title)}</button>`
    const actions = [
      p.href ? `<a class="nbtn nbtn--primary" href="${esc(p.href)}" rel="noopener">${esc(COPY.readOn(host(p.href)))} ↗</a>` : '',
      p.project ? `<a class="nbtn" href="/work/${esc(p.project)}">${esc(COPY.project)} ↗</a>` : '',
      p.isProject ? `<button type="button" class="nbtn" data-desk="work">${esc(COPY.inWork(app('work').label))}</button>` : '',
    ].join('')
    return meta(p) +
      `<h2 class="nwin__title" tabindex="-1">${esc(p.title)}</h2>` +
      (p.blurb ? `<p class="lede">${esc(p.blurb)}</p>` : '') +
      gallery(p) +
      (p.body ? `<div class="lab-prose nwin__prose">${LAB.body.render(p.body, { href: (s) => '#' + s })}</div>` : '') +
      (actions ? `<div class="nwin__actions">${actions}</div>` : '') +
      (linked.length ? `<div class="nwin__rel"><p class="t-label nwin__dim">${esc(COPY.linked)}</p><div class="nwin__links">${linked.map(chip).join('')}</div></div>` : '')
  }

  // The Arcade: a stub of the real card, listing the games it plays (pieces with card: 'arcade').
  // The row you came from is marked; the live card would start that game.
  win.arcade = (p) => {
    const games = LAB.pieces.filter((x) => x.card === 'arcade'), a = app('arcade')
    return `<p class="nwin__meta"><span class="nwin__shelf t-label">${swatch('playground')}${esc(LAB.shelfName('playground'))}</span></p>` +
      `<h2 class="nwin__title" tabindex="-1">${esc(a.label)}</h2>` +
      `<div class="arc">${games.map((g) => { const on = p && g.slug === p.slug
        return `<div class="desk-row arc__game${on ? ' is-on' : ''}"${on ? ' aria-current="true"' : ''} style="--t:${a.tint}">` +
          `<span class="arc__play" aria-hidden="true">▶</span><span><span class="desk-row__ttl">${esc(g.title)}</span>` +
          `<span class="desk-row__sub">${esc(g.blurb || '')}</span></span></div>` }).join('')}</div>` +
      `<p class="nwin__stub t-label">${esc(COPY.stub)}</p>`
  }
})()
