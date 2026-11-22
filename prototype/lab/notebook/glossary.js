/*
 * prototype/lab/notebook/glossary.js: explain this term (Q5) and hover previews (Q9).
 *
 *   NB.gloss.entries()        the glossary note's terms (NB.reading.glossary), cached per vault
 *   NB.gloss.mark(root, note) the first use of each term on a note gets a dotted underline: a
 *                             .nb-gl[data-gloss] button-like span. Not on the glossary itself, not
 *                             inside links, code, headings or formulas
 *   NB.gloss.show(target)     the popover for a term, or for an ID link (its note's title)
 *   NB.gloss.hide()
 *
 * A term: tap, click, Enter or a 350 ms hover shows a popover of at most two lines (the first
 * sentence of the definition) and "more →" to the glossary. An ID (T02, PW1, W1): on a phone a tap
 * shows its note's title and what the prefix means, with "open →"; on a desktop the hover preview
 * says the same. A wikilink, on a desktop only, after 350 ms: a 320 px card with the title, the
 * kicker and the summary. One popover at a time; Esc, a click outside or a scroll closes it.
 *
 * Round 7 (E): this is the one preview owner for every item that opens a note, not just a body's
 * wikilinks: the tree, start-here's and the hubs' lists and cards, the map's nodes and list,
 * what's nearby, the tag pages, the switcher's results, prev/next and the author card's next.
 *   - a post or a build gets the rich card: its cover (contained, never cropped), the TL;DR or its
 *     first lines, reading time, tags and date; a note keeps the compact one, plus where it lives
 *   - desktop only, (hover: hover) and (pointer: fine): 350 ms after the pointer or the keyboard
 *     arrives (the switcher's arrow keys count); Esc, leaving or a scroll closes it
 *   - placed beside a list row (tree, switcher, map list), under or over anything else, inside the
 *     viewport and never over the item itself
 *   NB.gloss.preview(item)   schedule a preview for an item the keyboard moved to (the switcher)
 */
;(() => {
  const NB = (window.NB = window.NB || {})
  const C = NB.copy, MD = NB.md, R = NB.reading, esc = MD.escape
  const S = () => NB.shell, V = () => NB.vault
  const GLOSS = '01-glossary'
  const DELAY = 350
  const hover = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches } catch { return false } }
  const G = (NB.gloss = {})

  let cache = null
  G.entries = () => {
    const v = V()
    if (cache && cache.v === v) return cache.e
    const g = v.get(GLOSS)
    cache = { v, e: g ? R.glossary(g.blocks, MD.plain, MD.slugify) : [] }
    return cache.e
  }
  const first = (s) => (/^.*?[.!?](?=\s|$)/.exec(s) || [s])[0]
  const byPrefix = (p) => G.entries().find((e) => e.idPrefix === p)
  // "A study topic: one thing to learn…" → "A study topic"
  const prefixWhat = (p) => { const e = byPrefix(p); return e ? first(e.def).split(':')[0].replace(/\.$/, '') : '' }
  G.prefixWhat = prefixWhat

  // ── marking the first use of each term ────────────────────────────────────────────────
  const SKIP = 'a, code, pre, h1, h2, h3, h4, button, .nb-formula, .nb-code, .nb-embed, .nb-gl, .nb-dl, .nb-slot, .nb-proposal'
  function textsIn(root) {
    const out = []
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (/\S/.test(t.nodeValue) && !t.parentElement.closest(SKIP) ? 1 : 2) })
    while (w.nextNode()) out.push(w.currentNode)
    return out
  }
  function wrapAt(t, at, len, e) {
    const mid = t.splitText(at)
    mid.splitText(len)
    const s = document.createElement('span')
    s.className = 'nb-gl'
    s.dataset.gloss = e.id
    s.tabIndex = 0
    s.setAttribute('role', 'button')
    s.setAttribute('aria-expanded', 'false')
    s.setAttribute('aria-label', C.glossLabel(mid.nodeValue))
    mid.replaceWith(s)
    s.appendChild(mid)
    return s
  }
  G.mark = (root, note) => {
    if (!note || note.route === GLOSS || note.route === '') return 0
    const body = root.querySelector('.nb-body')
    if (!body) return 0
    const E = G.entries(), texts = textsIn(body)
    const uses = R.firstUses(texts.map((t) => t.nodeValue), E)
    // from the end of each text run backwards, so the offsets before stay true
    for (const u of uses) wrapAt(texts[u.i], u.at, u.len, E.find((e) => e.id === u.id))
    // a two-column table is also drawn as a list for a phone: mark the same term there too
    for (const dl of body.querySelectorAll('.nb-table-wrap .nb-dl')) {
      const ids = new Set([...dl.parentElement.querySelectorAll('.nb-table .nb-gl')].map((x) => x.dataset.gloss))
      if (!ids.size) continue
      const ts = (() => { const out = [], w = document.createTreeWalker(dl, NodeFilter.SHOW_TEXT); while (w.nextNode()) if (!w.currentNode.parentElement.closest('a, code')) out.push(w.currentNode); return out })()
      for (const u of R.firstUses(ts.map((t) => t.nodeValue), E.filter((e) => ids.has(e.id)))) wrapAt(ts[u.i], u.at, u.len, E.find((e) => e.id === u.id))
    }
    return uses.length
  }

  // ── the popover ───────────────────────────────────────────────────────────────────────
  let pop = null, owner = null, layered = false
  function box() {
    if (pop) return pop
    pop = document.createElement('div')
    pop.className = 'nb-pop'
    pop.id = 'nbPop'
    pop.hidden = true
    // on the body, beside the layers, so a switcher result's preview can sit over the switcher
    document.body.appendChild(pop)
    pop.addEventListener('mouseenter', () => clearTimeout(outT))
    pop.addEventListener('mouseleave', () => { if (!layered) later(G.hide, 120) })
    return pop
  }
  const routeOf = (a) => (a.dataset && a.dataset.route != null ? a.dataset.route : (/^#\/([^?]*)/.exec(a.getAttribute('href') || '') || [])[1])
  const noteOf = (a) => { const r = routeOf(a); if (r == null) return null; try { return V().get(decodeURIComponent(r)) } catch { return null } }
  const day = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || '')); return m ? `${+m[3]} ${C.months[+m[2] - 1]} ${m[1]}` : '' }
  const rich = (n) => n.type === 'post' || n.type === 'build'
  const assetSrc = (src) => (/^(data:|https?:)/.test(src) ? src : (NB.publicRoot || '../../../public') + src)
  // the TL;DR when the note has a real one, otherwise its first lines
  function gist(n, max) {
    if (n.summary && V().ledeOf(n).why === 'ok' && n.summary.length >= 40) return n.summary
    const b = (n.blocks || []).find((x) => x.t === 'p' && MD.plain(x.text).trim().length > 30)
    const t = b ? MD.plain(b.text).replace(/\s+/g, ' ').trim() : n.summary || ''
    return t.length > max ? t.slice(0, t.lastIndexOf(' ', max)) + '…' : t
  }
  function richHtml(n) {
    const img = (n.blocks || []).find((x) => x.t === 'img' && x.src)
    const c = V().clock(n), date = day(n.fm.date || n.updated)
    const tags = (n.tags || []).map((id) => NB.tags.get(id)).filter(Boolean)
    return `${img ? `<span class="nb-pop__cover"><img src="${esc(assetSrc(img.src))}" alt="" decoding="async"></span>` : ''}` +
      `<p class="nb-pop__kicker">${[C.sections[n.section] || '', C.shapes[n.type] || ''].filter(Boolean).map(esc).join(' · ')}</p>` +
      `<p class="nb-pop__title">${S().nameHtml(n)}</p>` +
      `<p class="nb-pop__sum">${esc(gist(n, 200))}</p>` +
      `<p class="nb-pop__meta">${[c.read ? C.minRead(Math.max(1, Math.round(c.read))) : '', date].filter(Boolean).map(esc).join(' · ')}${tags.length ? ` <span class="nb-pop__tags">${tags.map((t) => `<span data-tag="${esc(t.id)}"><span aria-hidden="true">${esc(t.glyph)}</span> ${esc(C.tags.names[t.id])}</span>`).join('')}</span>` : ''}</p>`
  }
  function compactHtml(n) {
    const f = V().fits(n), where = f.partOf.map((x) => x.title).join(` ${C.crumbSep} `)
    return `<p class="nb-pop__kicker">${kicker(n)}</p><p class="nb-pop__title">${S().nameHtml(n)}</p>${n.summary && V().ledeOf(n).why === 'ok' ? `<p class="nb-pop__sum">${esc(n.summary)}</p>` : ''}${where ? `<p class="nb-pop__where"><span>${esc(C.fits.partOf)}</span> ${esc(where)}</p>` : ''}`
  }
  function kicker(n) {
    const st = C.status[n.status] || C.status.planned, c = V().clock(n)
    return [C.sections[n.section] || '', n.id && R.idPrefix(n.id) ? prefixWhat(R.idPrefix(n.id)) : C.shapes[n.type] || '', st[1], c.read ? C.minRead(Math.max(1, Math.round(c.read))) : ''].filter(Boolean).map(esc).join(' · ')
  }
  function fill(t) {
    const p = box()
    if (t.classList.contains('nb-gl')) {
      const e = G.entries().find((x) => x.id === t.dataset.gloss)
      if (!e) return false
      p.dataset.kind = 'term'
      p.setAttribute('role', 'dialog')
      p.setAttribute('aria-label', e.term)
      p.innerHTML = `<p class="nb-pop__def"><b>${esc(e.term)}</b> ${esc(first(e.def))}</p><a class="nb-pop__more" href="${esc(S().href(GLOSS, `a=${e.id}`))}">${esc(C.more)}</a>`
      return true
    }
    const n = noteOf(t)
    if (!n) return false
    p.dataset.kind = rich(n) ? 'rich' : 'note'
    p.dataset.sec = n.section
    p.setAttribute('role', layered ? 'dialog' : 'tooltip')
    p.setAttribute('aria-label', n.title)
    p.innerHTML = `${rich(n) ? richHtml(n) : compactHtml(n)}${layered ? `<a class="nb-pop__more" href="${esc(t.getAttribute('href'))}">${esc(C.previewOpen)}</a>` : ''}`
    return true
  }
  // beside a list row, under or over anything else; the first spot that fits the viewport wins.
  // Each spot is wholly outside the item's box on one axis, so the card never covers its item
  function place(t) {
    const p = pop, r = t.getBoundingClientRect(), m = 8, g = 8
    p.style.left = '0px'; p.style.top = '0px'
    const w = p.offsetWidth, h = p.offsetHeight
    const top = (t.closest('.nb-layer') ? 0 : S().el.head.getBoundingClientRect().bottom) + m
    const cx = (x) => Math.max(m, Math.min(innerWidth - w - m, x)), cy = (y) => Math.max(top, Math.min(innerHeight - h - m, y))
    const spots = {
      right: [r.right + g, cy(r.top - 4)], left: [r.left - g - w, cy(r.top - 4)],
      below: [cx(r.left + r.width / 2 - w / 2), r.bottom + g], above: [cx(r.left + r.width / 2 - w / 2), r.top - g - h],
    }
    const order = t.closest('.nb-side, .nb-switcher, .nb-maplist, .nb-margin') ? ['right', 'left', 'below', 'above'] : ['below', 'above', 'right', 'left']
    const ok = ([x, y]) => x >= m && y >= top && x + w <= innerWidth - m && y + h <= innerHeight - m
    const [x, y] = spots[order.find((k) => ok(spots[k])) || order[0]]
    p.style.left = `${Math.round(x)}px`; p.style.top = `${Math.round(y)}px`
    p.dataset.at = order.find((k) => ok(spots[k])) || order[0]
  }
  G.show = (t, asLayer = false) => {
    G.hide()
    layered = asLayer
    if (!fill(t)) return false
    owner = t
    pop.hidden = false
    place(t)
    if (t.classList.contains('nb-gl')) t.setAttribute('aria-expanded', 'true')
    else t.setAttribute('aria-describedby', 'nbPop')
    // F: it lifts out of the word or row it belongs to (S.layer does the same for a pinned one)
    if (asLayer) S().layer(pop, t, () => { if (owner) owner.setAttribute('aria-expanded', 'false'); owner = null; layered = false })
    else NB.motion.open(pop, { from: t })
    return true
  }
  G.hide = () => {
    clearTimeout(inT); clearTimeout(outT)
    if (!NB.motion.isOpen(pop)) return
    if (layered) { S().closeLayer(pop); return }
    NB.motion.close(pop)
    if (owner) { owner.setAttribute('aria-expanded', 'false'); owner.removeAttribute('aria-describedby') }
    owner = null
  }
  G.owner = () => owner

  // ── when it shows ─────────────────────────────────────────────────────────────────────
  let inT = 0, outT = 0
  const later = (f, ms) => { clearTimeout(outT); outT = setTimeout(f, ms) }
  // every item that opens a note, wherever it is; not the bar's path (you are on it), a heading's
  // own link, a row reference inside a table, or the popover's own links
  const ITEM = '.nb a[href^="#/"], .nb a.n[data-route], .nb-switcher li[data-route]'
  const NOT = '.nb-bar, .nb-pop, .nb-hlink, [data-hlink], a.nb-rowref'
  const previewable = (a) => !!a && a.matches(ITEM) && !a.closest(NOT) && !!noteOf(a)
  const targetOf = (e) => e.target.closest && (e.target.closest('.nb-col .nb-gl') || e.target.closest(ITEM))
  G.preview = (t) => {
    clearTimeout(inT)
    if (!hover() || layered || !previewable(t)) return
    inT = setTimeout(() => { if (t.isConnected && t.getAttribute('aria-selected') !== 'false') G.show(t) }, DELAY)
  }
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || !hover()) return
    const t = targetOf(e)
    if (!t || t === owner) { if (t) clearTimeout(outT); return }
    if (!t.classList.contains('nb-gl') && !previewable(t)) return
    clearTimeout(inT)
    inT = setTimeout(() => { if (t.matches(':hover')) G.show(t) }, DELAY)
  })
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return
    const t = targetOf(e)
    if (!t) return
    clearTimeout(inT)
    if (t === owner && !layered && !(e.relatedTarget && pop && pop.contains(e.relatedTarget))) later(G.hide, 120)
  })
  // keyboard: a focused term or link previews after the same delay; Enter on a term pins it
  document.addEventListener('focusin', (e) => {
    const t = e.target
    if (!t.closest || !(t.closest('.nb-col') || previewable(t))) return
    clearTimeout(inT)
    if (layered) return
    if (t.classList.contains('nb-gl') || (t.matches('a[href^="#/"]') && previewable(t) && hover())) inT = setTimeout(() => { if (document.activeElement === t) G.show(t) }, DELAY)
    else G.hide()
  })
  document.addEventListener('focusout', (e) => { if (e.target === owner && !layered) later(G.hide, 120) })
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('.nb-col .nb-gl')
    // an ID on a touch screen: the first tap says what it is; "open →" goes there
    const id = !t && !hover() && e.target.closest && e.target.closest('.nb-col a.nb-id')
    if (t || (id && noteOf(id))) {
      e.preventDefault()
      const x = t || id
      if (owner === x && layered) { G.hide(); return }
      G.show(x, true)
      const more = pop.querySelector('a')
      if (more && e.detail === 0) more.focus({ preventScroll: true })
      return
    }
    if (pop && !pop.hidden && !pop.contains(e.target)) G.hide()
  })
  document.addEventListener('keydown', (e) => {
    const t = e.target.closest && e.target.closest('.nb-col .nb-gl')
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click() }
  })
  for (const [tg, ev] of [[window, 'scroll'], [document, 'scroll']]) tg.addEventListener(ev, () => { if (NB.motion.isOpen(pop)) G.hide() }, { passive: true, capture: true })
  // Esc closes a preview (a pinned term is a layer: the shell's Esc closes that)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !layered && NB.motion.isOpen(pop)) G.hide() }, true)
  addEventListener('hashchange', () => G.hide())
})()
