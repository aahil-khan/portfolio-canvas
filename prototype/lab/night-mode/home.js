/*
 * prototype/lab/night-mode/home.js: the Lab's home, in three layouts to compare by eye.
 *
 *   index (default)  a thin text index on the left; everything to its right reads the highlighted
 *                    entry. No dock. Phone: the list, then one entry's detail.
 *   dock             the dock is the only navigation (← canvas · work · experiments · writing); the
 *                    screen is that section as a full-width list, an entry expands in place.
 *   page             one editorial page that scrolls: the welcome and the toy, then work,
 *                    experiments and writing down the page, with a tiny sticky jump line. No dock.
 * ?layout=index|dock|page picks one; the switch in the corner flips them live (night.js).
 *
 * The same in all three: one navigation system and no boxed panels (a frame is allowed only on
 * the reader's header and on figures); the welcome sits beside the toy, top right; every entry
 * comes from model.js, so a new piece is one new row in whichever layout is showing.
 *
 *   NIGHT.home.mount(root, layout)       builds into root (the Lab screen's main area)
 *   .layout(), .setLayout(id)            the toy is moved into the new layout's slot, never rebuilt
 *   .go(sectionId)                       1 2 3 and the dock's tiles
 *   .back() → bool                       Esc: what "back" means in this layout, if anything
 *   .first()                             the element focus lands on when the Lab opens by keyboard
 *   .render() → { kept, added, removed, changed, section }   re-render from LAB.pieces (20th piece)
 *   .select(rowId), .expand(rowId), .detail(on)   the URL switches (&sel=, &view=detail)
 *   .section()                           the dock's current section
 * NIGHT.menu.target / .titleOf are what reader.js asks of whichever layout is showing.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const M = () => NIGHT.model
  const C = () => NIGHT.copy
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const phone = () => innerWidth < 700
  const pad = (n) => String(n).padStart(2, '0')
  const LAYOUTS = ['index', 'dock', 'page']

  const H = (NIGHT.home = { LAYOUTS })
  const st = { layout: 'index', secs: [], sel: null, open: null, sec: 'work', view: 'list', rows: new Map() }
  let root = null, el = {}

  // ── shared pieces ────────────────────────────────────────────────────────────────────────
  const welcome = () => { const w = C().welcome; return phone() ? [...w.slice(0, -1), st.layout === 'dock' ? C().welcomeTouchDock : C().welcomeTouch] : w }
  const hello = (cls = '') => `<div class="hello ${cls}"><p class="hello__1">${esc(welcome()[0])}</p>` +
    welcome().slice(1).map((l) => `<p class="hello__l">${esc(l)}</p>`).join('') +
    `<p class="keys" aria-hidden="true">${C().keys.map(([k, v]) => `<span class="keys__k">${esc(k)}</span> ${esc(v)}`).join('<span class="keys__sep"> · </span>')}</p></div>`
  const slot = (cls = '') => `<div class="toy-slot ${cls}"></div>`
  const secHead = (s, tag = 'p', idp = 'h') => `<${tag} class="sh" id="${idp}-${s.id}" data-sec="${s.id}"><span class="sh__k" aria-hidden="true">${esc(s.key)}</span>` +
    `<span class="sh__t">${esc(s.id)}</span><span class="sh__n" aria-label="${esc(C().entries(s.count))}">${pad(s.count)}</span></${tag}>`
  const rowsHtml = (s, layout) => s.entries.map((e) => M().rowHtml(e, s.id, layout)).join('')
  const remember = () => { st.rows = new Map(st.secs.flatMap((s) => s.entries.map((e) => [`${s.id}/${e.slug}`, M().rowHtml(e, s.id, st.layout)]))) }
  const rowEl = (id) => root && root.querySelector(`[data-row="${CSS.escape(id)}"]`)
  const placeToy = () => { const s = root.querySelector('.toy-slot'); if (s && NIGHT.toy.node && NIGHT.toy.node.parentNode !== s) s.appendChild(NIGHT.toy.node); NIGHT.toy.wake() }
  const secOf = (id) => String(id).split('/')[0]
  const entryOf = (id) => { const [sid, slug] = String(id).split('/'), s = st.secs.find((x) => x.id === sid); return s && s.entries.find((e) => e.slug === slug) }
  // an entry opens in the reader when it has a body; an essay with none would link out
  function openEntry(id, from) {
    const e = entryOf(id)
    if (!e) return
    if (e.read) return NIGHT.reader.go(e.slug, secOf(id) === 'experiments' ? 'experiments' : 'writing', from)
    if (e.href) window.open(e.href, '_blank', 'noopener')
  }

  // ── the three layouts: markup ────────────────────────────────────────────────────────────
  const VIEW = {
    index: () => `<div class="L L--index" data-view="${st.view}" data-has-sel="false">` +
      `<nav class="ixn" aria-label="${esc(C().treeLabel)}"><ul class="ixl" role="listbox" aria-label="${esc(C().treeLabel)}">` +
      st.secs.map((s) => `<li class="ixs" role="presentation" data-sec="${s.id}">${secHead(s, 'p', 'ixh')}` +
        `<ul class="ixs__items" role="group" aria-labelledby="ixh-${s.id}">${rowsHtml(s, 'index')}</ul></li>`).join('') +
      `</ul></nav>` +
      hello('hello--index') +
      `<section class="ixr" aria-label="${esc(C().preview)}"><button type="button" class="act ixr__back" aria-label="${esc(C().backLabel)}">← ${esc(C().back)}</button><div class="pv"></div></section>` +
      slot() + `</div>`,
    dock: () => {
      const s = st.secs.find((x) => x.id === st.sec) || st.secs[0], meta = M().sectionsOf([s])[0]
      return `<div class="L L--dock"><header class="top">${hello()}${slot()}</header>` +
        `<section class="dks" data-sec="${s.id}" aria-labelledby="dkh-${s.id}">` +
        `<h2 class="dks__h" id="dkh-${s.id}"><span class="dks__t">${esc(s.id)}/</span><span class="dks__n">${esc(meta.unit)}</span></h2>` +
        `<p class="dks__blurb">${esc(meta.blurb)}</p><ul class="dkl">${rowsHtml(s, 'dock')}</ul></section></div>`
    },
    page: () => `<div class="L L--page"><nav class="jump" aria-label="${esc(C().jumpLabel)}">` +
      st.secs.map((s, i) => `${i ? '<span class="jump__sep" aria-hidden="true"> · </span>' : ''}<a class="jump__a" href="#pg-${s.id}" data-jump="${s.id}" data-sec="${s.id}"><span class="jump__l">${esc(s.id)}</span><span class="jump__s" aria-hidden="true">${esc(C().dockShort[s.id])}</span></a>`).join('') + `</nav>` +
      `<header class="top top--page">${hello('hello--page')}${slot()}</header>` +
      M().sectionsOf(st.secs).map((m) => `<section class="pgs" id="pg-${m.id}" data-sec="${m.id}" aria-labelledby="pgh-${m.id}">` +
        `<h2 class="pgs__h" id="pgh-${m.id}"><span class="pgs__k" aria-hidden="true">${esc(m.key)}</span><span class="pgs__t">${esc(m.id)}</span><span class="pgs__n">${esc(m.unit)}</span></h2>` +
        `<p class="pgs__blurb">${esc(m.blurb)}</p><ol class="pgl">${rowsHtml(st.secs.find((x) => x.id === m.id), 'page')}</ol></section>`).join('') + `</div>`,
  }

  function paint() {
    root.innerHTML = VIEW[st.layout]()
    el = { L: root.firstElementChild }
    remember()
    placeToy()
    if (st.layout === 'index') {
      el.list = root.querySelector('.ixl')
      el.pv = root.querySelector('.ixr .pv')
      el.read = root.querySelector('.ixr')
      const keep = st.sel && rowEl(st.sel) ? st.sel : null
      st.sel = null
      roving(keep || M().order(st.secs)[0])
      if (keep) select(keep)
    }
    if (st.layout === 'dock' && st.open) { const o = st.open; st.open = null; if (rowEl(o)) expand(o) }
    if (st.layout === 'page') spy()
    count()
  }
  const count = () => { if (H.onCount) H.onCount(st.secs.reduce((n, s) => n + s.count, 0)) }

  // ── index: highlight, preview, open ─────────────────────────────────────────────────────
  // the list is one Tab stop with a roving tabindex; nothing is highlighted until you point at a
  // row or arrow into the list, and then the reading area shows it. Esc goes back to the welcome.
  function roving(id) {
    for (const n of el.list.querySelectorAll('[tabindex="0"]')) n.tabIndex = -1
    const n = rowEl(id)
    if (n) n.tabIndex = 0
  }
  function select(id, { focus = false } = {}) {
    if (st.layout !== 'index') return
    const node = rowEl(id)
    if (!node) return
    const was = st.sel && rowEl(st.sel)
    if (was && was !== node) { was.classList.remove('is-sel'); was.setAttribute('aria-selected', 'false') }
    st.sel = id
    node.classList.add('is-sel')
    node.setAttribute('aria-selected', 'true')
    roving(id)
    el.L.dataset.hasSel = 'true'
    el.L.dataset.sec = secOf(id)
    el.pv.innerHTML = M().previewHtml(st.secs, id)
    el.read.scrollTop = 0
    if (focus) node.focus({ preventScroll: false })
    else keepInSight(node)
  }
  const keepInSight = (node) => {
    const box = node.closest('.ixn'), r = node.getBoundingClientRect(), b = box.getBoundingClientRect()
    if (r.top < b.top + 4) box.scrollTop -= b.top + 4 - r.top
    else if (r.bottom > b.bottom - 4) box.scrollTop += r.bottom - b.bottom + 4
  }
  function home() {
    if (st.layout !== 'index' || !st.sel) return false
    const n = rowEl(st.sel)
    if (n) { n.classList.remove('is-sel'); n.setAttribute('aria-selected', 'false') }
    st.sel = null
    el.L.dataset.hasSel = 'false'
    delete el.L.dataset.sec
    el.pv.innerHTML = ''
    return true
  }
  function detail(on, focus = true) {
    st.view = on ? 'detail' : 'list'
    el.L.dataset.view = st.view
    if (on) placeToy()
    NIGHT.toy.wake()
    if (!focus) return
    if (on) root.querySelector('.ixr__back').focus({ preventScroll: true })
    else { const n = rowEl(st.sel); if (n) n.focus({ preventScroll: true }) }
  }
  const move = (d) => {
    const o = M().order(st.secs), i = st.sel ? o.indexOf(st.sel) : d > 0 ? -1 : o.length
    select(o[Math.min(o.length - 1, Math.max(0, i + d))], { focus: true })
  }

  // ── dock: one section at a time; an entry expands in place ──────────────────────────────
  function expand(id, { focus = false } = {}) {
    if (st.layout !== 'dock') return
    if (st.open && st.open !== id) collapse()
    const li = rowEl(id)
    if (!li) return
    const btn = li.querySelector('.dl__row'), box = li.querySelector('.dl__x')
    box.innerHTML = M().previewHtml(st.secs, id, { bare: true })
    box.hidden = false
    btn.setAttribute('aria-expanded', 'true')
    li.classList.add('is-open')
    st.open = id
    if (focus) btn.focus({ preventScroll: true })
    // bring the opened entry into view inside the screen's own scroller
    const sc = root, r = li.getBoundingClientRect(), b = sc.getBoundingClientRect()
    if (r.bottom > b.bottom - 90) sc.scrollTop += Math.min(r.top - b.top - 80, r.bottom - b.bottom + 110)
  }
  function collapse() {
    const li = st.open && rowEl(st.open)
    st.open = null
    if (!li) return false
    li.classList.remove('is-open')
    li.querySelector('.dl__row').setAttribute('aria-expanded', 'false')
    const box = li.querySelector('.dl__x')
    box.hidden = true
    box.innerHTML = ''
    return true
  }

  // ── page: the jump line marks the section you are reading ───────────────────────────────
  let spyObs = null
  function spy() {
    if (spyObs) spyObs.disconnect()
    if (!('IntersectionObserver' in window)) return
    const seen = new Map()
    spyObs = new IntersectionObserver((es) => {
      for (const e of es) seen.set(e.target.dataset.sec, e.isIntersecting)
      const cur = st.secs.map((s) => s.id).find((id) => seen.get(id))
      for (const a of root.querySelectorAll('.jump__a')) a.toggleAttribute('aria-current', a.dataset.jump === cur)
    }, { root, rootMargin: '-30% 0px -60% 0px' })
    for (const s of root.querySelectorAll('.pgs')) spyObs.observe(s)
  }
  function jump(sid) {
    const s = root.querySelector(`#pg-${sid}`)
    if (!s) return
    root.scrollTo({ top: s.offsetTop - (phone() ? 52 : 64), behavior: LAB.sky.reduced ? 'auto' : 'smooth' })
    const h = s.querySelector('.pgs__h')
    h.tabIndex = -1
    h.focus({ preventScroll: true })
  }

  // ── input ────────────────────────────────────────────────────────────────────────────────
  function bind() {
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-read]')
      if (act) return NIGHT.reader.go(act.dataset.read, act.dataset.in, act)
      if (st.layout === 'index') {
        if (e.target.closest('.ixr__back')) return detail(false)
        const row = e.target.closest('.ix[data-row]')
        if (!row) return
        const id = row.dataset.row
        if (phone()) { select(id); detail(true); return }
        select(id, { focus: true })
        openEntry(id, row)
      } else if (st.layout === 'dock') {
        const btn = e.target.closest('.dl__row')
        if (!btn) return
        const id = btn.parentElement.dataset.row
        if (st.open === id) collapse(); else expand(id)
      } else if (st.layout === 'page') {
        const a = e.target.closest('[data-jump]')
        if (a) { e.preventDefault(); jump(a.dataset.jump) }
      }
    })
    // index: pointing at a row is enough to read it (no click)
    root.addEventListener('pointerover', (e) => {
      if (st.layout !== 'index' || e.pointerType !== 'mouse' || phone()) return
      const row = e.target.closest('.ix[data-row]')
      if (row && row.dataset.row !== st.sel) select(row.dataset.row)
    })
    root.addEventListener('keydown', (e) => {
      const k = e.key
      if (st.layout === 'index' && e.target.closest('.ixl')) {
        if (k === 'ArrowDown' || k === 'j') move(1)
        else if (k === 'ArrowUp' || k === 'k') move(-1)
        else if (k === 'Home') select(M().order(st.secs)[0], { focus: true })
        else if (k === 'End') { const o = M().order(st.secs); select(o[o.length - 1], { focus: true }) }
        else if (k === 'Enter' || k === ' ') { if (!st.sel) return; if (phone()) detail(true); else openEntry(st.sel, rowEl(st.sel)) }
        else return
        e.preventDefault()
        e.stopPropagation()
      } else if (st.layout === 'dock' && e.target.closest('.dl__row')) {
        const btns = [...root.querySelectorAll('.dl__row')], i = btns.indexOf(e.target.closest('.dl__row'))
        if (k === 'ArrowDown' || k === 'j') btns[Math.min(btns.length - 1, i + 1)].focus()
        else if (k === 'ArrowUp' || k === 'k') btns[Math.max(0, i - 1)].focus()
        else if (k === 'Home') btns[0].focus()
        else if (k === 'End') btns[btns.length - 1].focus()
        else return
        e.preventDefault()
        e.stopPropagation()
      }
    })
    // the index's list takes focus: if nothing is highlighted yet, the first row is
    root.addEventListener('focusin', (e) => {
      if (st.layout !== 'index' || st.quiet) return
      const row = e.target.closest && e.target.closest('.ix[data-row]')
      if (row && row.dataset.row !== st.sel) select(row.dataset.row)
    })
  }

  // ── the API ──────────────────────────────────────────────────────────────────────────────
  H.mount = (r, layout) => {
    root = r
    st.secs = M().build(LAB.pieces)
    st.layout = LAYOUTS.includes(layout) ? layout : 'index'
    bind()
    paint()
  }
  H.layout = () => st.layout
  H.setLayout = (id) => {
    if (!LAYOUTS.includes(id) || id === st.layout) return
    st.layout = id
    st.view = 'list'
    root.scrollTop = 0
    paint()
  }
  H.go = (sid) => {
    if (!st.secs.some((s) => s.id === sid)) return
    if (st.layout === 'index') {
      if (phone()) detail(false, false)
      const s = st.secs.find((x) => x.id === sid)
      if (s.entries[0]) select(`${sid}/${s.entries[0].slug}`, { focus: true })
    } else if (st.layout === 'dock') {
      if (st.sec !== sid) { st.sec = sid; st.open = null; paint() }
      if (H.onSection) H.onSection(sid)
      const b = root.querySelector('.dl__row')
      if (b) b.focus({ preventScroll: true })
      root.scrollTop = 0
    } else jump(sid)
  }
  H.section = () => st.sec
  H.back = () => {
    if (st.layout === 'index') {
      if (phone() && st.view === 'detail') { detail(false); return true }
      const had = st.sel, row = had && rowEl(had)
      // focus stays on the row, quietly: focusing it must not highlight it again
      if (home()) { if (row) { st.quiet = true; row.focus({ preventScroll: true }); st.quiet = false } return true }
      return false
    }
    if (st.layout === 'dock') { const o = st.open; if (collapse()) { const b = rowEl(o); if (b) b.querySelector('.dl__row').focus({ preventScroll: true }); return true } }
    return false
  }
  H.first = () => (st.layout === 'index' ? rowEl(M().order(st.secs)[0]) : st.layout === 'dock' ? root.querySelector('.dl__row') : root.querySelector('.jump__a'))
  H.select = (id) => { if (st.layout === 'index') select(id); else if (st.layout === 'dock') { const s = secOf(id); if (st.sec !== s) H.go(s); expand(id) } else { const n = rowEl(id); if (n) root.scrollTop = n.offsetTop - 80 } }
  H.expand = (id) => expand(id)
  H.detail = (on) => { if (st.layout === 'index') detail(on, false) }
  H.root = () => root

  // ── the 20th piece: re-render from LAB.pieces; an unchanged row keeps its DOM node ──────
  H.render = () => {
    const out = { kept: 0, added: [], removed: [], changed: [], section: null }
    const next = M().build(LAB.pieces)
    out.changed = next.filter((s, i) => !st.secs[i] || s.count !== st.secs[i].count).map((s) => s.id)
    const fresh = new Map(next.flatMap((s) => s.entries.map((e) => [`${s.id}/${e.slug}`, M().rowHtml(e, s.id, st.layout)])))
    const added = [...fresh.keys()].filter((id) => !st.rows.has(id))
    out.section = added.length ? secOf(added[0]) : null
    // the dock shows one section: go to the one the new piece is in, as a visitor would
    if (st.layout === 'dock' && out.section && out.section !== st.sec) { st.sec = out.section; paint() }
    const old = new Map([...root.querySelectorAll('[data-row]')].map((n) => [n.dataset.row, n]))
    out.before = old.size
    const scroll = root.scrollTop, sel = st.sel
    st.secs = next
    const t = document.createElement('template')
    t.innerHTML = VIEW[st.layout]()
    for (const n of [...t.content.querySelectorAll('[data-row]')]) {
      const id = n.dataset.row, o = old.get(id)
      if (o && st.rows.get(id) === fresh.get(id)) { n.replaceWith(o); out.kept++ } else if (!o) out.added.push(id)
      old.delete(id)
    }
    out.removed = [...old.keys()]
    // keep the toy where it is (moved, not rebuilt) and swap everything else
    const toy = NIGHT.toy.node
    root.replaceChildren(t.content)
    el = { L: root.firstElementChild }
    const s = root.querySelector('.toy-slot')
    if (s && toy) s.appendChild(toy)
    st.rows = fresh
    if (st.layout === 'index') { el.list = root.querySelector('.ixl'); el.pv = root.querySelector('.ixr .pv'); el.read = root.querySelector('.ixr'); st.sel = null; roving(M().order(st.secs)[0]); if (sel && rowEl(sel)) select(sel) }
    if (st.layout === 'page') spy()
    root.scrollTop = scroll
    count()
    return out
  }
  H.sections = () => st.secs

  // ── what reader.js asks: where a closing post goes back to, and the title it flies from ──
  NIGHT.menu = {
    target: (section, slug) => {
      const ids = [`${section}/${slug}`, `work/${slug}`].filter((id) => rowEl(id))
      if (!ids.length) return null
      const id = ids[0]
      if (st.layout === 'index') {
        if (st.sel !== id) select(id)
        if (phone()) { detail(true, false); return el.pv.querySelector(`[data-read="${CSS.escape(slug)}"]`) || rowEl(id) }
        return rowEl(id)
      }
      if (st.layout === 'dock') { if (st.open !== id) expand(id); const li = rowEl(id); return li.querySelector('.dl__row') }
      return rowEl(id).querySelector(`[data-read="${CSS.escape(slug)}"]`) || rowEl(id)
    },
    titleOf: (node) => {
      if (!node) return null
      const row = node.closest('[data-row]')
      return (row && row.querySelector('.ix__t, .dl__t, .pg__tt')) || (node.closest('.pv') && node.closest('.pv').querySelector('[data-pv-title]')) || node
    },
  }
})()
