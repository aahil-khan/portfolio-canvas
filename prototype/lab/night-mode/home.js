/*
 * prototype/lab/night-mode/home.js: the Lab's home. The welcome beside the toy, the ask hero, and
 * THE LIVING TILES: work, experiments, research, writing, each with a small looping ASCII vignette
 * (vignette.js), its name, one line on what is in it, and a count.
 *
 *   welcome to the lab.                                                     [toy]   [next]
 *   [▶ what am i working on?]  (something interesting) (a joke)
 *   > the answer types out here, in time with the voice reading it
 *   ┌ 1 work/ ─────── 6 ┐ ┌ 2 experiments/ ─ 3 ┐ ┌ 3 research/ ── 1·3ch ┐ ┌ 4 writing/ ──── 8 ┐
 *   │  vignette          │ │  vignette           │ │  vignette             │ │  vignette          │
 *   │  one line          │ │  one line           │ │  one line             │ │  one line          │
 *   └────────────────────┘ └─────────────────────┘ └───────────────────────┘ └────────────────────┘
 *
 * At rest the vignettes run slow and dim. Hover or focus wakes a tile: its vignette speeds up and
 * brightens, and its line swaps, in place, for a peek at the latest 2–3 things inside (in place,
 * so a hover never moves anything else). Click or Enter opens the category.
 *
 * AN OPEN CATEGORY is its own view: its vignette awake in the header, its rows with a tiny status
 * glyph each (● live ✓ done ◐ in progress, turning ◌ shelved ¶ post ↗ elsewhere ○ planned), and,
 * where there is room and a pointer, a preview pane that follows the row under the pointer or
 * the cursor. There a click opens the row (the reader, or the pane's links); on a narrow screen
 * the row expands in place instead. A series is one row, `3 of ~6 ▓▓▓░░░`, its chapters under it.
 *
 * Keys: 1–4 open a category, arrows walk the tiles or the rows, Enter opens, Esc goes back one
 * level. The deck is not navigation; this is (plus the experimental dial, which only calls go()).
 *
 *   NIGHT.home.mount(root)            builds into root (the Lab screen's main area)
 *   .go(catId)                        open that category, the cursor on its first row
 *   .back() → bool                    Esc: fold the open row, then the category back to the tiles
 *   .first()                          where focus lands when the Lab opens by keyboard
 *   .ask(id)                          the hero and its chips: an answer types out, the voice reads it
 *   .render() → { kept, added, removed, changed }   re-render from LAB.pieces (the 20th piece)
 *   .select(rowId)                    open the row's category and show it (&sel=)
 *   .live()                           the Lab opened or closed: the vignettes follow
 * NIGHT.menu.target / .titleOf are what reader.js asks: where a closing post goes back to.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const M = () => NIGHT.model
  const C = () => NIGHT.copy
  const VG = () => NIGHT.vignette
  const V = () => NIGHT.voice
  const G = () => NIGHT.logic
  const cue = (n, i) => NIGHT.sound && NIGHT.sound.cue(n, i)
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const phone = () => innerWidth < 700
  // the preview pane needs the width for two columns, and a pointer to follow
  const paned = () => matchMedia('(min-width: 1000px)').matches

  const H = (NIGHT.home = {})
  const st = { secs: [], view: 'home', cat: null, open: null, rows: new Map(), seen: {}, answer: null, vg: [] }
  let root = null, el = {}

  // ── markup ───────────────────────────────────────────────────────────────────────────────
  const welcome = () => { const w = C().welcome; return phone() ? [...w.slice(0, -1), C().welcomeTouch] : w }
  const hero = () => {
    const A = C().ask, [now, ...rest] = A.prompts
    return `<div class="hero" role="group" aria-label="${esc(A.label)}">` +
      `<button type="button" class="hero__go" data-ask="${now.id}"><span class="hero__p" aria-hidden="true">▶</span> ${esc(now.q)}</button>` +
      rest.map((p) => `<button type="button" class="chip" data-ask="${p.id}" aria-label="${esc(p.q)}">${esc(p.chip)}</button>`).join('') + `</div>` +
      `<div class="ans" hidden><p class="ans__q"></p><p class="ans__t" aria-live="polite"></p><p class="ans__mark"></p></div>`
  }
  const hello = () => `<div class="hello"><p class="hello__1">${esc(welcome()[0])}</p>` +
    welcome().slice(1).map((l) => `<p class="hello__l">${esc(l)}</p>`).join('') + `</div><div class="ask">${hero()}</div>`
  const latest = () => { const all = st.secs.map((s) => s.upd).filter(Boolean); const key = (u) => { const [m, y] = u.split(' '); return y ? y + String(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m)).padStart(2, '0') : m + '00' }; return all.sort((a, b) => (key(a) < key(b) ? 1 : -1))[0] || '' }
  const titleOf = (id) => { const [sid, slug] = id.split('/'), s = st.secs.find((x) => x.id === sid), e = s && s.entries.find((x) => x.slug === slug); return e ? e.title : slug }
  // the latest 2–3 things inside a category, for the peek
  const peekOf = (s) => {
    if (s.id === 'research') return s.entries.flatMap((e) => [`${e.title} · ${C().series.of(e.written, e.planned)}`, ...e.chapters.slice().reverse().slice(0, 2).map((c) => `${String(c.n).padStart(2, '0')} ${c.title}`)]).slice(0, 3)
    return s.entries.slice(0, 3).map((e) => s.id === 'experiments' ? `${e.n} ${e.title}` : `${e.title}${e.when || e.year ? ' · ' + (e.when || e.year) : ''}`)
  }
  const linesOf = (s) => (s.id === 'writing' ? s.entries.slice(0, 4).map((e) => e.title) : [])
  const count = (m) => (m.id === 'research' ? C().sections.research.short(m.count, m.chapters) : String(m.count))
  const tileHtml = (m) => {
    const s = st.secs.find((x) => x.id === m.id)
    return `<li class="tile" data-sec="${m.id}"><button type="button" class="tile__b" id="tile-${m.id}" data-cat="${m.id}" aria-keyshortcuts="${m.key}" aria-describedby="tile-${m.id}-d">` +
      `<span class="tile__top"><span class="tile__k" aria-hidden="true">${esc(m.key)}</span><span class="tile__t">${esc(m.id)}/</span><span class="tile__n" aria-label="${esc(m.unit)}">${esc(count(m))}</span></span>` +
      `<span class="vg" data-vg="${m.id}" aria-hidden="true"></span>` +
      `<span class="tile__body"><span class="tile__d" id="tile-${m.id}-d">${esc(m.blurb)}</span>` +
      `<span class="tile__peek" aria-hidden="true">${peekOf(s).map((t) => `<span class="tile__pi">${esc(t)}</span>`).join('')}</span></span>` +
      `</button></li>`
  }
  const catHead = (m) => `<div class="cvh" data-sec="${m.id}" hidden><button type="button" class="act cvh__back" data-back aria-label="${esc(C().tiles.backLabel)}">← ${esc(C().tiles.back)}</button>` +
    `<div class="cvh__row"><span class="vg vg--head" data-vg="${m.id}" aria-hidden="true"></span><div class="cvh__txt"><h2 class="cvh__t">${esc(C().root)}/${esc(m.id)}/</h2>` +
    `<p class="cvh__d">${esc(m.blurb)}</p><p class="cvh__n">${esc(m.unit)} · ${esc(C().updated(m.upd))}</p></div></div></div>`
  const VIEW = () => {
    const metas = M().sectionsOf(st.secs)
    return `<div class="L" data-view="${st.view}"><header class="top">${hello()}${metas.map(catHead).join('')}<div class="toy-slot"></div></header>` +
      `<section class="tiles-wrap" aria-labelledby="dir-h"><p class="dir__head"><span class="dir__root" id="dir-h">${esc(C().root)}</span><span class="dir__upd">${esc(C().updated(latest()))}</span></p>` +
      `<ul class="tiles" aria-label="${esc(C().tiles.label)}">${metas.map(tileHtml).join('')}</ul>` +
      `<p class="keys" aria-hidden="true">${C().keys.map(([k, v]) => `<span class="keys__k">${esc(k)}</span> ${esc(v)}`).join('<span class="keys__sep"> · </span>')}</p></section>` +
      `<section class="cv" aria-label="${esc(C().dirLabel)}">` +
      metas.map((m) => `<div class="cvs" data-sec="${m.id}" hidden><ul class="dkl" id="catx-${m.id}" aria-labelledby="cvh-${m.id}">${st.secs.find((x) => x.id === m.id).entries.map((e) => M().rowHtml(e, m.id)).join('') || `<li class="dl__none">${esc(C().tiles.empty)}</li>`}</ul>` +
        `<aside class="pane" aria-label="${esc(C().tiles.preview)}" aria-live="polite"></aside></div>`).join('') +
      `</section></div>`
  }
  const remember = () => { st.rows = new Map(st.secs.flatMap((s) => s.entries.map((e) => [`${s.id}/${e.slug}`, M().rowHtml(e, s.id)]))) }
  const rowEl = (id) => root && root.querySelector(`[data-row="${CSS.escape(id)}"]`)
  const cvs = (id) => root.querySelector(`.cvs[data-sec="${CSS.escape(id)}"]`)
  const placeToy = () => { const s = root.querySelector('.toy-slot'); if (s && NIGHT.toy.node && NIGHT.toy.node.parentNode !== s) s.appendChild(NIGHT.toy.node); NIGHT.toy.wake() }

  // ── the vignettes: one per tile, one per category header, and the rows' turning ◐ ───────
  function attachVignettes() {
    for (const h of st.vg) h.detach()
    st.vg = []
    VG().prune()
    for (const n of root.querySelectorAll('.vg[data-vg]')) {
      const s = st.secs.find((x) => x.id === n.dataset.vg)
      const h = VG().attach(n, n.dataset.vg, { lines: linesOf(s), awake: n.classList.contains('vg--head') })
      h.node = n
      st.vg.push(h)
    }
    for (const n of root.querySelectorAll('.dl__g[data-g="spin"]')) st.vg.push(VG().attach(n, 'spin'))
  }
  const tileVg = (id) => st.vg.find((h) => h.node && !h.node.classList.contains('vg--head') && h.node.dataset.vg === id)
  function wake(tile, on) {
    if (!tile) return
    tile.classList.toggle('is-awake', on)
    const h = tileVg(tile.dataset.sec)
    if (h) h.wake(on)
  }

  function paint() {
    root.innerHTML = VIEW()
    el = { L: root.firstElementChild, ans: root.querySelector('.ans') }
    remember()
    placeToy()
    attachVignettes()
    if (st.view === 'cat' && st.cat) openCat(st.cat, { quiet: true, keep: true })
  }

  // ── a category, opened: its own view ───────────────────────────────────────────────────
  function openCat(id, { focus = false, quiet = false, keep = false } = {}) {
    if (!st.secs.some((s) => s.id === id)) return
    if (st.cat && st.cat !== id) collapse()
    st.view = 'cat'
    st.cat = id
    el.L.dataset.view = 'cat'
    el.L.dataset.cat = id
    for (const n of root.querySelectorAll('.cvs, .cvh')) n.hidden = n.dataset.sec !== id
    for (const t of root.querySelectorAll('.tile.is-awake')) wake(t, false)
    if (!keep) root.scrollTop = 0
    const first = cvs(id).querySelector('.dl__row')
    if (paned()) pane(first ? first.closest('[data-row]').dataset.row : null)
    if (!quiet) cue('enter')
    if (focus && first) first.focus({ preventScroll: true })
  }
  function closeCat({ focus = true } = {}) {
    if (st.view !== 'cat') return false
    const id = st.cat
    collapse()
    st.view = 'home'
    st.cat = null
    el.L.dataset.view = 'home'
    delete el.L.dataset.cat
    for (const n of root.querySelectorAll('.cvs, .cvh')) n.hidden = true
    if (focus) { const t = root.querySelector(`#tile-${CSS.escape(id)}`); if (t) t.focus({ preventScroll: true }) }
    cue('chirp-close')
    return true
  }
  // the pane: whatever row the pointer or the cursor is on
  function pane(rowId, chapter) {
    if (!st.cat) return
    const p = cvs(st.cat).querySelector('.pane')
    if (!p || p.dataset.row === (rowId || '') + (chapter || '')) return
    p.dataset.row = (rowId || '') + (chapter || '')
    p.innerHTML = rowId ? (rowId.startsWith('research/') ? seriesPane(rowId, chapter) : M().previewHtml(st.secs, rowId)) : ''
    for (const n of root.querySelectorAll('.dl.is-pv')) n.classList.remove('is-pv')
    const li = rowId && rowEl(rowId)
    if (li) li.classList.add('is-pv')
  }
  function seriesPane(rowId, chapter) {
    const slug = rowId.split('/')[1], e = st.secs.find((s) => s.id === 'research').entries.find((x) => x.slug === slug)
    if (!e) return ''
    const S = C().series, c = chapter && e.chapters.find((x) => x.slug === chapter)
    return `<p class="pv__path">${esc(C().root)}/research/${esc(e.slug)}${c ? '/' + String(c.n).padStart(2, '0') : ''}</p>` +
      (e.placeholder ? `<p class="pv__sample">${esc(S.sample)}</p>` : '') +
      `<h3 class="pv__title">${esc(c ? c.title : e.title)}</h3>` +
      (c ? `<p class="pv__log">${esc(S.partOf(c.n, e.title))}</p><p class="pv__lede">${esc(S.chMeta(c.status, c.date, c.mins, G().clock(c.listen)))}</p>`
        : `<p class="pv__lede">${esc(e.question)}</p><p class="pv__log">${esc(S.status)}: ${esc(e.status)} · ${esc(S.of(e.written, e.planned))} ${G().bar(e.written, e.planned)}</p><p class="pv__log">${esc(S.totals(e.mins, G().clock(e.listen)))}</p>`) +
      `<p class="pv__act"><button type="button" class="act act--go" data-read="${esc(c ? c.slug : e.slug)}" data-in="research"><span class="act__k" aria-hidden="true">↵ </span>${esc(C().open)}</button></p>`
  }
  // a narrow screen has no pane: a row expands in place (text, then the screenshot)
  function expand(id, { focus = false, quiet = false } = {}) {
    if (st.open && st.open !== id) collapse()
    const li = rowEl(id)
    if (!li) return
    const btn = li.querySelector('.dl__row'), box = li.querySelector('.dl__x')
    if (!box) { if (focus) btn.focus({ preventScroll: true }); return }
    box.innerHTML = M().previewHtml(st.secs, id, { bare: true })
    box.hidden = false
    btn.setAttribute('aria-expanded', 'true')
    li.classList.add('is-open')
    st.open = id
    if (!quiet) cue('enter')
    if (focus) btn.focus({ preventScroll: true })
    inView(li)
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
  // a row pressed: with the pane, it opens (the reader, or the pane's first link); without, it
  // expands in place
  function press(li) {
    const id = li.dataset.row, [sid, slug] = id.split('/')
    if (!paned()) { if (st.open === id) collapse(); else expand(id); return }
    const e = st.secs.find((s) => s.id === sid).entries.find((x) => x.slug === slug)
    pane(id)
    if (e && e.read && sid !== 'work') { cue('enter'); NIGHT.reader.go(slug, sid, li.querySelector('.dl__row')); return }
    const go = cvs(sid).querySelector('.pane [data-read], .pane a[href]')
    if (go) go.focus({ preventScroll: true })
  }
  // keep what was opened in sight inside the screen's own scroller (the deck covers the bottom)
  const inView = (node) => {
    const r = node.getBoundingClientRect(), b = root.getBoundingClientRect(), foot = phone() ? 90 : 120
    if (r.bottom > b.bottom - foot) root.scrollTop += Math.min(r.top - b.top - 80, r.bottom - b.bottom + foot)
    else if (r.top < b.top + 10) root.scrollTop -= b.top + 10 - r.top
  }
  // every row the cursor can stand on in the open category, in order
  const stops = () => (st.cat ? [...cvs(st.cat).querySelectorAll('.dl__row, .dl__c')] : [])

  // ── ask: an answer types out under the hero, in time with the voice reading it ──────────
  H.ask = (id) => {
    const A = C().ask, P = A.prompts.find((p) => p.id === id)
    if (!P) return
    if (st.view === 'cat') closeCat({ focus: false })
    let text, mark
    if (id === 'now') { text = A.now.text; mark = A.now.mark }
    else { const r = G().pick(A[id], st.seen[id] || []); st.seen[id] = r.seen; text = A[id][r.i]; mark = A.authored }
    const words = G().tokens(text).map((t) => t.w)
    st.answer = { id, text, words }
    el.ans.hidden = false
    el.ans.querySelector('.ans__q').textContent = '?> ' + P.q
    el.ans.querySelector('.ans__mark').textContent = '# ' + mark
    el.ans.querySelector('.ans__t').textContent = ''
    for (const b of root.querySelectorAll('[data-ask]')) b.setAttribute('aria-pressed', String(b.dataset.ask === id))
    V().load({ id: 'ask:' + id, kind: 'answer', title: P.q, words, index: 0, of: 0 })
    V().play() // a press on the prompt is the press that plays it
    cue('enter')
  }
  // words up to the one being spoken are out; the current one types letter by letter
  function typeAnswer() {
    const a = st.answer, t = el.ans && el.ans.querySelector('.ans__t')
    if (!a || !t) return
    const s = V().state()
    if (s.id !== 'ask:' + a.id) { t.textContent = a.text; st.answer = null; for (const b of root.querySelectorAll('[data-ask]')) b.removeAttribute('aria-pressed'); NIGHT.deck.reloadPost(); return }
    if (LAB.sky.reduced || (!s.playing && s.t >= s.dur && s.dur)) { if (t.textContent !== a.text) t.textContent = a.text; return }
    const w = s.word, tm = V().timingsOf ? V().timingsOf() : null
    let out = a.words.slice(0, Math.max(0, w)).join(' ')
    if (w >= 0) {
      const cur = a.words[w], span = tm && tm[w] ? Math.max(0.05, tm[w].e - tm[w].s) : 0.3, f = tm && tm[w] ? Math.min(1, (s.t - tm[w].s) / span) : 1
      out += (w ? ' ' : '') + cur.slice(0, Math.max(1, Math.ceil(cur.length * f)))
    }
    if (t.textContent !== out + '▌') { t.textContent = out + '▌'; cue('key') }
  }
  H.stopAnswer = () => { if (!st.answer) return false; V().unload('ask:' + st.answer.id); typeAnswer(); return true }

  // ── input ────────────────────────────────────────────────────────────────────────────────
  function bind() {
    root.addEventListener('click', (e) => {
      const q = e.target.closest('[data-ask]')
      if (q) return H.ask(q.dataset.ask)
      if (e.target.closest('[data-back]')) return closeCat()
      const read = e.target.closest('[data-read]')
      if (read) { cue('enter'); return NIGHT.reader.go(read.dataset.read, read.dataset.in, read) }
      const tile = e.target.closest('.tile__b')
      if (tile) return openCat(tile.dataset.cat, { focus: e.detail === 0 })
      const btn = e.target.closest('.dl__row')
      if (btn) press(btn.closest('[data-row]'))
    })
    // waking a tile: the pointer over it, or the cursor on it
    const tileOf = (e) => e.target.closest && e.target.closest('.tile')
    root.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return
      const t = tileOf(e)
      if (t && !t.classList.contains('is-awake')) wake(t, true)
      const r = e.target.closest && e.target.closest('.dl__row, .dl__c')
      if (r && paned()) pane(r.closest('[data-row]').dataset.row, r.dataset.ch)
    })
    root.addEventListener('pointerout', (e) => {
      const t = tileOf(e)
      if (t && !t.contains(e.relatedTarget) && !t.contains(document.activeElement)) wake(t, false)
    })
    root.addEventListener('focusin', (e) => {
      const t = tileOf(e)
      if (t) wake(t, true)
      const r = e.target.closest && e.target.closest('.dl__row, .dl__c')
      if (r && paned()) pane(r.closest('[data-row]').dataset.row, r.dataset.ch)
    })
    root.addEventListener('focusout', (e) => {
      const t = tileOf(e)
      if (t && !t.contains(e.relatedTarget) && !t.matches(':hover')) wake(t, false)
    })
    root.addEventListener('keydown', (e) => {
      const k = e.key, tile = e.target.closest && e.target.closest('.tile__b')
      if (tile) {
        const all = [...root.querySelectorAll('.tile__b')], i = all.indexOf(tile)
        const cols = Math.max(1, Math.round(root.querySelector('.tiles').offsetWidth / tile.offsetWidth))
        const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[k]
        if (d == null) return
        e.preventDefault(); e.stopPropagation()
        const to = all[i + d] || (Math.abs(d) === 1 ? null : null)
        if (to) { to.focus({ preventScroll: true }); cue('cursor', i) }
        return
      }
      const here = e.target.closest && e.target.closest('.dl__row, .dl__c')
      if (!here) return
      const all = stops(), i = all.indexOf(here)
      let to = null
      if (k === 'ArrowDown' || k === 'j') to = all[Math.min(all.length - 1, i + 1)]
      else if (k === 'ArrowUp' || k === 'k') to = all[Math.max(0, i - 1)]
      else if (k === 'Home') to = all[0]
      else if (k === 'End') to = all[all.length - 1]
      else if (k === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); if (!collapse()) closeCat(); else here.focus({ preventScroll: true }); return }
      else if (k === 'ArrowRight' && here.classList.contains('dl__row') && !paned()) { e.preventDefault(); expand(here.closest('[data-row]').dataset.row); return }
      else return
      e.preventDefault()
      e.stopPropagation()
      if (to && to !== here) { to.focus({ preventScroll: true }); inView(to); cue('cursor', all.indexOf(to) % 5) }
    })
  }

  // ── the API ──────────────────────────────────────────────────────────────────────────────
  H.mount = (r) => {
    root = r
    st.secs = M().build(LAB.pieces)
    bind()
    paint()
    V().on(typeAnswer)
  }
  H.go = (id) => openCat(id, { focus: true })
  // Esc acts where the cursor is: the row open in place, then the category, back to the tiles
  H.back = () => {
    if (st.open) { const id = st.open; collapse(); const r = rowEl(id); if (r) r.querySelector('.dl__row').focus({ preventScroll: true }); return true }
    return closeCat()
  }
  H.first = () => (st.view === 'cat' && stops()[0]) || root.querySelector('.tile__b')
  H.select = (id) => { const s = id.split('/')[0]; openCat(s, { quiet: true }); if (id.includes('/')) { if (paned()) pane(id); else expand(id, { quiet: true }) } }
  H.openCat = (id) => openCat(id, { quiet: true })
  H.view = () => st.view
  H.cat = () => st.cat
  H.root = () => root
  H.sections = () => st.secs
  H.live = () => VG().live(!!(NIGHT.lab && NIGHT.lab.live()))

  // ── the 20th piece: re-render from LAB.pieces; an unchanged row keeps its DOM node ──────
  H.render = () => {
    const out = { kept: 0, added: [], removed: [], changed: [] }
    const next = M().build(LAB.pieces)
    out.changed = next.filter((s, i) => !st.secs[i] || s.count !== st.secs[i].count).map((s) => s.id)
    const fresh = new Map(next.flatMap((s) => s.entries.map((e) => [`${s.id}/${e.slug}`, M().rowHtml(e, s.id)])))
    const old = new Map([...root.querySelectorAll('[data-row]')].map((n) => [n.dataset.row, n]))
    out.before = old.size
    const scroll = root.scrollTop
    st.secs = next
    const t = document.createElement('template')
    t.innerHTML = VIEW()
    for (const n of [...t.content.querySelectorAll('[data-row]')]) {
      const id = n.dataset.row, o = old.get(id)
      if (o && st.rows.get(id) === fresh.get(id)) { n.replaceWith(o); out.kept++ } else if (!o) out.added.push(id)
      old.delete(id)
    }
    out.removed = [...old.keys()]
    const toy = NIGHT.toy.node
    root.replaceChildren(t.content)
    el = { L: root.firstElementChild, ans: root.querySelector('.ans') }
    const s = root.querySelector('.toy-slot')
    if (s && toy) s.appendChild(toy)
    st.rows = fresh
    attachVignettes()
    // the new piece's category opens, as a visitor would go and look
    const cat = out.added.length ? out.added[0].split('/')[0] : st.cat
    if (cat) openCat(cat, { quiet: true, keep: true })
    root.scrollTop = scroll
    return out
  }

  // ── what reader.js asks: where a closing post goes back to, and the title it flies from ──
  NIGHT.menu = {
    target: (section, slug) => {
      const ser = section === 'research' && M().seriesOf(slug)
      if (ser) {
        openCat('research', { quiet: true, keep: true })
        const li = rowEl(`research/${ser.series.slug}`)
        if (!li) return null
        return ser.chapter ? li.querySelector(`[data-ch="${CSS.escape(slug)}"]`) : li.querySelector('.dl__row')
      }
      const ids = [`${section}/${slug}`, `work/${slug}`].filter((id) => rowEl(id))
      if (!ids.length) return null
      const id = ids[0]
      openCat(id.split('/')[0], { quiet: true, keep: true })
      if (paned()) { pane(id); return rowEl(id).querySelector('.dl__row') }
      if (st.open !== id) expand(id, { quiet: true })
      return rowEl(id).querySelector(`.dl__x [data-read="${CSS.escape(slug)}"]`) || rowEl(id).querySelector('.dl__row')
    },
    titleOf: (node) => {
      if (!node) return null
      const row = node.closest('[data-row]')
      if (node.classList.contains('dl__c')) return node.querySelector('.dl__ct')
      return (row && row.querySelector('.dl__t')) || node
    },
  }
})()
