/*
 * prototype/lab/night-mode/reader.js: write-ups are blog posts, not windows.
 *
 *   NIGHT.reader.mount()            builds the reader (fixed, outside the world: a page, not a card)
 *   NIGHT.reader.go(slug, from)     opens a post from the row or [read] button `from`, by setting
 *                                   the hash, so the post deep-links and Back closes it
 *   NIGHT.reader.sync({ instant })  makes the reader match location.hash (#/writing/<slug>)
 *   NIGHT.reader.dismiss()          [x] close and Escape: the same as Back
 *   NIGHT.reader.isOpen(), .slug(), .body(p) (the article markup, from LAB data only)
 *
 * THE TRANSITION. Opening grows the page out of the row that was clicked: the reader's clip-path
 * runs from the row's screen rect to the whole viewport, while the title flies from the row's
 * title to the post's (an explicit FLIP: measured in screen space, translate + scale, then to
 * identity) and the rest of the page fades up after it. Closing is the same keyframes played
 * backwards, into the row of the post that is open now (prev/next may have moved on), so it is
 * the opposite motion, not a cut. Reduced motion (LAB.sky.reduced, the one owner): a crossfade.
 *
 * Mono for the chrome and the metadata, Space Grotesk for the body at a 64ch measure. Images sit
 * in the flow of the text. A reading-progress line runs along the top.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
  const OPEN_MS = 560, CLOSE_MS = 480
  const reduced = () => LAB.sky.reduced
  const S = () => NIGHT.shelves
  // UI words for this mockup (the React build takes them from content/, like every other string)
  const COPY = {
    close: 'close', closeLabel: 'Close the post', mins: (n) => `${n} min read`, file: (s) => `~/lab/writing/${s}.md`,
    prev: 'prev', next: 'next', progress: 'Reading progress', links: 'Links',
  }
  const LINK = { Repo: 'repo', Github: 'repo', Site: 'live', Demo: 'live' }
  const ROUTE = /^#\/writing\/([a-z0-9-]+)$/

  const R = (NIGHT.reader = {})
  const st = { slug: null, from: null, pushed: false, pending: null, inert: [] }
  let el, scroller, article, bar, line, pct, path
  R.isOpen = () => !!st.slug
  R.slug = () => st.slug

  const posts = () => S().posts(LAB.pieces)
  const route = () => { const m = ROUTE.exec(location.hash); return m && posts().some((p) => p.slug === m[1]) ? m[1] : null }

  // ── the article ──────────────────────────────────────────────────────────────────────────
  const fig = (im, alt) => `<figure class="rd__fig"><img src="${esc(LAB.asset(im.src))}" alt="${esc(im.caption || alt)}" loading="lazy">` +
    (im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : '') + `</figure>`
  R.body = (p) => {
    const list = posts(), i = list.findIndex((x) => x.slug === p.slug), e = list[i]
    const blocks = String(p.body || '').trim().split(/\n\s*\n/).filter(Boolean)
    const imgs = p.images || []
    // images go in the flow: spread over the gaps after each block, in order
    const at = imgs.map((_, k) => Math.min(blocks.length - 1, Math.floor((k * blocks.length) / imgs.length)))
    const href = (slug) => (list.some((x) => x.slug === slug) ? '#/writing/' + slug : '#')
    const body = blocks.map((b, k) => {
      const here = imgs.filter((_, j) => at[j] === k)
      return LAB.body.render(b, { href }) + (here.length ? `<div class="rd__figs" data-n="${here.length}">${here.map((im) => fig(im, p.title)).join('')}</div>` : '')
    }).join('')
    const f = (NIGHT.facts || {})[p.slug] || {}
    const links = (f.links || []).map((l) => `<a class="act" href="${esc(l.href)}" rel="noopener">${esc(LINK[l.label] || l.label.toLowerCase())}</a>`).join('')
    const nav = (x, dir) => x ? `<a class="rd__step rd__step--${dir}" href="#/writing/${esc(x.slug)}" data-step="${esc(x.slug)}">` +
      `<span class="rd__stepk">${dir === 'prev' ? '← ' + COPY.prev : COPY.next + ' →'}</span><span class="rd__stept">${esc(x.title)}</span></a>` : '<span></span>'
    return `<p class="rd__meta"><span>${esc(e.when)}</span><span>${esc(COPY.mins(e.mins))}</span>${p.status ? `<span>${esc(p.status)}</span>` : ''}</p>` +
      `<h1 class="rd__title" tabindex="-1">${esc(p.title)}</h1>` +
      (p.blurb ? `<p class="rd__lede">${esc(p.blurb)}</p>` : '') +
      `<div class="rd__body">${body}</div>` +
      (links ? `<p class="rd__links" aria-label="${esc(COPY.links)}">${links}</p>` : '') +
      `<nav class="rd__nav">${nav(list[i - 1], 'prev')}${nav(list[i + 1], 'next')}</nav>`
  }

  // ── chrome ───────────────────────────────────────────────────────────────────────────────
  R.mount = () => {
    el = h('div', 'reader')
    el.hidden = true
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.innerHTML =
      `<div class="rd__bar"><button type="button" class="rd__x" aria-label="${esc(COPY.closeLabel)}">${esc(COPY.close)}</button>` +
      `<span class="rd__path"></span><span class="rd__pct" aria-hidden="true"></span></div>` +
      `<div class="rd__line" role="progressbar" aria-label="${esc(COPY.progress)}" aria-valuemin="0" aria-valuemax="100"><i></i></div>` +
      `<div class="rd__scroll"><article class="rd__post"></article></div>`
    document.body.appendChild(el)
    scroller = el.querySelector('.rd__scroll')
    article = el.querySelector('.rd__post')
    bar = el.querySelector('.rd__bar')
    line = el.querySelector('.rd__line')
    pct = el.querySelector('.rd__pct')
    path = el.querySelector('.rd__path')
    el.querySelector('.rd__x').addEventListener('click', () => R.dismiss())
    scroller.addEventListener('scroll', progress, { passive: true })
    // images landing change the page's length; so does the window
    article.addEventListener('load', () => { if (!el.hidden) progress() }, true)
    addEventListener('resize', () => { if (!el.hidden) progress() })
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); R.dismiss(); return }
      if (e.key === 'Tab') trap(e)
      e.stopPropagation() // the desk's 0 / + / − are not for a page of text
    })
    el.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#/writing/"]')
      if (!a) return
      e.preventDefault()
      // prev, next and links between posts swap in place: one history entry, so Back still closes
      try { location.replace(a.getAttribute('href')) } catch { location.hash = a.getAttribute('href') }
    })
    addEventListener('hashchange', () => R.sync())
  }
  const trap = (e) => {
    const f = [...el.querySelectorAll('button, a[href], [tabindex="-1"].rd__title')].filter((n) => n.offsetParent !== null)
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
    pct.textContent = `[${'#'.repeat(n)}${'·'.repeat(10 - n)}] ${String(Math.round(f * 100)).padStart(3, ' ')}%`
  }
  // everything but the reader goes inert while it is open, so Tab and clicks stay on the page
  const setInert = (on) => {
    if (on) {
      st.inert = [...document.body.children].filter((n) => n !== el && !n.inert)
      st.inert.forEach((n) => { n.inert = true })
    } else { st.inert.forEach((n) => { n.inert = false }); st.inert = [] }
  }

  function fill(slug) {
    const p = LAB.pieces.find((x) => x.slug === slug)
    el.setAttribute('aria-label', p.title)
    el.style.setProperty('--c', 'var(--lab-writing)')
    path.textContent = COPY.file(slug)
    article.innerHTML = R.body(p)
    scroller.scrollTop = 0
    if (!el.hidden) progress()
  }

  // ── where a post lives on the night desk: its writing row, or the button it came from ────
  const rowOf = (slug) => S().find(`.post[data-read="${CSS.escape(slug)}"]`)
  function target(slug) {
    const from = st.from
    if (from && from.isConnected && from.dataset.read === slug && from.getClientRects().length) return from
    // the writing pane must be showing (phone tabs) and the row scrolled into its pane
    if (S().phone() && S().current() !== 'writing') S().tab('writing', false)
    const row = rowOf(slug)
    if (row) {
      const body = row.closest('.shelf__body'), top = row.offsetTop - body.offsetTop
      if (top < body.scrollTop || top + row.offsetHeight > body.scrollTop + body.clientHeight) body.scrollTop = top - 24
    }
    return row
  }
  const titleOf = (node) => node && (node.querySelector('.post__ttl') || node.closest('.spec')?.querySelector('.spec__name') || node)

  // ── the motion ───────────────────────────────────────────────────────────────────────────
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
    const t = article.querySelector('.rd__title'), src = titleOf(from)
    if (t && src) {
      const a = src.getBoundingClientRect(), b = t.getBoundingClientRect()
      const k = parseFloat(getComputedStyle(src).fontSize) / parseFloat(getComputedStyle(t).fontSize)
      run.push(t.animate([{ transform: `translate(${(a.left - b.left).toFixed(1)}px, ${(a.top - b.top).toFixed(1)}px) scale(${k.toFixed(4)})` }, { transform: 'none' }],
        { duration: ms, easing: EASE, direction: dir, fill: 'both' }))
    }
    // the rest follows the page open, and leaves first on the way back
    const rest = [bar, ...article.children].filter((n) => n !== t)
    for (const n of rest) run.push(n.animate([{ opacity: 0, translate: '0 14px' }, { opacity: 0, translate: '0 14px', offset: 0.28 }, { opacity: 1, translate: '0 0' }], { duration: ms, easing: EASE, direction: dir, fill: 'both' }))
    run.push(line.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: ms, direction: dir, fill: 'both' }))
    return Promise.all(run.map((a) => a.finished))
  }

  function open(slug, from, instant) {
    stop()
    fill(slug)
    st.slug = slug
    st.from = from || null
    el.hidden = false
    progress() // measured once it has a layout
    document.documentElement.classList.add('is-reading')
    setInert(true)
    article.querySelector('.rd__title').focus({ preventScroll: true })
    if (instant) return Promise.resolve()
    const mine = slug
    return morph(from, true).then(() => { if (st.slug === mine) stop() }, () => {})
  }
  function swap(slug) {
    // prev / next: the page stays, the post changes (a crossfade of the article only)
    st.slug = slug
    fill(slug)
    article.querySelector('.rd__title').focus({ preventScroll: true })
    if (!reduced()) article.animate([{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 260, easing: EASE })
  }
  function close() {
    const slug = st.slug
    st.slug = null
    stop()
    const to = target(slug)
    setInert(false)
    const done = () => {
      if (st.slug) return // reopened meanwhile
      stop()
      el.hidden = true
      document.documentElement.classList.remove('is-reading')
      if (to && to.isConnected) to.focus({ preventScroll: true })
    }
    return morph(to, false).then(done, done)
  }

  R.go = (slug, from) => {
    st.pending = from || null
    if (route() === slug) return R.sync()
    st.pushed = true
    location.hash = '#/writing/' + slug
  }
  R.sync = ({ instant = false } = {}) => {
    const slug = route()
    if (slug && !st.slug) {
      const from = st.pending || null
      st.pending = null
      if (!from) st.pushed = false // arrived by link or history, not a click here
      return open(slug, from || rowOf(slug), instant || !from)
    }
    if (slug && slug !== st.slug) return swap(slug)
    if (!slug && st.slug) return close()
  }
  R.dismiss = () => {
    if (!st.slug) return
    if (st.pushed) { st.pushed = false; history.back(); return }
    // deep-linked: drop the hash without a new history entry where the browser allows it
    try { history.replaceState(null, '', location.pathname + location.search) } catch { /* file:// */ }
    if (ROUTE.test(location.hash)) location.hash = ''
    else close()
  }
})()
