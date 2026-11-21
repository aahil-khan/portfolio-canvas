/*
 * prototype/lab/notebook/shell.js: the notebook's frame. The bar, the tree (a drawer on phone),
 * the reading column, the margin, the graphs, the keys and the router. The note itself is
 * reader.js; the switcher is switcher.js; the way in from the canvas is trip.js.
 *
 *   NB.shell.mount()            builds the frame (once, before the trip can run)
 *   NB.shell.go(route, q)       navigate: '#/<route>?<q>'
 *   NB.shell.show()             render whatever the hash says (the router)
 *   NB.shell.el                 { root, head, bar, strip, side, main, col, margin, … }
 *   NB.shell.setPalette(id), .toggleSide(), .openDrawer(), .closeDrawer(), .layer()
 *   NB.vault                    the vault, built once from vault.js + study.js + essay.js
 *
 * ROUTES (hash): '' or '#/' start-here · '#/graph' the full graph · '#/<path>' a note ·
 * '#/T02', '#/PW1', '#/W1', an alias or a slug path → replaced by the full path ·
 * '?w=W1' tour context · '?a=p2' a heading or table row · '&pop=switcher|drawer|help' a layer on
 * arrival. '#desk' starts on the canvas (trip.js). Never ▶ on arrival: nothing autoplays.
 *
 * PAN AND ZOOM (the full graph) never pass through anything but one ref: the transform is written
 * to one <g> from rAF. Hover never changes content, only a highlight.
 */
;(() => {
  const NB = (window.NB = window.NB || {})
  const C = NB.copy, MD = NB.md
  const q0 = new URLSearchParams(location.search)
  const esc = MD.escape
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const phone = () => innerWidth < 900
  const wide = () => innerWidth >= 1200
  const PALETTES = Object.keys(C.palettes)
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private window */ } },
  }

  // ── the vault ──────────────────────────────────────────────────────────────────────────
  function buildVault(extraFiles) {
    return NB.model.build({
      files: { ...NB.vaultFiles, ...(extraFiles || {}) }, study: NB.study, essays: (window.NIGHT && NIGHT.imports) || {}, copy: C,
      autolink: q0.get('autolink') !== '0', hidden: q0.get('hidden') === '1',
    })
  }
  NB.vault = buildVault()
  const V = () => NB.vault

  const S = (NB.shell = { el: {}, state: { route: null, view: 'note', note: null, q: new URLSearchParams() } })
  const el = S.el

  // ── the graph layout, warm from the seed ──────────────────────────────────────────────
  let layoutCache = null
  function graphLayout() {
    if (layoutCache) return layoutCache
    const v = V()
    const nodes = v.notes.map((n) => ({ key: n.route, section: n.section, type: n.type }))
    const edges = v.edges.map((e) => ({ a: e.a.route, b: e.b.route, kind: e.kind }))
    layoutCache = NB.graph.layout(nodes, edges, { seed: NB.graphSeed })
    return layoutCache
  }
  S.relayout = () => { layoutCache = null; return graphLayout() }

  // ── glyphs and labels ─────────────────────────────────────────────────────────────────
  const glyph = (n) => { const g = C.status[n.status] || C.status.planned; return `<span class="nb-row__glyph" aria-label="${esc(g[1])}" title="${esc(g[1])}">${esc(g[0])}</span>` }
  const numOf = (n) => (n.id || (n.isHub ? '00' : /^\d\d$/.test(n.num) ? n.num : ''))
  S.glyph = glyph
  S.visited = new Set(store.get('nb-visited') || [])

  // ── build the frame ───────────────────────────────────────────────────────────────────
  S.mount = () => {
    const root = h('div', 'nb')
    root.id = 'nb'
    root.setAttribute('aria-label', C.labLabel)
    root.innerHTML = `
      <div class="nb-panes-bg" aria-hidden="true"></div>
      <header class="nb-head">
        <nav class="nb-bar" aria-label="${esc(C.labLabel)}">
          <button type="button" class="nb-bar__cell nb-bar__menu" aria-label="${esc(C.menuLabel)}" aria-expanded="false" aria-controls="nbSide">${esc(C.menu)}</button>
          <a class="nb-bar__cell nb-bar__canvas" href="#desk" data-act="canvas" aria-label="${esc(C.canvasLabel)}">${esc(C.canvas)}</a>
          <div class="nb-bar__cell nb-bar__path" aria-label="${esc(C.pathLabel)}"><ol></ol></div>
          <button type="button" class="nb-bar__cell nb-bar__btn" data-act="search" aria-label="${esc(C.searchLabel)}">${esc(C.search)}<span class="nb-bar__word"> ${esc(C.searchWord)}</span> <span class="nb-bar__k">${esc(C.searchKey)}</span></button>
          <button type="button" class="nb-bar__cell nb-bar__btn" data-act="graph" aria-label="${esc(C.graphLabel)}" aria-pressed="false">${esc(C.graph)}<span class="nb-bar__word"> ${esc(C.graphWord)}</span></button>
          <button type="button" class="nb-bar__cell nb-bar__btn" data-act="listen" aria-label="${esc(C.listenLabel)}">${esc(C.listen)}<span class="nb-bar__word"> ${esc(C.listenWord)}</span></button>
          <div class="nb-bar__cell nb-bar__flags">
            <button type="button" data-act="snd"></button>
            <button type="button" data-act="pal"></button>
            <button type="button" data-act="help" aria-label="${esc(C.helpLabel)}">${esc(C.help)}</button>
          </div>
        </nav>
        <div class="nb-strip" role="region" aria-label="${esc(C.strip.label)}" hidden></div>
      </header>
      <aside class="nb-side" id="nbSide" aria-label="${esc(C.treeLabel)}">
        <a class="nb-side__canvas" href="#desk" data-act="canvas">${esc(C.canvas)}</a>
        <ul class="nb-tree" role="tree" aria-label="${esc(C.treeLabel)}"></ul>
        <div class="nb-side__foot"><button type="button" data-act="snd"></button><button type="button" data-act="pal"></button><button type="button" data-act="help">${esc(C.help)} ${esc(C.helpTitle)}</button></div>
      </aside>
      <main class="nb-main" id="nbMain" tabindex="-1"><div class="nb-col"></div></main>
      <aside class="nb-margin" aria-label="${esc(C.linksHead)}"></aside>
      <div class="nb-scrim" hidden></div>`
    document.body.appendChild(root)
    Object.assign(el, {
      root, head: root.querySelector('.nb-head'), bar: root.querySelector('.nb-bar'), strip: root.querySelector('.nb-strip'), path: root.querySelector('.nb-bar__path ol'),
      menu: root.querySelector('.nb-bar__menu'), canvas: root.querySelector('.nb-bar__canvas'), side: root.querySelector('.nb-side'), tree: root.querySelector('.nb-tree'),
      main: root.querySelector('.nb-main'), col: root.querySelector('.nb-col'), margin: root.querySelector('.nb-margin'), scrim: root.querySelector('.nb-scrim'),
      graphBtn: root.querySelector('[data-act="graph"]'), listenBtn: root.querySelector('.nb-bar [data-act="listen"]'),
    })
    root.addEventListener('click', onClick)
    el.scrim.addEventListener('click', () => S.closeDrawer())
    el.tree.addEventListener('keydown', treeKeys)
    addEventListener('keydown', onKey, true)
    addEventListener('hashchange', () => S.show())
    let rt = 0
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!phone()) S.closeDrawer(true); S.renderAside() }, 120) })
    S.setPalette(q0.get('palette') && PALETTES.includes(q0.get('palette')) ? q0.get('palette') : 'white')
    if (q0.get('voice')) NIGHT.voice.use(q0.get('voice'))
    flags()
    if (NIGHT.sound && NIGHT.sound.on) NIGHT.sound.on(flags)
    renderTree()
  }

  function flags() {
    const muted = !NIGHT.sound || NIGHT.sound.muted
    for (const b of el.root.querySelectorAll('[data-act="snd"]')) { b.textContent = `${C.snd}:${muted ? C.off : C.on}`; b.setAttribute('aria-label', C.sndLabel(!muted)); b.setAttribute('aria-pressed', String(!muted)) }
    const p = document.documentElement.dataset.palette || 'white'
    for (const b of el.root.querySelectorAll('[data-act="pal"]')) { b.textContent = `${C.pal}:${C.palShort[p]}`; b.setAttribute('aria-label', C.palLabel(C.palettes[p])) }
  }
  S.flags = flags
  S.setPalette = (id) => {
    if (!PALETTES.includes(id)) return false
    document.documentElement.dataset.palette = id
    if (NB.trip && NB.trip.bakeStars) NB.trip.bakeStars()
    if (el.root) flags()
    return true
  }
  S.cyclePalette = () => S.setPalette(PALETTES[(PALETTES.indexOf(document.documentElement.dataset.palette || 'white') + 1) % PALETTES.length])
  S.toggleSound = (on) => { if (!NIGHT.sound) return; NIGHT.sound.setMuted(on == null ? !NIGHT.sound.muted : !on); flags() }

  // ── clicks ────────────────────────────────────────────────────────────────────────────
  function onClick(e) {
    const a = e.target.closest('[data-act]')
    if (a && el.root.contains(a)) {
      const act = a.dataset.act
      if (act === 'canvas') { e.preventDefault(); S.closeDrawer(true); NB.trip.leave(); return }
      if (act === 'search') return NB.switcher.open(a)
      if (act === 'graph') return S.state.view === 'graph' ? history.back() : S.go('graph')
      if (act === 'listen') return NB.narrator.press()
      if (act === 'snd') return S.toggleSound()
      if (act === 'pal') return S.cyclePalette()
      if (act === 'help') return S.help(a)
      if (act === 'depth') { S.depth = S.depth === 2 ? 1 : 2; return S.renderAside() }
      if (act === 'fold') { const li = a.closest('li[data-folder]'); li.dataset.open = li.dataset.open === 'false' ? 'true' : 'false'; syncFolds(); return }
    }
    if (e.target.closest('.nb-bar__menu')) return el.root.classList.contains('nb-drawer-open') ? S.closeDrawer() : S.openDrawer()
    if (e.target.closest('.nb-bar__path') && phone() && !e.target.closest('a')) return S.openDrawer()
    // a note link inside the drawer closes it (the hashchange renders the note)
    if (e.target.closest('.nb-side a[href^="#/"]') && phone()) setTimeout(() => S.closeDrawer(true), 0)
    const row = e.target.closest('a[href^="#/"]')
    if (row && NIGHT.sound) NIGHT.sound.cue('select')
  }

  // ── the router ────────────────────────────────────────────────────────────────────────
  const parse = () => {
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''))
    const i = raw.indexOf('?')
    return { route: (i < 0 ? raw : raw.slice(0, i)).replace(/\/+$/, ''), q: new URLSearchParams(i < 0 ? '' : raw.slice(i + 1)) }
  }
  S.parse = parse
  S.href = (route, q) => `#/${route}${q && String(q) ? '?' + q : ''}`
  S.go = (route, q) => { const hh = S.href(route, q); if (location.hash === hh) S.show(); else location.hash = hh }
  const replace = (route, q) => { try { history.replaceState(null, '', S.href(route, q)) } catch { location.replace(S.href(route, q)) } }

  S.show = () => {
    if (location.hash === '#desk') return
    let { route, q } = parse()
    const v = V()
    if (route === 'graph') return showGraph(q)
    let note = v.get(route)
    if (!note && route) {
      note = v.resolve(route)
      if (note) { replace(note.route, q); }
    }
    if (!note) note = v.get('')
    if (S.state.note && S.state.note !== note && NB.narrator) NB.narrator.navigated(note, q)
    S.state = { ...S.state, route: note.route, view: note.route === '' ? 'home' : 'note', note, q }
    el.root.dataset.view = S.state.view
    el.graphBtn.setAttribute('aria-pressed', 'false')
    document.title = C.title(note.title)
    S.visited.add(note.route)
    store.set('nb-visited', [...S.visited])
    renderPath(note)
    markTree(note)
    NB.reader.render(note, q)
    S.renderAside()
    const a = q.get('a')
    if (a) requestAnimationFrame(() => NB.reader.toAnchor(a))
    else if (!S.keepScroll) { el.main.scrollTop = 0; if (phone()) scrollTo(0, 0) }
    S.keepScroll = false
    popOnArrival(q)
  }
  let popped = false
  function popOnArrival(q) {
    if (popped) return
    popped = true
    const pop = q.get('pop') || q0.get('pop')
    if (!pop) return
    setTimeout(() => { if (pop === 'switcher') NB.switcher.open(el.root.querySelector('[data-act="search"]')); else if (pop === 'drawer') S.openDrawer(); else if (pop === 'help') S.help() }, 60)
  }

  // ── the bar's path: every segment is a link ───────────────────────────────────────────
  function renderPath(note, graph) {
    const v = V(), segs = graph ? ['graph'] : note.route ? note.route.split('/') : []
    const parts = [`<li><a href="#/">${esc(C.lab)}</a></li>`]
    let acc = ''
    segs.forEach((s, i) => {
      acc = acc ? `${acc}/${s}` : s
      const last = i === segs.length - 1
      const hub = graph ? null : v.get(acc)
      // a folder with no hub of its own (a study track) links to the nearest hub above it
      const to = last ? (graph ? '#/graph' : S.href(note.route)) : hub ? S.href(hub.route) : S.href(nearestHub(acc).route, `a=${MD.slugify(C.blocks.tracksHead[0])}`)
      parts.push(`<li${last ? '' : ''}><a href="${esc(to)}"${last ? ' aria-current="page"' : ''}>${esc(s)}</a></li>`)
    })
    // on phone the path truncates from the left: … then the last segment
    if (segs.length > 1) parts.splice(parts.length - 1, 0, '<li class="nb-ell" aria-hidden="true">…/</li>')
    el.path.innerHTML = parts.join('')
  }
  function nearestHub(path) {
    let p = path
    while (p) { p = p.split('/').slice(0, -1).join('/'); const hub = V().get(p); if (hub) return hub }
    return V().get('')
  }

  // ── the tree ──────────────────────────────────────────────────────────────────────────
  function rowHtml(n, label) {
    return `<a class="nb-row" role="treeitem" href="${esc(S.href(n.route))}" data-route="${esc(n.route)}"${n.visibility === 'hidden' ? ' data-hidden' : ''}>${glyph(n)}<span class="nb-row__num">${esc(numOf(n))}</span><span class="nb-row__title">${esc(label || n.title)}</span></a>`
  }
  function folderHtml(f) {
    const kids = f.notes.map((n) => `<li role="none">${rowHtml(n)}</li>`).join('') + f.folders.map(folderHtml).join('')
    const label = f.hub ? rowHtml(f.hub, f.name + '/') : `<button type="button" class="nb-row" data-act="fold" aria-expanded="false"><span class="nb-row__glyph"></span><span class="nb-row__num"></span><span class="nb-row__title">${esc(f.name)}/</span></button>`
    return `<li data-folder="${esc(f.path)}" data-open="false" role="none"><div class="nb-frow"><button type="button" class="nb-fold" data-act="fold" aria-expanded="false" aria-label="${esc(f.title)}" tabindex="-1">▸</button>${label}</div><ul role="group">${kids}</ul></li>`
  }
  function renderTree() {
    const t = V().tree
    el.tree.innerHTML = (t.hub ? `<li role="none">${rowHtml(t.hub)}</li>` : '') + t.notes.map((n) => `<li role="none">${rowHtml(n)}</li>`).join('') + t.folders.map(folderHtml).join('')
  }
  const syncFolds = () => {
    for (const li of el.tree.querySelectorAll('li[data-folder]')) {
      const open = li.dataset.open === 'true'
      for (const b of li.querySelectorAll(':scope > .nb-frow [data-act="fold"]')) b.setAttribute('aria-expanded', String(open))
      li.querySelector(':scope > .nb-frow > .nb-fold').textContent = open ? '▾' : '▸'
    }
  }
  S.renderTree = renderTree
  function markTree(note) {
    for (const a of el.tree.querySelectorAll('[aria-current]')) a.removeAttribute('aria-current')
    const a = el.tree.querySelector(`a[data-route="${CSS.escape(note.route)}"]`)
    if (!a) return
    a.setAttribute('aria-current', 'page')
    // open every folder on the way down
    let li = a.closest('li[data-folder]')
    while (li) { li.dataset.open = 'true'; li = li.parentElement.closest('li[data-folder]') }
    syncFolds()
    const r = a.getBoundingClientRect(), sr = el.side.getBoundingClientRect()
    if (r.top < sr.top || r.bottom > sr.bottom) a.scrollIntoView({ block: 'nearest' })
  }
  function treeKeys(e) {
    const rows = [...el.tree.querySelectorAll('.nb-row')].filter((x) => x.offsetParent !== null)
    const i = rows.indexOf(document.activeElement)
    if (i < 0) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]; n.focus(); if (NIGHT.sound) NIGHT.sound.cue('cursor') }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const li = document.activeElement.closest('li[data-folder]')
      if (!li) return
      e.preventDefault()
      li.dataset.open = e.key === 'ArrowRight' ? 'true' : 'false'
      syncFolds()
    }
  }

  // ── the drawer (phone) ────────────────────────────────────────────────────────────────
  let drawerFrom = null
  S.openDrawer = () => {
    if (!phone()) { document.documentElement.classList.remove('nb-noside'); return }
    drawerFrom = document.activeElement
    document.documentElement.classList.add('nb-drawer')
    el.root.classList.add('nb-drawer-open')
    el.scrim.hidden = false
    el.menu.setAttribute('aria-expanded', 'true')
    el.side.setAttribute('role', 'dialog')
    el.side.setAttribute('aria-modal', 'true')
    el.main.inert = true; el.head.inert = true
    const cur = el.tree.querySelector('[aria-current]') || el.side.querySelector('.nb-side__canvas')
    setTimeout(() => (el.side.querySelector('.nb-side__canvas') || cur).focus({ preventScroll: true }), 0)
    if (NIGHT.sound) NIGHT.sound.cue('chirp-open')
  }
  S.closeDrawer = (quiet) => {
    if (!el.root.classList.contains('nb-drawer-open')) return false
    document.documentElement.classList.remove('nb-drawer')
    el.root.classList.remove('nb-drawer-open')
    el.scrim.hidden = true
    el.menu.setAttribute('aria-expanded', 'false')
    el.side.removeAttribute('role'); el.side.removeAttribute('aria-modal')
    el.main.inert = false; el.head.inert = false
    if (!quiet && drawerFrom && drawerFrom.focus) drawerFrom.focus({ preventScroll: true })
    else if (quiet) el.menu.focus({ preventScroll: true })
    if (NIGHT.sound) NIGHT.sound.cue('chirp-close')
    return true
  }
  S.toggleSide = () => { document.documentElement.classList.toggle('nb-noside') }
  // focus stays inside the drawer while it is open
  addEventListener('focusin', (e) => {
    if (!el.root || !el.root.classList.contains('nb-drawer-open')) return
    if (!el.side.contains(e.target) && !e.target.closest('.nb-layer')) el.side.querySelector('.nb-side__canvas').focus({ preventScroll: true })
  })

  // ── layers: the topmost one closes on Esc ────────────────────────────────────────────
  const layers = []
  S.layer = (node, from, onClose) => {
    layers.push({ node, from, onClose })
    return () => S.closeLayer(node)
  }
  S.closeLayer = (node) => {
    const i = node ? layers.findIndex((l) => l.node === node) : layers.length - 1
    if (i < 0) return false
    const [l] = layers.splice(i, 1)
    l.node.hidden = true
    if (l.onClose) l.onClose()
    if (l.from && l.from.focus) l.from.focus({ preventScroll: true })
    return true
  }
  S.topLayer = () => layers[layers.length - 1] || null
  function trapTab(e) {
    const top = S.topLayer()
    const box = top ? top.node : el.root.classList.contains('nb-drawer-open') ? el.side : null
    if (!box || e.key !== 'Tab') return
    const f = [...box.querySelectorAll('a[href], button:not([disabled]), input, [tabindex="0"]')].filter((x) => x.offsetParent !== null || x === document.activeElement)
    if (!f.length) return
    const i = f.indexOf(document.activeElement)
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus() }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus() }
  }

  // ── help ──────────────────────────────────────────────────────────────────────────────
  let helpEl = null
  S.help = (from) => {
    if (!helpEl) {
      helpEl = h('div', 'nb-layer', `<div class="nb-dialog" role="dialog" aria-modal="true" aria-label="${esc(C.helpTitle)}"><h2>${esc(C.helpTitle)}</h2><dl class="nb-keys">${C.keys.map(([k, d]) => `<dt>${esc(k)}</dt><dd>${esc(d)}</dd>`).join('')}</dl><div class="nb-dialog__foot"><button type="button" data-close>${esc(C.close)}</button></div></div>`)
      helpEl.hidden = true
      helpEl.addEventListener('click', (e) => { if (e.target === helpEl || e.target.closest('[data-close]')) S.closeLayer(helpEl) })
      document.body.appendChild(helpEl)
    }
    if (!helpEl.hidden) return S.closeLayer(helpEl)
    helpEl.hidden = false
    S.layer(helpEl, from || document.activeElement)
    helpEl.querySelector('[data-close]').focus()
  }

  // ── keys ──────────────────────────────────────────────────────────────────────────────
  const live = () => !NB.trip || NB.trip.live()
  function onKey(e) {
    if (!live()) return
    trapTab(e)
    if (e.key === 'Tab') return
    const typing = e.target.closest && e.target.closest('input, textarea, select')
    // the desk's own keys (0, +, −) must not move the camera under the Lab
    if (['0', '+', '=', '-'].includes(e.key)) e.stopImmediatePropagation()
    if (e.key === 'Escape') {
      if (S.closeLayer()) { e.preventDefault(); return }
      if (S.closeDrawer()) { e.preventDefault(); return }
      if (NB.narrator && NB.narrator.active()) { NB.narrator.stop(); e.preventDefault(); return }
      return
    }
    if (typing) return
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); NB.switcher.open(document.activeElement); return }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (S.topLayer()) return
    const n = S.state.note
    const k = e.key
    if (k === '/') { e.preventDefault(); NB.switcher.open(document.activeElement) }
    else if (k === 'g') S.state.view === 'graph' ? history.back() : S.go('graph')
    else if (k === 'b') phone() ? (el.root.classList.contains('nb-drawer-open') ? S.closeDrawer() : S.openDrawer()) : S.toggleSide()
    else if (k === '~' || k === '`') NB.trip.leave()
    else if (k === '?') S.help()
    else if (k === 'l') NB.narrator.press()
    else if (k === ' ' && NB.narrator.active() && !e.target.closest('button, a')) { e.preventDefault(); NB.narrator.toggle() }
    else if (k === ',' && NB.narrator.active()) NB.narrator.seek(-10)
    else if (k === '.' && NB.narrator.active()) NB.narrator.seek(10)
    else if ((k === '[' || k === ']' || k === 'u') && n && S.state.view !== 'graph') {
      const w = S.state.q.get('w'), pn = V().prevNext(n, w)
      const to = k === '[' ? pn.prev : k === ']' ? pn.next : pn.up
      if (to) S.go(to.route, pn.tour && to.type !== 'walkthrough' ? `w=${w}` : '')
    } else return
  }

  // ── the margin: local graph, outline, backlinks (or the full graph on start-here) ───────
  S.depth = 1
  S.renderAside = () => {
    const n = S.state.note
    if (!n || S.state.view === 'graph') return
    if (S.state.view === 'home' && wide()) {
      el.margin.innerHTML = `<div class="nb-home-graph"></div>`
      graphView(el.margin.querySelector('.nb-home-graph'), { compact: true })
      return
    }
    if (!wide()) { el.margin.innerHTML = ''; return }
    const v = V()
    const heads = NB.reader.headings || []
    const back = v.back(n), out = v.out(n)
    el.margin.innerHTML = `
      <section class="nb-sec nb-sec--graph"><h2><span>${esc(C.localGraph)}</span><button type="button" class="nb-depth" data-act="depth" aria-pressed="${S.depth === 2}" aria-label="${esc(C.depthLabel)}">${esc(C.depth(2))}</button></h2>${localGraph(n, 260, 200)}</section>
      ${heads.length ? `<section class="nb-sec nb-sec--toc"><h2>${esc(C.onPage)}</h2><ul>${heads.filter((x) => x.level <= 3).map((x) => `<li class="${x.level === 3 ? 'is-h3' : ''}"><a href="${esc(S.href(n.route, `a=${x.id}${S.state.q.get('w') ? '&w=' + S.state.q.get('w') : ''}`))}" data-anchor="${esc(x.id)}">${esc(x.text)}</a></li>`).join('')}</ul></section>` : ''}
      <section class="nb-sec nb-sec--back"><h2>${esc(C.linkedFrom(back.length))}</h2>${linkList(back, true)}</section>
      <section class="nb-sec nb-sec--out"><h2>${esc(C.linksOut(out.length))}</h2>${linkList(out, false)}</section>`
    bindLocal(el.margin)
  }
  const linkList = (ls, ctx) => ls.length ? `<ul>${ls.map((l) => `<li><a href="${esc(S.href(l.note.route))}" data-route="${esc(l.note.route)}">${esc(V().label(l.note))}${ctx && l.context ? `<span class="nb-ctx">“${esc(trimCtx(l.context))}”</span>` : ''}</a></li>`).join('')}</ul>` : `<p class="nb-ctx" style="color:var(--lab-dim)">${esc(C.noLinks)}</p>`
  const trimCtx = (s) => (s.length > 120 ? s.slice(0, 117) + '…' : s)
  S.linkList = linkList

  // the local graph: the note in the middle, its neighbours round it, in the list's order
  const CAP = 24
  function localGraph(n, w, hgt) {
    const v = V()
    const all = v.neighbours(n, S.depth)
    const one = all.filter((x) => x.hop === 1)
    const list = [...one.slice(0, CAP), ...all.filter((x) => x.hop === 2).slice(0, Math.max(0, CAP - one.length))]
    const pos = NB.graph.radial(list, w, hgt)
    const nodes = [{ note: n, hop: 0 }, ...list]
    const R = (t) => Math.max(4, (NB.graph.R[t] || 5) * 0.9)
    const edges = list.map((x, i) => {
      if (x.hop === 1) return `<line class="e" x1="${pos[0][0]}" y1="${pos[0][1]}" x2="${pos[i + 1][0]}" y2="${pos[i + 1][1]}"/>`
      const via = list.findIndex((y) => y.hop === 1 && v.neighbourList(y.note).includes(x.note))
      return via >= 0 ? `<line class="e e--hop2" x1="${pos[via + 1][0]}" y1="${pos[via + 1][1]}" x2="${pos[i + 1][0]}" y2="${pos[i + 1][1]}"/>` : ''
    }).join('')
    const more = one.length > CAP ? `<p class="nb-ctx" style="color:var(--lab-dim)">${esc(C.more(one.length - CAP))}: ${one.slice(CAP).map((x) => `<a href="${esc(S.href(x.note.route))}">${esc(x.note.id || x.note.title)}</a>`).join(' · ')}</p>` : ''
    return `<svg class="nb-g nb-g--local" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" role="group" aria-label="${esc(C.localGraph)}">${edges}${nodes.map((x, i) => nodeSvg(x.note, pos[i][0], pos[i][1], R(x.note.type), { here: i === 0, hop2: x.hop === 2, label: true, local: true, flip: pos[i][0] > w * 0.55 })).join('')}</svg>${more}`
  }
  S.localGraph = localGraph
  function shapeSvg(type, r) {
    if (type === 'doc') return `<rect class="s" x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}"/>`
    if (type === 'stage') return `<path class="s" d="M0 ${-r * 1.25}L${r * 1.25} 0L0 ${r * 1.25}L${-r * 1.25} 0Z"/>`
    if (type === 'post') return `<path class="s" d="M0 ${-r * 1.2}L${r * 1.1} ${r * 0.8}L${-r * 1.1} ${r * 0.8}Z"/>`
    if (type === 'hub') return `<circle class="s" r="${r}"/><circle class="s" r="${r * 0.55}"/>`
    if (type === 'walkthrough') return `<circle class="s" r="${r}" style="fill:none"/>`
    return `<circle class="s" r="${r}"/>`
  }
  const shortLabel = (n) => (n.type === 'topic' || n.type === 'stage' ? n.id : n.isHub ? n.title + '/' : n.type === 'walkthrough' ? n.id : n.title.length > 18 ? n.title.slice(0, 17) + '…' : n.title)
  function nodeSvg(n, x, y, r, o = {}) {
    const cls = ['n', o.here ? 'is-here' : '', o.hop2 ? 'is-hop2' : '', S.visited.has(n.route) ? 'is-visited' : ''].filter(Boolean).join(' ')
    const label = o.label !== false
    const full = V().label(n)
    // a label on the right-hand side of a small graph reads leftwards, so it stays inside the frame
    const lx = o.flip ? -(r + 3) : r + 3, anchor = o.flip ? ' text-anchor="end"' : ''
    return `<a class="${cls}" href="${esc(S.href(n.route))}" data-route="${esc(n.route)}" data-sec="${n.section}" data-type="${n.type}" aria-label="${esc(full)}" transform="translate(${x} ${y})">${shapeSvg(n.type, r)}${label ? `<text class="short" x="${lx}" y="3.5"${anchor}>${esc(shortLabel(n))}</text><text class="full" x="${lx}" y="3.5"${anchor}>${esc(o.local ? shortLabel(n) : full)}</text>` : ''}<title>${esc(full)}</title></a>`
  }
  function bindLocal(root) {
    for (const svg of root.querySelectorAll('.nb-g--local')) {
      svg.addEventListener('keydown', (e) => {
        if (!/^Arrow/.test(e.key)) return
        const ns = [...svg.querySelectorAll('a.n')]
        const i = ns.indexOf(document.activeElement)
        if (i < 0) return
        e.preventDefault()
        ns[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + ns.length) % ns.length].focus()
      })
    }
  }
  S.bindLocal = bindLocal

  // ── the full graph ────────────────────────────────────────────────────────────────────
  function showGraph(q) {
    S.state = { ...S.state, view: 'graph', q, route: 'graph' }
    el.root.dataset.view = 'graph'
    el.graphBtn.setAttribute('aria-pressed', 'true')
    document.title = C.title(C.graphTitle)
    renderPath(null, true)
    el.col.innerHTML = `<h1 class="nb-sr" tabindex="-1">${esc(C.graphTitle)}</h1><div class="nb-graph-host" style="height:100%"></div>`
    graphView(el.col.querySelector('.nb-graph-host'), {})
    if (phone()) scrollTo(0, 0)
    popOnArrival(q)
  }
  S.graphFilters = { 'agent-reliability': true, builds: true, writing: true }
  function graphView(host, { compact }) {
    const v = V(), L = graphLayout()
    const edges = v.edges.map((e) => { const a = L.pos[e.a.route], b = L.pos[e.b.route]; return a && b ? `<line class="e${e.kind === 'tour' ? ' e--tour' : ''}" data-a="${esc(e.a.route)}" data-b="${esc(e.b.route)}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>` : '' }).join('')
    const here = S.state.note && S.state.view !== 'graph' ? S.state.note : null
    const nodes = v.notes.map((n) => { const p = L.pos[n.route]; return nodeSvg(n, p[0], p[1], NB.graph.R[n.type] || 5, { here: n === here, label: true }) }).join('')
    host.innerHTML = `<div class="nb-graph">
      <div class="nb-graph__bar">${Object.keys(C.filters).map((s) => `<button type="button" data-filter="${s}" aria-pressed="${S.graphFilters[s]}" aria-label="${esc(C.filterLabel(C.filters[s], S.graphFilters[s]))}">${esc(C.filters[s])}</button>`).join('')}
        <button type="button" data-fit aria-label="${esc(C.fitLabel)}">${esc(C.fit)}</button>${compact ? '' : `<span class="nb-graph__hint">${esc(C.graphHint)}</span>`}</div>
      <div class="nb-graph__view"><svg class="nb-g nb-g--full" role="group" aria-label="${esc(C.graphLabel2)}"><g class="nb-g__world">${edges}${nodes}</g></svg></div>
      <p class="nb-graph__pick" hidden></p>
      <p class="nb-legend">${Object.entries(C.shapes).filter(([t]) => t !== 'log').map(([t, w]) => `<span>${esc({ hub: '◎', doc: '■', stage: '◆', topic: '•', build: '●', post: '▲', walkthrough: '○' }[t])} ${esc(w)}</span>`).join('')}</p>
    </div>`
    const svg = host.querySelector('svg'), world = svg.querySelector('.nb-g__world'), pick = host.querySelector('.nb-graph__pick')
    // one ref for the transform; written from rAF only
    const cam = { s: 1, x: 0, y: 0 }
    let dirty = true, raf = 0
    const frame = () => { raf = 0; if (dirty) { dirty = false; world.setAttribute('transform', `translate(${cam.x.toFixed(2)} ${cam.y.toFixed(2)}) scale(${cam.s.toFixed(4)})`) } }
    const kick = () => { dirty = true; if (!raf) raf = requestAnimationFrame(frame) }
    const fit = () => { const r = svg.getBoundingClientRect(); const f = NB.graph.fit(L.pos, r.width, r.height, compact ? 12 : 24); Object.assign(cam, f); kick() }
    S.graphCam = cam
    S.graphFit = fit
    requestAnimationFrame(fit)
    const filter = () => {
      for (const a of svg.querySelectorAll('a.n')) a.classList.toggle('is-dim', a.dataset.sec in S.graphFilters && !S.graphFilters[a.dataset.sec])
      for (const b of host.querySelectorAll('[data-filter]')) { const on = S.graphFilters[b.dataset.filter]; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', C.filterLabel(C.filters[b.dataset.filter], on)) }
    }
    filter()
    host.querySelector('.nb-graph__bar').addEventListener('click', (e) => {
      const f = e.target.closest('[data-filter]')
      if (f) { S.graphFilters[f.dataset.filter] = !S.graphFilters[f.dataset.filter]; filter() }
      if (e.target.closest('[data-fit]')) fit()
    })
    // pan, zoom, pinch: pointer events → cam → one transform
    const pts = new Map()
    let moved = 0, last = null, pinch = null
    svg.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; last = [e.clientX, e.clientY]; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: cam.s } } })
    svg.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return
      pts.set(e.pointerId, [e.clientX, e.clientY])
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()], r = svg.getBoundingClientRect()
        const mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top
        zoomAt(mx, my, pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)
        moved = 99
        return
      }
      const dx = e.clientX - last[0], dy = e.clientY - last[1]
      last = [e.clientX, e.clientY]
      moved += Math.abs(dx) + Math.abs(dy)
      if (moved > 4) { if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId); cam.x += dx; cam.y += dy; kick() }
    })
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null }
    svg.addEventListener('pointerup', up)
    svg.addEventListener('pointercancel', up)
    const zoomAt = (mx, my, s) => { s = Math.min(6, Math.max(0.2, s)); cam.x = mx - ((mx - cam.x) / cam.s) * s; cam.y = my - ((my - cam.y) / cam.s) * s; cam.s = s; kick() }
    S.graphZoomAt = zoomAt
    svg.addEventListener('wheel', (e) => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, cam.s * Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.003)) }, { passive: false })
    let touchSel = null
    svg.addEventListener('click', (e) => {
      const a = e.target.closest('a.n')
      if (moved > 4) { e.preventDefault(); return }
      if (!a) return
      // a tap on a phone selects first and says what it is; a second tap (or open →) goes
      if (phone() && touchSel !== a) {
        e.preventDefault()
        touchSel = a
        const n = V().get(a.dataset.route)
        pick.hidden = false
        pick.innerHTML = `${esc(V().label(n))} · <a href="${esc(S.href(n.route))}">${esc(C.nodeOpen)}</a>`
      }
    })
    svg.addEventListener('keydown', (e) => {
      if (!/^Arrow/.test(e.key)) return
      const ns = [...svg.querySelectorAll('a.n')], i = ns.indexOf(document.activeElement)
      if (i < 0) return
      e.preventDefault(); ns[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + ns.length) % ns.length].focus()
    })
  }
  // the switcher highlights matches in an open graph
  S.highlight = (notes) => {
    const set = new Set((notes || []).map((n) => n.route))
    for (const a of document.querySelectorAll('.nb-g--full a.n')) a.classList.toggle('is-match', !!notes && set.has(a.dataset.route))
  }

  // ?add=1: a 72nd note, relaid out warm; the readout says how far the others moved
  S.addProof = () => {
    const before = graphLayout().pos
    NB.vault = buildVault({ 'agent-reliability/shopkeeper/08-test-note.md': `---\ntitle: "test note"\ntype: doc\nstatus: planned\nupdated: 2026-11-21\nsummary: "the ?add=1 proof"\ntags: [shopkeeper]\naliases: []\nlisten: true\nvisibility: public\nproject: shopkeeper\n---\n\nSee [[shopkeeper/spec]].\n` })
    const after = S.relayout().pos
    const mv = Object.keys(before).map((k) => Math.hypot(after[k][0] - before[k][0], after[k][1] - before[k][1])).sort((a, b) => a - b)
    renderTree()
    S.show()
    const med = mv[mv.length >> 1], max = mv[mv.length - 1]
    NB.trip.badge(C.proof.add(med.toFixed(2), max.toFixed(2)), med < 4 && max < 24)
    return { med, max, n: NB.vault.notes.length }
  }
})()
