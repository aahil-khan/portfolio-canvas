/*
 * prototype/lab/notebook/reader.js: one note in the reading column, and the narrator that reads it.
 *
 *   NB.reader.render(note, q)   the metadata line, the title, the tour banner, the body (md.js),
 *                               the stub slots, prev / next, and the note-end links (narrow screens)
 *   NB.reader.toAnchor(id)      scroll to a heading or a table row (?a=p2) and mark it
 *   NB.reader.headings          the note's outline, for the margin
 *
 *   NB.narrator.press()         ▶ / l: play this note (on a walkthrough: the whole tour)
 *   .toggle() .stop() .seek(±s) .seekEnd() .active() .navigated(note, q)
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

  R.render = (note, q) => {
    const v = V(), w = q.get('w'), pn = v.prevNext(note, w), ts = pn.tour
    const ctx = {
      resolve: (t) => { const n = v.resolve(t); return n && { href: v.href(n), id: n.id, title: v.label(n), label: n.title } },
      rowIds: v.rowIdsOf(note), row: (id) => v.rowHref(note, id), autolink: new URLSearchParams(location.search).get('autolink') !== '0',
      block: (id) => MD.render(MD.parse(v.blockMd(note, id)), { resolve: (t) => { const n = v.resolve(t); return n && { href: v.href(n), id: n.id, title: v.label(n), label: n.title } }, asset }).html,
      embed: (b, n) => NB.embeds.html(b, n, note), asset,
    }
    const out = MD.render(note.blocks, ctx)
    R.headings = out.headings
    R.figures = out.figures
    const c = v.clock(note), st = C.status[note.status] || C.status.planned
    const meta = [
      `<b>${esc(note.id || (note.isHub ? '00' : note.num))}</b>`, esc(C.types[note.type] || note.type),
      `<span aria-label="${esc(st[1])}">${esc(st[0])} ${esc(st[1])}</span>`,
      note.updated ? esc(C.updated(note.updated)) : '',
      c.read ? esc(C.minRead(Math.max(1, Math.round(c.read)))) : '',
      ...note.tags.map((t) => `#${esc(t)}`),
      `<span class="nb-meta__vis" title="${esc(C.visibilityLabel(note.visibility))}">${esc(C.visibility[note.visibility])}</span>`,
      note.fm.proposal ? `<span class="nb-proposal" title="${esc(C.proposalLabel)}">${esc(C.proposal)}</span>` : '',
    ].filter(Boolean)
    const step = (n, dir) => n ? `<a href="${esc(S().href(n.route, ts && n.type !== 'walkthrough' ? `w=${w}` : ''))}" rel="${dir}" aria-label="${esc((dir === 'prev' ? C.prevLabel : dir === 'next' ? C.nextLabel : C.upLabel)(v.label(n)))}">${dir === 'prev' ? esc(C.prev) + ' ' : dir === 'up' ? esc(C.up) + ' ' : ''}${esc(n.id || (n.isHub ? n.title + '/' : `${n.num} ${n.title}`))}${dir === 'next' ? ' ' + esc(C.next) : ''}</a>` : '<span></span>'
    const banner = ts ? `<nav class="nb-tour" aria-label="${esc(C.tourBanner(ts.tour.id, ts.tour.title, ts.i + 1, ts.n))}"><b>${esc(ts.tour.id)} ${esc(ts.tour.title)}</b><span>${esc(C.tourOf(ts.i + 1, ts.n))}</span>${step(pn.prev, 'prev')}${step(pn.up, 'up')}${step(pn.next, 'next')}</nav>` : ''
    const toc = out.headings.length > 1 ? `<details class="nb-toc-inline"><summary>${esc(C.onPage)}</summary><ul>${out.headings.filter((x) => x.level <= 3).map((x) => `<li><a href="${esc(S().href(note.route, `a=${x.id}${w ? '&w=' + w : ''}`))}">${esc(x.text)}</a></li>`).join('')}</ul></details>` : ''
    let body = out.html
    // a stub shows every part as a labelled empty slot, so what is left to fill is visible
    if (note.fm.stub) body = body.replace(/(<\/h2>)/g, `$1<p class="nb-slot">${esc(C.stubSlot)}</p>`)
    const totals = note.type === 'walkthrough' ? (() => { const t = v.totals(note); return `<p class="nb-meta">${esc(C.totals(t.n, t.read, t.listen))}</p>` })() : ''
    const showSummary = ['doc', 'walkthrough', 'log', 'topic'].includes(note.type) && note.summary && note.type !== 'topic'
    S().el.col.innerHTML = `<article class="nb-note" data-route="${esc(note.route)}">
      <p class="nb-meta">${meta.join(' · ')}</p>
      <h1 class="nb-title${note.isHub && note.route ? ' nb-title--hub' : ''}" tabindex="-1" data-say="title">${esc(note.isHub && note.route ? note.title + '/' : note.title)}</h1>
      ${banner}
      ${note.fm.stub ? `<p class="nb-stub">${esc(C.status.stub[0])} ${esc(C.stub)}</p>` : ''}
      ${showSummary ? `<p class="nb-summary">${esc(note.summary)}</p>` : ''}
      ${totals}
      ${toc}
      <div class="nb-body">${body}</div>
      <nav class="nb-prevnext" aria-label="${esc(C.linksHead)}">${step(pn.prev, 'prev')}${step(pn.up, 'up')}${step(pn.next, 'next')}</nav>
      ${endLinks(note)}
    </article>`
    // a walkthrough's steps open inside the tour, so the banner and [ ] follow it
    if (note.type === 'walkthrough') for (const a of S().el.col.querySelectorAll('[data-block="steps"] a[href^="#/"]')) a.setAttribute('href', `${a.getAttribute('href')}?w=${note.id}`)
    NB.embeds.hydrate(S().el.col, note)
    S().bindLocal(S().el.col)
    S().el.listenBtn.setAttribute('aria-label', note.type === 'walkthrough' ? C.listenTour(note.id) : C.listenLabel)
  }

  // the note's end on narrow screens: a radial first hop, then links out and backlinks by section
  function endLinks(note) {
    const v = V(), out = v.out(note), back = v.back(note)
    const bySec = (ls) => {
      const groups = {}
      for (const l of ls) (groups[l.note.section] = groups[l.note.section] || []).push(l)
      return Object.entries(groups).map(([s, g]) => `<p style="margin:6px 0 2px;color:var(--lab-dim)">${esc(C.filters[s] || s)}</p>${S().linkList(g, false)}`).join('')
    }
    const w = Math.min(358, Math.max(240, innerWidth - 32))
    return `<section class="nb-end" aria-label="${esc(C.linksHead)}"><h2>${esc(C.linksHead)}</h2>${S().localGraph(note, w, 200)}
      <h2 style="margin-top:12px">${esc(C.linksOut(out.length))}</h2>${out.length ? bySec(out) : `<p>${esc(C.noLinks)}</p>`}
      <h2 style="margin-top:12px">${esc(C.linkedFrom(back.length))}</h2>${back.length ? bySec(back) : `<p>${esc(C.noLinks)}</p>`}</section>`
  }

  R.toAnchor = (id) => {
    const col = S().el.col
    const t = col.querySelector(`#${CSS.escape(id)}`)
    if (!t) return
    for (const x of col.querySelectorAll('.is-target')) x.classList.remove('is-target')
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
  const st = { note: null, tour: null, step: 0, parts: [], k: 0, on: false, resume: null, auto: false, wrapped: null }
  N.state = st
  const partsOf = (note) => {
    const v = V()
    const said = MD.spoken(note.blocks, { lines: C.say, block: (id) => v.blockSpoken(note, id) })
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
  function start(note, { tour = null, step = 0, navigate = false, k = 0 } = {}) {
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
  N.stop = () => { voice().stop(); voice().unload(); unwrap(); st.on = false; st.resume = null; strip() }
  N.seek = (d) => { if (st.on) voice().seek(d) }
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
      const r = node.getBoundingClientRect(), top = S().el.head.getBoundingClientRect().bottom
      if (r.top < top || r.top > innerHeight - 60) node.scrollIntoView({ block: 'center' })
    }
    if (s.word === lastWord) return
    lastWord = s.word
    const { spans, map } = st.wrapped
    spans.forEach((sp, j) => sp.classList.toggle('is-on', map[j] === s.word))
  }

  // ── the strip ─────────────────────────────────────────────────────────────────────────
  const T = C.strip
  function strip() {
    const el = S().el.strip, s = voice().state()
    const show = st.on || !!st.resume
    if (el.hidden === show) el.hidden = !show
    if (!show) { el.innerHTML = ''; el.dataset.key = ''; return }
    if (!st.on && st.resume) {
      el.dataset.key = 'resume'
      el.innerHTML = `<button type="button" class="nb-strip__resume" data-nb="resume" aria-label="${esc(T.resumeLabel(st.resume.tour ? st.resume.tour.id : st.resume.note.title))}">${esc(T.resume(st.resume.tour ? st.resume.tour.id : st.resume.note.title))}</button><span class="nb-strip__where"></span><button type="button" data-nb="stop" aria-label="${esc(T.stopLabel)}">${esc(T.stop)}</button>`
      return
    }
    const where = st.tour ? T.tour(st.tour.id, st.step + 1, st.tour.steps.length, V().label(st.note)) : V().label(st.note)
    const wave = s.peaks ? G().wave(s.peaks, s.perSec, s.t, 10, !s.playing) : ''
    const vname = (C.voices[s.voice] || {}).name || s.voice
    const html = `<button type="button" class="nb-strip__back" data-nb="back" aria-label="${esc(T.backLabel)}">${esc(T.back)}</button>` +
      `<button type="button" class="nb-strip__play" data-nb="play" aria-label="${esc(s.playing ? T.pauseLabel : T.playLabel)}">${esc(s.playing ? T.pause : T.play)}</button>` +
      `<button type="button" class="nb-strip__fwd" data-nb="fwd" aria-label="${esc(T.fwdLabel)}">${esc(T.fwd)}</button>` +
      `<button type="button" class="nb-strip__rate" data-nb="rate" aria-label="${esc(T.rateLabel(s.rate))}">${s.rate}×</button>` +
      `<span class="nb-strip__where">${esc(where)} · ${esc(T.part(st.k + 1, st.parts.length))}</span>` +
      `<span class="nb-strip__time">${G().clock(s.t)}/${G().clock(s.dur)}</span>` +
      `<span class="nb-strip__wave" aria-hidden="true">${esc(wave)}</span>` +
      `<span class="nb-strip__note">${esc(s.note || '')}</span>` +
      `<button type="button" class="nb-strip__voice" data-nb="voice" aria-label="${esc(T.voiceLabel(vname))}">${esc(vname)}▾</button>` +
      `<button type="button" data-nb="stop" aria-label="${esc(T.stopLabel)}">${esc(T.stop)}</button>`
    // rebuild only when what the strip says changes; the clock and the wave tick in place
    const key = [s.playing, st.k, s.voice, s.rate, where, s.note].join('|')
    if (el.dataset.key !== key) { el.dataset.key = key; el.innerHTML = html; return }
    el.querySelector('.nb-strip__time').textContent = `${G().clock(s.t)}/${G().clock(s.dur)}`
    el.querySelector('.nb-strip__wave').textContent = wave
  }
  N.strip = strip
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.nb-strip [data-nb]')
    if (!b) return
    const a = b.dataset.nb
    if (a === 'play') N.toggle()
    else if (a === 'back') N.seek(-10)
    else if (a === 'fwd') N.seek(10)
    else if (a === 'rate') voice().cycleRate()
    else if (a === 'stop') N.stop()
    else if (a === 'resume') N.resumeTour()
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
