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
 *   (the theme itself is NB.prefs's: prefs.js, applied before first paint)
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
  // the width, read once and on resize: innerWidth on a phone's viewport forces a layout, and the
  // router asks right after drawing a note (that layout belongs to the next frame)
  let vw = innerWidth
  addEventListener('resize', () => { vw = innerWidth })
  const wide = () => vw >= 1200
  const P = NB.prefs
  const store = { get: P.get, set: P.set }

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

  // ── glyphs and labels ─────────────────────────────────────────────────────────────────
  const glyph = (n) => { const g = C.status[n.status] || C.status.planned; return `<span class="nb-row__glyph" data-st="${esc(C.status[n.status] ? n.status : 'planned')}" aria-label="${esc(g[1])}" title="${esc(g[1])}">${esc(g[0])}</span>` }
  // a hub's 00 is an internal label: the tree shows it only in the author view (?hidden=1)
  const numOf = (n) => (n.id || (n.isHub ? (q0.get('hidden') === '1' ? '00' : '') : /^\d\d$/.test(n.num) ? n.num : ''))
  S.glyph = glyph
  // a tag as a chip: its glyph and its tone are its own, everywhere (tags.js)
  S.tagChip = (id, o = {}) => {
    const t = NB.tags.get(id)
    if (!t) return ''
    const name = C.tags.names[id] || id
    const tagName = o.button ? 'button' : 'a', attrs = o.button ? `type="button" data-tagpick="${esc(id)}" aria-pressed="${!!o.on}"` : `href="${esc(S.href('tag/' + id))}"`
    return `<${tagName} class="nb-chip" ${attrs} data-tag="${esc(id)}" data-tone="${t.tone}" aria-label="${esc(C.tags.label(name))}"><span class="nb-chip__g" aria-hidden="true">${esc(t.glyph)}</span>${esc(name)}${o.count != null ? `<span class="nb-chip__n">${o.count}</span>` : ''}</${tagName}>`
  }
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
          <div class="nb-bar__cell nb-bar__path" aria-label="${esc(C.pathLabel)}"><ol></ol><span class="nb-bar__up"></span></div>
          <button type="button" class="nb-bar__cell nb-bar__btn" data-act="search" aria-label="${esc(C.searchLabel)}">${esc(C.search)}<span class="nb-bar__word"> ${esc(C.searchWord)}</span> <span class="nb-bar__k">${esc(C.searchKey)}</span></button>
          <button type="button" class="nb-bar__cell nb-bar__btn" data-act="graph" aria-label="${esc(C.graphLabel)}" aria-pressed="false">${esc(C.graph)}<span class="nb-bar__word"> ${esc(C.graphWord)}</span></button>
          <button type="button" class="nb-bar__cell nb-bar__btn" data-act="listen" aria-label="${esc(C.listenLabel)}">${esc(C.listen)}<span class="nb-bar__word"> ${esc(C.listenWord)}</span></button>
          <button type="button" class="nb-bar__cell nb-bar__btn nb-bar__focus" data-act="focus" aria-label="${esc(C.focusLabel)}" aria-pressed="false">${esc(C.focus)}<span class="nb-bar__word"> ${esc(C.focusWord)}</span> <span class="nb-bar__k">${esc(C.focusKey)}</span></button>
          <button type="button" class="nb-bar__cell nb-bar__btn nb-bar__aa" data-act="aa" aria-label="${esc(C.aaLabel)}" aria-expanded="false" aria-controls="nbAa">${esc(C.aa)}</button>
          <button type="button" class="nb-bar__cell nb-bar__btn nb-bar__help" data-act="help" aria-label="${esc(C.helpLabel)}">${esc(C.help)}</button>
        </nav>
        <div class="nb-strip" role="region" aria-label="${esc(C.strip.label)}" hidden></div>
      </header>
      <aside class="nb-side" id="nbSide" aria-label="${esc(C.treeLabel)}">
        <a class="nb-side__canvas" href="#desk" data-act="canvas">${esc(C.canvas)}</a>
        <div class="nb-here" aria-hidden="true" hidden></div>
        <ul class="nb-tree" role="tree" aria-label="${esc(C.treeLabel)}"></ul>
        <div class="nb-side__foot"><button type="button" class="nb-side__share" data-act="share">${esc(C.share)}</button><button type="button" class="nb-side__keys" data-act="help">${esc(C.keysHint)}</button></div>
      </aside>
      <main class="nb-main" id="nbMain" tabindex="-1"><div class="nb-col"></div></main>
      <aside class="nb-margin" aria-label="${esc(C.linksHead)}"></aside>
      <div class="nb-scrim" hidden></div>`
    document.body.appendChild(root)
    Object.assign(el, {
      root, head: root.querySelector('.nb-head'), bar: root.querySelector('.nb-bar'), strip: root.querySelector('.nb-strip'), path: root.querySelector('.nb-bar__path ol'), up: root.querySelector('.nb-bar__up'), focusBtn: root.querySelector('[data-act="focus"]'),
      menu: root.querySelector('.nb-bar__menu'), canvas: root.querySelector('.nb-bar__canvas'), side: root.querySelector('.nb-side'), tree: root.querySelector('.nb-tree'), here: root.querySelector('.nb-here'),
      main: root.querySelector('.nb-main'), col: root.querySelector('.nb-col'), margin: root.querySelector('.nb-margin'), scrim: root.querySelector('.nb-scrim'),
      graphBtn: root.querySelector('[data-act="graph"]'), listenBtn: root.querySelector('.nb-bar [data-act="listen"]'),
    })
    root.addEventListener('click', onClick)
    el.scrim.addEventListener('click', () => S.closeDrawer())
    el.tree.addEventListener('keydown', treeKeys)
    addEventListener('keydown', onKey, true)
    addEventListener('hashchange', () => S.show())
    let rt = 0
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!phone()) S.closeDrawer(true); if (S.state.view === 'graph') { if (S.graphPhone !== phone()) S.show(); return } S.renderAside(); NB.reader.tables(); placeHere(false) }, 120) })
    // the theme is already on <html> (NB.prefs.apply, before first paint); the stars follow it
    P.onTheme(() => { NB.motion.snap(() => {}); if (NB.trip && NB.trip.bakeStars) NB.trip.bakeStars(); flags() })
    NB.controls.mount()
    if (q0.get('voice')) NIGHT.voice.use(q0.get('voice'))
    flags()
    if (NIGHT.sound && NIGHT.sound.on) NIGHT.sound.on(flags)
    // the inline script in index.html has already set html[data-focus] before first paint
    S.setFocus(S.isFocus(), false, false)
    renderTree()
    if (document.fonts) document.fonts.ready.then(() => placeHere(false))
  }

  // ── focus mode: html[data-focus], one owner. The tree and the margin go, the column centres,
  // the bar dims until it is pointed at. Stored (try/catch); the narrator turns it on unstored.
  // M7: the panes leave (opacity and 12 px aside, 320 ms) and then the grid switches, once, so no
  // frame reflows the column's text; turning it off switches the grid first and the panes come
  // back. The state is the reader's at once (isFocus, aria-pressed); the attribute is the layout.
  const FOCUS_KEY = P.KEY.focus
  let focusState = null
  S.isFocus = () => (focusState == null ? document.documentElement.hasAttribute('data-focus') : focusState)
  S.setFocus = (on, persist = true, animate = true) => {
    on = !!on
    const was = S.isFocus()
    focusState = on
    if (persist) store.set(FOCUS_KEY, on)
    if (el.focusBtn) el.focusBtn.setAttribute('aria-pressed', String(on))
    if (NB.controls && NB.controls.syncAa) NB.controls.syncAa()
    const apply = () => { document.documentElement.toggleAttribute('data-focus', on); if (!on) placeHere(false) }
    if (!animate || was === on || !live()) return apply()
    NB.motion.panes(apply, on, [[el.side, -1], [el.margin, 1]])
  }
  S.toggleFocus = () => { if (NB.narrator) NB.narrator.focusTouched(); S.setFocus(!S.isFocus()) }

  // a hub's title and a section's name, as words: "Agent reliability", not "agent-reliability/"
  S.cap = (t) => String(t).charAt(0).toUpperCase() + String(t).slice(1)
  S.name = (n) => (n.route === '' ? C.sections.root : n.isHub ? S.cap(n.title) : n.title)
  const folderName = (path) => C.folderNames[path] || S.cap(V().folderTitle(path))

  function flags() {
    const muted = !NIGHT.sound || NIGHT.sound.muted
    for (const b of el.root.querySelectorAll('[data-act="snd"]')) { b.textContent = C.sndWord(!muted); b.setAttribute('aria-label', C.sndLabel(!muted)); b.setAttribute('aria-pressed', String(!muted)) }
  }
  S.flags = flags
  // "> palette <id>" and the Aa panel's theme are stored choices; NB.prefs owns the attribute
  S.setPalette = (id) => P.setTheme(id)
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
      if (act === 'aa') return NB.controls.toggleAa(a)
      if (act === 'share') return NB.share.open(a)
      if (act === 'top') return NB.controls.top()
      if (act === 'help') return S.help(a)
      if (act === 'focus') return S.toggleFocus()
      if (act === 'fold') { e.preventDefault(); const li = a.closest('li[data-folder]'); li.dataset.open = li.dataset.open === 'false' ? 'true' : 'false'; syncFolds(); return }
    }
    // prev / next / up move focus to the new note's h1, as the trip does
    if (e.target.closest('a[data-step]')) S.focusTitle = true
    if (e.target.closest('.nb-bar__menu')) return el.root.classList.contains('nb-drawer-open') ? S.closeDrawer() : S.openDrawer()
    // the bar's title goes back to the top (Q12, the iOS convention): the current crumb on a
    // desktop, the bar's free space beside "‹ parent" on a phone
    if (e.target.closest('.nb-bar__path [aria-current="page"]') && S.state.view === 'note') { e.preventDefault(); return NB.controls.top() }
    if (e.target.closest('.nb-bar__path') && phone() && !e.target.closest('a')) return S.state.view === 'note' ? NB.controls.top() : S.openDrawer()
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
    NB.controls.save()
    let { route, q } = parse()
    const v = V()
    if (route === 'graph') return showGraph(q)
    if (route === 'tag' || route.startsWith('tag/')) return showTag(route.slice(4), q)
    let note = v.get(route)
    if (!note && route) {
      note = v.resolve(route)
      if (note) { replace(note.route, q); }
    }
    const lost = !note && route ? route : ''
    if (!note) note = v.get('')
    if (S.state.note && S.state.note !== note && NB.narrator) NB.narrator.navigated(note, q)
    // M1: a new note crossfades in (motion.js); the same note again (an anchor, a resize) and
    // anything before the Lab is up (a direct link, the trip) draw at once
    const was = S.state, up = !!NB.trip && NB.trip.live()
    const how = !up || !was.note ? null : was.view === 'graph' ? 'arrive' : was.note !== note ? 'swap' : null
    const prevSec = el.root.dataset.sec
    const draw = () => {
      S.state = { ...S.state, route: note.route, view: note.route === '' ? 'home' : 'note', note, q }
      el.root.dataset.view = S.state.view
      el.root.dataset.sec = note.section
      document.documentElement.classList.remove('nb-graph')
      // leaving the graph, ◎ stops being pressed at once, like the tree's rows (markTree flushes)
      el.graphBtn.style.transition = 'none'
      el.graphBtn.setAttribute('aria-pressed', 'false')
      document.title = C.title(note.title)
      S.visited.add(note.route)
      store.set('nb-visited', [...S.visited])
      renderPath(note)
      markTree(note)
      el.graphBtn.style.transition = ''
      NB.reader.render(note, q, { later: !!how })
      S.renderAside()
      const a = q.get('a'), top = !a && !S.keepScroll
      // resetting the scroll lays the note out: during a crossfade that waits for the frame (the
      // column shows nothing until then), so the router's own task stays short
      const reset = () => { el.main.scrollTop = 0; if (phone()) scrollTo(0, 0) }
      // a jump within the note on screen scrolls there smoothly (M8); a new note opened at a heading
      // jumps there under its crossfade, as a link from outside does
      if (a) requestAnimationFrame(() => NB.reader.toAnchor(a, { smooth: up && was.note === note }))
      else if (top && how) requestAnimationFrame(reset)
      else if (top) reset()
      S.keepScroll = false
    }
    if (how === 'swap') NB.motion.swap({ root: el.root, col: el.col, clip: phone() ? { getBoundingClientRect: () => ({ left: 0, top: el.head.getBoundingClientRect().bottom, width: innerWidth, bottom: innerHeight }) } : el.main, sec: prevSec, render: draw })
    else { draw(); if (how === 'arrive') NB.motion.arrive(el.col) }
    if (S.focusTitle) { S.focusTitle = false; const t = el.col.querySelector('.nb-title'); if (t) t.focus({ preventScroll: true }) }
    NB.controls.arrived(note, q)
    NB.share.arrived(S.state.view === 'note' ? note : null)
    if (lost) NB.controls.toast(esc(C.notFound(lost)), 4000)
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

  // ── the bar's path: titles, every segment a link. A phone shows "‹ parent" only ────────
  function renderPath(note, graph) {
    const v = V(), segs = graph ? ['graph'] : note.route ? note.route.split('/') : []
    const crumbs = [{ href: '#/', text: C.crumbRoot, last: !segs.length }]
    let acc = ''
    segs.forEach((s, i) => {
      acc = acc ? `${acc}/${s}` : s
      const last = i === segs.length - 1
      const hub = graph ? null : v.get(acc)
      // a folder with no hub of its own (a study track) links to the nearest hub above it
      const href = last ? (graph ? '#/graph' : S.href(note.route)) : hub ? S.href(hub.route) : S.href(nearestHub(acc).route, `a=${MD.slugify(C.blocks.tracksHead[0])}`)
      const text = graph ? S.cap(C.graphTitle) : last ? S.name(note) : hub ? S.name(hub) : folderName(acc)
      crumbs.push({ href, text, last })
    })
    el.path.innerHTML = crumbs.map((c, i) => `<li${i === 1 && !graph ? ' class="is-sec"' : ''}>${i ? `<span class="nb-crumb-sep" aria-hidden="true">${esc(C.crumbSep)}</span>` : ''}<a href="${esc(c.href)}"${c.last ? ' aria-current="page"' : ''}>${esc(c.text)}</a></li>`).join('')
    const up = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null
    el.up.innerHTML = up ? `<a class="nb-up" href="${esc(up.href)}" aria-label="${esc(C.crumbUpLabel(up.text))}">${esc(C.crumbUp(up.text))}</a>` : `<span class="nb-up">${esc(crumbs[0].text)}</span>`
  }
  function nearestHub(path) {
    let p = path
    while (p) { p = p.split('/').slice(0, -1).join('/'); const hub = V().get(p); if (hub) return hub }
    return V().get('')
  }

  // ── the tree: one tab stop (the current row); arrows move, → and ← fold ─────────────────
  // Rows recede (dim) until the pane is hovered or focused. A folder is a chevron and a title.
  function rowHtml(n, label) {
    const t = label || n.title
    return `<a class="nb-row" role="treeitem" tabindex="-1" href="${esc(S.href(n.route))}" data-route="${esc(n.route)}" title="${esc(t)}"${n.visibility === 'hidden' ? ' data-hidden' : ''}>${glyph(n)}<span class="nb-row__num">${esc(numOf(n))}</span><span class="nb-row__title">${esc(t)}</span></a>`
  }
  function folderHtml(f) {
    const kids = f.notes.map((n) => `<li role="none">${rowHtml(n)}</li>`).join('') + f.folders.map(folderHtml).join('')
    const name = folderName(f.path), chev = `<span class="nb-row__chev" data-act="fold" aria-hidden="true">▸</span>`
    const label = f.hub
      ? `<a class="nb-row nb-row--folder" role="treeitem" tabindex="-1" aria-expanded="false" href="${esc(S.href(f.hub.route))}" data-route="${esc(f.hub.route)}" title="${esc(name)}">${chev}<span class="nb-row__title">${esc(name)}</span></a>`
      : `<button type="button" class="nb-row nb-row--folder" role="treeitem" tabindex="-1" data-act="fold" aria-expanded="false" title="${esc(name)}">${chev}<span class="nb-row__title">${esc(name)}</span></button>`
    return `<li data-folder="${esc(f.path)}" data-sec="${esc(secOf(f))}" data-open="false" role="none">${label}<ul role="group">${kids}</ul></li>`
  }
  // a folder's section: its hub's, or its first note's
  const secOf = (f) => (f.hub ? f.hub.section : f.notes[0] ? f.notes[0].section : f.folders[0] ? secOf(f.folders[0]) : 'root')
  function renderTree() {
    const t = V().tree
    el.tree.innerHTML = (t.hub ? `<li role="none">${rowHtml(t.hub, S.name(t.hub))}</li>` : '') + t.notes.map((n) => `<li role="none">${rowHtml(n)}</li>`).join('') + t.folders.map(folderHtml).join('')
    rove(el.tree.querySelector('.nb-row'))
  }
  const syncFolds = () => {
    for (const li of el.tree.querySelectorAll('li[data-folder]')) {
      const open = li.dataset.open === 'true', row = li.querySelector(':scope > .nb-row')
      row.setAttribute('aria-expanded', String(open))
    }
    placeHere()
  }
  // the roving tab stop
  function rove(row) {
    if (!row) return
    for (const r of el.tree.querySelectorAll('.nb-row[tabindex="0"]')) if (r !== row) r.setAttribute('tabindex', '-1')
    row.setAttribute('tabindex', '0')
  }
  S.renderTree = renderTree
  // the rows that stop and start being "here" change colour at once: only the bar moves (M1), and
  // a colour the reader did not point at never fades (the style is flushed below, with the
  // transition off on just those rows)
  function markTree(note) {
    const quiet = [...el.tree.querySelectorAll('[aria-current]')]
    const a = note ? el.tree.querySelector(`a[data-route="${CSS.escape(note.route)}"]`) : null
    if (a) quiet.push(a)
    for (const x of quiet) x.style.transition = 'none'
    for (const x of el.tree.querySelectorAll('[aria-current]')) x.removeAttribute('aria-current')
    if (!a) { void el.tree.offsetWidth; for (const x of quiet) x.style.transition = ''; placeHere(); return }
    a.setAttribute('aria-current', 'page')
    rove(a)
    // open every folder on the way down
    let li = a.closest('li[data-folder]')
    while (li) { li.dataset.open = 'true'; li = li.parentElement.closest('li[data-folder]') }
    syncFolds()
    for (const x of quiet) x.style.transition = ''
    const r = a.getBoundingClientRect(), sr = el.side.getBoundingClientRect()
    if (r.top < sr.top || r.bottom > sr.bottom) a.scrollIntoView({ block: 'nearest' })
  }
  // M1: "you are here" is one 2 px bar beside the current row, sliding to the next one over
  // 180 ms (a transform: translate to the row, scaleY to its height). CSS owns the transition.
  function placeHere(animate = true) {
    const bar = el.here, a = el.tree && el.tree.querySelector('.nb-row[aria-current="page"]')
    if (!bar) return
    const on = !!a && a.getClientRects().length > 0
    if (!on) { bar.hidden = true; return }
    const first = bar.hidden || !animate
    if (first) bar.style.transition = 'none'
    bar.hidden = false
    const sr = el.side.getBoundingClientRect(), r = a.getBoundingClientRect()
    bar.style.transform = `translate(${(r.left - sr.left + el.side.scrollLeft).toFixed(1)}px, ${(r.top - sr.top + el.side.scrollTop).toFixed(1)}px) scaleY(${(r.height / 100).toFixed(4)})`
    if (first) { void bar.offsetWidth; bar.style.transition = '' }
  }
  S.placeHere = placeHere
  function treeKeys(e) {
    const rows = [...el.tree.querySelectorAll('.nb-row')].filter((x) => x.offsetParent !== null)
    const i = rows.indexOf(document.activeElement)
    if (i < 0) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      const n = e.key === 'Home' ? rows[0] : e.key === 'End' ? rows[rows.length - 1] : rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      rove(n); n.focus(); if (NIGHT.sound) NIGHT.sound.cue('cursor')
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const li = document.activeElement.closest('li[data-folder]')
      if (!li || (li.querySelector(':scope > .nb-row') !== document.activeElement && e.key === 'ArrowRight')) return
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
    el.scrim.style.pointerEvents = ''
    NB.motion.fadeIn(el.scrim, NB.motion.D.scrim)
    placeHere(false)
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
    // the scrim fades as the drawer slides; it takes no click while it goes
    el.scrim.style.pointerEvents = 'none'
    NB.motion.play(el.scrim, [{ opacity: 1 }, { opacity: 0 }], NB.motion.cap(NB.motion.D.scrim)).then(() => { if (!el.root.classList.contains('nb-drawer-open')) el.scrim.hidden = true })
    el.menu.setAttribute('aria-expanded', 'false')
    el.side.removeAttribute('role'); el.side.removeAttribute('aria-modal')
    el.main.inert = false; el.head.inert = false
    if (!quiet && drawerFrom && drawerFrom.focus) drawerFrom.focus({ preventScroll: true })
    else if (quiet) el.menu.focus({ preventScroll: true })
    if (NIGHT.sound) NIGHT.sound.cue('chirp-close')
    return true
  }
  S.toggleSide = () => {
    const h = document.documentElement, out = !h.classList.contains('nb-noside')
    NB.motion.panes(() => { h.classList.toggle('nb-noside', out); if (!out) placeHere(false) }, out, [[el.side, -1]])
  }
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
    const f = [...box.querySelectorAll('a[href], button:not([disabled]), input, [tabindex="0"]')].filter((x) => x.getAttribute('tabindex') !== '-1' && (x.offsetParent !== null || x === document.activeElement))
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
    // the Aa panel and a popover are not modal: + − and a still work while they are open
    if (S.topLayer() && !S.topLayer().node.matches('.nb-aa, .nb-pop')) return
    const n = S.state.note
    const k = e.key
    if (k === '/') { e.preventDefault(); NB.switcher.open(document.activeElement) }
    else if (k === 'g') { if (S.state.view === 'graph') history.back(); else S.go('graph') }
    else if (k === 'b') { if (!phone()) S.toggleSide(); else if (el.root.classList.contains('nb-drawer-open')) S.closeDrawer(); else S.openDrawer() }
    else if (k === '~' || k === '`') NB.trip.leave()
    else if (k === '?') S.help()
    else if (k === 'f') S.toggleFocus()
    else if (k === 'a') NB.controls.toggleAa(document.activeElement)
    else if ((k === '+' || k === '=' || k === '-' || k === '−') && S.state.view !== 'graph') { NB.controls.markPlace(); P.bump(k === '-' || k === '−' ? -1 : 1) }
    else if (k === 'l') NB.narrator.press()
    else if (k === ' ' && NB.narrator.active() && !e.target.closest('button, a')) { e.preventDefault(); NB.narrator.toggle() }
    else if (k === ',' && NB.narrator.active()) NB.narrator.seek(-10)
    else if (k === '.' && NB.narrator.active()) NB.narrator.seek(10)
    else if ((k === '[' || k === ']' || k === 'u') && n && S.state.view !== 'graph') {
      const w = S.state.q.get('w'), pn = V().prevNext(n, w)
      const to = k === '[' ? pn.prev : k === ']' ? pn.next : pn.up
      if (to) { S.focusTitle = true; S.go(to.route, pn.tour && to.type !== 'walkthrough' ? `w=${w}` : '') }
    } else return
  }

  // ── the margin: only "on this page", with scroll-spy, and only for ≥ 3 headings ─────────
  // No margin: the column centres. Start-here is one centred column (round 3: no graph there).
  let spy = null
  S.renderAside = () => {
    const n = S.state.note
    if (!n || S.state.view === 'graph') return
    if (spy) { spy.disconnect(); spy = null }
    const heads = S.state.view === 'home' ? [] : NB.reader.outline()
    el.root.dataset.margin = heads.length ? 'toc' : 'none'
    if (!wide() || !heads.length) { el.margin.innerHTML = ''; return }
    const w = S.state.q.get('w')
    el.margin.innerHTML = `<nav class="nb-sec nb-sec--toc" aria-label="${esc(C.onPage)}"><h2>${esc(C.onPage)}</h2><ul>${heads.map((x) => `<li class="${x.level === 3 ? 'is-h3' : ''}"><a href="${esc(S.href(n.route, `a=${x.id}${w ? '&w=' + w : ''}`))}" data-anchor="${esc(x.id)}">${esc(x.text)}</a></li>`).join('')}</ul></nav>`
    // scroll-spy: the last heading above the top third of the column is "here"
    const links = new Map([...el.margin.querySelectorAll('[data-anchor]')].map((a) => [a.dataset.anchor, a]))
    const seen = new Map()
    const mark = () => {
      let cur = null
      for (const x of heads) if (seen.get(x.id)) cur = x.id
      if (!cur) cur = heads[0].id
      for (const [id, a] of links) { if (id === cur) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current') }
    }
    spy = new IntersectionObserver((es) => { for (const e of es) seen.set(e.target.id, e.boundingClientRect.top < (e.rootBounds ? e.rootBounds.top + e.rootBounds.height * 0.33 : innerHeight / 3)); mark() }, { root: el.main, rootMargin: '0px 0px -66% 0px', threshold: [0, 1] })
    for (const x of heads) { const t = el.col.querySelector(`#${CSS.escape(x.id)}`); if (t) spy.observe(t) }
    mark()
  }
  // a note's name in a list: "T03 Error analysis", the ID mono and dim, the title in sans (O7)
  const nameHtml = (n) => (n.id ? `<span class="nb-lid">${esc(n.id)}</span> ${esc(n.title)}` : esc(n.isHub ? S.name(n) : n.title))
  S.nameHtml = nameHtml
  const trimCtx = (s) => (s.length > 120 ? s.slice(0, 117) + '…' : s)
  // links with the sentence around each; an empty list is not drawn at all
  S.linkList = (ls) => (ls.length ? `<ul>${ls.map((l) => `<li><a href="${esc(S.href(l.note.route))}" data-route="${esc(l.note.route)}">${nameHtml(l.note)}${l.context ? `<span class="nb-ctx">“${esc(trimCtx(l.context))}”</span>` : ''}</a></li>`).join('')}</ul>` : '')

  // ── the map's nodes ───────────────────────────────────────────────────────────────────
  function shapeSvg(type, r) {
    if (type === 'doc') return `<rect class="s" x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}"/>`
    if (type === 'stage') return `<path class="s" d="M0 ${-r * 1.25}L${r * 1.25} 0L0 ${r * 1.25}L${-r * 1.25} 0Z"/>`
    if (type === 'post') return `<path class="s" d="M0 ${-r * 1.2}L${r * 1.1} ${r * 0.8}L${-r * 1.1} ${r * 0.8}Z"/>`
    if (type === 'hub') return `<circle class="s" r="${r}"/><circle class="s s--in" r="${r * 0.55}"/>`
    if (type === 'walkthrough') return `<circle class="s" r="${r}" style="fill:none"/>`
    if (type === 'track') return `<circle class="s" r="${r}"/><circle class="s s--in" r="${(r * 0.45).toFixed(1)}"/>`
    return `<circle class="s" r="${r}"/>`
  }
  S.shapeSvg = shapeSvg
  // a node's label as lines; a track's is its name and its progress
  const trackNote = (t) => ({ name: S.cap(V().folderTitle(t.folder)), done: t.topics.filter((x) => x.status === 'done').length, of: t.topics.length })
  const labelOf = (d) => {
    if (d.type === 'track') { const t = trackNote(d.track); return [t.name, C.track.done(t.done, t.of)] }
    const n = V().get(d.key)
    // a section's own overview sits under the section's name on the map: it is "Overview" there
    return NB.graph.wrap(n.id ? `${n.id} ${n.title}` : n.route === '' ? n.title : n.type === 'log' ? S.cap(C.shapes.log) : n.isHub && n.route === n.section ? S.cap(C.shapes.hub) : n.isHub ? S.name(n) : n.title)
  }
  const LH = 1.2
  let LF = 14, RF = 20
  function labelSvg(d, x, y, at) {
    if (!at) return ''
    const lx = (at.x - x).toFixed(1), ly = (at.y - y).toFixed(1)
    const id = d.type !== 'track' && (V().get(d.key) || {}).id
    return `<text class="l${at.shown ? '' : ' is-off'}" x="${lx}" y="${ly}">${at.lines.map((line, i) => {
      const body = i === 0 && id && line.startsWith(id + ' ') ? `<tspan class="lid">${esc(id)}</tspan>${esc(line.slice(id.length))}` : esc(line)
      return `<tspan x="${lx}" dy="${i ? (LF * LH).toFixed(1) : (LF * 0.95).toFixed(1)}">${body}</tspan>`
    }).join('')}</text>`
  }
  function nodeSvg(d, x, y, at) {
    const n = d.type === 'track' ? null : V().get(d.key)
    const t = d.track && trackNote(d.track)
    const cls = ['n', n && S.visited.has(n.route) ? 'is-visited' : '', d.type === 'track' && S.graphOpen.has(d.key) ? 'is-open' : ''].filter(Boolean).join(' ')
    const label = n ? V().label(n) : C.track.label(t.name, t.done, t.of)
    const href = n ? S.href(n.route) : S.href(V().get('agent-reliability/study') ? 'agent-reliability/study' : '')
    const tags = n ? n.tags : [...new Set(V().notes.filter((x) => x.folder === `agent-reliability/study/${d.track}`).flatMap((x) => x.tags))]
    return `<a class="${cls}" href="${esc(href)}" data-route="${esc(d.key)}" data-tags="${esc(tags.join(' '))}" data-sec="${esc(d.section)}" data-type="${esc(d.type)}"${d.type === 'track' ? ` aria-expanded="${S.graphOpen.has(d.key)}"` : ''} aria-label="${esc(label)}" transform="translate(${x} ${y})">${shapeSvg(d.type, NB.graph.radius(d))}${labelSvg(d, x, y, at)}<title>${esc(label)}</title></a>`
  }

  // ── a tag's page: '#/tag/<id>', its notes grouped by section; an unknown tag lists the real ones ──
  function showTag(id, q) {
    NB.share.arrived(null)
    const v = V(), t = NB.tags.get(id), g = t ? NB.tags.group(v, t.id) : null
    const name = t ? C.tags.names[t.id] || t.id : id
    S.state = { ...S.state, view: 'tag', q, route: 'tag/' + id, note: null, tag: t ? t.id : null }
    el.root.dataset.view = 'tag'
    el.root.dataset.sec = 'root'
    document.documentElement.classList.remove('nb-graph')
    el.graphBtn.setAttribute('aria-pressed', 'false')
    document.title = C.title(C.tags.title(name))
    el.path.innerHTML = `<li><a href="#/">${esc(C.crumbRoot)}</a></li><li><span class="nb-crumb-sep" aria-hidden="true">${esc(C.crumbSep)}</span><a href="${esc(S.href('tag/' + id))}" aria-current="page">${esc(C.tags.title(name))}</a></li>`
    el.up.innerHTML = `<a class="nb-up" href="#/" aria-label="${esc(C.crumbUpLabel(C.crumbRoot))}">${esc(C.crumbUp(C.crumbRoot))}</a>`
    const counts = Object.fromEntries(NB.tags.list.map((x) => [x.id, v.notes.filter((n) => n.tags.includes(x.id)).length]))
    const every = `<section class="nb-tagall" aria-label="${esc(C.tags.all)}"><h2 class="nb-end__head">${esc(C.tags.all)}</h2><p class="nb-chips">${NB.tags.list.filter((x) => counts[x.id]).map((x) => S.tagChip(x.id, { count: counts[x.id] })).join('')}</p></section>`
    const body = !t ? `<p class="nb-summary nb-lede">${esc(C.tags.none(id))}</p>` : `${g.groups.map((gr) => `<section class="nb-taggroup" data-sec="${esc(gr.section)}"><h2>${esc(gr.section === 'root' ? C.crumbRoot : C.sections[gr.section])} <span class="nb-taggroup__n">${esc(C.tags.count(gr.notes.length))}</span></h2>${S.linkList(gr.notes.map((n) => ({ note: n })))}</section>`).join('')}
      <p class="nb-fits__map"><a href="${esc(S.href('graph', `tag=${t.id}`))}">${esc(C.tags.onMap)}</a></p>`
    el.col.innerHTML = `<article class="nb-note nb-tagpage" data-tag="${esc(id)}">
      ${NB.share.bylineHtml()}
      <p class="nb-meta nb-kicker"><span class="nb-k nb-k--sec">${esc(C.tags.kicker)}</span>${t ? `<span class="nb-k">${esc(C.tags.count(g.n))}</span>` : ''}</p>
      <h1 class="nb-title" tabindex="-1">${t ? `<span class="nb-chip__g" data-tone="${t.tone}" aria-hidden="true">${esc(t.glyph)}</span> ` : ''}${esc(C.tags.title(name))}</h1>
      ${t ? `<p class="nb-summary nb-lede">${esc(C.tags.lines[t.id] || '')}</p>` : ''}
      ${body}${every}</article>`
    el.margin.innerHTML = ''
    markTree(null)
    el.main.scrollTop = 0
    if (phone()) scrollTo(0, 0)
    NB.controls.arrived(null, q)
    if (S.focusTitle) { S.focusTitle = false; el.col.querySelector('.nb-title').focus({ preventScroll: true }) }
  }
  S.showTag = showTag

  // ── the full graph: desktop only (≥ 900 px); a phone gets the map as a list ────────────
  S.graphOpen = new Set()
  function showGraph(q) {
    S.state = { ...S.state, view: 'graph', q, route: 'graph' }
    el.root.dataset.view = 'graph'
    el.root.dataset.sec = 'root'
    document.documentElement.classList.add('nb-graph')
    el.graphBtn.setAttribute('aria-pressed', 'true')
    document.title = C.title(S.cap(C.graphTitle))
    renderPath(null, true)
    S.graphPhone = phone()
    S.graphTag = NB.tags.get(q.get('tag')) ? q.get('tag') : null
    if (S.graphPhone) {
      el.col.innerHTML = mapList()
      bindMapList(el.col.querySelector('.nb-maplist'))
      if (S.graphTag) S.mapFilter('#' + S.graphTag)
      scrollTo(0, 0)
    } else {
      el.col.innerHTML = `<h1 class="nb-sr" tabindex="-1">${esc(C.list.title)}</h1><div class="nb-graph-host" style="height:100%"></div>`
      graphView(el.col.querySelector('.nb-graph-host'), q.get('focus'))
    }
    NB.controls.arrived(null, q)
    popOnArrival(q)
  }
  S.graphFilters = { 'agent-reliability': true, builds: true, writing: true }
  // round 6: one tag at a time, on the map and on the phone's list (the same control)
  const tagSelect = () => `<label class="nb-graph__tag"><span>${esc(C.tags.filter)}</span><select aria-label="${esc(C.tags.filterLabel)}"><option value="">${esc(C.tags.any)}</option>${NB.tags.list.map((t) => `<option value="${t.id}"${S.graphTag === t.id ? ' selected' : ''}>${esc(t.glyph)} ${esc(C.tags.names[t.id])}</option>`).join('')}</select></label>`
  // the layout for the open tracks, warm from the seed (cached per set of open tracks)
  const views = new Map(), layouts = new Map()
  // a label's real width: the text face at the label's weight, an ID at the start in mono
  const pen = document.createElement('canvas').getContext('2d')
  const measure = (line, size) => {
    const sans = getComputedStyle(el.col).fontFamily, mono = getComputedStyle(el.root).getPropertyValue('--mono') || 'monospace'
    const id = /^(T\d\d|PW\d|W\d)(?= )/.exec(line)
    pen.font = `500 ${size}px ${sans}`
    const rest = pen.measureText(id ? line.slice(id[0].length) : line).width
    if (!id) return rest
    pen.font = `400 ${size}px ${mono}`
    return rest + pen.measureText(id[0]).width
  }
  // the labels are sized for the view they are drawn in (≥ 13.5 px once fitted)
  function mapView(vw = 900, vh = 800) {
    const v = V(), open = [...S.graphOpen].sort().join(',')
    const g = NB.graph.view(v.notes, v.edges.map((e) => ({ a: e.a.route, b: e.b.route, kind: e.kind })), S.graphOpen)
    const L0 = layouts.get(open)
    const L = L0 && L0.vault === v ? L0.L : NB.graph.layout(g.nodes, g.edges, { seed: NB.graphSeed })
    layouts.set(open, { vault: v, L })
    const size = NB.graph.labelSize(g.nodes, L.pos, vw, vh, { lh: LH })
    const k = `${open}@${size.F}`
    if (views.has(k) && views.get(k).vault === v) return views.get(k)
    const regions = Object.keys(S.graphFilters).map((sec) => ({ key: `region:${sec}`, section: sec, text: C.sections[sec] }))
    const at = NB.graph.labels(g.nodes, L.pos, labelOf, { F: size.F, RF: size.F * 1.43, lh: LH, open: S.graphOpen, regions, margin: size.margin, measure })
    const res = { vault: v, g, L, at, regions, F: size.F }
    views.set(k, res)
    return res
  }
  S.mapView = mapView
  const keyHtml = () => `<section class="nb-key" aria-label="${esc(C.legend)}"><h2 class="nb-key__head">${esc(C.legend)}</h2>
    <p>${esc(C.key.dot)} ${esc(C.key.line)} ${esc(C.key.dotted)}</p>
    <h3 class="nb-key__head">${esc(C.key.colours)}</h3><ul class="nb-key__list">${Object.keys(S.graphFilters).map((s) => `<li data-sec="${s}"><span class="nb-key__sw" aria-hidden="true"></span>${esc(C.sections[s])}</li>`).join('')}<li data-sec="tours"><span class="nb-key__sw" aria-hidden="true"></span>${esc(C.sections.tours)}</li></ul>
    <h3 class="nb-key__head">${esc(C.key.shapesHead)}</h3><ul class="nb-key__list nb-key__shapes">${['hub', 'doc', 'stage', 'track', 'topic', 'build', 'post', 'walkthrough'].map((t) => `<li><svg class="nb-key__shape" viewBox="-10 -10 20 20" width="20" height="20" aria-hidden="true">${shapeSvg(t, t === 'topic' ? 4.5 : 6.5)}</svg>${esc(C.shapes[t])}</li>`).join('')}</ul></section>`
  function graphView(host, focus) {
    host.innerHTML = `<div class="nb-graph">
      <div class="nb-graph__bar">${Object.keys(S.graphFilters).map((s) => `<button type="button" data-filter="${s}" data-sec="${s}" aria-pressed="${S.graphFilters[s]}" aria-label="${esc(C.filterLabel(C.filters[s], S.graphFilters[s]))}"><span class="nb-key__sw" aria-hidden="true"></span>${esc(C.filters[s])}</button>`).join('')}
        ${tagSelect()}<button type="button" data-fit aria-label="${esc(C.fitLabel)}">${esc(C.fit)}</button><span class="nb-graph__hint">${esc(C.graphHint)}</span></div>
      <div class="nb-graph__body">
        <div class="nb-graph__view"><svg class="nb-g nb-g--full" role="group" aria-label="${esc(C.graphLabel2)}"><g class="nb-g__world"></g></svg></div>
        <aside class="nb-graph__side"><section class="nb-card" aria-label="${esc(C.card.label)}" aria-live="polite" hidden></section>${keyHtml()}</aside>
      </div>
    </div>`
    const svg = host.querySelector('svg'), world = svg.querySelector('.nb-g__world'), viewEl = host.querySelector('.nb-graph__view'), card = host.querySelector('.nb-card')
    let M = null, sel = null
    const draw = () => {
      const vr = svg.getBoundingClientRect()
      M = mapView(vr.width, vr.height)
      LF = M.F; RF = M.F * 1.43
      world.style.setProperty('--lf', `${LF}px`)
      const { g, L, at, regions } = M
      const edges = g.edges.map((e) => { const a = L.pos[e.a], b = L.pos[e.b]; return a && b ? `<line class="e${e.kind === 'tour' ? ' e--tour' : e.kind === 'track' ? ' e--track' : ''}" data-a="${esc(e.a)}" data-b="${esc(e.b)}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>` : '' }).join('')
      const regs = regions.map((r) => { const a = at[r.key]; return a ? `<text class="rg" data-sec="${r.section}" x="${a.x}" y="${(a.y + RF * 0.95).toFixed(1)}">${esc(r.text)}</text>` : '' }).join('')
      world.innerHTML = `${regs}${edges}${g.nodes.map((d) => { const p = L.pos[d.key]; return nodeSvg(d, p[0], p[1], at[d.key]) }).join('')}`
      filter()
      if (sel) light(sel)
    }
    // one ref for the transform; written from rAF only. Labels under 12 px on screen are hidden,
    // not drawn small: the flag sits on the view's box, outside the SVG
    const cam = { s: 1, x: 0, y: 0 }
    let dirty = true, raf = 0, tiny = null
    const frame = () => {
      raf = 0
      if (!dirty) return
      dirty = false
      world.setAttribute('transform', `translate(${cam.x.toFixed(2)} ${cam.y.toFixed(2)}) scale(${cam.s.toFixed(4)})`)
      const t = (cam.s * LF < 12 ? 'l' : '') + (cam.s * RF < 12 ? 'r' : '')
      if (t !== tiny) { tiny = t; viewEl.dataset.tiny = t }
    }
    const kick = () => { dirty = true; if (!raf) raf = requestAnimationFrame(frame) }
    // fit every node and every label that is shown
    const bounds = () => {
      const pts = { ...M.L.pos }
      for (const [k, a] of Object.entries(M.at)) if (a.shown) { pts[k + ':0'] = [a.x, a.y]; pts[k + ':1'] = [a.x + a.w, a.y + a.h] }
      return pts
    }
    // M5: Fit and focus move the camera over 450 ms on the one easing (NB.motion.camera), still
    // through this one transform; a drag, a wheel or a pinch takes over at once
    let tw = null
    const write = (c) => { Object.assign(cam, c); dirty = true; frame() }
    const stopTween = () => { if (tw) { tw.stop(); tw = null } }
    const moveTo = (to, animate) => {
      stopTween()
      if (!animate) { Object.assign(cam, to); kick(); return }
      const r = svg.getBoundingClientRect()
      let t = null
      t = NB.motion.camera({ ...cam }, to, r.width, r.height, write, () => { if (tw === t) tw = null })
      if (t.on()) tw = t
    }
    const fit = (animate = true) => { const r = svg.getBoundingClientRect(); moveTo(NB.graph.fit(bounds(), r.width, r.height, 20, 14), animate) }
    const centre = (key, animate = true) => {
      const p = M.L.pos[key], r = svg.getBoundingClientRect()
      if (!p) return
      const f = NB.graph.fit(bounds(), r.width, r.height, 20, 14), s = Math.min(6, Math.max(f.s, 1.15))
      moveTo({ s, x: r.width / 2 - p[0] * s, y: r.height / 2 - p[1] * s }, animate)
    }
    S.graphCam = cam
    S.graphFit = fit
    S.graphCentre = centre
    S.graphMoving = () => !!(tw && tw.on())
    // selection: the note, its neighbours lit, the rest faded, and the side card
    const light = (key) => {
      const nb = new Set([key])
      for (const ln of world.querySelectorAll('line.e')) { const on = ln.dataset.a === key || ln.dataset.b === key; ln.classList.toggle('is-lit', on); if (on) { nb.add(ln.dataset.a); nb.add(ln.dataset.b) } }
      for (const a of world.querySelectorAll('a.n')) { a.classList.toggle('is-sel', a.dataset.route === key); a.classList.toggle('is-lit', a.dataset.route !== key && nb.has(a.dataset.route)); a.classList.toggle('is-fade', !nb.has(a.dataset.route)) }
      world.classList.add('has-sel')
    }
    const unselect = () => {
      sel = null
      for (const x of world.querySelectorAll('.is-sel, .is-lit, .is-fade')) x.classList.remove('is-sel', 'is-lit', 'is-fade')
      world.classList.remove('has-sel')
      card.hidden = true
    }
    S.graphUnselect = unselect
    const select = (key) => {
      const d = M.g.nodes.find((x) => x.key === key)
      if (!d) return
      sel = key
      light(key)
      card.hidden = false
      if (d.type === 'track') {
        const t = trackNote(d.track), open = S.graphOpen.has(key)
        card.innerHTML = `<p class="nb-card__kicker" data-sec="${esc(d.section)}">${esc(C.sections[d.section])} · ${esc(C.shapes.track.split(' (')[0])}</p><h2 class="nb-card__title">${esc(t.name)}</h2><p class="nb-card__sum">${esc(C.track.done(t.done, t.of))}</p>
          <ul class="nb-card__list">${d.track.topics.map((x) => `<li><a href="${esc(S.href(x.route))}">${glyph(x)} ${nameHtml(x)}</a></li>`).join('')}</ul>
          <button type="button" class="nb-card__btn" data-track="${esc(key)}" aria-expanded="${open}">${esc(open ? C.track.collapse : C.track.expand(t.of))}</button>`
      } else {
        const n = V().get(key), st = C.status[n.status] || C.status.planned
        card.innerHTML = `<p class="nb-card__kicker" data-sec="${esc(n.section)}">${esc(C.sections[n.section] || n.section)} · ${esc(C.shapes[n.type] || n.type)} · <span data-st="${esc(n.status)}" aria-hidden="true">${esc(st[0])}</span> ${esc(st[1])}</p><h2 class="nb-card__title">${nameHtml(n)}</h2>${n.summary ? `<p class="nb-card__sum">${esc(n.summary)}</p>` : ''}<p><a class="nb-card__open" href="${esc(S.href(n.route))}">${esc(C.nodeOpen)}</a></p>`
      }
    }
    S.graphSelect = select
    const toggleTrack = (key) => {
      if (S.graphOpen.has(key)) S.graphOpen.delete(key); else S.graphOpen.add(key)
      draw()
      select(key)
    }
    S.graphToggle = toggleTrack
    const filter = () => {
      const tg = S.graphTag
      for (const a of svg.querySelectorAll('a.n')) a.classList.toggle('is-dim', (a.dataset.sec in S.graphFilters && !S.graphFilters[a.dataset.sec]) || (!!tg && !a.dataset.tags.split(' ').includes(tg)))
      for (const b of host.querySelectorAll('[data-filter]')) { const on = S.graphFilters[b.dataset.filter]; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', C.filterLabel(C.filters[b.dataset.filter], on)) }
    }
    draw()
    // labels are measured in the real face: if it was still loading, measure and draw again
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (svg.isConnected) { views.clear(); draw() } })
    // ?focus=<route>: a topic inside a folded track opens it first; then centre it, its neighbours lit
    let fkey = focus && V().get(focus) ? focus : null
    if (fkey && !M.L.pos[fkey]) { const t = M.g.groups.find((x) => x.topics.some((y) => y.route === fkey)); if (t) { S.graphOpen.add(t.key); draw() } }
    // M5: on open the sections fade in one after another (40 ms apart, 320 ms each; opacity only,
    // every position already final). ?focus= starts fitted and then moves to its note.
    // Reduced motion: the graph shows whole, and the camera jumps.
    intro()
    requestAnimationFrame(() => { fit(false); if (fkey && M.L.pos[fkey]) { centre(fkey); select(fkey) } })
    function intro() {
      if (NB.motion.reduced()) return
      const order = ['root', 'agent-reliability', 'builds', 'writing', 'tours'], D = NB.motion.D
      const at = (sec) => Math.max(0, order.indexOf(sec))
      const idx = new Map()
      const fade = (e, i) => NB.motion.play(e, [{ opacity: 0, offset: 0 }], D.cluster, { delay: i * D.stagger, fill: 'backwards', id: 'm5-in' })
      for (const a of world.querySelectorAll('a.n')) { const i = at(a.dataset.sec); idx.set(a.dataset.route, i); fade(a, i) }
      for (const t of world.querySelectorAll('.rg')) fade(t, at(t.dataset.sec))
      for (const ln of world.querySelectorAll('line.e')) fade(ln, Math.max(idx.get(ln.dataset.a) || 0, idx.get(ln.dataset.b) || 0))
    }
    host.querySelector('.nb-graph__tag select').addEventListener('change', (e) => { S.graphTag = e.target.value || null; filter() })
    S.graphSetTag = (t) => { S.graphTag = t || null; host.querySelector('.nb-graph__tag select').value = t || ''; filter() }
        host.querySelector('.nb-graph__bar').addEventListener('click', (e) => {
      const f = e.target.closest('[data-filter]')
      if (f) { S.graphFilters[f.dataset.filter] = !S.graphFilters[f.dataset.filter]; filter() }
      if (e.target.closest('[data-fit]')) fit()
    })
    card.addEventListener('click', (e) => { const b = e.target.closest('[data-track]'); if (b) toggleTrack(b.dataset.track) })
    // pan, zoom, pinch: pointer events → cam → one transform
    const pts = new Map()
    let moved = 0, last = null, pinch = null
    svg.addEventListener('pointerdown', (e) => { stopTween(); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; last = [e.clientX, e.clientY]; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: cam.s } } })
    svg.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return
      pts.set(e.pointerId, [e.clientX, e.clientY])
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()], r = svg.getBoundingClientRect()
        zoomAt((a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top, pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)
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
    svg.addEventListener('wheel', (e) => { e.preventDefault(); stopTween(); const r = svg.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, cam.s * Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.003)) }, { passive: false })
    // a click selects (the card says what it is and offers open →); a track opens or folds
    svg.addEventListener('click', (e) => {
      const a = e.target.closest('a.n')
      if (moved > 4) { e.preventDefault(); return }
      if (!a) { unselect(); return }
      e.preventDefault()
      if (a.dataset.type === 'track') toggleTrack(a.dataset.route)
      else select(a.dataset.route)
      if (NIGHT.sound) NIGHT.sound.cue('select')
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

  // ── the map as a list (phone): sections → folders → notes, with a filter on top ────────
  function mapList() {
    const t = V().tree
    const row = (n, label) => `<li><a class="nb-maplist__row" href="${esc(S.href(n.route))}" data-route="${esc(n.route)}">${glyph(n)}<span class="nb-maplist__name">${label || nameHtml(n)}</span></a></li>`
    const count = (f) => f.notes.length + (f.hub ? 1 : 0) + f.folders.reduce((a, s) => a + count(s), 0)
    const folder = (f, top) => {
      const name = top ? C.sections[f.path] || folderName(f.path) : folderName(f.path)
      const kids = (f.hub ? row(f.hub, esc(top ? S.cap(f.hub.title) : S.name(f.hub))) : '') + f.notes.map((n) => row(n)).join('') + f.folders.map((s) => `<li>${folder(s, false)}</li>`).join('')
      return `<details class="nb-maplist__${top ? 'sec' : 'folder'}" data-sec="${esc(secOf(f))}" data-folder="${esc(f.path)}"><summary><span class="nb-maplist__label">${esc(name)}</span><span class="nb-maplist__count">${esc(C.list.count(count(f)))}</span></summary><ul>${kids}</ul></details>`
    }
    return `<div class="nb-maplist"><h1 class="nb-title" tabindex="-1">${esc(C.list.title)}</h1>
      ${tagSelect()}<label class="nb-maplist__filter"><span class="nb-sr">${esc(C.list.filter)}</span><input type="search" autocomplete="off" spellcheck="false" placeholder="${esc(C.list.placeholder)}" aria-label="${esc(C.list.filter)}"></label>
      <p class="nb-maplist__none" hidden>${esc(C.list.none)}</p>
      ${t.folders.map((f) => folder(f, true)).join('')}</div>`
  }
  function bindMapList(box) {
    const input = box.querySelector('input'), none = box.querySelector('.nb-maplist__none')
    const all = [...box.querySelectorAll('details')]
    const apply = () => {
      const q = input.value.trim()
      const hits = q ? new Set(V().match(q).map((n) => n.route)) : null
      for (const a of box.querySelectorAll('.nb-maplist__row')) a.parentElement.hidden = !!hits && !hits.has(a.dataset.route)
      for (const d of all.slice().reverse()) {
        const any = !!d.querySelector('li:not([hidden]) > .nb-maplist__row')
        const li = d.parentElement.closest('li')
        if (li && box.contains(li)) li.hidden = !!hits && !any
        if (hits) { d.hidden = !any; d.open = any } else { d.hidden = false; d.open = false }
      }
      none.hidden = !hits || !!box.querySelector('li:not([hidden]) > .nb-maplist__row')
    }
    const sel = box.querySelector('.nb-graph__tag select')
    input.addEventListener('input', () => { const m = /^#(\S+)/.exec(input.value.trim()); sel.value = m && NB.tags.get(m[1]) ? m[1] : ''; apply() })
    sel.addEventListener('change', () => { input.value = sel.value ? `#${sel.value} ` : ''; apply() })
    S.mapFilter = (q) => { input.value = q; const m = /^#(\S+)/.exec(q.trim()); sel.value = m && NB.tags.get(m[1]) ? m[1] : ''; apply() }
  }

  // ?add=1: one more note, relaid out warm; the readout says how far the others moved
  S.addProof = () => {
    const before = mapView().L.pos
    NB.vault = buildVault({ 'agent-reliability/shopkeeper/08-test-note.md': `---\ntitle: "test note"\ntype: doc\nstatus: planned\nupdated: 2026-11-21\nsummary: "the ?add=1 proof"\ntags: [shopkeeper]\naliases: []\nlisten: true\nvisibility: public\nproject: shopkeeper\n---\n\nSee [[shopkeeper/spec]].\n` })
    const after = mapView().L.pos
    const mv = Object.keys(before).map((k) => Math.hypot(after[k][0] - before[k][0], after[k][1] - before[k][1])).sort((a, b) => a - b)
    renderTree()
    S.show()
    const med = mv[mv.length >> 1], max = mv[mv.length - 1]
    NB.trip.badge(C.proof.add(med.toFixed(2), max.toFixed(2)), med < 4 && max < 24)
    return { med, max, n: NB.vault.notes.length }
  }
})()
