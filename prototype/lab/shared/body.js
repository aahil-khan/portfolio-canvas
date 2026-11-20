/*
 * prototype/lab/shared/body.js: the proposed `md` field, rendered. The prototype of the
 * hand-written renderer that would extend lib/rich.tsx (plan.md, "Content model and authoring").
 *
 * The whole syntax, on purpose a subset, so /edit can preview it and no markdown library enters
 * any bundle:
 *   paragraphs (blank line between)      ## heading                 - list item
 *   **bold**   *italic*   [label](https://…)   ![caption](/archive/…)   [[slug]] → another piece
 *
 *   LAB.body.render(md, { pieces, href(slug), asset(src) })  → HTML string (input is escaped)
 *   LAB.body.refs(md)                                        → slugs named by [[slug]]
 *   LAB.backlinks(pieces)    → { [slug]: [slugs that link to it] } from links + [[slug]]s.
 *                              Computed, never stored, so it cannot drift.
 *   LAB.excerpt(piece, max)  → blurb, else the body's first sentence, else the first caption
 *   LAB.asset(src)           → a site path (/work/…, /archive/…) resolved over file://.
 *                              Pages one level under prototype/lab/ need no setup; the hub sets
 *                              LAB.publicRoot = '../../public'.
 * Unresolved [[slug]]s render as marked text, the way validateSet would refuse them on save.
 */
;(() => {
  const LAB = (window.LAB = window.LAB || {})
  if (!LAB.publicRoot) LAB.publicRoot = '../../../public'
  LAB.asset = (src) => (/^\//.test(src) ? LAB.publicRoot + src : src)

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const safeUrl = (u) => /^(https?:\/\/|mailto:|\/)/.test(u)
  const REF = /\[\[([a-z0-9-]+)\]\]/g

  const inline = (s, o) => esc(s)
    .replace(REF, (m, slug) => {
      const p = (o.pieces || []).find((x) => x.slug === slug)
      return p ? `<a class="lab-ref" href="${esc(o.href(slug))}">${esc(p.title)}</a>`
        : `<span class="lab-ref lab-ref--broken" title="no piece called ${slug}">${slug}</span>`
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const u = url.replace(/&amp;/g, '&')
      return safeUrl(u) ? `<a href="${esc(u)}"${/^https?:/.test(u) ? ' rel="noopener"' : ''}>${label}</a>` : m
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')

  const render = (md, opts = {}) => {
    const o = { pieces: LAB.pieces, href: (slug) => `piece.html?p=${slug}`, asset: LAB.asset, ...opts }
    if (!md) return ''
    return md.trim().split(/\n\s*\n/).map((block) => {
      const lines = block.split('\n')
      const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(block.trim())
      if (img && safeUrl(img[2]))
        return `<figure class="lab-figure"><img src="${esc(o.asset(img[2]))}" alt="${esc(img[1])}" loading="lazy">` +
          (img[1] ? `<figcaption>${inline(img[1], o)}</figcaption>` : '') + '</figure>'
      if (/^## /.test(block)) return `<h2>${inline(block.slice(3), o)}</h2>`
      if (lines.every((l) => /^- /.test(l))) return '<ul>' + lines.map((l) => `<li>${inline(l.slice(2), o)}</li>`).join('') + '</ul>'
      return `<p>${inline(lines.join(' '), o)}</p>`
    }).join('\n')
  }
  const refs = (md) => [...String(md || '').matchAll(REF)].map((m) => m[1])
  LAB.body = { render, refs }

  LAB.backlinks = (pieces = LAB.pieces) => {
    const back = Object.fromEntries(pieces.map((p) => [p.slug, []]))
    for (const p of pieces)
      for (const s of new Set([...(p.links || []), ...refs(p.body)]))
        if (back[s] && s !== p.slug && !back[s].includes(p.slug)) back[s].push(p.slug)
    return back
  }

  LAB.excerpt = (p, max = 120) => {
    const text = p.blurb || (p.body ? p.body.split(/\n\s*\n/)[0].replace(/^- /, '') : '') ||
      ((p.images || [])[0] || {}).caption || ''
    const plain = text.replace(REF, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    const first = (/^(.+?[.!?])(\s|$)/.exec(plain) || [, plain])[1]
    return first.length <= max ? first : first.slice(0, first.lastIndexOf(' ', max - 1)) + '…'
  }
})()
