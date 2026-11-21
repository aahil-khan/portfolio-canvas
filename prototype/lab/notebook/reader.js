/*
 * prototype/lab/notebook/reader.js: one note in the reading column, and the narrator that reads it.
 *
 *   NB.reader.render(note, q)   the kicker (one line), the title, the TL;DR lede, the tour banner,
 *                               the body (md.js), the stub slots, prev / next, and the note's end
 *                               (links out, backlinks, the local graph, tags) on every width
 *   NB.reader.toAnchor(id)      scroll to a heading or a table row (?a=p2) and mark it
 *   NB.reader.headings          the note's headings; .outline() the margin's (h2/h3, ≥ 3 or none)
 *   NB.reader.tables()          table furniture: edge fades, the scroll cue, the sticky ID column,
 *                               the phone's fold to 8 rows (re-run on resize)
 *
 *   NB.narrator.press()         ▶ / l: play this note (on a walkthrough: the whole tour)
 *   .toggle() .stop() .seek(±s) .seekEnd() .part(k) .active() .navigated(note, q) .left()
 *   While it plays: focus mode is on (restored at the end), and the page follows the word only
 *   while the reader has not scrolled for 4 s; otherwise the strip offers "↓ back to narration".
 *
 * THE NARRATOR. A note is read part by part: the title, then each block md.spoken says (prose,
 * lists, headings word for word; a table, a figure or a formula as one line). Each part is one
 * voice.js target, rendered live for sam and synth, so any phone can listen. At a part's end the
 * next one loads and plays; at a note's end inside a tour, the next step opens and plays. A
 * manual navigation pauses it and the strip offers resume. NOTHING AUTOPLAYS: play() only ever
 * follows a press.
 */
;(() => {
  const NB = (window.NB = window.NB || {})
  const C = NB.copy, MD = NB.md, esc = MD.escape
  const V = () => NB.vault
  const S = () => NB.shell
  const R = (NB.reader = { headings: [] })
  const asset = (src) => (/^data:/.test(src) ? src : (NB.publicRoot || '../../../public') + src)

  // "2026-11-20" → "20 Nov"
  const day = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d)); return m ? `${+m[3]} ${C.months[+m[2] - 1]}` : String(d) }
  R.day = day
  const author = () => new URLSearchParams(location.search).get('hidden') === '1'

  // the kicker: one line, plain words. section · folder · status · read time · updated
  function kicker(note) {
    const v = V(), st = C.status[note.status] || C.status.planned, c = v.clock(note)
    const sec = note.section, top = note.route.split('/')[0]
    const folder = note.isHub || !note.folder || note.folder === top ? '' : v.folderTitle(note.folder)
    const k = (cls, html) => `<span class="nb-k nb-k--${cls}">${html}</span>`
    const items = [
      k('sec', `<span class="nb-k__dot" aria-hidden="true">●</span> <span class="nb-k__name">${esc(C.sections[sec] || sec)}</span>`),
      folder ? k('folder', esc(S().cap(folder))) : '',
      note.id ? k('id', esc(note.id)) : '',
      k('status', `<span aria-hidden="true" data-st="${esc(C.status[note.status] ? note.status : 'planned')}">${esc(st[0])}</span> ${esc(st[1])}`),
      c.read ? k('read', `${esc(C.minShort(Math.max(1, Math.round(c.read))))}<span class="nb-k__unit">${esc(C.readUnit)}</span>`) : '',
      note.updated ? k('upd', esc(C.updated(day(note.updated)))) : '',
    ]
    // the author view keeps the internal labels: the number, the type, visibility, PROPOSAL
    if (author()) items.push(
      k('num', `<b>${esc(note.isHub ? '00' : note.num)}</b>`), k('type', esc(C.types[note.type] || note.type)),
      k('vis', `<span class="nb-meta__vis" title="${esc(C.visibilityLabel(note.visibility))}">${esc(C.visibility[note.visibility])}</span>`),
      note.fm.proposal ? k('prop', `<span class="nb-proposal" title="${esc(C.proposalLabel)}">${esc(C.proposal)}</span>`) : '')
    return `<p class="nb-meta nb-kicker">${items.filter(Boolean).join('')}</p>`
  }

  R.render = (note, q) => {
    const v = V(), w = q.get('w'), pn = v.prevNext(note, w), ts = pn.tour
    const ctx = {
      resolve: (t) => { const n = v.resolve(t); return n && { href: v.href(n), id: n.id, title: v.label(n), label: n.title } },
      rowIds: v.rowIdsOf(note), row: (id) => v.rowHref(note, id), autolink: new URLSearchParams(location.search).get('autolink') !== '0',
      block: (id) => MD.render(MD.parse(v.blockMd(note, id)), { resolve: (t) => { const n = v.resolve(t); return n && { href: v.href(n), id: n.id, title: v.label(n), label: n.title } }, asset }).html,
      embed: (b, n) => NB.embeds.html(b, n, note), asset,
    }
    const out = MD.render(v.readBlocks(note), ctx)
    R.headings = out.headings
    R.figures = out.figures
    const stepText = (n) => n.id || (n.isHub ? S().cap(n.title) : `${n.num} ${n.title}`)
    const step = (n, dir) => n ? `<a href="${esc(S().href(n.route, ts && n.type !== 'walkthrough' ? `w=${w}` : ''))}" rel="${dir}" data-step="${dir}" aria-label="${esc((dir === 'prev' ? C.prevLabel : dir === 'next' ? C.nextLabel : C.upLabel)(v.label(n)))}">${dir === 'prev' ? esc(C.prev) + ' ' : dir === 'up' ? esc(C.up) + ' ' : ''}${esc(stepText(n))}${dir === 'next' ? ' ' + esc(C.next) : ''}</a>` : '<span></span>'
    const banner = ts ? `<nav class="nb-tour nb-callout" aria-label="${esc(C.tourBanner(ts.tour.id, ts.tour.title, ts.i + 1, ts.n))}"><b>${esc(ts.tour.id)} ${esc(ts.tour.title)}</b><span>${esc(C.tourOf(ts.i + 1, ts.n))}</span>${step(pn.prev, 'prev')}${step(pn.up, 'up')}${step(pn.next, 'next')}</nav>` : ''
    const outline = R.outline()
    const toc = outline.length ? `<details class="nb-toc-inline"><summary>${esc(C.onPage)}</summary><ul>${outline.map((x) => `<li><a href="${esc(S().href(note.route, `a=${x.id}${w ? '&w=' + w : ''}`))}">${esc(x.text)}</a></li>`).join('')}</ul></details>` : ''
    let body = out.html
    // a stub shows every part as a labelled empty slot, so what is left to fill is visible
    if (note.fm.stub) body = body.replace(/(<\/h2>)/g, `$1<p class="nb-slot">${esc(C.stubSlot)}</p>`)
    // a decision record's verdict is a note callout: the paragraph that opens "Decision:"
    if (note.fm.decision) body = body.replace(/<p((?: [^>]*)?)>(Decision:)/, '<p class="nb-callout nb-decision"$1>$2')
    const totals = note.type === 'walkthrough' ? (() => { const t = v.totals(note); return `<p class="nb-meta nb-totals">${esc(C.totals(t.n, t.read, t.listen))}</p>` })() : ''
    // the summary is the TL;DR, under the title; a missing or heading-list one is a slot for the author
    const L = v.ledeOf(note)
    const lede = L.why === 'ok' ? `<p class="nb-summary nb-lede">${esc(L.text)}</p>`
      : author() && L.why !== 'repeat' ? `<p class="nb-slot nb-lede-slot"><span class="nb-proposal">${esc(C.proposal)}</span> ${esc(C.ledeSlot)} (${esc(C.ledeSlotWhy[L.why])})</p>` : ''
    const title = note.isHub ? S().cap(note.title) : note.title
    S().el.col.innerHTML = `<article class="nb-note" data-route="${esc(note.route)}">
      ${kicker(note)}
      <h1 class="nb-title" tabindex="-1" data-say="title">${esc(title)}</h1>
      ${lede}
      ${banner}
      ${note.fm.stub ? `<p class="nb-stub nb-callout nb-callout--warn"><span data-st="stub" aria-hidden="true">${esc(C.status.stub[0])}</span> ${esc(C.stub)}</p>` : ''}
      ${totals}
      ${toc}
      <div class="nb-body">${body}</div>
      <nav class="nb-prevnext" aria-label="${esc(C.linksHead)}">${step(pn.prev, 'prev')}${step(pn.up, 'up')}${step(pn.next, 'next')}</nav>
      ${endLinks(note)}
    </article>`
    // a walkthrough's steps open inside the tour, so the banner and [ ] follow it
    if (note.type === 'walkthrough') for (const a of S().el.col.querySelectorAll('[data-block="steps"] a[href^="#/"]')) a.setAttribute('href', `${a.getAttribute('href')}?w=${note.id}`)
    statusGlyphs(S().el.col)
    NB.embeds.hydrate(S().el.col, note)
    S().bindLocal(S().el.col)
    R.tables()
    S().el.listenBtn.setAttribute('aria-label', note.type === 'walkthrough' ? C.listenTour(note.id) : C.listenLabel)
  }
  // a computed list (a tour's steps, a folder's contents, latest, stages) writes its status as a
  // glyph in the text: give each its status, so it takes the status colour
  const GLYPH = {}
  for (const [k, [g]] of Object.entries(C.status)) if (!GLYPH[g]) GLYPH[g] = k
  const GLYPHS = new RegExp(`(^|\\s)([${Object.keys(GLYPH).join('')}])(?=\\s)`, 'g')
  function statusGlyphs(root) {
    for (const blk of root.querySelectorAll('[data-block]')) {
      const w = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT), hits = []
      while (w.nextNode()) { GLYPHS.lastIndex = 0; if (GLYPHS.test(w.currentNode.nodeValue)) hits.push(w.currentNode) }
      for (const t of hits) {
        const span = document.createElement('span')
        span.innerHTML = esc(t.nodeValue).replace(GLYPHS, (m, pre, g) => `${pre}<span data-st="${GLYPH[g]}">${g}</span>`)
        t.replaceWith(...span.childNodes)
      }
    }
  }
  R.statusGlyphs = statusGlyphs
  // the outline: h2 and h3 only, and only when there are at least three of them
  R.outline = () => { const hs = R.headings.filter((x) => x.level <= 3); return hs.length >= 3 ? hs : [] }

  // the note's end, on every width: the local graph, links out and backlinks by section, the tags
  function endLinks(note) {
    const v = V(), out = v.out(note), back = v.back(note)
    const bySec = (ls, ctx) => {
      const groups = {}
      for (const l of ls) (groups[l.note.section] = groups[l.note.section] || []).push(l)
      return Object.entries(groups).map(([s, g]) => `<p class="nb-end__sec">${esc(C.sections[s] || s)}</p>${S().linkList(g, ctx)}`).join('')
    }
    const w = Math.min(420, Math.max(240, (S().el.col.clientWidth || innerWidth) - 32))
    const tags = note.tags.length ? `<p class="nb-tags"><span class="nb-end__sec">${esc(C.tagsHead)}</span> ${note.tags.map((t) => `<span class="nb-tag">#${esc(t)}</span>`).join(' ')}</p>` : ''
    return `<section class="nb-end" aria-label="${esc(C.linksHead)}"><h2 class="nb-end__head">${esc(C.linksHead)}</h2>${S().localGraph(note, w, 200)}
      <h3 class="nb-end__head">${esc(C.linksOut(out.length))}</h3>${out.length ? bySec(out, false) : `<p class="nb-end__none">${esc(C.noLinks)}</p>`}
      <h3 class="nb-end__head">${esc(C.linkedFrom(back.length))}</h3>${back.length ? bySec(back, true) : `<p class="nb-end__none">${esc(C.noLinks)}</p>`}${tags}</section>`
  }

  // tables: an edge fade on the side that scrolls, a "scroll →" cue until the first scroll, the
  // ID column's width for the sticky column, and a fold to 8 rows on a phone past 15
  const FOLD_AT = 15
  R.tables = () => {
    for (const w of S().el.col.querySelectorAll('.nb-table-wrap')) {
      const sc = w.querySelector('.nb-table')
      if (!w.dataset.ready) {
        w.dataset.ready = '1'
        if (+w.dataset.rows > FOLD_AT) {
          w.dataset.folded = 'true'
          w.insertAdjacentHTML('beforeend', `<button type="button" class="nb-rows-btn" data-rows-toggle aria-expanded="false">${esc(C.showRows(+w.dataset.rows))}</button>`)
        }
        w.insertAdjacentHTML('afterbegin', `<span class="nb-table__cue" aria-hidden="true">${esc(C.tableCue)}</span>`)
        sc.addEventListener('scroll', () => { w.dataset.scrolled = '1'; edge(w, sc) }, { passive: true })
      }
      const id = w.classList.contains('has-ids') && sc.querySelector('td.nb-td-id')
      if (id) w.style.setProperty('--stick', `${id.offsetWidth}px`)
      edge(w, sc)
    }
  }
  function edge(w, sc) {
    const max = sc.scrollWidth - sc.clientWidth
    w.dataset.scroll = max <= 1 ? '' : sc.scrollLeft < 1 ? 'right' : sc.scrollLeft >= max - 1 ? 'left' : 'both'
  }
  const foldRows = (w, open) => {
    w.dataset.folded = open ? 'false' : 'true'
    const b = w.querySelector('[data-rows-toggle]')
    if (b) { b.textContent = open ? C.fewerRows : C.showRows(+w.dataset.rows); b.setAttribute('aria-expanded', String(open)) }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rows-toggle]')
    if (b) foldRows(b.closest('.nb-table-wrap'), b.closest('.nb-table-wrap').dataset.folded === 'true')
  })

  R.toAnchor = (id) => {
    const col = S().el.col
    const t = col.querySelector(`#${CSS.escape(id)}`)
    if (!t) return
    for (const x of col.querySelectorAll('.is-target')) x.classList.remove('is-target')
    const w = t.closest('.nb-table-wrap[data-folded="true"]')
    if (w) foldRows(w, true)
    t.classList.add('is-target')
    t.scrollIntoView({ block: 'start' })
  }

  // ── the lightbox ──────────────────────────────────────────────────────────────────────
  let lbx = null
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.nb-fig__img')
    if (!b) return
    const img = b.querySelector('img'), cap = b.closest('figure').querySelector('figcaption')
    if (!lbx) {
      lbx = document.createElement('div')
      lbx.className = 'nb-layer nb-lbx'
      lbx.innerHTML = `<figure role="dialog" aria-modal="true"><img alt=""><figcaption></figcaption><button type="button" data-close style="margin-top:6px">${esc(C.figClose)}</button></figure>`
      lbx.addEventListener('click', (ev) => { if (ev.target === lbx || ev.target.closest('[data-close]')) S().closeLayer(lbx) })
      document.body.appendChild(lbx)
    }
    lbx.querySelector('img').src = img.src
    lbx.querySelector('img').alt = img.alt
    lbx.querySelector('figcaption').textContent = cap ? cap.textContent : ''
    lbx.hidden = false
    S().layer(lbx, b)
    lbx.querySelector('[data-close]').focus()
  })

  // ── the narrator ──────────────────────────────────────────────────────────────────────
  const voice = () => NIGHT.voice
  const G = () => NIGHT.logic
  const N = (NB.narrator = {})
  const st = { note: null, tour: null, step: 0, parts: [], k: 0, on: false, resume: null, auto: false, wrapped: null, focusWas: null }
  N.state = st
  const partsOf = (note) => {
    const v = V()
    const said = MD.spoken(v.readBlocks(note), { lines: C.say, block: (id) => v.blockSpoken(note, id) })
    return [{ i: 'title', text: note.title }, ...said]
  }
  N.active = () => st.on
  N.press = () => {
    const n = S().state.note
    if (!n) return
    if (st.on && st.note === n) return N.toggle()
    if (st.resume && st.resume.note === n) return N.resumeTour()
    if (n.type === 'walkthrough') {
      const w = n
      start(w.steps[0], { tour: w, step: 0, navigate: true })
    } else {
      const q = S().state.q, ts = q.get('w') && V().tourStep(n, q.get('w'))
      start(n, ts ? { tour: ts.tour, step: ts.i } : {})
    }
  }
  // focus mode comes on while narration plays, and goes back to what it was when it stops; a reader
  // who presses f meanwhile has decided, and nothing is restored over them
  function focusOn() { if (st.focusWas === null) { st.focusWas = S().isFocus(); S().setFocus(true, false) } }
  function focusBack() { if (st.focusWas !== null) { const was = st.focusWas; st.focusWas = null; S().setFocus(was, false) } }
  N.focusTouched = () => { st.focusWas = null }
  function start(note, { tour = null, step = 0, navigate = false, k = 0 } = {}) {
    focusOn()
    userAt = -Infinity; oursUntil = now() + 400
    st.note = note; st.tour = tour; st.step = step; st.parts = partsOf(note); st.k = k; st.on = true; st.resume = null
    if (navigate) { st.auto = S().state.note !== note; S().go(note.route, tour ? `w=${tour.id}` : '') }
    loadPart(true)
  }
  function loadPart(play) {
    const p = st.parts[st.k]
    if (!p) return
    const words = G().tokens(p.text).map((t) => t.w)
    voice().load({ id: `${st.note.route}#${st.k}`, title: st.note.title, words, index: st.k + 1, of: st.parts.length, kind: 'section' })
    unwrap()
    if (play) voice().play()
    strip()
  }
  N.toggle = () => { if (!st.on) return; voice().toggle(); strip() }
  N.stop = () => { voice().stop(); voice().unload(); unwrap(); st.on = false; st.resume = null; closeMenu(); focusBack(); strip() }
  N.seek = (d) => { if (st.on) voice().seek(d) }
  // jump to part k of this note and play it
  N.part = (k) => { if (!st.on) return; st.k = Math.max(0, Math.min(st.parts.length - 1, k)); loadPart(true) }
  // jump to this note's last part, at its end: the next part (or step) follows
  N.seekEnd = () => {
    if (!st.on) return
    st.k = st.parts.length - 1
    loadPart(false)
    voice().play().then(() => { const s = voice().state(); voice().seek(s.dur) })
  }
  N.resumeTour = () => {
    const r = st.resume
    if (!r) return
    start(r.note, { tour: r.tour, step: r.step, k: r.k, navigate: S().state.note !== r.note })
  }
  // a navigation the narrator did not make pauses it, and the strip offers to resume
  N.navigated = () => {
    if (st.auto) { st.auto = false; return }
    if (!st.on) return
    voice().pause()
    unwrap()
    st.resume = { note: st.note, tour: st.tour, step: st.step, k: st.k }
    st.on = false
    strip()
  }
  voice().onend = () => {
    if (!st.on) return
    if (st.k < st.parts.length - 1) { st.k++; loadPart(true); return }
    if (st.tour && st.step < st.tour.steps.length - 1) {
      const next = st.tour.steps[st.step + 1]
      start(next, { tour: st.tour, step: st.step + 1, navigate: true })
      return
    }
    st.on = false
    unwrap()
    focusBack()
    strip()
  }

  // ── the word highlight: the current part's words, wrapped on demand ─────────────────────
  function partEl() {
    const p = st.parts[st.k]
    if (!p || S().state.note !== st.note) return null
    return S().el.col.querySelector(p.i === 'title' ? '[data-say="title"]' : `[data-say="${p.i}"]`)
  }
  function wrap(node, spoken) {
    const texts = []
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (/\S/.test(t.nodeValue) ? 1 : 2) })
    while (w.nextNode()) texts.push(w.currentNode)
    const spans = []
    for (const t of texts) {
      const frag = document.createDocumentFragment()
      for (const part of t.nodeValue.split(/(\s+)/)) {
        if (!part) continue
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue }
        const s = document.createElement('span')
        s.className = 'nb-word'
        s.textContent = part
        spans.push(s)
        frag.appendChild(s)
      }
      t.parentNode.replaceChild(frag, t)
    }
    const map = G().align(spans.map((s) => s.textContent), spoken)
    return { node, spans, map, html: null }
  }
  function unwrap() {
    if (!st.wrapped) return
    const { node, spans } = st.wrapped
    node.classList.remove('nb-say-on')
    for (const s of spans) if (s.parentNode) s.replaceWith(document.createTextNode(s.textContent))
    node.normalize()
    st.wrapped = null
  }
  let lastWord = -2
  function highlight(s) {
    if (!st.on) return
    const node = partEl()
    if (!node) return
    if (!st.wrapped || st.wrapped.node !== node) {
      unwrap()
      const p = st.parts[st.k]
      // a table, a figure or a formula is said as one line that is not on the page: mark the block
      const onPage = !/^(nb-table|nb-embed|nb-fig|nb-formula|nb-code)/.test(node.className) && node.tagName !== 'DIV'
      st.wrapped = onPage ? wrap(node, G().tokens(p.text).map((t) => t.w)) : { node, spans: [], map: [] }
      node.classList.add('nb-say-on')
    }
    const { spans, map } = st.wrapped
    if (s.word !== lastWord) {
      lastWord = s.word
      spans.forEach((sp, j) => sp.classList.toggle('is-on', map[j] === s.word))
    }
    // every tick: is what is being read still in view? (a table is one line, so its block counts)
    follow(spans.find((sp) => sp.classList.contains('is-on')) || node)
  }

  // ── following the word, without fighting the reader ────────────────────────────────────
  // The page follows the current word only while the reader has not scrolled for 4 s. Otherwise
  // the strip offers "↓ back to narration". A scroll counts as the reader's unless it is ours:
  // ours are marked for the second a smooth scroll takes. Reduced motion: LAB.sky.reduced.
  const QUIET_MS = 4000
  let userAt = -Infinity, oursUntil = 0, away = false
  const reduced = () => !!(window.LAB && LAB.sky && LAB.sky.reduced)
  const now = () => performance.now()
  const mark = () => { if (st.on && now() > oursUntil) userAt = now() }
  for (const t of ['wheel', 'touchmove']) addEventListener(t, () => { if (st.on) userAt = now() }, { passive: true, capture: true })
  addEventListener('keydown', (e) => { if (/^(PageUp|PageDown|Home|End|ArrowUp|ArrowDown)$/.test(e.key) || (e.key === ' ' && !st.on)) mark() }, true)
  addEventListener('scroll', mark, { passive: true, capture: true })
  const inView = (e) => { const r = e.getBoundingClientRect(), top = S().el.head.getBoundingClientRect().bottom; return r.bottom > top + 8 && r.top < innerHeight - 40 }
  function scrollToWord(e) {
    oursUntil = now() + (reduced() ? 150 : 1000)
    e.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' })
  }
  function follow(e) {
    const out = !inView(e)
    if (out && now() - userAt >= QUIET_MS) { scrollToWord(e); setAway(false); return }
    setAway(out)
  }
  function setAway(v) { if (away === v) return; away = v; strip() }
  N.backToWord = () => {
    userAt = -Infinity
    const e = (st.wrapped && st.wrapped.spans.find((x) => x.classList.contains('is-on'))) || partEl()
    if (e) scrollToWord(e)
    setAway(false)
  }
  N.following = () => !away

  // ── the strip ─────────────────────────────────────────────────────────────────────────
  const T = C.strip
  // the whole note's time left: this part's remaining seconds, then the parts after it at this
  // part's own pace (seconds per word), or at the listen clock's pace before the first render
  const wordsOf = (p) => G().tokens(p.text).length
  function left(s) {
    const cur = st.parts[st.k]
    if (!cur) return 0
    const spw = s.dur > 0 ? s.dur / Math.max(1, wordsOf(cur)) : 60 / 150 / (s.rate || 1)
    const after = st.parts.slice(st.k + 1).reduce((a, p) => a + wordsOf(p), 0)
    return Math.max(0, (s.dur || wordsOf(cur) * spw) - (s.t || 0)) + after * spw
  }
  N.left = () => left(voice().state())
  function strip() {
    const el = S().el.strip, s = voice().state()
    const show = st.on || !!st.resume
    if (el.hidden === show) el.hidden = !show
    if (!show) { el.innerHTML = ''; el.dataset.key = ''; closeMenu(); return }
    if (!st.on && st.resume) {
      el.dataset.key = 'resume'
      el.innerHTML = `<button type="button" class="nb-strip__resume" data-nb="resume" aria-label="${esc(T.resumeLabel(st.resume.tour ? st.resume.tour.id : st.resume.note.title))}">${esc(T.resume(st.resume.tour ? st.resume.tour.id : st.resume.note.title))}</button><span class="nb-strip__where"></span><button type="button" class="nb-strip__stop" data-nb="stop" aria-label="${esc(T.stopLabel)}">${esc(T.stop)}</button>`
      return
    }
    const where = st.tour ? T.tour(st.tour.id, st.step + 1, st.tour.steps.length, V().label(st.note)) : V().label(st.note)
    const tl = G().clock(left(s))
    const html = `<button type="button" class="nb-strip__play" data-nb="play" aria-label="${esc(s.playing ? T.pauseLabel : T.playLabel)}">${esc(s.playing ? T.pause : T.play)}</button>` +
      `<span class="nb-strip__where">${esc(where)}</span>` +
      (away ? `<button type="button" class="nb-strip__follow" data-nb="follow" aria-label="${esc(T.followLabel)}">${esc(T.follow)}</button>` : '') +
      `<span class="nb-strip__time" aria-label="${esc(T.leftLabel(tl))}">${esc(T.left(tl))}</span>` +
      `<button type="button" class="nb-strip__more" data-nb="more" aria-label="${esc(T.moreLabel)}" aria-expanded="${!menu().hidden}" aria-controls="nbStripMenu">${esc(T.more)}</button>` +
      `<button type="button" class="nb-strip__stop" data-nb="stop" aria-label="${esc(T.stopLabel)}">${esc(T.stop)}</button>`
    // rebuild only when what the strip says changes; the clock ticks in place
    const key = [s.playing, st.k, where, away, !menu().hidden].join('|')
    if (el.dataset.key !== key) { el.dataset.key = key; el.innerHTML = html }
    else el.querySelector('.nb-strip__time').textContent = T.left(tl)
    if (!menu().hidden) fillMenu(s)
  }
  N.strip = strip

  // ── ⋯ : seek, speed, voice and the level meter, out of the strip's way ──────────────────
  let menuEl = null
  function menu() {
    if (menuEl) return menuEl
    menuEl = document.createElement('div')
    menuEl.className = 'nb-strip-menu'
    menuEl.id = 'nbStripMenu'
    menuEl.setAttribute('role', 'group')
    menuEl.setAttribute('aria-label', T.moreLabel)
    menuEl.hidden = true
    S().el.head.appendChild(menuEl)
    return menuEl
  }
  function fillMenu(s) {
    const m = menu(), vname = (C.voices[s.voice] || {}).name || s.voice
    const key = [s.rate, s.voice, s.note].join('|')
    if (m.dataset.key !== key) {
      m.dataset.key = key
      m.innerHTML = `<button type="button" class="nb-strip__back" data-nb="back" aria-label="${esc(T.backLabel)}">${esc(T.back)}</button>` +
        `<button type="button" class="nb-strip__fwd" data-nb="fwd" aria-label="${esc(T.fwdLabel)}">${esc(T.fwd)}</button>` +
        `<button type="button" class="nb-strip__rate" data-nb="rate" aria-label="${esc(T.rateLabel(s.rate))}">${esc(T.speed)} ${s.rate}×</button>` +
        `<button type="button" class="nb-strip__voice" data-nb="voice" aria-label="${esc(T.voiceLabel(vname))}">${esc(T.voice)} ${esc(vname)}</button>` +
        `<span class="nb-strip__clock">${G().clock(s.t)}/${G().clock(s.dur)}</span>` +
        `<span class="nb-strip__wave" aria-hidden="true"></span>` +
        `<span class="nb-strip__note">${esc(s.note || '')}</span>`
    }
    m.querySelector('.nb-strip__clock').textContent = `${G().clock(s.t)}/${G().clock(s.dur)}`
    m.querySelector('.nb-strip__wave').textContent = s.peaks ? G().wave(s.peaks, s.perSec, s.t, 10, !s.playing) : ''
  }
  function openMenu(from) { const m = menu(); m.hidden = false; fillMenu(voice().state()); S().layer(m, from, () => strip()); strip() }
  function closeMenu() { if (menuEl && !menuEl.hidden) S().closeLayer(menuEl) }
  document.addEventListener('click', (e) => {
    if (menuEl && !menuEl.hidden && !e.target.closest('.nb-strip-menu, [data-nb="more"]')) closeMenu()
    const b = e.target.closest('.nb-strip [data-nb], .nb-strip-menu [data-nb]')
    if (!b) return
    const a = b.dataset.nb
    if (a === 'play') N.toggle()
    else if (a === 'back') N.seek(-10)
    else if (a === 'fwd') N.seek(10)
    else if (a === 'rate') voice().cycleRate()
    else if (a === 'stop') N.stop()
    else if (a === 'resume') N.resumeTour()
    else if (a === 'follow') N.backToWord()
    else if (a === 'more') { if (menu().hidden) openMenu(b); else closeMenu() }
    else if (a === 'voice') {
      const ids = voice().IDS.filter((id) => voice().status(id) === 'ok')
      const cur = voice().state().voice
      const next = ids[(ids.indexOf(cur) + 1) % ids.length]
      const playing = voice().state().playing
      voice().use(next)
      loadPart(playing)
    }
    strip()
  })
  voice().on((s) => { highlight(s); strip() })
})()
