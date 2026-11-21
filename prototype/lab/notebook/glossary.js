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
    S().el.root.appendChild(pop)
    pop.addEventListener('mouseenter', () => clearTimeout(outT))
    pop.addEventListener('mouseleave', () => { if (!layered) later(G.hide, 120) })
    return pop
  }
  const noteOf = (a) => { const m = /^#\/([^?]*)/.exec(a.getAttribute('href') || ''); return m ? V().get(decodeURIComponent(m[1])) : null }
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
    p.dataset.kind = 'note'
    p.dataset.sec = n.section
    p.setAttribute('role', layered ? 'dialog' : 'tooltip')
    p.setAttribute('aria-label', n.title)
    p.innerHTML = `<p class="nb-pop__kicker">${kicker(n)}</p><p class="nb-pop__title">${S().nameHtml(n)}</p>${n.summary && V().ledeOf(n).why === 'ok' ? `<p class="nb-pop__sum">${esc(n.summary)}</p>` : ''}${layered ? `<a class="nb-pop__more" href="${esc(t.getAttribute('href'))}">${esc(C.previewOpen)}</a>` : ''}`
    return true
  }
  function place(t) {
    const p = pop, r = t.getBoundingClientRect(), m = 8
    p.style.left = '0px'; p.style.top = '0px'
    const w = p.offsetWidth, h = p.offsetHeight
    const head = S().el.head.getBoundingClientRect().bottom
    let y = r.bottom + 6
    if (y + h > innerHeight - m && r.top - 6 - h > head + m) y = r.top - 6 - h
    const x = Math.max(m, Math.min(innerWidth - w - m, r.left + r.width / 2 - w / 2))
    p.style.left = `${Math.round(x)}px`; p.style.top = `${Math.round(y)}px`
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
    if (asLayer) S().layer(pop, t, () => { if (owner) owner.setAttribute('aria-expanded', 'false'); owner = null; layered = false })
    return true
  }
  G.hide = () => {
    clearTimeout(inT); clearTimeout(outT)
    if (!pop || pop.hidden) return
    if (layered) { S().closeLayer(pop); return }
    pop.hidden = true
    if (owner) { owner.setAttribute('aria-expanded', 'false'); owner.removeAttribute('aria-describedby') }
    owner = null
  }
  G.owner = () => owner

  // ── when it shows ─────────────────────────────────────────────────────────────────────
  let inT = 0, outT = 0
  const later = (f, ms) => { clearTimeout(outT); outT = setTimeout(f, ms) }
  const previewable = (a) => a.matches('.nb-col a.nb-wl:not(.nb-rowref), .nb-col .nb-end a[href^="#/"], .nb-col .nb-prevnext a[href^="#/"]') && !!noteOf(a)
  const targetOf = (e) => e.target.closest && (e.target.closest('.nb-col .nb-gl') || e.target.closest('.nb-col a[href^="#/"]'))
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
    if (!t.closest || !t.closest('.nb-col')) return
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
  for (const [tg, ev] of [[window, 'scroll'], [document, 'scroll']]) tg.addEventListener(ev, () => { if (pop && !pop.hidden) G.hide() }, { passive: true, capture: true })
  addEventListener('hashchange', () => G.hide())
})()
