// prototype/lab/night-mode/import-medium.mjs: Aahil's Medium export → the reader's body format.
//
//   node prototype/lab/night-mode/import-medium.mjs <export/posts dir>   (writes essay.js here)
//
// Medium's export is one HTML file per post, every block a `graf`: h3 (the first is the title,
// the rest are sections), h4 (subsections), p, ul / ol > li, figure > img + figcaption. This
// turns each into the body format the Lab reads (shared/body.js, plus what the reader adds):
//   ## section   ### subsection   paragraphs   - item   1. item   ![caption](src)
//   **bold**  *italic*  [label](https://…)  `code`
// No HTML parser and no dependency: the export is regular, and anything it does not recognise
// is reported, not dropped silently. The real build runs the same mapping over the export when
// an essay is imported (an /edit upload, or the update-content skill).
//
// Which file is which post: the id at the end of the file name, mapped to the Lab's slugs below.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const POSTS = { '16d07de27399': 'old-laptop-cloud', fdf2d3c9e219: 'chrome-hackathon' }

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }
const text = (s) => s.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => ENT[e] ?? (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : m))
// inline markup: strong, em, a, code, br. Anything else is reported.
export function inline(html, warn = () => {}) {
  const out = html
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/g, (m, t) => (t.trim() ? `**${t.trim()}**` + (/\s$/.test(t) ? ' ' : '') : t))
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/g, (m, t) => (t.trim() ? `*${t.trim()}*` + (/\s$/.test(t) ? ' ' : '') : t))
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/g, (m, t) => '`' + t + '`')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (m, href, t) => `[${t}](${href})`)
  const left = out.match(/<[a-z][^>]*>/gi)
  if (left) warn('unknown inline markup: ' + [...new Set(left)].join(' '))
  return text(out.replace(/<\/?[a-z][^>]*>/gi, '')).replace(/\s+/g, ' ').trim()
}

// one post: { title, subtitle, date, body, images, words }
export function convert(html, warn = () => {}) {
  const body = (/<section data-field="body"[\s\S]*<\/section>/.exec(html) || [''])[0]
  const blocks = [], images = []
  let title = ''
  const graf = /<(h3|h4|p|ul|ol|figure|blockquote|pre)\b[^>]*class="[^"]*graf[^"]*"[^>]*>([\s\S]*?)<\/\1>|<(ul|ol)\b[^>]*class="postList"[^>]*>([\s\S]*?)<\/\3>/g
  for (const m of body.matchAll(graf)) {
    const tag = m[1] || m[3], inner = m[2] ?? m[4]
    if (tag === 'h3' && !title) { title = inline(inner, warn).replace(/\*+/g, ''); continue }
    if (tag === 'h3') blocks.push('## ' + inline(inner, warn).replace(/\*+/g, '')) // headings carry no emphasis
    else if (tag === 'h4') blocks.push('### ' + inline(inner, warn).replace(/\*+/g, ''))
    else if (tag === 'p') { const t = inline(inner, warn); if (t) blocks.push(t) }
    else if (tag === 'ul' || tag === 'ol') {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((x, i) => (tag === 'ol' ? `${i + 1}. ` : '- ') + inline(x[1], warn))
      if (items.length) blocks.push(items.join('\n'))
    } else if (tag === 'figure') {
      const src = (/<img[^>]*src="([^"]+)"/.exec(inner) || [])[1]
      const cap = inline((/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(inner) || [, ''])[1], warn)
      // Medium serves its export images at 800px; ask its CDN for 1024, as the essay page does
      if (src) { const s = src.replace('/max/800/', '/max/1024/'); images.push({ src: s, caption: cap }); blocks.push(`![${cap.replace(/[[\]]/g, '')}](${s})`) }
    } else warn(`unhandled block <${tag}>`)
  }
  const subtitle = text(((/<section data-field="subtitle"[^>]*>([\s\S]*?)<\/section>/.exec(html) || [, ''])[1]).replace(/<[^>]+>/g, '')).trim()
  const date = (/<time[^>]*datetime="([^"]+)"/.exec(html) || [])[1] || ''
  const md = blocks.join('\n\n')
  const words = md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*#`-]/g, ' ').split(/\s+/).filter(Boolean).length
  return { title, subtitle, date: date.slice(0, 10), body: md, images, words }
}

// run as a script: convert every mapped post in the folder, write essay.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2]
  if (!dir) { console.error('usage: node import-medium.mjs <medium-export/posts>'); process.exit(2) }
  const out = {}
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.html') && !x.startsWith('draft_'))) {
    const id = (/-([0-9a-f]{10,})\.html$/.exec(f) || [])[1], slug = POSTS[id]
    if (!slug) { console.log(`skip  ${f} (no Lab slug for ${id})`); continue }
    const warns = []
    const post = convert(readFileSync(join(dir, f), 'utf8'), (w) => warns.push(w))
    const heads = post.body.split('\n\n').filter((b) => /^#{2,3} /.test(b)).length
    console.log(`${slug}: "${post.title}" · ${post.date} · ${post.words} words · ${heads} headings · ${post.images.length} figures${warns.length ? ' · WARN ' + [...new Set(warns)].join('; ') : ''}`)
    out[slug] = { source: 'medium', title: post.title, date: post.date, mins: Math.max(1, Math.round(post.words / 220)), body: post.body }
  }
  const js = `/*
 * prototype/lab/night-mode/essay.js: GENERATED by import-medium.mjs from Aahil's Medium export. Do
 * not edit by hand: run  node prototype/lab/night-mode/import-medium.mjs <medium-export/posts>
 *
 * The essays' real text, headings and figures (hotlinked from Medium's CDN, fine for a mockup),
 * in the reader's body format. They become the writing entries for these slugs, instead of the
 * medium.com link-out. In the real build this lands in content/data/writing.json as each essay's
 * body, through /edit or the update-content skill, and the images move into public/writing/.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  NIGHT.imports = ${JSON.stringify(out, null, 2).replace(/\n/g, '\n  ')}
})()
`
  writeFileSync(join(here, 'essay.js'), js)
  console.log('wrote essay.js')
}
