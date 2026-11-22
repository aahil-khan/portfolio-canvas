/*
 * prototype/lab/notebook/share.js: sharing and the visitor's way in (round 6).
 *
 *   NB.share.targets(url, title)   pure: the menu's LinkedIn, X (via=…) and email links
 *   NB.share.due(p, s)             pure: has the reader read enough for the nudge?
 *                                  (≥ 75 % scrolled, or ≥ 60 s on the note)
 *   NB.share.button(where, title)  the Share button's HTML; where = 'top' | 'end' | 'nudge'
 *   NB.share.open(btn)             navigator.share where it exists (phones, some desktops);
 *                                  otherwise a small menu under the button: copy link, LinkedIn,
 *                                  X, email. Esc, a click outside, or a pick closes it.
 *   NB.share.nudgeHtml(note)       the end-of-note prompt, drawn hidden; .tick() shows it once
 *   NB.share.authorHtml(note, w)   the author card: name, role, one line, links, follow, next up
 *   NB.share.bylineHtml(note)      the line above the kicker: whose Lab this is
 *
 * THE NUDGE is inline, near the end, never a modal and never over the text. It shows once per
 * note per visitor: the first time it shows, the note goes into localStorage (try/catch, through
 * NB.prefs), and "Not now" hides it. Every word is copy.js's.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NB = (root_.NB = root_.NB || {})
  const C = NB.copy, A = NB.author
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const NUDGE_P = 0.75, NUDGE_S = 60, SEEN_KEY = 'nb-nudged'
  const enc = encodeURIComponent

  const targets = (url, title) => [
    { id: 'linkedin', label: C.share2.linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { id: 'x', label: C.share2.x, href: `https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}&via=${enc(A.x)}` },
    { id: 'email', label: C.share2.email, href: `mailto:?subject=${enc(C.share2.emailSubject(title))}&body=${enc(C.share2.emailBody(title, url))}` },
  ]
  const due = (p, s) => p >= NUDGE_P || s >= NUDGE_S
  const SH = (NB.share = { targets, due, NUDGE_P, NUDGE_S, SEEN_KEY })

  // ── HTML (no DOM needed) ──────────────────────────────────────────────────────────────
  const authorView = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('hidden') === '1'
  const prop = () => (authorView() ? ` <span class="nb-proposal" title="${esc(C.proposalLabel)}">${esc(C.proposal)}</span>` : '')
  SH.button = (where, title) => `<button type="button" class="nb-share nb-share--${where}" data-act="share" data-where="${where}" aria-haspopup="true" aria-expanded="false" aria-label="${esc(C.shareLabel(title))}"><span class="nb-share__g" aria-hidden="true">↗</span><span class="nb-share__w">${esc(C.share)}</span></button>`
  SH.bylineHtml = () => `<p class="nb-byline"><a href="#/" aria-label="${esc(C.byline.label)}">${esc(C.byline.home)}</a><span class="nb-byline__line"> · ${esc(C.byline.line)}</span></p>`
  SH.nudgeHtml = (note) => {
    const line = C.nudge.lines[note.section] || C.nudge.lines.root
    return `<aside class="nb-nudge" aria-label="${esc(C.nudge.label)}" hidden><p class="nb-nudge__line">${esc(line)}${prop()}</p><p class="nb-nudge__acts">${SH.button('nudge', note.title)}<button type="button" class="nb-nudge__no" data-act="nudge-no" aria-label="${esc(C.nudge.dismissLabel)}">${esc(C.nudge.dismiss)}</button></p></aside>`
  }
  SH.authorHtml = (note, v, w) => {
    const T = C.author, by = Object.fromEntries(A.links.map((l) => [l.id, l]))
    const a = (l, cls) => `<a class="${cls}" href="${esc(l.href)}"${/^https?:/.test(l.href) ? ' target="_blank" rel="noopener"' : ''} data-link="${esc(l.id)}" aria-label="${esc(T.linkLabel(l.label))}">${esc(l.label)}</a>`
    const pn = v.prevNext(note, w), next = pn.next
    const tour = v.tours.find((t) => t.steps.includes(note))
    const start = note.type === 'walkthrough' ? null : tour ? { route: tour.route, text: `${tour.id} ${tour.title}` } : note.route ? { route: '', text: T.startHere } : null
    const href = (r, q) => `#/${r}${q ? '?' + q : ''}`
    const nextQ = pn.tour && next && next.type !== 'walkthrough' ? `w=${w}` : ''
    const nextName = (n) => (n.id ? `${n.id} ${n.title}` : n.isHub ? n.title.charAt(0).toUpperCase() + n.title.slice(1) : n.title)
    return `<section class="nb-author" aria-label="${esc(T.label)}">
      <p class="nb-author__k">${esc(T.label)}</p>
      <p class="nb-author__name"><a href="#/">${esc(A.name)}</a></p>
      <p class="nb-author__role">${esc(A.role.prefix)} <b>${esc(A.role.emphasis)}</b></p>
      <p class="nb-author__line">${esc(T.line)}${prop()}</p>
      <p class="nb-author__links" aria-label="${esc(T.linksLabel)}">${A.links.map((l) => a(l, 'nb-author__link')).join('')}</p>
      <p class="nb-author__follow">${esc(T.follow)} ${A.follow.map((id) => a(by[id], 'nb-author__fl')).join(' · ')}</p>
      ${next || start ? `<div class="nb-author__next">${next ? `<a class="nb-author__nx" data-next href="${esc(href(next.route, nextQ))}" data-step="next"><span class="nb-author__nk">${esc(T.nextUp)}</span> ${esc(nextName(next))} ${esc(C.next)}</a>` : ''}${start ? `<a class="nb-author__st" data-start href="${esc(href(start.route))}"><span class="nb-author__nk">${esc(T.fromStart)}</span> ${esc(start.text)} ${esc(C.next)}</a>` : ''}</div>` : ''}
    </section>`
  }

  if (typeof document === 'undefined') return

  // ── the menu, or the native sheet ─────────────────────────────────────────────────────
  const S = () => NB.shell
  let menu = null, from = null
  SH.last = null
  function build() {
    menu = document.createElement('div')
    menu.className = 'nb-sharemenu'
    menu.id = 'nbShare'
    menu.setAttribute('role', 'menu')
    menu.setAttribute('aria-label', C.share2.menuLabel)
    menu.hidden = true
    menu.addEventListener('click', async (e) => {
      const c = e.target.closest('[data-copy]')
      if (c) {
        e.preventDefault()
        const ok = await NB.controls.copyLink(menu.dataset.url)
        if (ok) { c.textContent = C.share2.copied; c.dataset.done = '1' }
        setTimeout(close, 700)
        return
      }
      if (e.target.closest('a[data-target]')) { SH.last = menu.dataset.url; setTimeout(close, 0) }
    })
    S().el.root.appendChild(menu)
    document.addEventListener('pointerdown', (e) => { if (NB.motion.isOpen(menu) && !e.target.closest('.nb-sharemenu, [data-act="share"]')) close() }, true)
    addEventListener('scroll', () => { if (menu && !menu.hidden && from) place() }, { passive: true, capture: true })
  }
  function place() {
    const r = from.getBoundingClientRect(), w = Math.min(240, innerWidth - 16), h = menu.offsetHeight
    const below = r.bottom + 6 + h <= innerHeight
    menu.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left))}px`
    menu.style.top = `${below ? r.bottom + 6 : Math.max(8, r.top - 6 - h)}px`
    menu.style.width = `${w}px`
  }
  function close() { if (NB.motion.isOpen(menu)) S().closeLayer(menu) }
  SH.close = close
  SH.isOpen = () => NB.motion.isOpen(menu)
  SH.open = async (btn) => {
    const st = S().state, note = st.note
    const title = note ? note.title : C.byline.home
    const url = NB.controls.urlFor(note, '')
    if (navigator.share) {
      SH.last = url; NB.controls.last = url; SH.used = 'native'
      try { await navigator.share({ title: C.title(title), url }); return true } catch { return false }
    }
    if (!menu) build()
    if (NB.motion.isOpen(menu)) { const same = from === btn; close(); if (same) return false }
    SH.used = 'menu'
    from = btn && btn.closest ? btn : document.querySelector('[data-act="share"]')
    menu.dataset.url = url
    menu.innerHTML = `<button type="button" role="menuitem" class="nb-sharemenu__i" data-copy>${esc(C.share2.copy)}</button>` +
      targets(url, title).map((t) => `<a role="menuitem" class="nb-sharemenu__i" data-target="${t.id}" href="${esc(t.href)}"${t.id === 'email' ? '' : ' target="_blank" rel="noopener"'} aria-label="${esc(C.share2.targetLabel(t.label))}">${esc(t.label)}</a>`).join('')
    menu.hidden = false
    place()
    if (from) from.setAttribute('aria-expanded', 'true')
    const f = from
    S().layer(menu, f, () => { if (f) f.setAttribute('aria-expanded', 'false') })
    menu.querySelector('[data-copy]').focus({ preventScroll: true })
    return true
  }

  // ── the nudge: shown once per note, after a real read ─────────────────────────────────
  const seen = () => NB.prefs.get(SEEN_KEY) || {}
  SH.seen = (route) => !!seen()[route]
  let t0 = 0, cur = null, timer = 0
  SH.arrived = (note) => {
    clearTimeout(timer)
    cur = note && note.route !== '' && !SH.seen(note.route) ? note : null
    t0 = performance.now()
    if (cur) timer = setTimeout(() => SH.tick(), NUDGE_S * 1000 + 50)
  }
  SH.tick = () => {
    if (!cur || S().state.note !== cur || S().state.view !== 'note') return
    const s = (performance.now() - t0) / 1000
    if (!due(NB.controls.progress || 0, s)) return
    const box = S().el.col.querySelector('.nb-nudge')
    if (!box) return
    const all = seen(); all[cur.route] = 1; NB.prefs.set(SEEN_KEY, all)
    // F: it rises in like every other surface, and "Not now" takes it out the same way
    NB.motion.open(box)
    cur = null
  }
  document.addEventListener('click', (e) => {
    const no = e.target.closest('[data-act="nudge-no"]')
    if (no) { const box = no.closest('.nb-nudge'); NB.motion.close(box); const t = S().el.col.querySelector('.nb-share--end'); if (t) t.focus({ preventScroll: true }) }
  })
})()
