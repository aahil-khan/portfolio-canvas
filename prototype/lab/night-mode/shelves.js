/*
 * prototype/lab/night-mode/shelves.js: the Lab's three terminal panes, ~/lab/work,
 * ~/lab/experiments and ~/lab/writing, that open on the night desk.
 *
 * THE MODEL CHANGED (Aahil, mid-task): the Lab holds only the serious work. The fun stuff (scraps,
 * found things and the four Arcade games) stays on the desk and never enters the Lab. There are
 * no "Notes & write-ups / Playground" shelves any more. Which pane a piece lands in is decided
 * here, from its `kind`, by filtering the kit's pieces.js (no kit edit):
 *   work         kind `write-up`: the projects, as specimens (name, tagline, kind · year, stack,
 *                status, award, and [read] [repo] [live] where the data has them)
 *   experiments  kind `experiment`: a lab log (exp-NN · month · topic, title, one-line result)
 *   writing      kind `write-up` with a body, and kind `essay`: a list of posts (date, title,
 *                reading time). A write-up is both a project and a post about it, so it is in
 *                both panes, as two different things.
 *   (nowhere)    `scrap`, `found`, `game`
 *
 * Pure (no DOM; check.mjs runs these in Node):
 *   NIGHT.shelves.SECTIONS            the three panes, in order
 *   NIGHT.shelves.model(pieces)       [{ id, path, name, count, entries: [...] }]
 *   NIGHT.shelves.bodyHtml(section)   one pane's body
 *   NIGHT.shelves.posts(pieces)       the readable posts, in the writing pane's order
 *   NIGHT.shelves.minutes(body)       reading time, from the body's word count
 *   NIGHT.shelves.place(at, o)        { [id]: { x, y, w } }: from code, centred on `at`, never
 *                                     from content or a pane's height
 *   NIGHT.shelves.fit(rects, o)       { cx, cy, s }: the camera that shows them
 * DOM:
 *   mount(layer), render() → what changed, layout(at), tab(id, focus), cards, rects(), visible()
 *
 * Phone: one pane at a time, switched by ASCII tabs in the pane's title line (a real tablist).
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  const L = () => root_.LAB
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

  const SECTIONS = [
    { id: 'work', name: 'work', path: '~/lab/', w: 460 },
    { id: 'experiments', name: 'experiments', path: '~/lab/', w: 400 },
    { id: 'writing', name: 'writing', path: '~/lab/', w: 420 },
  ]
  const IN = { work: (p) => p.kind === 'write-up', experiments: (p) => p.kind === 'experiment', writing: (p) => (p.kind === 'write-up' && !!p.body) || p.kind === 'essay' }
  const inLab = (p) => SECTIONS.some((s) => IN[s.id](p))
  // UI words for this mockup (the React build takes them from content/, like every other string)
  const COPY = {
    ls: (id) => `$ ls -t ~/lab/${id}`, show: 'Sections', entries: (n) => `${n} entries`,
    read: 'read', mins: (n) => `${n} min`, out: (host) => `${host} ↗`, kv: { stack: 'stack', status: 'status', award: 'award' },
  }
  const LINK = { Repo: 'repo', Github: 'repo', Site: 'live', Demo: 'live' }
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  // the display date: `when` gives a month only when the source had one (pieces.js: a year-only
  // source keeps a placeholder month in `date`, and no view may show it)
  const when = (p) => {
    const [y, m] = String(p.date || '').split('-')
    return /[a-z]/i.test(p.when || '') && m ? `${MON[+m - 1]} ${y}` : y || ''
  }
  const host = (u) => { try { return new URL(u).host.replace(/^www\./, '') } catch { return u } }
  // reading time: words over 220 a minute, at least one. Markup is not words.
  const words = (md) => String(md || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([a-z0-9-]+)\]\]/g, '$1').replace(/[*#-]/g, ' ').split(/\s+/).filter(Boolean).length
  const minutes = (md) => Math.max(1, Math.round(words(md) / 220))
  const topic = (p) => { const c = (L().constellations || []).find((x) => x.id === p.constellation); return c ? c.name.toLowerCase() : '' }

  // pinned first, then newest first; ties keep lab.json's order (Array.sort is stable)
  const newest = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
  const oldest = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)

  const entries = {
    work: (own) => own.sort(newest).map((p) => {
      const f = (NIGHT.facts || {})[p.slug] || {}
      return {
        slug: p.slug, title: p.title, tagline: p.blurb || '', kind: (f.kind || '').toLowerCase(), year: String(p.date || '').slice(0, 4),
        stack: f.stack || [], status: p.status || '', award: f.award || '', read: !!p.body,
        links: (f.links || []).map((l) => ({ label: LINK[l.label] || l.label.toLowerCase(), href: l.href })),
      }
    }),
    // exp-NN counts up in date order, so a newer experiment is a new number and no old one moves
    experiments: (own) => {
      const n = new Map(own.slice().sort(oldest).map((p, i) => [p.slug, i + 1]))
      return own.sort(newest).map((p) => ({
        slug: p.slug, n: 'exp-' + String(n.get(p.slug)).padStart(2, '0'), when: when(p), topic: topic(p),
        title: p.title, result: L().excerpt ? L().excerpt(p, 96) : p.blurb || '', status: p.status || '',
      }))
    },
    writing: (own) => own.sort(newest).map((p) => ({
      slug: p.slug, when: when(p), title: p.title, sub: p.blurb || '',
      mins: p.body ? minutes(p.body) : 0, href: p.body ? '' : p.href || '',
    })),
  }
  const model = (pieces) => SECTIONS.map((s) => {
    const own = pieces.filter(IN[s.id])
    return { id: s.id, name: s.name, path: s.path, count: own.length, entries: entries[s.id](own.slice()) }
  })
  const posts = (pieces) => model(pieces).find((s) => s.id === 'writing').entries.filter((e) => !e.href)

  // ── markup ──────────────────────────────────────────────────────────────────────────────
  const lead = '<span class="lead" aria-hidden="true"></span>'
  const ENTRY = {
    work: (e, s) => `<article class="spec" data-entry="${esc(e.slug)}" aria-labelledby="e-${s}-${esc(e.slug)}">` +
      `<h3 class="spec__ttl"><span class="spec__name" id="e-${s}-${esc(e.slug)}">${esc(e.title)}</span>${lead}` +
      `<span class="spec__yr">${esc([e.kind, e.year].filter(Boolean).join(' · '))}</span></h3>` +
      (e.tagline ? `<p class="spec__tag">${esc(e.tagline)}</p>` : '') +
      ((e.stack.length || e.status || e.award) ? `<dl class="spec__kv">` +
        (e.stack.length ? `<dt>${COPY.kv.stack}</dt><dd>${esc(e.stack.join(' · '))}</dd>` : '') +
        (e.status ? `<dt>${COPY.kv.status}</dt><dd>${esc(e.status)}</dd>` : '') +
        (e.award ? `<dt>${COPY.kv.award}</dt><dd>${esc(e.award)}</dd>` : '') + `</dl>` : '') +
      ((e.read || e.links.length) ? `<p class="spec__act">` +
        (e.read ? `<button type="button" class="act" data-read="${esc(e.slug)}" aria-describedby="e-${s}-${esc(e.slug)}">${COPY.read}</button>` : '') +
        e.links.map((l) => `<a class="act" href="${esc(l.href)}" rel="noopener" aria-describedby="e-${s}-${esc(e.slug)}">${esc(l.label)}</a>`).join('') + `</p>` : '') +
      `</article>`,
    experiments: (e) => `<button type="button" class="log" data-entry="${esc(e.slug)}" data-open="${esc(e.slug)}">` +
      `<span class="log__id">${esc([e.n, e.when, e.topic].filter(Boolean).join(' · '))}</span>` +
      (e.status ? `<span class="log__st">${esc(e.status)}</span>` : '') +
      `<span class="log__ttl">${esc(e.title)}</span>` + (e.result ? `<span class="log__res">${esc(e.result)}</span>` : '') + `</button>`,
    writing: (e) => (e.href
      ? `<a class="post" data-entry="${esc(e.slug)}" href="${esc(e.href)}" rel="noopener">`
      : `<button type="button" class="post" data-entry="${esc(e.slug)}" data-read="${esc(e.slug)}">`) +
      `<span class="post__d">${esc(e.when)}</span><span class="post__ttl">${esc(e.title)}</span>${lead}` +
      `<span class="post__t">${esc(e.href ? COPY.out(host(e.href)) : COPY.mins(e.mins))}</span>` +
      (e.sub ? `<span class="post__sub">${esc(e.sub)}</span>` : '') + (e.href ? '</a>' : '</button>'),
  }
  const bodyHtml = (s) => `<p class="pane__cmd" aria-hidden="true">${esc(COPY.ls(s.id))}</p>` +
    `<div class="pane__list pane__list--${s.id}">${s.entries.map((e) => ENTRY[s.id](e, s.id)).join('')}</div>`

  // ── placement: from code, around the night view ───────────────────────────────────────
  const GAP = 32, MAX_H = 640 // MAX_H: components/desktop/card.tsx MAX_CARD_H
  const place = (at, o = {}) => {
    if (o.phone) {
      // one at a time, full width at 100%, the same spot for all three
      const w = Math.round((o.width || 390) - 24)
      return Object.fromEntries(SECTIONS.map((s) => [s.id, { x: Math.round(at.x - w / 2), y: Math.round(at.y - MAX_H / 2), w }]))
    }
    const total = SECTIONS.reduce((n, s) => n + s.w, 0) + (SECTIONS.length - 1) * GAP
    let x = at.x - total / 2
    return Object.fromEntries(SECTIONS.map((s) => { const r = [s.id, { x: Math.round(x), y: Math.round(at.y - MAX_H / 2), w: s.w }]; x += s.w + GAP; return r }))
  }
  const fit = (rects, o) => {
    const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y))
    const x1 = Math.max(...rects.map((r) => r.x + r.w)), y1 = Math.max(...rects.map((r) => r.y + r.h))
    const s = Math.min(1, (o.vw - o.side * 2) / (x1 - x0), (o.vh - o.top - o.bottom) / (y1 - y0))
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 - (o.top - o.bottom) / 2 / s, s }
  }

  const shelves = (NIGHT.shelves = { SECTIONS, inLab, model, posts, minutes, when, bodyHtml, place, fit, MAX_H, cards: {}, at: null, COPY })

  // ── DOM ──────────────────────────────────────────────────────────────────────────────
  let layer = null, current = 'work', act = () => {}
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const isPhone = () => innerWidth < 700
  shelves.onAction = (fn) => { act = fn }
  shelves.phone = isPhone

  shelves.mount = (l) => {
    layer = l
    for (const s of model(L().pieces)) {
      const el = h('section', 'pane shelf')
      el.dataset.shelf = s.id
      el.setAttribute('aria-labelledby', `sh-${s.id}`)
      const tabs = SECTIONS.map((o) => `<button type="button" role="tab" id="tab-${s.id}-${o.id}" data-tab="${o.id}" aria-controls="sb-${o.id}" aria-selected="${o.id === s.id}" tabindex="${o.id === s.id ? 0 : -1}">${esc(o.name)}</button>`).join('')
      const head = h('header', 'pane__head',
        `<h2 class="pane__name cut" id="sh-${s.id}"><span class="pane__path">${esc(s.path)}</span>${esc(s.name)}</h2>` +
        `<div class="pane-tabs cut" role="tablist" aria-label="${esc(COPY.show)}">${tabs}</div>` +
        `<span class="pane__fill"></span>` +
        // card.tsx's scroll mark rides in the count's cut-out, shown only while the body overflows
        `<span class="pane__count cut"><span class="pane__scroll" aria-hidden="true">↕ </span><span class="pane__n" aria-label="${esc(COPY.entries(s.count))}">${String(s.count).padStart(2, '0')}</span></span>`)
      const body = h('div', 'pane__body shelf__body')
      body.id = 'sb-' + s.id
      body.setAttribute('role', 'tabpanel') // a plain region on desktop, where the tabs are display:none
      body.setAttribute('aria-labelledby', `sh-${s.id}`)
      body.innerHTML = bodyHtml(s)
      el.append(head, body)
      layer.appendChild(el)
      const card = { el, body, head, x: 0, y: 0, w: 400 }
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
      const t = e.target.closest('[data-open], [data-read], [data-tab]')
      if (!t) return
      if (t.dataset.tab) return shelves.tab(t.dataset.tab, true)
      if (t.dataset.read) act({ read: t.dataset.read }, t)
      else act({ open: t.dataset.open }, t)
    })
    head.querySelector('.pane-tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const ids = SECTIONS.map((s) => s.id), i = ids.indexOf(id)
      shelves.tab(ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length], true)
    })
    // a long pane scrolls inside itself instead of panning the night (as on /canvas)
    body.addEventListener('wheel', (e) => { if (!(e.ctrlKey || e.metaKey) && body.scrollHeight > body.clientHeight) e.stopPropagation() })
    // drag by the title line; deltas divide by scale or the pane drifts from the cursor when zoomed
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
    layer.dataset.mode = phone ? 'tabs' : 'row'
    for (const [id, c] of Object.entries(shelves.cards)) {
      Object.assign(c, spots[id])
      c.el.style.left = c.x + 'px'; c.el.style.top = c.y + 'px'; c.el.style.width = c.w + 'px'
    }
    shelves.tab(current, false)
  }
  shelves.visible = () => Object.entries(shelves.cards).filter(([, c]) => !c.el.hidden).map(([id]) => id)
  shelves.rects = () => shelves.visible().map((id) => { const c = shelves.cards[id]; return { id, x: c.x, y: c.y, w: c.w, h: c.el.offsetHeight } })
  shelves.current = () => current
  // the live node for a pane entry, or a control inside it
  shelves.find = (sel) => layer && layer.querySelector(sel)

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

  // Re-render from LAB.pieces. An entry whose markup is unchanged keeps its DOM node, so "nothing
  // else changes" is literal: returns { kept, added: [slug@pane], removed, changed: [pane ids] }
  shelves.render = () => {
    const out = { kept: 0, added: [], removed: [], changed: [] }
    for (const s of model(L().pieces)) {
      const c = shelves.cards[s.id]
      if (!c) continue
      const t = document.createElement('template')
      t.innerHTML = bodyHtml(s) // parsed, so it compares like for like with the live body
      const was = new Map([...c.body.querySelectorAll('[data-entry]')].map((n) => [n.dataset.entry, n]))
      if (c.body.innerHTML === t.innerHTML) { out.kept += was.size; continue }
      out.changed.push(s.id)
      for (const n of [...t.content.querySelectorAll('[data-entry]')]) {
        const o = was.get(n.dataset.entry)
        if (o && o.outerHTML === n.outerHTML) { n.replaceWith(o); out.kept++ } else if (!o) out.added.push(n.dataset.entry + '@' + s.id)
        was.delete(n.dataset.entry)
      }
      out.removed.push(...[...was.keys()].map((k) => k + '@' + s.id))
      const top = c.body.scrollTop
      c.body.replaceChildren(t.content)
      c.body.scrollTop = top
      if (c.sync) c.sync()
      const count = c.head.querySelector('.pane__n')
      count.textContent = String(s.count).padStart(2, '0')
      count.setAttribute('aria-label', COPY.entries(s.count))
    }
    return out
  }
})()
