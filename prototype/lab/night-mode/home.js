/*
 * prototype/lab/night-mode/home.js: the Lab's home, THE DIRECTORY (research ★1A), on #19's dock
 * layout: the welcome beside the toy, then an `ls`-style listing of what is here.
 *
 *   ~/lab                                                        updated nov 2026
 *   1  work/          things that shipped and people use               6   aug 2026
 *   2  experiments/   on the bench: half-built, and honest about it    3   jul 2026
 *   3  research/      studies in chapters: long, measured, slow   1 · 3ch   nov 2026
 *   4  writing/       essays, and the write-ups behind the projects    8   aug 2026
 *   not sure where to start? → holt · the reliability study · the laptop that became my cloud
 *
 * A category expands in place: its entries as #19's dock rows (an entry expands again, text left,
 * screenshot right), a series as one row with its chapters indented under it. Keys 1–4 open a
 * category, ↑↓ walk every visible row, Enter / space expand, Esc folds back one level. The deck is
 * not navigation: this list is the only way around the Lab (plus the experimental compass).
 *
 *   NIGHT.home.mount(root)            builds into root (the Lab screen's main area)
 *   .go(catId)                        1–4: open that category and put the cursor on it
 *   .back() → bool                    Esc: fold the open entry, then the category, then the compass
 *   .first()                          where focus lands when the Lab opens by keyboard
 *   .render() → { kept, added, removed, changed }   re-render from LAB.pieces (the 20th piece)
 *   .select(rowId)                    open the row's category and expand it (&sel=)
 *   .setHome('dir' | 'radial')        the experimental compass (radial.js), or the directory
 * NIGHT.menu.target / .titleOf are what reader.js asks: where a closing post goes back to.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const M = () => NIGHT.model
  const C = () => NIGHT.copy
  const cue = (n, i) => NIGHT.sound && NIGHT.sound.cue(n, i)
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const phone = () => innerWidth < 700

  const H = (NIGHT.home = {})
  const st = { secs: [], cats: new Set(), open: null, rows: new Map(), home: 'dir' }
  let root = null, el = {}

  // ── markup ───────────────────────────────────────────────────────────────────────────────
  const welcome = () => { const w = C().welcome; return phone() ? [...w.slice(0, -1), C().welcomeTouch] : w }
  const hello = () => `<div class="hello"><p class="hello__1">${esc(welcome()[0])}</p>` +
    welcome().slice(1).map((l) => `<p class="hello__l">${esc(l)}</p>`).join('') +
    `<p class="keys" aria-hidden="true">${C().keys.map(([k, v]) => `<span class="keys__k">${esc(k)}</span> ${esc(v)}`).join('<span class="keys__sep"> · </span>')}</p></div>`
  const latest = () => { const all = st.secs.map((s) => s.upd).filter(Boolean); const key = (u) => { const [m, y] = u.split(' '); return y ? y + String(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m)).padStart(2, '0') : m + '00' }; return all.sort((a, b) => (key(a) < key(b) ? 1 : -1))[0] || '' }
  const titleOf = (id) => { const [sid, slug] = id.split('/'), s = st.secs.find((x) => x.id === sid), e = s && s.entries.find((x) => x.slug === slug); return e ? e.title : slug }
  const VIEW = () => `<div class="L L--dir" data-home="${st.home}"><header class="top">${hello()}<div class="toy-slot"></div></header>` +
    `<section class="dir" aria-labelledby="dir-h"><p class="dir__head"><span class="dir__root" id="dir-h">${esc(C().root)}</span>` +
    `<button type="button" class="act dir__rad" data-to-radial hidden>◎ ${esc(C().radial.back)}</button><span class="dir__upd">${esc(C().updated(latest()))}</span></p>` +
    `<p class="dir__note" data-touch-note hidden>${esc(C().radial.touch)}</p>` +
    `<ul class="dir__cats" aria-label="${esc(C().dirLabel)}">` +
    M().sectionsOf(st.secs).map((m) => `<li class="cat" data-sec="${m.id}">${M().catHtml(m)}` +
      `<ul class="dkl" id="catx-${m.id}" hidden>${st.secs.find((x) => x.id === m.id).entries.map((e) => M().rowHtml(e, m.id)).join('')}</ul></li>`).join('') +
    `</ul><p class="dir__start"><span class="dir__q">${esc(C().start)}</span> <span aria-hidden="true">→</span> ` +
    C().picks.filter(([s, slug]) => st.secs.some((x) => x.id === s && x.entries.some((e) => e.slug === slug))).map(([s, slug]) => `<button type="button" class="act" data-pick="${s}/${esc(slug)}" data-sec="${s}">${esc(titleOf(`${s}/${slug}`))}</button>`).join('<span class="dir__dot" aria-hidden="true"> · </span>') +
    `</p></section><div class="rad-host" hidden></div></div>`
  const remember = () => { st.rows = new Map(st.secs.flatMap((s) => s.entries.map((e) => [`${s.id}/${e.slug}`, M().rowHtml(e, s.id)]))) }
  const rowEl = (id) => root && root.querySelector(`[data-row="${CSS.escape(id)}"]`)
  const catEl = (id) => root && root.querySelector(`.cat[data-sec="${CSS.escape(id)}"]`)
  const placeToy = () => { const s = root.querySelector('.toy-slot'); if (s && NIGHT.toy.node && NIGHT.toy.node.parentNode !== s) s.appendChild(NIGHT.toy.node); NIGHT.toy.wake() }

  function paint() {
    root.innerHTML = VIEW()
    el = { L: root.firstElementChild, rad: root.querySelector('.rad-host'), dir: root.querySelector('.dir') }
    remember()
    placeToy()
    restore()
    mountRadial()
  }
  // after a repaint, the categories and the entry that were open are open again
  function restore() {
    for (const id of [...st.cats]) { st.cats.delete(id); openCat(id, { quiet: true }) }
    if (st.open) { const o = st.open; st.open = null; if (rowEl(o)) expand(o, { quiet: true }) }
  }

  // ── categories and entries, in place ────────────────────────────────────────────────────
  function openCat(id, { focus = false, quiet = false } = {}) {
    const c = catEl(id)
    if (!c) return
    c.querySelector('.cat__row').setAttribute('aria-expanded', 'true')
    c.querySelector('.dkl').hidden = false
    c.classList.add('is-open')
    st.cats.add(id)
    if (!quiet) cue('enter')
    if (focus) { c.querySelector('.cat__row').focus({ preventScroll: true }); inView(c.querySelector('.cat__row')) }
  }
  function closeCat(id) {
    const c = catEl(id)
    if (!c) return false
    if (st.open && st.open.split('/')[0] === id) collapse()
    c.querySelector('.cat__row').setAttribute('aria-expanded', 'false')
    c.querySelector('.dkl').hidden = true
    c.classList.remove('is-open')
    st.cats.delete(id)
    return true
  }
  function expand(id, { focus = false, quiet = false } = {}) {
    if (st.open && st.open !== id) collapse()
    const li = rowEl(id)
    if (!li) return
    const btn = li.querySelector('.dl__row'), box = li.querySelector('.dl__x')
    if (!box) { if (focus) btn.focus({ preventScroll: true }); return } // a series: its row opens the hub
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
  // keep what was opened in sight inside the screen's own scroller (the deck covers the bottom)
  const inView = (node) => {
    const r = node.getBoundingClientRect(), b = root.getBoundingClientRect(), foot = phone() ? 90 : 120
    if (r.bottom > b.bottom - foot) root.scrollTop += Math.min(r.top - b.top - 80, r.bottom - b.bottom + foot)
    else if (r.top < b.top + 10) root.scrollTop -= b.top + 10 - r.top
  }
  // every row the cursor can stand on, in order: categories, and the rows of the open ones
  const stops = () => [...root.querySelectorAll('.cat__row, .cat.is-open .dl__row, .cat.is-open .dl__c')]

  // ── the compass ──────────────────────────────────────────────────────────────────────────
  function mountRadial() {
    const R = NIGHT.radial
    if (!R) return
    R.mount(el.rad, M().sectionsOf(st.secs))
    R.onCommit = (id) => { setHome('dir', { quiet: true }); openCat(id, { focus: true }) }
    showHome()
  }
  function showHome() {
    const R = NIGHT.radial, want = st.home === 'radial', can = R && R.supported()
    const on = want && can
    el.L.dataset.home = on ? 'radial' : 'dir'
    el.rad.hidden = !on
    el.dir.hidden = on
    root.querySelector('[data-touch-note]').hidden = !(want && !can)
    root.querySelector('[data-to-radial]').hidden = !(st.radialFlag && can)
    if (R) { if (on && NIGHT.lab && NIGHT.lab.live()) R.start(); else R.stop() }
  }
  function setHome(h, { quiet = false } = {}) {
    st.home = h === 'radial' ? 'radial' : 'dir'
    showHome()
    if (!quiet && st.home === 'radial') { const b = root.querySelector('.rad__w'); if (b && document.activeElement && root.contains(document.activeElement)) b.focus({ preventScroll: true }) }
  }

  // ── input ────────────────────────────────────────────────────────────────────────────────
  function bind() {
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-read]')
      if (act) { cue('enter'); return NIGHT.reader.go(act.dataset.read, act.dataset.in, act) }
      const pick = e.target.closest('[data-pick]')
      if (pick) { const id = pick.dataset.pick; openCat(id.split('/')[0]); expand(id, { focus: true }); return }
      if (e.target.closest('[data-to-radial]')) return setHome('radial')
      const cat = e.target.closest('.cat__row')
      if (cat) { const id = cat.dataset.cat; if (st.cats.has(id)) closeCat(id); else openCat(id); return }
      const btn = e.target.closest('.dl__row')
      if (!btn) return
      const id = btn.parentElement.dataset.row
      if (st.open === id) collapse(); else expand(id)
    })
    root.addEventListener('keydown', (e) => {
      const k = e.key, here = e.target.closest && e.target.closest('.cat__row, .dl__row, .dl__c')
      if (!here) return
      const all = stops(), i = all.indexOf(here)
      let to = null
      if (k === 'ArrowDown' || k === 'j') to = all[Math.min(all.length - 1, i + 1)]
      else if (k === 'ArrowUp' || k === 'k') to = all[Math.max(0, i - 1)]
      else if (k === 'Home') to = all[0]
      else if (k === 'End') to = all[all.length - 1]
      else if (k === 'ArrowRight' && here.classList.contains('cat__row')) { openCat(here.dataset.cat); e.preventDefault(); return }
      else if (k === 'ArrowLeft') { const c = here.closest('.cat'); if (c) { closeCat(c.dataset.sec); c.querySelector('.cat__row').focus({ preventScroll: true }) } e.preventDefault(); return }
      else return
      e.preventDefault()
      e.stopPropagation()
      if (to && to !== here) { to.focus({ preventScroll: true }); inView(to); cue('cursor', all.indexOf(to) % 5) }
    })
  }

  // ── the API ──────────────────────────────────────────────────────────────────────────────
  H.mount = (r, { home = 'dir', radialFlag = false } = {}) => {
    root = r
    st.secs = M().build(LAB.pieces)
    st.home = home
    st.radialFlag = radialFlag
    bind()
    paint()
  }
  H.go = (id) => {
    if (!st.secs.some((s) => s.id === id)) return
    if (st.home === 'radial') setHome('dir', { quiet: true })
    openCat(id, { focus: true })
  }
  // Esc acts where the cursor is: the entry it is in, then the category, then (flag on) the compass
  H.back = () => {
    const a = document.activeElement, c = a && a.closest && a.closest('.cat')
    const li = a && a.closest && a.closest('.dl.is-open')
    if (li && st.open === li.dataset.row) { collapse(); li.querySelector('.dl__row').focus({ preventScroll: true }); return true }
    if (c && st.cats.has(c.dataset.sec)) { closeCat(c.dataset.sec); c.querySelector('.cat__row').focus({ preventScroll: true }); return true }
    if (st.radialFlag && st.home === 'dir' && NIGHT.radial && NIGHT.radial.supported()) { setHome('radial'); return true }
    return false
  }
  H.first = () => (st.home === 'radial' && el.rad && !el.rad.hidden ? root.querySelector('.rad__w') : root.querySelector('.cat__row'))
  H.select = (id) => { const s = id.split('/')[0]; if (st.home === 'radial') setHome('dir', { quiet: true }); openCat(s, { quiet: true }); if (id.includes('/')) expand(id, { quiet: true }) }
  H.openCat = (id) => openCat(id, { quiet: true })
  H.root = () => root
  H.sections = () => st.secs
  H.home = () => (el.L ? el.L.dataset.home : st.home)
  H.setHome = setHome
  H.setRadialFlag = (on) => { st.radialFlag = !!on; setHome(on ? 'radial' : 'dir') }
  H.live = () => showHome() // the Lab opened or closed: the compass's pointer loop follows
  H.commitKey = (key) => (st.home === 'radial' && el.rad && !el.rad.hidden && NIGHT.radial ? NIGHT.radial.commitKey(key) : false)

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
    // the new piece's category opens, as a visitor would go and look
    for (const id of out.added) st.cats.add(id.split('/')[0])
    const toy = NIGHT.toy.node
    root.replaceChildren(t.content)
    el = { L: root.firstElementChild, rad: root.querySelector('.rad-host'), dir: root.querySelector('.dir') }
    const s = root.querySelector('.toy-slot')
    if (s && toy) s.appendChild(toy)
    st.rows = fresh
    const open = st.open
    st.open = null
    for (const id of [...st.cats]) { const c = catEl(id); if (c) { c.querySelector('.cat__row').setAttribute('aria-expanded', 'true'); c.querySelector('.dkl').hidden = false; c.classList.add('is-open') } }
    if (open && rowEl(open) && rowEl(open).classList.contains('is-open')) st.open = open
    mountRadial()
    root.scrollTop = scroll
    return out
  }

  // ── what reader.js asks: where a closing post goes back to, and the title it flies from ──
  NIGHT.menu = {
    target: (section, slug) => {
      const ser = section === 'research' && M().seriesOf(slug)
      if (ser) {
        openCat('research', { quiet: true })
        const li = rowEl(`research/${ser.series.slug}`)
        if (!li) return null
        return ser.chapter ? li.querySelector(`[data-ch="${CSS.escape(slug)}"]`) : li.querySelector('.dl__row')
      }
      const ids = [`${section}/${slug}`, `work/${slug}`].filter((id) => rowEl(id))
      if (!ids.length) return null
      const id = ids[0]
      openCat(id.split('/')[0], { quiet: true })
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
