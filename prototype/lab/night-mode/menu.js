/*
 * prototype/lab/night-mode/menu.js: the Lab's home, a TUI split.
 *
 *   left   a tree of ~/lab, as tree(1) prints it: work/, experiments/, writing/, entries nested
 *   right  a live preview of the highlighted row (model.previewHtml)
 *   below  the key hints
 * On a phone it is a drill-down instead: the list, then one row's detail with [← back].
 *
 * Nothing in here moves anything: no coordinates, no drag, no pan, no zoom. The two columns are a
 * CSS grid, each column scrolls inside itself.
 *
 * KEYS (on the tree, which is one Tab stop with a roving tabindex, as an ARIA tree):
 *   ↑ ↓ (or k j)  move          Home End  first, last        → (or l)  into a section
 *   ↵ / space     open: a section goes in, an entry opens (a post or log in the reader, an essay
 *                 on Medium)    ← (or h) / esc  up to the entry's section; on a phone, back to the list
 *   1 2 3 and ~ are the Lab's, in night.js.
 * MOUSE: a click highlights a row; a click on the highlighted row (or a double click) opens it.
 * The preview's [read] / [open] / [go in] buttons open too.
 *
 *   NIGHT.menu.mount(root)            builds into root (the Lab screen's main area)
 *   .select(rowId, { focus })         .selected()      .go(sectionId)   (the dock's tiles, 1 2 3)
 *   .open(rowId, from)                .back()          (phone: detail → list)
 *   .render() → { kept, added, removed, changed }      re-render from LAB.pieces (20th piece)
 *   .reveal(p, scramble)              the intro's last beat: the menu decodes in, pure of p
 *   .target(section, slug)            where a closing post goes back to (reader.js)
 *   .onSelect = fn(rowId)             night.js keeps the top bar's path and the dock in step
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const M = () => NIGHT.model
  const C = () => NIGHT.copy
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const phone = () => innerWidth < 700

  const menu = (NIGHT.menu = { onSelect: null })
  let el = {}, secs = [], sel = null, rows = new Map() // rowId → the pure markup it was rendered from

  menu.mount = (root) => {
    secs = M().build(LAB.pieces)
    const tui = h('div', 'tui')
    tui.dataset.view = 'list'
    tui.innerHTML =
      `<section class="frame frame--tree" aria-labelledby="fr-tree"><header class="frame__head"><h2 class="cut frame__name" id="fr-tree">${esc(C().root)}</h2>` +
      `<span class="frame__fill"></span><span class="cut frame__n"></span></header>` +
      `<div class="frame__body"><ul class="tree" role="tree" aria-label="${esc(C().treeLabel)}"></ul></div></section>` +
      `<section class="frame frame--pv" aria-labelledby="fr-pv"><header class="frame__head">` +
      `<button type="button" class="cut pv-back" aria-label="${esc(C().backLabel)}"><span aria-hidden="true">← </span>${esc(C().back)}</button>` +
      `<h2 class="cut frame__name" id="fr-pv">${esc(C().preview)}</h2><span class="frame__fill"></span></header>` +
      `<div class="frame__body pv"></div></section>`
    const keys = h('p', 'keys')
    keys.setAttribute('aria-hidden', 'true') // the same keys are in every control's own behaviour; this is a reminder for eyes
    const hint = (list, cls) => `<span class="keys__set ${cls}">` + list.map(([k, v]) => `<span class="keys__k">${esc(k)}</span> ${esc(v)}`).join('<span class="keys__sep"> · </span>') + '</span>'
    keys.innerHTML = hint([...C().keys, ...C().keysMore], 'keys__set--keys') + hint(C().keysTouch, 'keys__set--touch')
    root.append(tui, keys)
    el = { root, tui, keys, tree: tui.querySelector('.tree'), pv: tui.querySelector('.pv'), n: tui.querySelector('.frame__n'), back: tui.querySelector('.pv-back'), treeBody: tui.querySelector('.frame--tree .frame__body') }
    paint()
    bind()
    const first = secs[0].entries[0]
    select(first ? `${secs[0].id}/${first.slug}` : secs[0].id)
  }

  // ── markup ───────────────────────────────────────────────────────────────────────────────
  function paint() {
    el.tree.innerHTML = M().treeHtml(secs)
    rows = new Map(secs.flatMap((s) => s.entries.map((e) => [`${s.id}/${e.slug}`, M().rowHtml(e, s.id)])))
    count()
  }
  const total = () => secs.reduce((n, s) => n + s.count, 0)
  const count = () => { el.n.textContent = String(total()).padStart(2, '0'); el.n.setAttribute('aria-label', C().entries(total())) }
  const rowEl = (id) => el.tree.querySelector(`[data-row="${CSS.escape(id)}"]`)
  menu.rowEl = rowEl
  menu.total = total

  // ── selection ────────────────────────────────────────────────────────────────────────────
  function select(id, { focus = false, show = true } = {}) {
    const node = rowEl(id)
    if (!node) return
    const was = sel && rowEl(sel)
    if (was && was !== node) { was.classList.remove('is-sel'); was.removeAttribute('aria-selected'); was.tabIndex = -1 }
    sel = id
    el.tui.dataset.sec = parent(id)
    node.classList.add('is-sel')
    node.setAttribute('aria-selected', 'true')
    node.tabIndex = 0
    if (show) el.pv.innerHTML = M().previewHtml(secs, id)
    el.pv.scrollTop = 0
    // keep the row in sight inside its column (only the column scrolls, never the page)
    const b = el.treeBody, own = node.querySelector(':scope > .row') || node
    const top = own.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop
    if (top < b.scrollTop + 4) b.scrollTop = top - 8
    else if (top + own.offsetHeight > b.scrollTop + b.clientHeight - 4) b.scrollTop = top + own.offsetHeight - b.clientHeight + 8
    if (focus) node.focus({ preventScroll: true })
    if (menu.onSelect) menu.onSelect(id)
  }
  menu.select = (id, o) => select(id, o)
  menu.selected = () => sel
  const order = () => M().order(secs)
  const move = (d) => { const o = order(), i = o.indexOf(sel); select(o[Math.min(o.length - 1, Math.max(0, i + d))], { focus: true }) }
  const parent = (id) => String(id).split('/')[0]
  const isSection = (id) => !String(id).includes('/')

  // a section goes in; an entry opens
  menu.open = (id, from) => {
    if (isSection(id)) {
      const s = secs.find((x) => x.id === id), e = s && s.entries[0]
      if (e) select(`${id}/${e.slug}`, { focus: !phone() })
      if (phone()) detail(false)
      return
    }
    const [sid, slug] = id.split('/'), s = secs.find((x) => x.id === sid), e = s && s.entries.find((x) => x.slug === slug)
    if (!e) return
    if (e.read) return NIGHT.reader.go(slug, sid === 'experiments' ? 'experiments' : 'writing', from || rowEl(id))
    if (e.href) window.open(e.href, '_blank', 'noopener')
  }
  menu.go = (sid) => {
    if (!secs.some((s) => s.id === sid)) return
    if (phone()) detail(false)
    select(sid, { focus: true })
  }

  // ── phone: list → detail ─────────────────────────────────────────────────────────────────
  function detail(on, focus = true) {
    el.tui.dataset.view = on ? 'detail' : 'list'
    if (!focus) return
    if (on) { el.back.focus({ preventScroll: true }) } else { const n = rowEl(sel); if (n) n.focus({ preventScroll: true }) }
  }
  menu.back = () => { if (el.tui.dataset.view === 'detail') { detail(false); return true } return false }
  menu.view = () => el.tui.dataset.view
  menu.detail = (on) => detail(on, false)

  // ── input ────────────────────────────────────────────────────────────────────────────────
  function bind() {
    el.tree.addEventListener('click', (e) => {
      const node = e.target.closest('[data-row]')
      if (!node) return
      const id = node.dataset.row
      if (phone()) { select(id); detail(true); return }
      if (id === sel && e.detail < 2) return menu.open(id, node)
      select(id, { focus: true })
    })
    el.tree.addEventListener('dblclick', (e) => { const node = e.target.closest('[data-row]'); if (node && !phone()) menu.open(node.dataset.row, node) })
    el.tree.addEventListener('keydown', (e) => {
      const k = e.key
      if (k === 'ArrowDown' || k === 'j') move(1)
      else if (k === 'ArrowUp' || k === 'k') move(-1)
      else if (k === 'Home') select(order()[0], { focus: true })
      else if (k === 'End') { const o = order(); select(o[o.length - 1], { focus: true }) }
      else if (k === 'ArrowRight' || k === 'l') { if (isSection(sel)) menu.open(sel) }
      else if (k === 'ArrowLeft' || k === 'h') { if (!isSection(sel)) select(parent(sel), { focus: true }) }
      else if (k === 'Escape') { if (!isSection(sel)) select(parent(sel), { focus: true }); else return }
      else if (k === 'Enter' || k === ' ') { if (phone()) { detail(true) } else menu.open(sel, rowEl(sel)) }
      else return
      e.preventDefault()
      e.stopPropagation()
    })
    el.pv.addEventListener('click', (e) => {
      const b = e.target.closest('[data-read], [data-go], [data-sel]')
      if (!b) return
      if (b.dataset.read) return NIGHT.reader.go(b.dataset.read, b.dataset.in, b)
      if (b.dataset.go) return menu.open(b.dataset.go)
      if (b.dataset.sel) { select(b.dataset.sel, { focus: !phone() }); if (phone()) el.back.focus({ preventScroll: true }) }
    })
    el.back.addEventListener('click', () => detail(false))
    el.tui.querySelector('.frame--pv').addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el.tui.dataset.view === 'detail') { e.preventDefault(); e.stopPropagation(); detail(false) }
    })
    // a column scrolls inside itself; the wheel never reaches anything that could pan
    for (const b of el.tui.querySelectorAll('.frame__body')) b.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })
  }

  // ── where a closing post goes back to ───────────────────────────────────────────────────
  menu.target = (section, slug) => {
    const id = `${section}/${slug}`
    if (!rowEl(id)) return null
    if (sel !== id) select(id)
    if (phone()) { detail(true, false); return el.pv.querySelector(`[data-read="${CSS.escape(slug)}"]`) }
    return rowEl(id)
  }
  // the title a post's own title flies from and back to
  menu.titleOf = (node) => node && (node.querySelector('.row__ttl') || (node.closest('.pv') && node.closest('.pv').querySelector('[data-pv-title]')) || node)

  // ── the intro's last beat: frames come up, text decodes in. Pure of p. ──────────────────
  let decoders = null
  menu.reveal = (p, scramble) => {
    el.tui.style.opacity = el.keys.style.opacity = (scramble ? Math.min(1, p / 0.25) : p).toFixed(3)
    if (!scramble || p >= 1) {
      if (decoders) { for (const d of decoders) d.node.nodeValue = d.text; decoders = null }
      return
    }
    if (!decoders) {
      decoders = []
      const w = document.createTreeWalker(el.root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/\S/.test(n.nodeValue) && !n.parentElement.closest('.motd, .fx, .fx-meta') ? 1 : 2) })
      const nodes = []
      while (w.nextNode()) nodes.push(w.currentNode)
      nodes.forEach((node, i) => {
        const a = 0.1 + 0.5 * (i / Math.max(1, nodes.length - 1))
        decoders.push({ node, text: node.nodeValue, a, b: a + 0.4, seed: 500 + i })
      })
    }
    for (const d of decoders) {
      const k = p <= d.a ? 0 : p >= d.b ? 1 : (p - d.a) / (d.b - d.a)
      const v = NIGHT.decode(d.text, k, d.seed)
      if (d.node.nodeValue !== v) d.node.nodeValue = v
    }
  }

  // ── the 20th piece: re-render from LAB.pieces; an unchanged row keeps its DOM node ──────
  menu.render = () => {
    const out = { kept: 0, added: [], removed: [], changed: [] }
    const next = M().build(LAB.pieces)
    const old = new Map([...el.tree.querySelectorAll('li.ti')].map((n) => [n.dataset.row, n]))
    const t = document.createElement('template')
    t.innerHTML = M().treeHtml(next)
    const fresh = new Map()
    for (const s of next) for (const e of s.entries) fresh.set(`${s.id}/${e.slug}`, M().rowHtml(e, s.id))
    for (const n of [...t.content.querySelectorAll('li.ti')]) {
      const id = n.dataset.row, o = old.get(id)
      if (o && rows.get(id) === fresh.get(id)) { n.replaceWith(o); out.kept++ } else if (!o) out.added.push(id)
      old.delete(id)
    }
    out.removed = [...old.keys()]
    out.changed = next.filter((s, i) => !secs[i] || s.count !== secs[i].count).map((s) => s.id)
    const top = el.treeBody.scrollTop
    el.tree.replaceChildren(t.content)
    el.treeBody.scrollTop = top
    secs = next
    rows = fresh
    count()
    const keep = sel && rowEl(sel) ? sel : order()[0]
    sel = null
    select(keep)
    return out
  }
  menu.sections = () => secs
})()
