/*
 * prototype/lab/notebook/reading.js: the reader controls' arithmetic. Pure: no DOM, no storage, no
 * clock. controls.js and glossary.js call it in the browser; check.mjs runs all of it in Node.
 *
 *   NB.reading.progress(top, height, view)   0–1: how far through the scroller the reader is
 *   .left(readMin, p)                         { n, kind }: the kicker's clock. 'read' at the top
 *                                             ("12 min read"), then 'left' ("8 min left"), 'end'
 *   .resumeAt(saved, height, view)            the scroll to restore on return, or 0: none stored,
 *                                             a note read to its end, or one that got shorter
 *   .firstInView(parts, headBottom, viewH)    which part ▶ starts at: the first that starts below the
 *                                             bar (or is mostly below it) and above the fold; 0 if none
 *   .glossary(blocks, plain, slugify)         the glossary note → [{ id, term, def, match, idPrefix }]
 *   .termRe(entry)                            the RegExp that finds a term in prose
 *   .firstUses(texts, entries)                [{ i, at, len, id }]: the first use of each term,
 *                                             across text runs in page order
 *   .idPrefix(id)                             'T02' → 'T', 'PW1' → 'PW', 'W1' → 'W', else ''
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NB = (root_.NB = root_.NB || {})
  const clamp01 = (x) => Math.max(0, Math.min(1, x))

  const progress = (top, height, view) => (height - view <= 1 ? 1 : clamp01(top / (height - view)))
  // the top 2 % is "not started" (the clock still says how long the note is); the last 2 % is done
  const left = (readMin, p) => {
    if (p < 0.02) return { n: Math.max(1, Math.round(readMin)), kind: 'read' }
    const rest = readMin * (1 - p)
    if (p >= 0.98 || rest < 0.5) return { n: 0, kind: 'end' }
    return { n: Math.max(1, Math.round(rest)), kind: 'left' }
  }
  const resumeAt = (saved, height, view) => {
    if (!saved || !(saved.top > 0)) return 0
    if (saved.done) return 0
    const max = Math.max(0, height - view)
    return saved.top > max ? 0 : Math.round(saved.top)
  }
  const firstInView = (parts, headBottom, viewH) => {
    // a part that runs up under the bar counts only while most of it is still on screen
    const i = parts.findIndex((r) => r && r.bottom > headBottom + 8 && r.top < viewH - 40 && (r.top >= headBottom - 8 || r.bottom - headBottom >= (r.bottom - r.top) / 2))
    return i < 0 ? 0 : i
  }

  // ── the glossary: every "## term" is an entry; the first paragraph under it is the definition.
  // How each is found in prose: an acronym by its exact case, a word in any case and its plural.
  // PW, T and W are not found in prose: they are the prefixes of IDs, whose link popovers say them.
  const ID_PREFIX = { PW: /^PW\d$/, T: /^T\d\d$/, W: /^W\d$/ }
  const idPrefix = (id) => Object.keys(ID_PREFIX).find((k) => ID_PREFIX[k].test(String(id))) || ''
  function glossary(blocks, plain, slugify) {
    const out = [], used = new Set()
    // the same anchors md.render gives the headings: a repeat slug takes -2, -3 (pass@k, pass^k)
    const anchor = (t) => { let s = slugify(t), n = 2; while (used.has(s)) s = `${slugify(t)}-${n++}`; used.add(s); return s }
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      if (b.t !== 'h') continue
      const id = anchor(plain(b.text).trim())
      if (b.level !== 2) continue
      const term = plain(b.text).trim()
      const p = blocks.slice(i + 1).find((x) => x.t !== 'h' || x.level > 2)
      const def = p && p.t === 'p' && !(blocks.slice(i + 1, blocks.indexOf(p)).some((x) => x.t === 'h')) ? plain(p.text).trim() : ''
      const pre = /^(PW|T|W)\b/.exec(term)
      out.push({ id, term, def, idPrefix: pre && ID_PREFIX[pre[1]] ? pre[1] : '' })
    }
    return out
  }
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  function termRe(e) {
    if (e.idPrefix) return null
    const t = e.term
    // "LLM-as-judge" also reads "LLM-as-a-judge"; "eval" also "evals"
    const body = esc(t).replace(/-as-/g, '-as-(?:a-)?')
    const acronym = /[A-Z]{2}/.test(t) && !/-/.test(t)
    return new RegExp(`(?<![\\w@^-])${body}${acronym ? '' : 's?'}(?![\\w@^-])`, acronym ? '' : 'i')
  }
  function firstUses(texts, entries) {
    const res = []
    for (const e of entries) {
      const re = termRe(e)
      if (!re) continue
      for (let i = 0; i < texts.length; i++) {
        const m = re.exec(texts[i])
        if (m) { res.push({ i, at: m.index, len: m[0].length, id: e.id }); break }
      }
    }
    return res.sort((a, b) => a.i - b.i || b.at - a.at)
  }

  NB.reading = { progress, left, resumeAt, firstInView, glossary, termRe, firstUses, idPrefix }
})()
