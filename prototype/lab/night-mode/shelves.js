/*
 * prototype/lab/night-mode/shelves.js: the two shelf cards that open on the night desk.
 *
 * They are desk cards, not a new component: desk.css's `.desk-card` chrome (title bar in an
 * apps.ts pastel, 2px --border, hard slab) and desk.js's `desk-row` markup (year, title,
 * subtitle, chip), the markup the Work and Experience cards use. The only differences are that
 * a row is a <button> here, because it opens something, and rows are grouped under a kind label.
 *
 * Pure (no DOM; check.mjs runs these in Node):
 *   NIGHT.shelves.KIND               display labels for `kind`. lab.json has none yet (PR note).
 *   NIGHT.shelves.model(pieces)      [{ id, name, colour, tint, icon, count, groups: [{ kind,
 *                                    label, rows: [{ slug, year, title, sub, work }] }] }]
 *                                    one entry per shelf in LAB.shelves, every piece exactly once
 *   NIGHT.shelves.bodyHtml(shelf)    the card body for one model entry: groups of desk-rows
 *   NIGHT.shelves.place(at, o)       { [id]: { x, y, w } }: where the cards go, from code.
 *                                    Centred on the night view's world point `at`; never read
 *                                    from data, never from a card's height (so a new row can't
 *                                    move a card). o = { phone, width (screen px), s }
 *   NIGHT.shelves.fit(rects, o)      { cx, cy, s }: the camera that shows them between bar and dock
 * DOM:
 *   NIGHT.shelves.mount(layer)       builds the two cards in a DESK.addLayer() layer
 *   NIGHT.shelves.render()           (re)renders both bodies from LAB.pieces, keeping every row
 *                                    node whose content didn't change; returns what changed
 *   NIGHT.shelves.layout(at)         places the cards around world point `at` for this screen
 *   NIGHT.shelves.cards              { [id]: { el, body, x, y, w } }
 *   NIGHT.shelves.tab(id)            phone: which one is showing ('notes' | 'playground')
 *
 * Phone: one card at a time, with a two-tab switch in its title bar (see the PR for why: two
 * stacked 640px cards put the Playground a screen and a half below, reachable only by a canvas
 * drag that competes with scrolling the card). Both cards still exist; the other is `hidden`.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  const L = () => root_.LAB
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

  // Display labels for the `kind` enum, in shelf order. PROPOSED for content/schema (lab.json's
  // kinds have no labels; shelves do). `game` reads "Arcade": the games are the Arcade's.
  const KIND = { 'write-up': 'Write-ups', essay: 'Essays', experiment: 'Experiments', scrap: 'Scraps', found: 'Found', game: 'Arcade' }
  // Title-bar pastels, taken from apps.ts (DESK.content.apps), not new colours: Notes takes the
  // Writing card's lavender, the Playground the Archive card's peach (its pieces were the
  // Archive's). Neither is on the desk the night replaces, so the two read as new arrivals.
  const LOOK = { notes: { app: 'writing', icon: 'words' }, playground: { app: 'archive', icon: 'archive' } }
  // apps.ts values, for Node (in the browser they come from DESK.content and must agree)
  const APPS = { writing: ['#D9C2FF', '#F0E8FF', 'Writing'], archive: ['#FFD9A8', '#FFF0DC', 'Archive'], work: ['#A8E6A1', '#E4F7E1', 'Work'], about: ['#FACC00', '#FEF3BF', 'About'] }
  const app = (id) => {
    const live = root_.DESK && root_.DESK.content && root_.DESK.content.apps.find((a) => a.id === id)
    return live ? { colour: live.colour, tint: live.tint, label: live.label } : { colour: APPS[id][0], tint: APPS[id][1], label: APPS[id][2] }
  }
  // the canvas's own icons (components/desktop/app-icon.tsx: `words`, `archive`)
  const ICON = {
    words: '<path d="M7 3h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v4h4"/><path d="M8.5 12h7M8.5 15.5h4.5"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>',
  }
  const svg = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`
  // UI words for this mockup (the React build takes them from content/, like every other string)
  const COPY = { onDesk: 'On the desk', show: 'Show', rows: (n) => `${n} pieces` }

  const order = Object.keys(KIND)
  const byKind = (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || (a < b ? -1 : a > b ? 1 : 0)
  // pinned first, then newest first; ties keep lab.json's order (Array.sort is stable)
  const byDate = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)

  const model = (pieces) => (L().shelves || []).map((s) => {
    const own = pieces.filter((p) => p.shelf === s.id)
    const kinds = [...new Set(own.map((p) => p.kind))].sort(byKind)
    const look = LOOK[s.id] || LOOK.playground, a = app(look.app)
    return {
      id: s.id, name: s.name, colour: a.colour, tint: a.tint, icon: look.icon, count: own.length,
      groups: kinds.map((k) => ({
        kind: k, label: KIND[k] || k,
        rows: own.filter((p) => p.kind === k).sort(byDate).map((p) => ({
          slug: p.slug,
          year: String(p.date || '').slice(0, 4),
          title: p.title,
          // the blurb whole; a piece without one gets its body's first sentence or a caption
          sub: p.blurb || (L().excerpt ? L().excerpt(p, 84) : ''),
          work: !!p.project,
        })),
      })),
    }
  })

  const rowHtml = (r) => {
    const work = app('work')
    return `<button type="button" class="desk-row shelf-row" data-open="${esc(r.slug)}">` +
      `<span class="desk-row__yr">${esc(r.year)}</span>` +
      `<span class="shelf-row__txt"><span class="desk-row__ttl">${esc(r.title)}</span>` +
      (r.sub ? `<span class="desk-row__sub">${esc(r.sub)}</span>` : '') + `</span>` +
      (r.work ? `<span class="desk-chip desk-row__tag" style="--t:${work.tint}">${esc(work.label)}</span>` : '') +
      `</button>`
  }
  const bodyHtml = (s) => s.groups.map((g) =>
    `<section class="shelf-group" aria-labelledby="sg-${s.id}-${esc(g.kind)}">` +
    `<h3 class="shelf-group__h t-label" id="sg-${s.id}-${esc(g.kind)}">${esc(g.label)}</h3>` +
    g.rows.map(rowHtml).join('') + `</section>`).join('')
  const footHtml = () => `<span class="t-label">${esc(COPY.onDesk)}</span>` +
    ['work', 'about'].map((id) => { const a = app(id); return `<button type="button" class="shelf-foot__desk" data-desk="${id}" style="--c:${a.colour}">${esc(a.label)} →</button>` }).join('')

  // ── placement: from code, around the night view ───────────────────────────────────────
  const W = 520, GAP = 56, MAX_H = 640 // MAX_H: components/desktop/card.tsx MAX_CARD_H
  const TILT = { notes: -0.6, playground: 0.5 } // the desk's cards lean a little (apps.ts `rotate`)
  const place = (at, o = {}) => {
    const ids = (L().shelves || []).map((s) => s.id)
    if (o.phone) {
      // one at a time, full width at 100%, the same spot for both
      const w = Math.round((o.width || 390) - 24)
      return Object.fromEntries(ids.map((id) => [id, { x: Math.round(at.x - w / 2), y: Math.round(at.y - MAX_H / 2), w }]))
    }
    const total = ids.length * W + (ids.length - 1) * GAP
    return Object.fromEntries(ids.map((id, i) => [id, { x: Math.round(at.x - total / 2 + i * (W + GAP)), y: Math.round(at.y - MAX_H / 2), w: W }]))
  }
  const fit = (rects, o) => {
    const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y))
    const x1 = Math.max(...rects.map((r) => r.x + r.w)), y1 = Math.max(...rects.map((r) => r.y + r.h))
    const s = Math.min(1, (o.vw - o.side * 2) / (x1 - x0), (o.vh - o.top - o.bottom) / (y1 - y0))
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 - (o.top - o.bottom) / 2 / s, s }
  }

  const shelves = (NIGHT.shelves = { KIND, model, bodyHtml, place, fit, MAX_H, cards: {}, at: null })

  // ── DOM ──────────────────────────────────────────────────────────────────────────────
  let layer = null, current = 'notes', act = () => {}
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const isPhone = () => innerWidth < 700
  shelves.onAction = (fn) => { act = fn }
  shelves.phone = isPhone

  shelves.mount = (l) => {
    layer = l
    for (const s of model(L().pieces)) {
      const el = h('section', 'desk-card shelf')
      el.dataset.shelf = s.id
      el.setAttribute('aria-labelledby', `sh-${s.id}`)
      el.style.setProperty('--c', s.colour)
      el.style.rotate = TILT[s.id] + 'deg'
      const tabs = (L().shelves || []).map((o) => `<button type="button" role="tab" id="tab-${s.id}-${o.id}" data-tab="${o.id}" aria-controls="sb-${o.id}" aria-selected="${o.id === s.id}" tabindex="${o.id === s.id ? 0 : -1}">${esc(o.name)}</button>`).join('')
      const head = h('header', 'desk-card__head',
        `<span class="desk-card__ico">${svg(s.icon)}</span><h2 class="desk-card__name" id="sh-${s.id}">${esc(s.name)}</h2>` +
        `<div class="shelf-tabs" role="tablist" aria-label="${esc(COPY.show)}">${tabs}</div>` +
        `<span class="shelf__count t-label" aria-label="${esc(COPY.rows(s.count))}">${s.count}</span>` +
        // card.tsx's scroll mark: shown only while the body really overflows
        `<span class="shelf__scroll" aria-hidden="true"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10l4-4 4 4M8 14l4 4 4-4"/></svg></span>`)
      const body = h('div', 'desk-card__body shelf__body')
      body.id = 'sb-' + s.id
      body.setAttribute('role', 'tabpanel') // a plain region on desktop, where the tabs are display:none
      body.setAttribute('aria-labelledby', `sh-${s.id}`)
      body.innerHTML = bodyHtml(s)
      const foot = h('footer', 'shelf-foot', footHtml())
      el.append(head, body, foot)
      layer.appendChild(el)
      const card = { el, body, head, x: 0, y: 0, w: W }
      shelves.cards[s.id] = card
      bind(card, s.id)
      // as card.tsx: data-scrolls only while there is something to scroll to
      const sync = () => { if (body.scrollHeight > body.clientHeight + 1) el.dataset.scrolls = 'true'; else delete el.dataset.scrolls }
      card.sync = sync
      if (typeof ResizeObserver === 'function') new ResizeObserver(sync).observe(body)
    }
  }

  function bind(card, id) {
    const { el, head, body } = card
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-open], [data-desk], [data-tab]')
      if (!t) return
      if (t.dataset.tab) return shelves.tab(t.dataset.tab, true)
      if (t.dataset.open) act({ open: t.dataset.open }, t)
      else act({ desk: t.dataset.desk }, t)
    })
    head.querySelector('.shelf-tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const ids = (L().shelves || []).map((s) => s.id), i = ids.indexOf(id)
      shelves.tab(ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length], true)
    })
    // a long shelf scrolls inside its card instead of panning the night (as on /canvas)
    body.addEventListener('wheel', (e) => { if (!(e.ctrlKey || e.metaKey) && body.scrollHeight > body.clientHeight) e.stopPropagation() })
    // drag by the title bar; deltas divide by scale or the card drifts from the cursor when zoomed
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return
      e.stopPropagation()
      head.setPointerCapture(e.pointerId)
      head.classList.add('is-dragging')
      let lx = e.clientX, ly = e.clientY
      const move = (ev) => {
        card.x += (ev.clientX - lx) / DESK.camera.s
        card.y += (ev.clientY - ly) / DESK.camera.s
        lx = ev.clientX; ly = ev.clientY
        el.style.left = card.x + 'px'; el.style.top = card.y + 'px'
      }
      const up = () => { head.classList.remove('is-dragging'); head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up) }
      head.addEventListener('pointermove', move)
      head.addEventListener('pointerup', up)
    })
    el.addEventListener('pointerdown', () => raise(card), true)
  }
  let z = 50
  const raise = (card) => { for (const c of Object.values(shelves.cards)) c.el.classList.toggle('is-focused', c === card); card.el.style.zIndex = ++z }

  shelves.layout = (at) => {
    shelves.at = at
    const phone = isPhone(), spots = place(at, { phone, width: innerWidth })
    layer.dataset.mode = phone ? 'tabs' : 'pair'
    for (const [id, c] of Object.entries(shelves.cards)) {
      Object.assign(c, spots[id])
      c.el.style.left = c.x + 'px'; c.el.style.top = c.y + 'px'; c.el.style.width = c.w + 'px'
      c.el.style.rotate = phone ? '0deg' : TILT[id] + 'deg'
    }
    shelves.tab(current, false)
  }
  shelves.visible = () => Object.entries(shelves.cards).filter(([, c]) => !c.el.hidden).map(([id]) => id)
  shelves.rects = () => shelves.visible().map((id) => { const c = shelves.cards[id]; return { id, x: c.x, y: c.y, w: c.w, h: c.el.offsetHeight } })
  shelves.current = () => current

  shelves.tab = (id, focus) => {
    if (!shelves.cards[id]) return
    current = id
    const phone = layer && layer.dataset.mode === 'tabs'
    for (const [cid, c] of Object.entries(shelves.cards)) {
      c.el.hidden = phone && cid !== id
      for (const t of c.head.querySelectorAll('[role="tab"]')) {
        const on = t.dataset.tab === id
        t.setAttribute('aria-selected', String(on))
        t.tabIndex = on ? 0 : -1
      }
    }
    if (focus) {
      const t = shelves.cards[id].head.querySelector(`[data-tab="${id}"]`)
      if (t) t.focus({ preventScroll: true })
    }
    if (shelves.onTab) shelves.onTab(id)
  }

  // Re-render from LAB.pieces. A row whose markup is unchanged keeps its DOM node, so "nothing
  // else changes" is literal: returns { kept, added: [slugs], removed: [slugs], changed: [shelf ids] }
  shelves.render = () => {
    const out = { kept: 0, added: [], removed: [], changed: [] }
    for (const s of model(L().pieces)) {
      const c = shelves.cards[s.id]
      if (!c) continue
      const t = document.createElement('template')
      t.innerHTML = bodyHtml(s) // parsed, so it compares like for like with the live body
      const was = new Map([...c.body.querySelectorAll('[data-open]')].map((n) => [n.dataset.open, n]))
      if (c.body.innerHTML === t.innerHTML) { out.kept += was.size; continue }
      out.changed.push(s.id)
      for (const n of [...t.content.querySelectorAll('[data-open]')]) {
        const o = was.get(n.dataset.open)
        if (o && o.outerHTML === n.outerHTML) { n.replaceWith(o); out.kept++ } else if (!o) out.added.push(n.dataset.open)
        was.delete(n.dataset.open)
      }
      out.removed.push(...was.keys())
      const top = c.body.scrollTop
      c.body.replaceChildren(t.content)
      c.body.scrollTop = top
      if (c.sync) c.sync()
      const count = c.head.querySelector('.shelf__count')
      count.textContent = s.count
      count.setAttribute('aria-label', COPY.rows(s.count))
    }
    return out
  }
})()
