/*
 * prototype/lab/night-mode/reader.js: a post, or a log, as a page of its own.
 *
 *   NIGHT.reader.mount()                    builds the reader (fixed, over the Lab screen)
 *   NIGHT.reader.go(slug, section, from)    opens it from the row or button `from`, by setting the
 *                                           hash (#/writing/<slug> or #/experiments/<slug>), so it
 *                                           deep-links and Back closes it
 *   NIGHT.reader.sync({ instant })          makes the reader match location.hash
 *   NIGHT.reader.dismiss()                  [x] close and Escape: the same as Back
 *   NIGHT.reader.isOpen(), .slug(), .body(piece, section)  (the page's markup, from LAB data only)
 *   NIGHT.reader.onchange = fn()            called when a post opens or has closed (the toy pauses)
 *
 * THE TRANSITION is #17's, unchanged. Opening grows the page out of what was clicked: a clip-path
 * from that rect to the whole viewport, while the title flies from the row's title to the post's
 * (an explicit FLIP: measured in screen space, translate + scale, then to identity) and the rest
 * fades up after it. Closing plays the same keyframes backwards, into the row of the post that is
 * open now. Reduced motion (LAB.sky.reduced, the one owner): a crossfade.
 *
 * THE PAGE: a header block framed in a 1px line (one of the two frames the Lab keeps, with figures), with the title in mono and file-style
 * metadata (file, date, read, project, tags); a table of contents beside the body on a wide
 * screen when the post has sections; figures as framed thumbnails with captions that enlarge in
 * place (a lightbox, Esc or ← → inside it), never full-bleed slabs; prev / next at the end.
 * The body is Space Grotesk at a 64ch measure.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
  const OPEN_MS = 560, CLOSE_MS = 480
  const reduced = () => LAB.sky.reduced
  const C = () => NIGHT.copy
  const M = () => NIGHT.model
  const ROUTE = /^#\/(writing|experiments)\/([a-z0-9-]+)$/

  const R = (NIGHT.reader = {})
  const st = { slug: null, section: null, from: null, pushed: false, pending: null, inert: [], fig: null }
  let el, scroller, page, bar, line, pct, path, lbx
  R.isOpen = () => !!st.slug
  R.slug = () => st.slug

  const lists = () => M().readable(LAB.pieces)
  const route = () => {
    const m = ROUTE.exec(location.hash)
    return m && (lists()[m[1]] || []).some((p) => p.slug === m[2]) ? { section: m[1], slug: m[2] } : null
  }

  // ── the page ─────────────────────────────────────────────────────────────────────────────
  const asset = (src) => LAB.asset(src)
  const capOf = (im, i) => C().fig(i + 1) + (im.caption ? ' · ' + im.caption : ' · ' + String(im.src).split('/').pop())
  // figures: one framed at the measure's width, or a grid of thumbnails; each enlarges on click
  const figures = (imgs, title, start = 0) => {
    if (!imgs.length) return ''
    const one = (im, k) => { const i = start + k; return  `<figure class="rd__fig"><button type="button" class="rd__zoom" data-fig="${i}" aria-label="${esc(C().enlarge(i + 1))}">` +
      `<img src="${esc(asset(im.src))}" alt="${esc(im.caption || title)}" loading="lazy"></button>` +
      `<figcaption><span class="rd__fign">${esc(C().fig(i + 1))}</span>${im.caption ? ' ' + esc(im.caption) : ''}</figcaption></figure>` }
    return `<div class="rd__figs" data-n="${imgs.length}" aria-label="${esc(C().figs)}" role="group">${imgs.map(one).join('')}</div>`
  }
  R.body = (p, section) => {
    const list = lists()[section] || [], i = list.findIndex((x) => x.slug === p.slug), e = list[i] || {}
    const href = (slug) => { const sec = Object.keys(lists()).find((k) => lists()[k].some((x) => x.slug === slug)); return sec ? `#/${sec}/${slug}` : '#' }
    const parts = M().parts(M().bodyOf(p)), sections = parts.filter((s) => s.title)
    const imgs = M().imagesOf(p), imported = M().imp(p)
    // an imported post keeps its figures where the author put them, and its ### subheadings
    let figN = 0
    const render = (b) => {
      const im = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(b.trim())
      if (im) return figures([{ src: im[2], caption: im[1] }], p.title, figN++)
      const h3 = /^###\s+(.+)$/.exec(b.trim())
      if (h3) return `<h3><span class="rd__hn" aria-hidden="true">### </span>${esc(h3[1])}</h3>`
      if (b.split('\n').every((l) => /^\d+\. /.test(l))) return '<ol>' + b.split('\n').map((l) => `<li>${LAB.body.render(l.replace(/^\d+\. /, ''), { href }).replace(/^<p>|<\/p>$/g, '')}</li>`).join('') + '</ol>'
      return LAB.body.render(b, { href })
    }
    // the figures go after the part that says what it is (or the first block), not at the top
    const figAt = sections.length ? parts.findIndex((s) => s.id === 'what') : 0
    const body = parts.map((s, k) => {
      const blocks = s.blocks.map(render).join('').replace(/`([^`<]+)`/g, '<code>$1</code>')
      const figs = !imported && k === Math.max(0, figAt) ? figures(imgs, p.title) : ''
      return s.title
        ? `<section class="rd__sec" id="rd-${esc(s.id)}" data-sec="${esc(s.id)}"><h2><span class="rd__hn" aria-hidden="true">## </span>${esc(s.title)}</h2>${blocks}${figs}</section>`
        : blocks + figs
    }).join('')
    const toc = sections.length >= 2
      ? `<nav class="rd__toc" aria-label="${esc(C().contents)}"><p class="rd__toch">${esc(C().contents)}</p><ol>` +
        sections.map((s, k) => `<li><button type="button" data-toc="${esc(s.id)}"><span class="rd__tocn">${String(k + 1).padStart(2, '0')}</span>${esc(s.title)}</button></li>`).join('') + '</ol></nav>'
      : ''
    // file-style metadata
    const f = (NIGHT.facts || {})[p.slug] || {}
    const proj = M().build(LAB.pieces)[0].entries.find((x) => x.slug === p.slug)
    const links = proj ? proj.links : []
    const exp = section === 'experiments' ? M().build(LAB.pieces)[1].entries.find((x) => x.slug === p.slug) : null
    const K = C().meta
    const meta = [
      [K.file, `<span class="rd__mono">${esc(C().file(section, p.slug))}</span>`],
      [K.date, esc(M().when(p))],
      [K.read, esc(C().minsRead(e.mins || M().minutes(M().bodyOf(p))))],
      imported && p.href ? [K.source, `<a class="act" href="${esc(p.href)}" rel="noopener">${esc(C().out(M().host(p.href)))}</a>`] : null,
      exp ? [K.log, esc([exp.n, exp.topic].filter(Boolean).join(' · '))] : null,
      proj ? [K.project, esc([p.title, proj.kind, proj.year].filter(Boolean).join(' · ')) + (links.length ? ' ' + links.map((l) => `<a class="act" href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a>`).join(' ') : '')] : null,
      p.status ? [K.status, `<span class="rd__st">${esc(p.status)}</span>`] : null,
      (f.stack || []).length || (exp && exp.topic) ? [K.tags, esc((f.stack || []).length ? f.stack.map((x) => x.toLowerCase()).join(' · ') : exp.topic)] : null,
    ].filter(Boolean)
    const nav = (x, dir) => x ? `<a class="rd__step rd__step--${dir}" href="#/${section}/${esc(x.slug)}">` +
      `<span class="rd__stepk">${dir === 'prev' ? '← ' + esc(C().prev) : esc(C().next) + ' →'}</span><span class="rd__stept">${esc(x.title)}</span>` +
      `<span class="rd__stepf">${esc(x.slug)}.md</span></a>` : '<span class="rd__step rd__step--none" aria-hidden="true"></span>'
    return `<div class="rd__grid${toc ? ' has-toc' : ''}">${toc}<article class="rd__post">` +
      `<header class="rd__head"><span class="rd__frame" aria-hidden="true"></span><span class="cut rd__fname" aria-hidden="true">${esc(p.slug)}.md</span>` +
      `<h1 class="rd__title" tabindex="-1">${esc(p.title)}</h1>` +
      (p.blurb ? `<p class="rd__lede">${esc(p.blurb)}</p>` : '') +
      `<dl class="rd__meta">${meta.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl></header>` +
      `<div class="rd__body">${body}</div>` +
      `<p class="rd__eof" aria-hidden="true">${esc(C().eof)}</p>` +
      `<nav class="rd__nav">${nav(list[i - 1], 'prev')}${nav(list[i + 1], 'next')}</nav></article></div>`
  }

  // ── chrome ───────────────────────────────────────────────────────────────────────────────
  R.mount = () => {
    el = h('div', 'reader')
    el.hidden = true
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.innerHTML =
      `<div class="rd__bar"><button type="button" class="rd__x" aria-label="${esc(C().closeLabel)}">${esc(C().close)}</button>` +
      `<span class="rd__path"></span><span class="rd__pct" aria-hidden="true"></span></div>` +
      `<div class="rd__line" role="progressbar" aria-label="${esc(C().progress)}" aria-valuemin="0" aria-valuemax="100"><i></i></div>` +
      `<div class="rd__scroll"><div class="rd__page"></div></div>` +
      `<div class="lbx" role="dialog" aria-modal="true" hidden><div class="lbx__bar"><span class="lbx__n"></span><span class="lbx__fill"></span>` +
      `<button type="button" class="act lbx__p" data-step="-1">← ${esc(C().prev)}</button><button type="button" class="act lbx__p" data-step="1">${esc(C().next)} →</button>` +
      `<button type="button" class="act lbx__x" aria-label="${esc(C().figClose)}">x</button></div>` +
      `<figure class="lbx__fig"><img alt=""><figcaption></figcaption></figure></div>`
    document.body.appendChild(el)
    scroller = el.querySelector('.rd__scroll')
    page = el.querySelector('.rd__page')
    bar = el.querySelector('.rd__bar')
    line = el.querySelector('.rd__line')
    pct = el.querySelector('.rd__pct')
    path = el.querySelector('.rd__path')
    lbx = el.querySelector('.lbx')
    el.querySelector('.rd__x').addEventListener('click', () => R.dismiss())
    scroller.addEventListener('scroll', progress, { passive: true })
    page.addEventListener('load', () => { if (!el.hidden) progress() }, true)
    addEventListener('resize', () => { if (!el.hidden) progress() })
    el.addEventListener('keydown', (e) => {
      if (st.fig) {
        if (e.key === 'Escape') { e.preventDefault(); figClose() }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); figStep(e.key === 'ArrowRight' ? 1 : -1) }
        else if (e.key === 'Tab') trap(e, lbx)
        e.stopPropagation()
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); R.dismiss(); return }
      if (e.key === 'Tab') trap(e, el)
      e.stopPropagation() // the Lab's keys (1 2 3 ~) are not for a page of text
    })
    el.addEventListener('click', (e) => {
      const z = e.target.closest('[data-fig]')
      if (z) return figOpen(+z.dataset.fig, z)
      const t = e.target.closest('[data-toc]')
      if (t) return toSection(t.dataset.toc)
      if (e.target.closest('.lbx__x') || e.target === lbx) return figClose()
      const s = e.target.closest('.lbx__p')
      if (s) return figStep(+s.dataset.step)
      const a = e.target.closest('a[href^="#/writing/"], a[href^="#/experiments/"]')
      if (!a) return
      e.preventDefault()
      // prev, next and links between posts swap in place: one history entry, so Back still closes
      try { location.replace(a.getAttribute('href')) } catch { location.hash = a.getAttribute('href') }
    })
    addEventListener('hashchange', () => R.sync())
  }
  const trap = (e, box) => {
    const f = [...box.querySelectorAll('button, a[href], [tabindex="-1"].rd__title')].filter((n) => n.offsetParent !== null && !n.closest('[hidden]') && (box === lbx || !n.closest('.lbx')))
    if (!f.length) return
    const first = f[0], last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  function progress() {
    const max = scroller.scrollHeight - scroller.clientHeight, f = max > 0 ? Math.min(1, scroller.scrollTop / max) : 1
    line.firstChild.style.transform = `scaleX(${f.toFixed(4)})`
    line.setAttribute('aria-valuenow', Math.round(f * 100))
    const n = Math.round(f * 10)
    pct.textContent = `[${'#'.repeat(n)}${'·'.repeat(10 - n)}] ${String(Math.round(f * 100)).padStart(3, ' ')}%`
    // the contents follow the reading: the last section whose heading has passed a third of the way down
    const toc = page.querySelectorAll('[data-toc]')
    if (toc.length) {
      const y = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.33
      let on = toc[0].dataset.toc
      for (const s of page.querySelectorAll('.rd__sec')) if (s.getBoundingClientRect().top <= y) on = s.dataset.sec
      if (max > 0 && scroller.scrollTop >= max - 2) on = toc[toc.length - 1].dataset.toc
      for (const b of toc) b.toggleAttribute('aria-current', b.dataset.toc === on)
    }
  }
  function toSection(id) {
    const s = page.querySelector(`#rd-${CSS.escape(id)}`)
    if (!s) return
    const top = s.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 24
    scroller.scrollTo({ top, behavior: reduced() ? 'auto' : 'smooth' })
    const hd = s.querySelector('h2')
    hd.tabIndex = -1
    hd.focus({ preventScroll: true })
  }
  // everything but the reader goes inert while it is open, so Tab and clicks stay on the page
  const setInert = (on) => {
    if (on) {
      st.inert = [...document.body.children].filter((n) => n !== el && !n.inert)
      st.inert.forEach((n) => { n.inert = true })
    } else { st.inert.forEach((n) => { n.inert = false }); st.inert = [] }
  }

  function fill(slug, section) {
    const p = LAB.pieces.find((x) => x.slug === slug)
    el.setAttribute('aria-label', p.title)
    el.dataset.section = section
    path.textContent = C().file(section, slug)
    page.innerHTML = R.body(p, section)
    scroller.scrollTop = 0
    if (!el.hidden) progress()
  }

  // ── figures, enlarged in place ──────────────────────────────────────────────────────────
  const imgsOf = () => M().imagesOf(LAB.pieces.find((x) => x.slug === st.slug) || {})
  function figShow(i) {
    const imgs = imgsOf(), im = imgs[i]
    st.fig.i = i
    const img = lbx.querySelector('img')
    img.src = asset(im.src)
    img.alt = im.caption || ''
    lbx.querySelector('figcaption').textContent = capOf(im, i)
    lbx.querySelector('.lbx__n').textContent = C().figOf(i + 1, imgs.length)
    lbx.setAttribute('aria-label', capOf(im, i))
    for (const b of lbx.querySelectorAll('.lbx__p')) b.hidden = imgs.length < 2
  }
  function figOpen(i, from) {
    st.fig = { i, from }
    lbx.hidden = false
    figShow(i)
    lbx.querySelector('.lbx__x').focus({ preventScroll: true })
    const img = lbx.querySelector('img'), src = from.querySelector('img')
    if (reduced() || !src) return lbx.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear' })
    // FLIP: from the thumbnail's rect to the enlarged image's, once the image knows its size
    const go = () => {
      const a = src.getBoundingClientRect(), b = img.getBoundingClientRect()
      if (!b.width) return
      lbx.animate([{ backgroundColor: 'transparent' }, {}], { duration: 320, easing: EASE })
      img.animate([{ transform: `translate(${(a.left - b.left).toFixed(1)}px, ${(a.top - b.top).toFixed(1)}px) scale(${(a.width / b.width).toFixed(4)}, ${(a.height / b.height).toFixed(4)})`, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], { duration: 320, easing: EASE })
      for (const n of [lbx.querySelector('.lbx__bar'), lbx.querySelector('figcaption')]) n.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], { duration: 320 })
    }
    if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true })
  }
  function figStep(d) { const n = imgsOf().length; if (n > 1) figShow((st.fig.i + d + n) % n) }
  function figClose() {
    if (!st.fig) return
    const back = page.querySelector(`[data-fig="${st.fig.i}"]`) || st.fig.from
    st.fig = null
    const done = () => { lbx.hidden = true; if (back) back.focus({ preventScroll: true }) }
    if (reduced()) lbx.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140 }).finished.then(done, done)
    else done()
  }

  // ── where a post lives in the Lab: the row or button it came from, or its row in the menu ──
  function target(slug, section) {
    const from = st.from
    if (from && from.isConnected && from.dataset.read === slug && from.getClientRects().length) return from
    return NIGHT.menu.target(section, slug)
  }

  // ── the motion (as in #17) ───────────────────────────────────────────────────────────────
  const stop = () => { for (const a of el.getAnimations({ subtree: true })) a.cancel() }
  // keyframes for "the page at the row" → "the page", played forwards to open, backwards to close
  function morph(from, open) {
    const ms = open ? OPEN_MS : CLOSE_MS, dir = open ? 'normal' : 'reverse'
    if (reduced() || !from) {
      const a = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: open ? 200 : 160, easing: 'linear', direction: dir, fill: 'both' })
      return a.finished
    }
    const r = from.getBoundingClientRect(), vw = innerWidth, vh = innerHeight
    const clip = `inset(${r.top.toFixed(1)}px ${(vw - r.right).toFixed(1)}px ${(vh - r.bottom).toFixed(1)}px ${r.left.toFixed(1)}px)`
    const run = [el.animate([{ clipPath: clip }, { clipPath: 'inset(0px 0px 0px 0px)' }], { duration: ms, easing: EASE, direction: dir, fill: 'both' })]
    // the title flies between the row's title and the post's
    const t = page.querySelector('.rd__title'), src = NIGHT.menu.titleOf(from)
    if (t && src) {
      const a = src.getBoundingClientRect(), b = t.getBoundingClientRect()
      const k = parseFloat(getComputedStyle(src).fontSize) / parseFloat(getComputedStyle(t).fontSize)
      run.push(t.animate([{ transform: `translate(${(a.left - b.left).toFixed(1)}px, ${(a.top - b.top).toFixed(1)}px) scale(${k.toFixed(4)})` }, { transform: 'none' }],
        { duration: ms, easing: EASE, direction: dir, fill: 'both' }))
    }
    // the rest follows the page open, and leaves first on the way back
    const head = page.querySelector('.rd__head'), post = page.querySelector('.rd__post')
    const rest = [bar, page.querySelector('.rd__toc'), ...(head ? [...head.children] : []), ...(post ? [...post.children] : [])].filter((n) => n && n !== t && n !== head)
    for (const n of rest) run.push(n.animate([{ opacity: 0, translate: '0 14px' }, { opacity: 0, translate: '0 14px', offset: 0.28 }, { opacity: 1, translate: '0 0' }], { duration: ms, easing: EASE, direction: dir, fill: 'both' }))
    run.push(line.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: ms, direction: dir, fill: 'both' }))
    return Promise.all(run.map((a) => a.finished))
  }

  function open(slug, section, from, instant) {
    stop()
    fill(slug, section)
    st.slug = slug
    st.section = section
    st.from = from || null
    el.hidden = false
    progress() // measured once it has a layout
    document.documentElement.classList.add('is-reading'); if (R.onchange) R.onchange()
    setInert(true)
    page.querySelector('.rd__title').focus({ preventScroll: true })
    if (instant) return Promise.resolve()
    const mine = slug
    return morph(from, true).then(() => { if (st.slug === mine) stop() }, () => {})
  }
  function swap(slug, section) {
    // prev / next: the page stays, the post changes (a crossfade of the page only)
    st.slug = slug
    st.section = section
    if (st.fig) { st.fig = null; lbx.hidden = true }
    fill(slug, section)
    page.querySelector('.rd__title').focus({ preventScroll: true })
    if (!reduced()) page.animate([{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 260, easing: EASE })
  }
  function close() {
    const slug = st.slug, section = st.section
    st.slug = null
    if (st.fig) { st.fig = null; lbx.hidden = true }
    stop()
    setInert(false)
    const to = target(slug, section)
    const done = () => {
      if (st.slug) return // reopened meanwhile
      stop()
      el.hidden = true
      document.documentElement.classList.remove('is-reading'); if (R.onchange) R.onchange()
      if (to && to.isConnected) to.focus({ preventScroll: true })
    }
    return morph(to, false).then(done, done)
  }

  R.go = (slug, section = 'writing', from) => {
    st.pending = from || null
    const r = route()
    if (r && r.slug === slug && r.section === section) return R.sync()
    st.pushed = true
    location.hash = `#/${section}/${slug}`
  }
  R.sync = ({ instant = false } = {}) => {
    const r = route()
    if (r && !st.slug) {
      const from = st.pending || null
      st.pending = null
      if (!from) st.pushed = false // arrived by link or history, not a click here
      return open(r.slug, r.section, from || NIGHT.menu.target(r.section, r.slug), instant || !from)
    }
    if (r && (r.slug !== st.slug || r.section !== st.section)) return swap(r.slug, r.section)
    if (!r && st.slug) return close()
  }
  R.dismiss = () => {
    if (!st.slug) return
    if (st.pushed) { st.pushed = false; history.back(); return }
    // deep-linked: drop the hash without a new history entry where the browser allows it
    try { history.replaceState(null, '', location.pathname + location.search) } catch { /* file:// */ }
    if (ROUTE.test(location.hash)) location.hash = ''
    else close()
  }
  R.toSection = (id) => toSection(id)
  R.figOpen = (i) => { const z = page.querySelector(`[data-fig="${i}"]`); if (z) figOpen(i, z) }
  R.closeNow = () => {
    if (!st.slug) return
    st.slug = null
    st.fig = null
    lbx.hidden = true
    stop()
    setInert(false)
    el.hidden = true
    document.documentElement.classList.remove('is-reading'); if (R.onchange) R.onchange()
    try { history.replaceState(null, '', location.pathname + location.search) } catch { /* file:// */ }
  }
})()
