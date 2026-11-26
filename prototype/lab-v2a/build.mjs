// Builds the Lab v2A mockup into ONE self-contained HTML file.
//
//   node --experimental-strip-types --no-warnings prototype/lab-v2a/build.mjs [--fixtures] [--no-copy]
//
// Reads content/ (markdown with front matter, plus tours.json, external.json, ui.json), the
// site's 18 themes from content/themes.ts and the two Lab themes from src/lab-themes.json,
// renders every page body to HTML here, and inlines src/lab.css, src/*.js, the fonts and the
// images. The page makes no network request on load. --fixtures adds content/fixtures/ and
// writes lab-v2a.fixtures.html instead (never copied, never shipped).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const BUNDLE_COPY = path.join(os.homedir(), 'projects/scratch/lab-mockups/lab-v2a.html')
const TODAY = '2026-11-26'
const WPM_READ = 230
const WPM_LISTEN = 165

// ---------------------------------------------------------------- content loading

function frontMatter(src, file) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src)
  if (!m) throw new Error(`${file}: no front matter`)
  const data = {}
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue
    const kv = /^([a-z][\w-]*):\s*(.*)$/.exec(line)
    if (!kv) throw new Error(`${file}: bad front matter line: ${line}`)
    let v = kv[2].trim()
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
    else if (v === 'true' || v === 'false') v = v === 'true'
    else if (/^\d+$/.test(v)) v = Number(v)
    else if (/^".*"$/.test(v)) v = v.slice(1, -1)
    data[kv[1]] = v
  }
  return { data, body: m[2].trim() }
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : []
  })
}

function loadItems(dirs) {
  const items = []
  for (const base of dirs) {
    for (const file of walk(base)) {
      const rel = path.relative(base, file).split(path.sep)
      const { data, body } = frontMatter(fs.readFileSync(file, 'utf8'), file)
      const name = rel.at(-1).replace(/\.md$/, '')
      const section = rel[0] === name + '.md' ? null : rel[0]
      const item = { ...data, body, file: path.relative(HERE, file) }
      if (data.kind === 'section') { item.slug = rel[0]; item.section = rel[0]; item.key = rel[0] }
      else if (data.kind === 'series') { item.slug = rel[1]; item.section = section; item.key = rel[1] }
      else if (rel.length === 3) { item.slug = name; item.section = section; item.series = rel[1]; item.key = name }
      else { item.slug = name; item.section = section; item.key = name }
      items.push(item)
    }
  }
  return items
}

// ---------------------------------------------------------------- markdown

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Inline markdown. `ctx.link(target, label)` and `ctx.ext(key, label)` render links. */
function inline(src, ctx) {
  const tokens = []
  const hold = (html) => `\u0000${tokens.push(html) - 1}\u0000`
  let s = src
  // links first: a label may itself hold inline code, rendered by its own inline() call
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, l) => hold(ctx.link(t.trim(), l)))
  s = s.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`))
  s = s.replace(/\[([^\]]+)\]\(ext:([\w-]+)\)/g, (_, l, k) => hold(ctx.ext(k, l)))
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (_, l, u) => hold(`<a href="${esc(u)}" rel="noopener">${inline(l, ctx)}</a>`))
  s = esc(s)
  s = s.replace(/==(.+?)==/g, (_, t) => `<mark class="key" data-key>${t}</mark>`)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|\W)\*(.+?)\*(?=\W|$)/g, '$1<em>$2</em>')
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)])
}

/** Split prose into sentences without breaking inside code, links or a key sentence. */
function sentences(src) {
  const held = []
  const prot = src.replace(/`[^`]+`|\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\)|==.+?==/g, (m) => `\u0001${held.push(m) - 1}\u0001`)
  const parts = prot.split(/(?<=[.!?:]["”’)]?)\s+(?=["“(\u0001]?[A-Z0-9₹\u0001])/)
  return parts.map((p) => p.replace(/\u0001(\d+)\u0001/g, (_, i) => held[Number(i)]))
}

function table(lines, ctx) {
  const row = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  const head = row(lines[0])
  const body = lines.slice(2).map(row)
  const th = head.map((h, i) => `<th scope="col"${i === 0 ? ' class="rowhead"' : ''}>${inline(h, ctx)}</th>`).join('')
  const trs = body.map((r) => `<tr>${r.map((c, i) => i === 0
    ? `<th scope="row">${inline(c, ctx)}</th>`
    : `<td data-col="${esc(head[i].replace(/`/g, ''))}">${inline(c, ctx)}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`
}

function windowFrame({ kind, idText, label, title, inner, cls = '' }) {
  return `<figure class="win art ${cls}" data-artifact="${kind}">` +
    `<figcaption class="win-bar"><span class="win-id" data-id>${esc(idText)}</span><span class="win-label">${esc(label)}</span></figcaption>` +
    `<div class="win-body">${inner}</div>` +
    (title ? `<p class="art-cap">${esc(title)}</p>` : '') + `</figure>`
}

function imageArtifact(spec, item, ctx) {
  const [, file, label, alt] = spec.split('|').map((s) => s.trim())
  const src = ctx.asset(file)
  return windowFrame({ kind: 'image', idText: item.id || String(item.number).padStart(2, '0'), label,
    inner: `<img src="${src}" alt="${esc(alt)}" width="1280" height="720" decoding="async">` })
}

/** Body markdown → { html, toc, text }. Paragraphs and list items get sentence spans for Listen. */
function renderBody(md, item, ctx) {
  const lines = md.split('\n')
  const out = []
  const toc = []
  let i = 0
  let h2n = 0
  const para = (txt) => sentences(txt).map((s) => `<span class="s">${inline(s, ctx)}</span>`).join(' ')
  while (i < lines.length) {
    const l = lines[i]
    if (!l.trim()) { i++; continue }
    if (l.startsWith(':::artifact')) {
      const [, type, idText, title] = /^:::artifact\s+(\w+)\s*\|\s*([^|]+)\|\s*(.*)$/.exec(l) || []
      const inner = []
      i++
      while (i < lines.length && lines[i].trim() !== ':::') inner.push(lines[i++])
      i++
      const [idPart] = idText.split('·').map((s) => s.trim())
      const content = type === 'table' ? table(inner.filter((x) => x.trim()), ctx) : inline(inner.join(' '), ctx)
      out.push(windowFrame({ kind: type, idText: idPart, label: title.trim(), inner: content }))
      continue
    }
    if (l.startsWith('## ')) {
      const text = l.slice(3).trim()
      h2n++
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const num = String(h2n).padStart(2, '0')
      toc.push({ id, num, text })
      out.push(`<h2 id="${id}"><span class="h-num" data-id>${num}</span>${inline(text, ctx)}</h2>`)
      i++
      continue
    }
    if (l.startsWith('> ')) {
      const q = []
      while (i < lines.length && lines[i].startsWith('> ')) q.push(lines[i++].slice(2))
      out.push(`<blockquote class="pull" data-pullquote><p>${inline(q.join(' '), ctx)}</p></blockquote>`)
      continue
    }
    if (l.startsWith('|')) {
      const t = []
      while (i < lines.length && lines[i].startsWith('|')) t.push(lines[i++])
      out.push(`<div class="table-wrap">${table(t, ctx)}</div>`)
      continue
    }
    if (/^- /.test(l)) {
      const li = []
      while (i < lines.length && /^- /.test(lines[i])) {
        let txt = lines[i++].slice(2)
        while (i < lines.length && /^ {2}\S/.test(lines[i])) txt += ' ' + lines[i++].trim()
        li.push(`<li>${para(txt)}</li>`)
      }
      out.push(`<ul>${li.join('')}</ul>`)
      continue
    }
    const p = []
    while (i < lines.length && lines[i].trim() && !/^(## |> |\||- |:::)/.test(lines[i])) p.push(lines[i++])
    out.push(`<p>${para(p.join(' '))}</p>`)
  }
  const html = out.join('\n')
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
  return { html, toc, text }
}

const words = (t) => (t.match(/[\p{L}\p{N}₹][\p{L}\p{N}'’.,₹-]*/gu) || []).length

// ---------------------------------------------------------------- themes

function hexToRgb(c) {
  c = c.trim()
  let m = /^#([0-9a-f]{6})$/i.exec(c)
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1)
  m = /^#([0-9a-f]{3})$/i.exec(c)
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16)).concat(1)
  m = /^rgba?\(([^)]+)\)$/.exec(c)
  if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); return [p[0], p[1], p[2], p[3] ?? 1] }
  throw new Error(`colour? ${c}`)
}
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1)
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t).concat(1)

/** --accent at 28%, lowered where the ink on it would drop under 4.5:1 (frappé, everforest). */
function selAlpha(accent, canvas, ink) {
  let al = 0.28
  const ok = (x) => { const bg = over([...accent.slice(0, 3), x], canvas); return ratio(over(ink, bg), bg) >= 4.5 }
  while (al > 0.08 && !ok(al)) al -= 0.01
  return al
}

/** The 9 Lab tokens each site theme derives (plan §4, "Additions for the 18"). */
function deriveLabTokens(k) {
  const surface = hexToRgb(k.surface)
  const canvas = hexToRgb(k.canvas)
  const inkSolid = over(hexToRgb(k.ink), surface)
  const inks = [k.ink, k.inkMuted, k.inkSubtle].map(hexToRgb)
  const clears = (g) => inks.every((c) => ratio(over(c, g), g) >= 4.5)
  // ±4% toward the ink, eased back where a theme's subtle ink would drop under 4.5:1 on it
  let tAlt = 0.04
  while (tAlt > 0 && !clears(mix(surface, inkSolid, tAlt))) tAlt -= 0.005
  const alt = mix(surface, inkSolid, Math.max(0, tAlt))
  const sunken = mix(surface, inkSolid, -0.04)
  const grounds = [canvas, surface, alt, sunken]
  let accentText = hexToRgb(k.accent)
  // "darkened until it reaches 4.5:1": walk the accent toward the ink (darker on light themes,
  // lighter on dark ones) until it clears every ground the Lab sets text on.
  for (let t = 0; t <= 1.0001 && Math.min(...grounds.map((g) => ratio(accentText, g))) < 4.5; t += 0.02) accentText = mix(hexToRgb(k.accent), inkSolid, t)
  const a = hexToRgb(k.accent)
  const inkRgb = hexToRgb(k.ink)
  return {
    'surface-alt': hex(alt), 'surface-sunken': hex(sunken),
    hairline: `rgba(${inkRgb.slice(0, 3).join(',')},.10)`,
    link: k.ink, 'link-underline': k.accent,
    'accent-text': hex(accentText), focus: hex(accentText),
    selection: `rgba(${a.slice(0, 3).join(',')},${selAlpha(a, canvas, inkRgb).toFixed(3)})`, 'selection-ink': k.ink,
  }
}

async function loadThemes() {
  const { themes } = await import(pathToFileURL(path.join(ROOT, 'content/themes.ts')).href)
  const lab = JSON.parse(fs.readFileSync(path.join(HERE, 'src/lab-themes.json'), 'utf8'))
  const site = themes.map((t) => ({
    id: t.id, label: t.label, dark: t.dark, lab: false,
    tokens: {
      'canvas-base': t.tokens.canvas, 'canvas-grid': t.tokens.grid, surface: t.tokens.surface,
      ink: t.tokens.ink, 'ink-muted': t.tokens.inkMuted, 'ink-subtle': t.tokens.inkSubtle,
      accent: t.tokens.accent, 'accent-ink': t.tokens.accentInk, border: t.tokens.border,
      ...deriveLabTokens(t.tokens),
    },
  }))
  return [...lab, ...site]
}

const themeCss = (all) => all.map((t) => `[data-theme="${t.id}"]{color-scheme:${t.dark ? 'dark' : 'light'};` +
  Object.entries(t.tokens).map(([k, v]) => `--${k}:${v}`).join(';') + '}').join('\n')

// ---------------------------------------------------------------- the model

const fmtDate = (iso) => {
  const d = new Date(iso + 'T00:00:00Z')
  const m = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
  return `${d.getUTCDate()} ${m}${iso.slice(0, 4) === TODAY.slice(0, 4) ? '' : ' ' + iso.slice(0, 4)}`
}

function model(items, tours, external, ui, assets) {
  const byKey = new Map()
  for (const it of items) {
    if (byKey.has(it.key)) throw new Error(`duplicate key ${it.key} (${it.file} and ${byKey.get(it.key).file})`)
    byKey.set(it.key, it)
  }
  const resolve = (t, from) => {
    const it = byKey.get(t) || [...byKey.values()].find((x) => x.key.endsWith(t))
    if (!it) throw new Error(`${from}: [[${t}]] does not resolve`)
    return it
  }
  const sections = items.filter((i) => i.kind === 'section').sort((a, b) => a.number - b.number)
  // paths
  for (const it of items) {
    if (it.kind === 'section') it.path = `/lab/${it.slug}`
    else if (it.kind === 'series') it.path = `/lab/${it.section}/${it.slug}`
    else if (it.series) it.path = `/lab/${it.section}/${it.series}/${it.slug}`
    else it.path = `/lab/${it.section}/${it.slug}`
  }
  for (const t of tours) {
    const it = { ...t, kind: 'tour', key: `tour-${t.slug}`, path: `/lab/tours/${t.slug}`, section: null, number: Number(t.id.slice(1)), short: t.title, tags: [] }
    it.stops = t.stops.map((s) => resolve(s, it.key).key)
    items.push(it)
    byKey.set(it.key, it)
  }
  for (const it of items) {
    it.sectionTitle = it.section ? byKey.get(it.section)?.title : null
    it.seriesItem = it.series ? byKey.get(it.series) : null
    it.links = new Set((Array.isArray(it.links) ? it.links : []).map((l) => resolve(l, it.key).key))
    it.tags = Array.isArray(it.tags) ? it.tags : []
  }
  // render bodies (collects body links)
  for (const it of items) {
    const ctx = {
      link: (t, label) => {
        const target = resolve(t, it.key)
        it.links.add(target.key)
        return `<a href="#${target.path}" data-preview="${target.key}">${label ? inline(label, ctx) : esc(target.short || target.title)}</a>`
      },
      ext: (k, label) => {
        const e = external[k]
        if (!e) throw new Error(`${it.key}: unknown external link ${k}`)
        return `<a href="${esc(e.url)}" rel="noopener" target="_blank" data-ext="${k}">${inline(label, ctx)}</a>`
      },
      asset: (f) => assets(f),
    }
    if (it.artifact && typeof it.artifact === 'string') {
      const type = it.artifact.split('|')[0].trim()
      if (type === 'image') it.artifactHtml = imageArtifact(it.artifact, it, ctx)
    }
    if (it.body) {
      const r = renderBody(it.body, it, ctx)
      // a front-matter artifact leads the page when the body doesn't open with one
      if (it.artifactHtml && !r.html.trimStart().startsWith('<figure')) r.html = it.artifactHtml + '\n' + r.html
      it.html = r.html
      if (/\bundefined\b|\bNaN\b|\[object /.test(r.text)) throw new Error(`${it.key}: rendered text contains a template slip`)
      it.toc = r.toc
      it.text = r.text
      it.words = words(r.text)
      it.readMin = Math.max(1, Math.round(it.words / WPM_READ))
      it.listenMin = Math.max(1, Math.round(it.words / WPM_LISTEN))
      it.built = true
      const m = /<figure class="win art[^"]*" data-artifact="[^"]*">[\s\S]*?<\/figure>/.exec(r.html)
      if (m && r.html.trimStart().startsWith('<figure') && !it.artifactHtml) it.artifactHtml = m[0]
      it.pullquotes = (r.html.match(/data-pullquote/g) || []).length
    } else {
      it.built = false
    }
    if (it.kind === 'tour') {
      const ws = it.stops.reduce((n, k) => n + (byKey.get(k).words || 0), 0)
      it.readMin = Math.max(1, Math.round(ws / WPM_READ)) || null
      it.listenMin = Math.max(1, Math.round(ws / WPM_LISTEN)) || null
    }
  }
  // backlinks
  for (const it of items) it.backlinks = new Set()
  for (const it of items) for (const l of it.links) byKey.get(l).backlinks.add(it.key)
  // related (plan §4)
  const toursOf = (k) => items.filter((t) => t.kind === 'tour' && t.stops.includes(k)).map((t) => t.key)
  for (const it of items) {
    const linked = [...new Set([...it.links, ...it.backlinks])].filter((k) => k !== it.key)
      .map((k) => ({ key: k, how: it.links.has(k) && it.backlinks.has(k) ? 'both' : it.links.has(k) ? 'linkedFromHere' : 'linksHere' }))
      .slice(0, 6)
    const linkedKeys = new Set([...it.links, ...it.backlinks])
    const myTours = toursOf(it.key)
    const scored = items.filter((o) => o.key !== it.key && !linkedKeys.has(o.key) && o.kind !== 'section')
      .map((o) => {
        let s = 0
        if (it.series && o.series === it.series && Math.abs((o.number || 0) - (it.number || 0)) === 1) s += 3
        if (myTours.some((t) => toursOf(o.key).includes(t))) s += 2
        s += o.tags.filter((t) => it.tags.includes(t)).length
        if ([...o.links].some((l) => it.links.has(l))) s += 1
        return { key: o.key, s, updated: o.updated }
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.updated.localeCompare(a.updated))
      .slice(0, 4)
    it.related = { linked, also: scored.map((x) => x.key), total: linkedKeys.size }
  }
  // featured: pinned (newest pinned wins), else newest with an artifact
  const content = items.filter((i) => !['section', 'tour'].includes(i.kind))
  const newest = (a, b) => b.updated.localeCompare(a.updated) || b.published.localeCompare(a.published) || a.title.localeCompare(b.title)
  const featured = content.filter((i) => i.pinned).sort(newest)[0] || content.filter((i) => i.artifactHtml).sort(newest)[0]
  const latest = content.filter((i) => i.kind !== 'study').sort(newest).slice(0, 5).map((i) => i.key)
  // folders: what each path segment opens
  const folders = {}
  for (const s of sections) folders[s.key] = items.filter((i) => i.section === s.key && i.kind !== 'section' && !i.series).sort((a, b) => a.number - b.number).map((i) => i.key)
  for (const s of items.filter((i) => i.kind === 'series')) folders[s.key] = items.filter((i) => i.series === s.key).sort((a, b) => a.number - b.number).map((i) => i.key)
  folders.lab = sections.map((s) => s.key)
  // map: one column per section, nodes in folder order, edges only from real links
  const mapNodes = []
  sections.forEach((s) => {
    const keys = [...folders[s.key].flatMap((k) => [k, ...(folders[k] || [])])]
    keys.forEach((k) => mapNodes.push({ key: k, section: s.key }))
  })
  const edgeSet = new Set()
  for (const it of items) for (const l of it.links) {
    if (!mapNodes.find((n) => n.key === it.key) || !mapNodes.find((n) => n.key === l)) continue
    edgeSet.add([it.key, l].sort().join('|'))
  }
  const map = { nodes: mapNodes, edges: [...edgeSet].map((e) => e.split('|')), columns: sections.map((s) => s.key) }

  const pub = (it) => ({
    key: it.key, kind: it.kind, path: it.path, title: it.title, short: it.short || it.title, line: it.line || '',
    id: it.id || null, number: it.number ?? null, status: it.status || '', section: it.section, sectionTitle: it.sectionTitle,
    series: it.series || null, seriesShort: it.seriesItem ? (it.seriesItem.short || it.seriesItem.title) : null,
    published: it.published, updated: it.updated, publishedLabel: fmtDate(it.published), updatedLabel: fmtDate(it.updated),
    audience: it.audience || '', tags: it.tags, built: it.built, html: it.html || null, toc: it.toc || [],
    words: it.words || 0, readMin: it.readMin || null, listenMin: it.listenMin || null, listen: !!it.listen,
    artifactHtml: it.artifactHtml || null, preview: (it.text ? it.text.split(' ').slice(0, 60).join(' ') : it.line || '') + (it.text && it.text.split(' ').length > 60 ? '…' : ''),
    related: it.related, stops: it.stops || null, pinned: !!it.pinned, study: !!it.study, pullquotes: it.pullquotes || 0,
  })
  return {
    items: Object.fromEntries(items.map((i) => [i.key, pub(i)])),
    sections: sections.map((s) => s.key),
    tours: items.filter((i) => i.kind === 'tour').sort((a, b) => a.number - b.number).map((i) => i.key),
    featured: featured?.key || null, latest, folders, map, external, ui, today: TODAY,
  }
}

// ---------------------------------------------------------------- assemble

const b64 = (p) => fs.readFileSync(p).toString('base64')
const mime = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

export async function build({ fixtures = false, copy = true } = {}) {
  const contentDir = path.join(HERE, 'content')
  const dirs = [contentDir]
  // fixtures live in content/fixtures/ and mirror content/'s layout; load them only on request
  const base = loadItems(dirs).filter((i) => !i.file.startsWith('content/fixtures/'))
  const extra = fixtures ? loadItems([path.join(contentDir, 'fixtures')]) : []
  const items = [...base, ...extra]
  const read = (f) => JSON.parse(fs.readFileSync(path.join(contentDir, f), 'utf8'))
  const tours = read('tours.json')
  const external = read('external.json')
  const ui = read('ui.json')
  if (fixtures) tours.push(...JSON.parse(fs.readFileSync(path.join(contentDir, 'fixtures/tours.json'), 'utf8')))
  const assets = (f) => { const p = path.join(contentDir, 'assets', f); return `data:${mime[path.extname(f)]};base64,${b64(p)}` }
  const data = model(items, tours, external, ui, assets)
  const themes = await loadThemes()
  data.themes = themes.map((t) => ({ id: t.id, label: t.label, dark: t.dark, lab: t.lab, swatch: [t.tokens['canvas-base'], t.tokens.surface, t.tokens.accent, t.tokens.ink] }))
  data.fixtures = fixtures

  const font = (fam, file, weight, extra = '') => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64(path.join(HERE, 'fonts', file))}) format("woff2");font-weight:${weight};font-style:normal;font-display:swap;${extra}}`
  const fonts = [
    font('Space Grotesk', 'space-grotesk-latin.woff2', '300 700'),
    font('Space Mono', 'space-mono-400-latin.woff2', '400'),
    font('Caveat', 'caveat-400-dates.woff2', '400'),
  ].join('\n')
  const css = fs.readFileSync(path.join(HERE, 'src/lab.css'), 'utf8')
  const js = fs.readdirSync(path.join(HERE, 'src')).filter((f) => /^\d\d-.*\.js$/.test(f)).sort()
    .map((f) => `// ---- ${f}\n${fs.readFileSync(path.join(HERE, 'src', f), 'utf8')}`).join('\n')
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  const boot = `(function(){var id='lab-dark';try{var m=/[?&]theme=([\\w-]+)/.exec(location.hash);var s=localStorage.getItem('lab.theme');id=(m&&m[1])||s||id}catch(e){}document.documentElement.setAttribute('data-theme',id)})()`
  const html = `<!doctype html>
<html lang="en-GB" data-theme="lab-dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Aahil Khan's Lab</title>
<meta name="description" content="${esc(ui.home.intro)}">
<script>${boot}</script>
<style>${fonts}
${themeCss(themes)}
${css}</style>
</head>
<body>
<a class="skip" href="#main">Skip to the text</a>
<div id="app"></div>
<script type="application/json" id="lab-data">${json}</script>
<script>
(function () {
'use strict';
${js}
})();
</script>
</body>
</html>
`
  const out = path.join(HERE, fixtures ? 'lab-v2a.fixtures.html' : 'lab-v2a.html')
  fs.writeFileSync(out, html)
  if (copy && !fixtures) {
    fs.mkdirSync(path.dirname(BUNDLE_COPY), { recursive: true })
    fs.copyFileSync(out, BUNDLE_COPY)
  }
  return { out, bytes: Buffer.byteLength(html), data }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixtures = process.argv.includes('--fixtures')
  const r = await build({ fixtures, copy: !process.argv.includes('--no-copy') })
  console.log(`${path.relative(process.cwd(), r.out)}  ${(r.bytes / 1024).toFixed(0)} KB  ${Object.keys(r.data.items).length} items`)
}
