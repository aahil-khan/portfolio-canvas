/*
 * prototype/lab/night-mode/model.js: what is in the Lab, and the markup for it. Pure: no DOM, no
 * layout, no coordinates. check.mjs runs all of it in Node.
 *
 * WHAT GOES WHERE is decided here, from each piece's `kind`, by filtering the kit's pieces.js
 * (no kit edit). The Lab holds only the serious work; the fun stuff stays on the desk:
 *   work         kind `write-up`: the projects (tagline, stack, status, award, [read] [live] [repo])
 *   experiments  kind `experiment`: a lab log (exp-NN · month · topic, title, first line)
 *   writing      kind `write-up` with a body, and kind `essay`: posts (date, reading time)
 *   (nowhere)    `scrap`, `found`, `game`
 * A write-up is both a project and the post about it, so it is in work and in writing.
 *
 *   NIGHT.model.SECTIONS             the three sections, in order
 *   NIGHT.model.build(pieces)        [{ id, count, entries: [...] }]
 *   NIGHT.model.treeHtml(sections)   the menu's left column: one <li> per section and per entry
 *   NIGHT.model.rowHtml(e, s)        one entry's row (what the 20th-piece proof compares)
 *   NIGHT.model.previewHtml(row)     the right column for a section or an entry
 *   NIGHT.model.readable(pieces)     what opens in the reader, per section, in menu order
 *   NIGHT.model.parts(body)          a write-up's body split into its sections (the reader's TOC)
 *   NIGHT.model.minutes(body), .when(piece)
 *
 * A NEW PIECE IS ONE NEW ROW. Nothing here reads a position, a height or a count of rows to place
 * anything: the menu is a CSS grid and the tree's guides (├── └──) are CSS, so the row before a
 * new one keeps its markup byte for byte.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  const L = () => root_.LAB
  const C = () => NIGHT.copy
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

  const SECTIONS = [{ id: 'work', key: '1' }, { id: 'experiments', key: '2' }, { id: 'writing', key: '3' }]
  const IN = { work: (p) => p.kind === 'write-up', experiments: (p) => p.kind === 'experiment', writing: (p) => (p.kind === 'write-up' && !!p.body) || p.kind === 'essay' }
  const inLab = (p) => SECTIONS.some((s) => IN[s.id](p))
  const LINK = { Repo: 'repo', Github: 'repo', Site: 'live', Demo: 'live' }
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  // the display date: a month only when the source had one (pieces.js keeps a placeholder month
  // in `date` for a year-only source, and no view may show it)
  const when = (p) => {
    const [y, m] = String(p.date || '').split('-')
    return /[a-z]/i.test(p.when || '') && m ? `${MON[+m - 1]} ${y}` : y || ''
  }
  const host = (u) => { try { return new URL(u).host.replace(/^www\./, '') } catch { return u } }
  // reading time: words over 220 a minute, at least one. Markup is not words.
  const words = (md) => String(md || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([a-z0-9-]+)\]\]/g, '$1').replace(/[*#-]/g, ' ').split(/\s+/).filter(Boolean).length
  const minutes = (md) => Math.max(1, Math.round(words(md) / 220))
  // a post imported from elsewhere (essay.js): its body and images live there, not in pieces.js
  const imp = (p) => (NIGHT.imports || {})[p.slug] || null
  const bodyOf = (p) => p.body || (imp(p) ? imp(p).body : '')
  const IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)$/
  const imagesOf = (p) => p.images || String(bodyOf(p)).split(/\n\s*\n/).map((b) => IMG.exec(b.trim())).filter(Boolean).map((m) => ({ src: m[2], caption: m[1] }))
  const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const topic = (p) => { const c = (L().constellations || []).find((x) => x.id === p.constellation); return c ? c.name.toLowerCase() : '' }
  const firstLines = (md, max) => {
    const para = String(md || '').split(/\n\s*\n/).map((b) => b.trim()).find((b) => b && !/^[-#!]/.test(b)) || ''
    const plain = para.replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\[\[([a-z0-9-]+)\]\]/g, '$1')
    if (plain.length <= max) return plain
    const cut = plain.slice(0, max), sp = cut.lastIndexOf(' ')
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:.\s]+$/, '') + '…'
  }

  // pinned first, then newest first; ties keep lab.json's order (Array.sort is stable)
  const newest = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
  const oldest = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)

  const ENTRIES = {
    work: (own) => own.sort(newest).map((p) => {
      const f = (NIGHT.facts || {})[p.slug] || {}
      return {
        slug: p.slug, title: p.title, tagline: p.blurb || '', kind: (f.kind || '').toLowerCase(), year: String(p.date || '').slice(0, 4),
        stack: f.stack || [], status: p.status || '', award: f.award || '', read: !!p.body, images: p.images || [],
        links: (f.links || []).map((l) => ({ label: LINK[l.label] || l.label.toLowerCase(), href: l.href })),
      }
    }),
    // exp-NN counts up in date order, so a newer experiment is a new number and no old one moves
    experiments: (own) => {
      const n = new Map(own.slice().sort(oldest).map((p, i) => [p.slug, i + 1]))
      return own.sort(newest).map((p) => ({
        slug: p.slug, n: 'exp-' + String(n.get(p.slug)).padStart(2, '0'), when: when(p), topic: topic(p), title: p.title,
        result: L().excerpt ? L().excerpt(p, 96) : p.blurb || '', lines: firstLines(p.body, 260), status: p.status || '',
        images: p.images || [], read: !!p.body, href: p.href || '',
      }))
    },
    writing: (own) => own.sort(newest).map((p) => ({
      slug: p.slug, when: when(p), title: p.title, sub: p.blurb || '', lines: firstLines(bodyOf(p), 300),
      mins: imp(p) && imp(p).mins ? imp(p).mins : bodyOf(p) ? minutes(bodyOf(p)) : 0, href: bodyOf(p) ? '' : p.href || '', read: !!bodyOf(p),
    })),
  }
  const build = (pieces) => SECTIONS.map((s) => {
    const own = pieces.filter(IN[s.id])
    return { id: s.id, key: s.key, count: own.length, entries: ENTRIES[s.id](own.slice()) }
  })
  // what opens in the reader: per section, in the menu's order (prev / next follow it)
  const readable = (pieces) => Object.fromEntries(build(pieces).filter((s) => s.id !== 'work').map((s) => [s.id, s.entries.filter((e) => e.read)]))

  // a write-up's body is its story, then its lede, then its highlights (pieces.js, "Projects:
  // lede, then highlights as a `- ` list"). The reader gives each part a heading, so a long one
  // gets a table of contents. A body with its own `## ` headings keeps them instead.
  const parts = (md) => {
    const blocks = String(md || '').trim().split(/\n\s*\n/).filter(Boolean)
    if (blocks.some((b) => /^##\s/.test(b))) {
      // its own headings: one section per ##, its ### and figures inside it
      const out = []
      let cur = null
      for (const b of blocks) {
        const m = /^##\s+(.+)$/.exec(b.trim())
        if (m) { cur = { id: slugify(m[1]), title: m[1], blocks: [] }; out.push(cur) } else { if (!cur) { cur = { title: '', blocks: [] }; out.push(cur) } cur.blocks.push(b) }
      }
      return out
    }
    const list = blocks.findIndex((b) => /^- /.test(b.trim()))
    if (list < 1) return [{ title: '', blocks }]
    const out = []
    if (list > 1) out.push({ id: 'story', title: C().sec.story, blocks: blocks.slice(0, list - 1) })
    out.push({ id: 'what', title: C().sec.what, blocks: [blocks[list - 1]] })
    out.push({ id: 'highlights', title: C().sec.highlights, blocks: blocks.slice(list) })
    return out
  }

  // ── markup: the tree ─────────────────────────────────────────────────────────────────────
  // Row ids are section/slug: a write-up is a row in work and another in writing.
  const META = {
    work: (e) => [e.kind, e.year].filter(Boolean).join(' · '),
    // the date, not exp-NN: a back-dated experiment renumbers the later ones, and its row must be
    // the only one that changes (the number is in the preview and the reader)
    experiments: (e) => e.when,
    writing: (e) => (e.href ? C().out(host(e.href)) : C().mins(e.mins)),
  }
  const rowHtml = (e, s) => `<li class="ti" role="treeitem" id="r-${s}-${esc(e.slug)}" data-row="${s}/${esc(e.slug)}" data-sec="${s}" data-entry="${esc(e.slug)}" tabindex="-1">` +
    `<span class="row"><span class="row__in"><span class="row__ttl">${esc(e.title)}</span><span class="row__m">${esc(META[s](e))}</span></span></span></li>`
  const secHtml = (s) => `<span class="row row--sec" id="r-${s.id}"><span class="row__in"><span class="row__ttl">${esc(s.id)}/</span>` +
    `<span class="row__m" aria-label="${esc(C().entries(s.count))}">${String(s.count).padStart(2, '0')}</span></span></span>`
  const treeHtml = (secs) => `<li class="ti-root" role="none"><span class="row row--root"><span class="row__in"><span class="row__ttl">${esc(C().root)}</span></span></span></li>` +
    secs.map((s) => `<li class="sec" role="treeitem" aria-expanded="true" aria-labelledby="r-${s.id}" data-row="${s.id}" data-sec="${s.id}" tabindex="-1">` +
      secHtml(s) + `<ul class="sec__items" role="group">${s.entries.map((e) => rowHtml(e, s.id)).join('')}</ul></li>`).join('')

  // ── markup: the preview ──────────────────────────────────────────────────────────────────
  const asset = (src) => (L().asset ? L().asset(src) : src)
  const act = (label, attrs, primary) => `<button type="button" class="act${primary ? ' act--go' : ''}" ${attrs}>${primary ? '<span class="act__k" aria-hidden="true">↵ </span>' : ''}${esc(label)}</button>`
  const link = (l) => `<a class="act" href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a>`
  const kv = (pairs) => {
    const rows = pairs.filter(([, v]) => v)
    return rows.length ? `<dl class="pv__kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''
  }
  const thumbs = (imgs, max) => imgs.length ? `<div class="pv__figs" data-n="${Math.min(max, imgs.length)}">` +
    imgs.slice(0, max).map((im, i) => `<figure class="pv__fig"><img src="${esc(asset(im.src))}" alt="${esc(im.caption || '')}" loading="lazy"><figcaption>${esc(C().fig(i + 1))}${im.caption ? ' · ' + esc(im.caption) : ''}</figcaption></figure>`).join('') + `</div>` : ''
  const PREVIEW = {
    section: (s) => `<p class="pv__path">${esc(C().root)}/${esc(s.id)}</p>` +
      `<h3 class="pv__title" data-pv-title>${esc(s.id)}/</h3>` +
      `<p class="pv__sub">${esc(C().sections[s.id].unit(s.count))}</p>` +
      `<p class="pv__lede">${esc(C().sections[s.id].blurb)}</p>` +
      `<ol class="pv__ls">${s.entries.map((e) => `<li><button type="button" class="pv__li" data-sel="${s.id}/${esc(e.slug)}"><span class="pv__lst">${esc(e.title)}</span><span class="pv__lsm">${esc(META[s.id](e))}</span></button></li>`).join('')}</ol>` +
      `<p class="pv__act">${act(C().enter, `data-go="${s.id}"`, true)}</p>`,
    work: (e) => `<p class="pv__path">${esc(C().root)}/work/${esc(e.slug)}</p>` +
      `<h3 class="pv__title" data-pv-title>${esc(e.title)}</h3>` +
      `<p class="pv__sub">${esc([e.kind, e.year].filter(Boolean).join(' · '))}</p>` +
      (e.tagline ? `<p class="pv__lede">${esc(e.tagline)}</p>` : '') +
      kv([[C().kv.stack, e.stack.join(' · ')], [C().kv.status, e.status], [C().kv.award, e.award]]) +
      ((e.read || e.links.length) ? `<p class="pv__act">${e.read ? act(C().read, `data-read="${esc(e.slug)}" data-in="writing"`, true) : ''}${e.links.map(link).join('')}</p>` : '') +
      thumbs(e.images, 1),
    experiments: (e) => `<p class="pv__path">${esc(C().root)}/experiments/${esc(e.slug)}</p>` +
      `<p class="pv__log">${esc([e.n, e.when, e.topic].filter(Boolean).join(' · '))}${e.status ? ` <span class="pv__st">${esc(e.status)}</span>` : ''}</p>` +
      `<h3 class="pv__title" data-pv-title>${esc(e.title)}</h3>` +
      (e.lines ? `<p class="pv__lines">${esc(e.lines)}</p>` : '') +
      `<p class="pv__act">${e.read ? act(C().open, `data-read="${esc(e.slug)}" data-in="experiments"`, true) : ''}${e.href ? link({ label: C().out(host(e.href)), href: e.href }) : ''}</p>` +
      thumbs(e.images, 3),
    writing: (e) => `<p class="pv__path">${esc(C().root)}/writing/${esc(e.slug)}</p>` +
      `<p class="pv__log">${esc([e.when, e.href ? C().out(host(e.href)) : C().minsRead(e.mins)].filter(Boolean).join(' · '))}</p>` +
      `<h3 class="pv__title" data-pv-title>${esc(e.title)}</h3>` +
      (e.sub ? `<p class="pv__lede">${esc(e.sub)}</p>` : '') +
      (e.lines ? `<p class="pv__lines pv__lines--fade">${esc(e.lines)}</p>` : '') +
      `<p class="pv__act">${e.read ? act(C().read, `data-read="${esc(e.slug)}" data-in="writing"`, true) : `<a class="act act--go" href="${esc(e.href)}" rel="noopener"><span class="act__k" aria-hidden="true">↵ </span>${esc(C().readOn(host(e.href)))}</a>`}</p>`,
  }
  // row: { sec, entry? } → the right column
  const previewHtml = (secs, rowId) => {
    const [sid, slug] = String(rowId).split('/')
    const s = secs.find((x) => x.id === sid)
    if (!s) return ''
    if (!slug) return PREVIEW.section(s)
    const e = s.entries.find((x) => x.slug === slug)
    return e ? PREVIEW[sid](e) : ''
  }
  // the order ↑↓ walks: each section, then its entries
  const order = (secs) => secs.flatMap((s) => [s.id, ...s.entries.map((e) => s.id + '/' + e.slug)])

  NIGHT.model = { imp, bodyOf, imagesOf, SECTIONS, inLab, build, readable, parts, treeHtml, rowHtml, secHtml, previewHtml, order, minutes, when, host, firstLines }
})()
