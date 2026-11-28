/*
 * prototype/lab/notebook/md.js: the notebook's Markdown, as a pure function. No DOM, no clock.
 * check.mjs runs all of it in Node; the React build ports it to lib/lab/md.ts (server only).
 *
 *   NB.md.frontmatter(src)      → { data, body }   a YAML subset: key: value, key: [a, b],
 *                                                  key: { k: v, k: [a] }, "quoted strings"
 *   .parse(body)                → blocks           h, p, ul, ol, table, fence, quote, img, hr
 *   .inline(text, opt)          → tokens           text, code, strong, em, link, wiki, id, br
 *   .render(blocks, ctx)        → { html, headings, figures }
 *   .links(blocks, opt)         → [{ kind, target, anchor, label, context }]  what the note links to
 *   .stats(blocks, opt)         → { prose, rows, cells, spoken }   word counts for the read / listen clocks
 *   .spoken(blocks, opt)        → [{ i, text }]    what narration says, block by block
 *   .plain(text)                → text with link markup stripped (the verbatim check)
 *   .slugify(text), .escape(text), .ROW_ID, .FENCES, .EMBEDS
 *
 * Wikilinks: [[target]], [[target|label]], [[target#anchor]]. ID mentions (T02, PW1, W1) link
 * when they resolve; inside a scope that declares row IDs (the Shopkeeper: P1–P13, A1–C12) those
 * link to their table rows. A table row whose first cell is an ID gets that ID as its anchor.
 * Everything that reaches the HTML is escaped; an href is only ever http(s), mailto or a #route.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NB = (root_.NB = root_.NB || {})

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c])
  const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[`*_[\]()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section'
  const ROW_ID = /^[A-Z]{1,2}\d{1,2}$/
  const EMBEDS = ['clip', 'terminal', 'try', 'chart', 'diagram']
  // every fence kind a note may use: the five embeds, a computed block, a formula, and plain code
  const FENCES = [...EMBEDS, 'block', 'latex', 'code']
  const safeHref = (h) => (/^(https?:|mailto:|#)/i.test(h) ? h : null)
  const decodeEntities = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))

  // ── frontmatter ──────────────────────────────────────────────────────────────────────────
  function scalar(v) {
    v = v.trim()
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1).replace(/\\"/g, '"')
    if (v === 'true') return true
    if (v === 'false') return false
    if (/^-?\d+(\.\d+)?$/.test(v)) return +v
    return v
  }
  // split on commas that are not inside quotes, brackets or braces
  function splitTop(s) {
    const out = []
    let depth = 0, q = '', cur = ''
    for (const ch of s) {
      if (q) { if (ch === q) q = ''; cur += ch; continue }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue }
      if (ch === '[' || ch === '{') depth++
      if (ch === ']' || ch === '}') depth--
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue }
      cur += ch
    }
    if (cur.trim()) out.push(cur)
    return out.map((x) => x.trim()).filter((x) => x !== '')
  }
  function value(v) {
    v = v.trim()
    if (v.startsWith('[') && v.endsWith(']')) return splitTop(v.slice(1, -1)).map(value)
    if (v.startsWith('{') && v.endsWith('}')) {
      const o = {}
      for (const part of splitTop(v.slice(1, -1))) { const i = part.indexOf(':'); if (i > 0) o[part.slice(0, i).trim()] = value(part.slice(i + 1)) }
      return o
    }
    return scalar(v)
  }
  function frontmatter(src) {
    const m = /^---\n([\s\S]*?)\n---\n?/.exec(src)
    if (!m) return { data: {}, body: src }
    const data = {}
    for (const line of m[1].split('\n')) {
      if (!line.trim() || line.trim().startsWith('#')) continue
      const i = line.indexOf(':')
      if (i < 1) throw new Error(`frontmatter: cannot read "${line}"`)
      data[line.slice(0, i).trim()] = value(line.slice(i + 1))
    }
    return { data, body: src.slice(m[0].length) }
  }

  // ── blocks ───────────────────────────────────────────────────────────────────────────────
  const cells = (line) => {
    let s = line.trim()
    if (s.startsWith('|')) s = s.slice(1)
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
    const out = []
    let cur = ''
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '\\' && s[i + 1] === '|') { cur += '\\|'; i++; continue }
      if (s[i] === '|') { out.push(cur.trim()); cur = ''; continue }
      cur += s[i]
    }
    out.push(cur.trim())
    return out
  }
  const isSep = (line) => /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line.trim()) && line.includes("-")

  function parse(body) {
    const lines = String(body).replace(/\r\n?/g, '\n').split('\n')
    const blocks = []
    let i = 0
    const para = []
    const flush = () => { if (para.length) { blocks.push({ t: 'p', text: para.join(' ') }); para.length = 0 } }
    while (i < lines.length) {
      const line = lines[i]
      const fence = /^```\s*([a-z-]*)\s*(.*)$/.exec(line)
      if (fence) {
        flush()
        const kind = fence[1] || 'code', rest = fence[2].trim()
        const body = []
        i++
        while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++])
        i++
        // ```kind id key=value …: the first bare word is the id, the rest are attributes
        const attrs = {}
        let id = ''
        for (const a of rest.split(/\s+/).filter(Boolean)) { const j = a.indexOf('='); if (j > 0) attrs[a.slice(0, j)] = a.slice(j + 1); else if (!id) id = a }
        let caption = ''
        if (EMBEDS.includes(kind) && body.length && /^fig\b/.test(body[0])) caption = body.shift()
        blocks.push({ t: 'fence', kind, id, attrs, body: body.join('\n'), caption })
        continue
      }
      if (!line.trim()) { flush(); i++; continue }
      const h = /^(#{1,4})\s+(.*)$/.exec(line)
      if (h) { flush(); blocks.push({ t: 'h', level: h[1].length, text: h[2].trim() }); i++; continue }
      if (/^(-{3,}|\*{3,})\s*$/.test(line)) { flush(); blocks.push({ t: 'hr' }); i++; continue }
      if (line.trim().startsWith('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
        flush()
        const head = cells(line), rows = []
        i += 2
        while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]))
        blocks.push({ t: 'table', head, rows })
        continue
      }
      const img = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line.trim())
      if (img) { flush(); blocks.push({ t: 'img', alt: img[1], src: img[2] }); i++; continue }
      if (/^>\s?/.test(line)) {
        flush()
        const q = []
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''))
        blocks.push({ t: 'quote', text: q.join(' ') })
        continue
      }
      const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line)
      if (li) {
        flush()
        const ordered = /\d/.test(li[2]), items = []
        const start = ordered ? parseInt(li[2], 10) : 1
        while (i < lines.length) {
          const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i])
          if (m && /\d/.test(m[2]) === ordered) { items.push(m[3]); i++; continue }
          // a continuation line of the last item (indented, not blank, not a new block)
          if (items.length && /^\s{2,}\S/.test(lines[i]) && !m) { items[items.length - 1] += ' ' + lines[i].trim(); i++; continue }
          break
        }
        blocks.push({ t: ordered ? 'ol' : 'ul', items, start })
        continue
      }
      para.push(line.trim())
      i++
    }
    flush()
    return blocks
  }

  // ── inline ───────────────────────────────────────────────────────────────────────────────
  const AUTO_ID = /\b(T\d\d|PW\d|W\d)\b/g
  // opt.rowIds: a regex of row IDs that link to table anchors in this note's scope
  function inline(text, opt = {}) {
    const out = []
    const src = String(text)
    let i = 0, buf = ''
    const push = (tok) => { if (buf) { out.push(...plainTokens(buf, opt)); buf = '' } out.push(tok) }
    while (i < src.length) {
      const ch = src[i]
      if (ch === '\\' && i + 1 < src.length && /[\\`*_[\]()|#<>!-]/.test(src[i + 1])) { buf += src[i + 1]; i += 2; continue }
      if (ch === '`') {
        const j = src.indexOf('`', i + 1)
        if (j > i) { push({ t: 'code', text: src.slice(i + 1, j) }); i = j + 1; continue }
      }
      if (ch === '[' && src[i + 1] === '[') {
        const j = src.indexOf(']]', i + 2)
        if (j > i) {
          const inner = src.slice(i + 2, j)
          const [ref, label] = inner.split('|')
          const [target, anchor] = ref.split('#')
          push({ t: 'wiki', target: target.trim(), anchor: (anchor || '').trim(), label: (label || '').trim() })
          i = j + 2
          continue
        }
      }
      if (ch === '[') {
        const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(src.slice(i))
        if (m) { push({ t: 'link', href: m[2], children: inline(m[1], { ...opt, noAuto: true }) }); i += m[0].length; continue }
      }
      if (ch === '*' && src[i + 1] === '*') {
        const j = src.indexOf('**', i + 2)
        if (j > i + 2) { push({ t: 'strong', children: inline(src.slice(i + 2, j), opt) }); i = j + 2; continue }
      }
      if (ch === '*' && src[i + 1] !== ' ') {
        const j = src.indexOf('*', i + 1)
        if (j > i + 1 && src[j - 1] !== ' ') { push({ t: 'em', children: inline(src.slice(i + 1, j), opt) }); i = j + 1; continue }
      }
      buf += ch
      i++
    }
    if (buf) out.push(...plainTokens(buf, opt))
    return out
  }
  // plain text, with ID mentions picked out (unless this is inside a link label)
  function plainTokens(s, opt) {
    s = decodeEntities(s)
    if (opt.noAuto) return [{ t: 'text', text: s }]
    const re = opt.rowIds ? new RegExp(`${AUTO_ID.source}|\\b(${opt.rowIds.source})\\b`, 'g') : new RegExp(AUTO_ID.source, 'g')
    const out = []
    let last = 0
    for (const m of s.matchAll(re)) {
      if (m.index > last) out.push({ t: 'text', text: s.slice(last, m.index) })
      out.push(m[1] ? { t: 'id', id: m[1] } : { t: 'row', id: m[2] })
      last = m.index + m[0].length
    }
    if (last < s.length) out.push({ t: 'text', text: s.slice(last) })
    return out
  }
  const textOf = (toks) => toks.map((k) => (k.t === 'text' || k.t === 'code' ? k.text : k.t === 'id' || k.t === 'row' ? k.id : k.t === 'wiki' ? k.label || k.target + (k.anchor ? '#' + k.anchor : '') : k.children ? textOf(k.children) : '')).join('')
  const plain = (text) => textOf(inline(text, { noAuto: true }))

  // the inline text of every block that holds prose (a table row's defining first cell is marked)
  function* allTexts(blocks) {
    for (let b = 0; b < blocks.length; b++) {
      const x = blocks[b]
      if (x.t === 'p' || x.t === 'quote' || x.t === 'h') yield { b, text: x.text }
      else if (x.t === 'ul' || x.t === 'ol') for (const it of x.items) yield { b, text: it }
      else if (x.t === 'table') {
        for (const c of x.head) yield { b, text: c, head: true }
        for (const r of x.rows) for (let k = 0; k < r.length; k++) yield { b, text: r[k], rowDef: k === 0 && ROW_ID.test(r[0]) }
      }
    }
  }

  // ── links ────────────────────────────────────────────────────────────────────────────────
  // what a note links to, each with the sentence around the link (for backlinks)
  function links(blocks, opt = {}) {
    const out = []
    const walk = (toks, whole) => {
      for (const k of toks) {
        if (k.t === 'wiki') out.push({ kind: 'wiki', target: k.target, anchor: k.anchor, label: k.label, context: whole })
        else if (k.t === 'id' && opt.autolink !== false) out.push({ kind: 'id', target: k.id, anchor: '', label: '', context: whole })
        else if (k.t === 'row' && opt.autolink !== false) out.push({ kind: 'row', target: k.id, anchor: k.id.toLowerCase(), label: '', context: whole })
        if (k.children) walk(k.children, whole)
      }
    }
    for (const { text, rowDef, head } of allTexts(blocks)) {
      if (rowDef) continue
      const toks = inline(text, head ? { ...opt, noAuto: true } : opt)
      walk(toks, textOf(toks))
    }
    return out
  }

  // ── the clocks: read and listen ──────────────────────────────────────────────────────────
  const count = (s) => (String(s).match(/\S+/g) || []).length
  // narration: prose, lists and headings word for word; a table, a figure, a formula or a code
  // block as one line. opt.lines: { table(n), figure(caption), formula(), code() } from copy.js
  const LINES = { table: (n) => `a table of ${n} rows, on the page.`, figure: (c) => `a figure: ${c}.`, formula: () => 'a formula, on the page.', code: () => 'a code block, on the page.' }
  function spoken(blocks, opt = {}) {
    const L = { ...LINES, ...(opt.lines || {}) }
    const out = []
    blocks.forEach((x, i) => {
      let text = ''
      if (x.t === 'p' || x.t === 'quote' || x.t === 'h') text = plain(x.text)
      else if (x.t === 'ul' || x.t === 'ol') text = x.items.map(plain).join('. ')
      else if (x.t === 'table') text = L.table(x.rows.length)
      else if (x.t === 'img') text = L.figure(x.alt)
      else if (x.t === 'fence' && x.kind === 'latex') text = L.formula()
      else if (x.t === 'fence' && x.kind === 'block' && opt.block) text = opt.block(x.id) || ''
      else if (x.t === 'fence' && EMBEDS.includes(x.kind)) text = x.caption ? L.figure(x.caption.replace(/^fig\s*·\s*/, '')) : ''
      else if (x.t === 'fence') text = L.code()
      if (text.trim()) out.push({ i, text: text.trim() })
    })
    return out
  }
  function stats(blocks, opt = {}) {
    let prose = 0, rows = 0, cells = 0
    for (const x of blocks) {
      if (x.t === 'p' || x.t === 'quote' || x.t === 'h') prose += count(plain(x.text))
      else if (x.t === 'ul' || x.t === 'ol') prose += x.items.reduce((a, it) => a + count(plain(it)), 0)
      else if (x.t === 'table') { rows += x.rows.length; cells += [...x.head, ...x.rows.flat()].reduce((a, c) => a + count(plain(c)), 0) }
      else if (x.t === 'fence' && x.kind === 'block' && opt.blockWords) prose += opt.blockWords(x.id) || 0
    }
    const said = spoken(blocks, opt).reduce((a, s) => a + count(s.text), 0)
    return { prose, rows, cells, spoken: said }
  }

  // ── render ───────────────────────────────────────────────────────────────────────────────
  // ctx: { resolve(target, anchor) → { href, title, glyph, label } | null, row(id) → href | null,
  //        rowIds: RegExp, autolink: bool, block(id) → html, embed(block, n) → html, asset(src) }
  function render(blocks, ctx = {}) {
    const headings = [], figures = []
    const used = new Set()
    const anchor = (text) => { let s = slugify(text), n = 2; while (used.has(s)) s = `${slugify(text)}-${n++}`; used.add(s); return s }
    const opt = { rowIds: ctx.rowIds, noAuto: ctx.autolink === false }
    let fig = 0
    const tokHtml = (toks) => toks.map((k) => {
      if (k.t === 'text') return escape(k.text)
      if (k.t === 'code') return `<code>${escape(k.text)}</code>`
      if (k.t === 'strong') return `<strong>${tokHtml(k.children)}</strong>`
      if (k.t === 'em') return `<em>${tokHtml(k.children)}</em>`
      if (k.t === 'link') {
        const href = safeHref(k.href)
        const ext = href && /^https?:/.test(href)
        return href ? `<a href="${escape(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${tokHtml(k.children)}</a>` : tokHtml(k.children)
      }
      if (k.t === 'wiki') {
        const r = ctx.resolve && ctx.resolve(k.target, k.anchor)
        const label = k.label || (r && r.label) || k.target
        // "T03 Error analysis": the ID mono and dim, the title in the text face (O7)
        const lid = /^(T\d\d|PW\d|W\d)\s+(.+)$/.exec(label)
        const text = lid ? `<span class="nb-lid">${escape(lid[1])}</span> ${escape(lid[2])}` : escape(label)
        return r ? `<a class="nb-wl" href="${escape(r.href)}" data-to="${escape(r.id || '')}" title="${escape(r.title || '')}">${text}</a>`
          : `<span class="nb-wl is-broken" title="unresolved: ${escape(k.target)}">${escape(label)}</span>`
      }
      if (k.t === 'id') {
        const r = ctx.resolve && ctx.resolve(k.id, '')
        return r ? `<a class="nb-wl nb-id" href="${escape(r.href)}" data-to="${escape(r.id || '')}" title="${escape(r.title || '')}">${escape(k.id)}</a>` : escape(k.id)
      }
      if (k.t === 'row') {
        const href = ctx.row && ctx.row(k.id)
        return href ? `<a class="nb-wl nb-rowref" href="${escape(href)}">${escape(k.id)}</a>` : escape(k.id)
      }
      return ''
    }).join('')
    const il = (text) => tokHtml(inline(text, opt))
    const html = blocks.map((x, i) => {
      const say = ` data-say="${i}"`
      if (x.t === 'h') {
        const id = anchor(plain(x.text))
        headings.push({ level: x.level, text: plain(x.text), id })
        const lv = Math.min(4, Math.max(2, x.level))
        return `<h${lv} id="${id}" class="nb-h"${say}>${il(x.text)}</h${lv}>`
      }
      if (x.t === 'p') return `<p${say}>${il(x.text)}</p>`
      if (x.t === 'quote') return `<blockquote${say}><p>${il(x.text)}</p></blockquote>`
      if (x.t === 'hr') return '<hr>'
      if (x.t === 'ul') return `<ul${say}>${x.items.map((it) => `<li>${il(it)}</li>`).join('')}</ul>`
      if (x.t === 'ol') return `<ol${say}${x.start !== 1 ? ` start="${x.start}"` : ''}>${x.items.map((it) => `<li>${il(it)}</li>`).join('')}</ol>`
      if (x.t === 'table') {
        // a header cell is never auto-linked: "Example (A1)" stays one line
        const th = (c) => tokHtml(inline(c, { ...opt, noAuto: true }))
        const head = `<tr>${x.head.map((c) => `<th scope="col">${th(c)}</th>`).join('')}</tr>`
        const ids = x.rows.some((r) => ROW_ID.test(r[0]))
        const body = x.rows.map((r) => {
          const def = ROW_ID.test(r[0]) ? r[0].toLowerCase() : ''
          if (def) used.add(def)
          return `<tr${def ? ` id="${def}"` : ''}>${r.map((c, k) => (k === 0 && def ? `<td class="nb-td-id">${escape(r[0])}</td>` : `<td>${il(c)}</td>`)).join('')}</tr>`
        }).join('')
        const label = escape(plain(x.head.join(' · ')))
        // two columns and no row anchors: on a phone it reads as a stack of definitions instead
        const two = x.head.length === 2 && !ids
        const dl = two ? `<dl class="nb-dl" aria-label="${label}">${x.rows.map((r) => `<div><dt>${il(r[0] || '')}</dt><dd>${il(r[1] || '')}</dd></div>`).join('')}</dl>` : ''
        return `<div class="nb-table-wrap${two ? ' is-two' : ''}${ids ? ' has-ids' : ''}" data-rows="${x.rows.length}"${say}><div class="nb-table" role="region" tabindex="0" aria-label="${label}"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>${dl}</div>`
      }
      if (x.t === 'img') {
        fig++
        figures.push({ n: fig, src: x.src, alt: x.alt })
        const src = safeHref(x.src) || (ctx.asset ? ctx.asset(x.src) : null)
        return `<figure class="nb-fig" data-fig="${fig}"${say}>${src ? `<button type="button" class="nb-fig__img" data-fig="${fig}" aria-label="${escape(x.alt || 'figure ' + fig)}"><img src="${escape(src)}" alt="${escape(x.alt)}" loading="lazy" decoding="async"></button>` : ''}<figcaption class="nb-cap">fig ${fig} · ${escape(x.alt)}</figcaption></figure>`
      }
      if (x.t === 'fence') {
        if (x.kind === 'block') return `<div class="nb-block" data-block="${escape(x.id)}"${say}>${ctx.block ? ctx.block(x.id) : ''}</div>`
        if (x.kind === 'latex') return `<figure class="nb-formula"${say}><code>${escape(latexText(x.body))}</code></figure>`
        if (EMBEDS.includes(x.kind)) {
          fig++
          figures.push({ n: fig, embed: x.kind, id: x.id, caption: x.caption })
          const cap = x.caption ? x.caption.replace(/^fig\b/, `fig ${fig}`) : `fig ${fig} · ${x.kind}`
          const inner = ctx.embed ? ctx.embed(x, fig) : ''
          const attrs = Object.entries(x.attrs).map(([k, v]) => ` data-${escape(k)}="${escape(v)}"`).join('')
          return `<figure class="nb-embed nb-embed--${x.kind}" data-embed="${x.kind}" data-id="${escape(x.id)}"${attrs}${say}><div class="nb-embed__body">${inner}</div><figcaption class="nb-cap">${escape(cap)}</figcaption></figure>`
        }
        return `<pre class="nb-code"${say}><code>${escape(x.body)}</code></pre>`
      }
      return ''
    }).join('\n')
    return { html, headings, figures }
  }
  // the spec's one formula, as plain text: \frac{a}{b} → (a) / (b), \text{x} → x
  function latexText(s) {
    let out = String(s).trim()
    for (let k = 0; k < 4; k++) out = out.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1) / ($2)').replace(/\\text\{([^{}]*)\}/g, '$1')
    return out.replace(/\\[a-z]+/g, '').replace(/\s+/g, ' ').replace(/ - /g, ' − ')
  }

  NB.md = { frontmatter, parse, inline, render, links, stats, spoken, plain, slugify, escape, latexText, ROW_ID, FENCES, EMBEDS, LINES }
})()
