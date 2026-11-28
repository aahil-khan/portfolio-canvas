/**
 * Rule OG: share cards and metadata on every Lab route. Lane module for scripts/check-lab.mjs
 * (API.md §11; plan PR 13).
 *
 * For every Lab page that answers 200:
 *   - one `og:image`, absolute on `SITE_URL`, naming the page's own card (`<path>/opengraph-image`),
 *     which answers 200 `image/png`, a real 1200 × 630 PNG; `og:image:width`/`height` say so and it
 *     has an alt;
 *   - `twitter:card` is `summary_large_image` and `twitter:image` is the same card, not the site's;
 *   - `og:title` is the page's title (an entry's own title, the section's, or the home's line),
 *     `og:description` its lede, and `og:url` and the canonical are the same absolute URL;
 *   - an entry is `og:type` article with its published time, and carries JSON-LD that parses, with no
 *     raw `<`: an Article (headline, url, datePublished, author, image = its card) and a
 *     BreadcrumbList whose items are absolute, numbered from 1, ending at the page.
 * For every route `routes()` lists, a page or not yet (PR 9 builds sections): its card answers as
 * above, and while the Lab is hidden carries `X-Robots-Tag: noindex`.
 * From the build: every card is prerendered (in `prerender-manifest.json`), so `next/og` never runs on
 * a request; and nothing under `lib/lab/og/` or the four `opengraph-image.tsx` fetches anything.
 */
import fs from 'node:fs'
import path from 'node:path'

import { entryByPath, getLab } from '../../lib/lab/content.ts'
import { plainInline } from '../../lib/lab/text.ts'
import { LAB_X_ROBOTS_HIDDEN } from '../../lib/lab/visibility.ts'
import { SITE_URL } from '../../lib/site.ts'

const CARD_FILES = [
  'app/lab/opengraph-image.tsx',
  'app/lab/[section]/opengraph-image.tsx',
  'app/lab/[section]/[entry]/opengraph-image.tsx',
  'app/lab/[section]/[entry]/[child]/opengraph-image.tsx',
]
const OG_DIR = 'lib/lab/og'
const CARD_KINDS = new Set(['home', 'section', 'entry'])

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'gi'))].map((m) => {
    const a = {}
    for (const x of m[1].matchAll(/([\w:-]+)="([^"]*)"/g)) a[x[1].toLowerCase()] = decode(x[2])
    return a
  })
}
const metas = (html, key) => tags(html, 'meta').filter((m) => m.property === key || m.name === key).map((m) => m.content)
const meta = (html, key) => metas(html, key)[0]
const ldScripts = (html) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])

/** The PNG's own width and height, from its IHDR chunk. */
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

/** What an entry's page and card say under its title (lib/lab/seo.ts, `entryDescription`). */
const entryDescription = (e) => plainInline(e.lede ?? (e.kind === 'essay' ? e.opening : (e.keyLine ?? '')))

/** Source with comments removed, so a URL in a doc comment is not mistaken for a fetch. */
const code = (file) =>
  fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1')

const seo = {
  id: 'OG',
  title: 'Share cards and metadata on every Lab route',
  needs: ['build', 'server'],
  async run(ctx) {
    const fail = []
    const notes = []
    if (!CARD_FILES.every((f) => fs.existsSync(path.join(ctx.root, f)))) return { notBuilt: 'no opengraph-image routes under app/lab yet' }
    if (!ctx.lab.built) return { notBuilt: 'no Lab routes yet (PR 2)' }
    const { labPublic } = ctx.visibility
    const { copy, sections } = getLab()
    const site = new URL(SITE_URL)
    const canonical = (p) => new URL(p, SITE_URL).toString().replace(/\/$/, '')
    const bytes = async (p) => {
      const res = await fetch(ctx.base + p, { redirect: 'manual' })
      return { status: res.status, headers: res.headers, buf: Buffer.from(await res.arrayBuffer()) }
    }

    // nothing a card draws is fetched: no fetch() and no remote URL in the card code
    for (const f of [...CARD_FILES, ...fs.readdirSync(path.join(ctx.root, OG_DIR)).filter((x) => /\.tsx?$/.test(x) && !x.endsWith('.test.ts')).map((x) => `${OG_DIR}/${x}`)]) {
      const src = code(path.join(ctx.root, f))
      if (/\bfetch\s*\(/.test(src)) fail.push(`${f} calls fetch(): a card must read everything from disk`)
      if (/['"`]https?:\/\//.test(src)) fail.push(`${f} names a remote URL: a card must read everything from disk`)
    }

    // every card is prerendered at build
    const manifest = path.join(ctx.root, '.next/prerender-manifest.json')
    const pre = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')).routes ?? {} : null
    if (!pre) fail.push('no .next/prerender-manifest.json: run the build first')

    const cardRoutes = ctx.lab.routes.filter((r) => CARD_KINDS.has(r.kind))
    let cards = 0
    let pages = 0
    const notYet = []
    for (const r of cardRoutes) {
      const cardPath = `${r.path}/opengraph-image`
      if (pre && !pre[cardPath]) fail.push(`${cardPath} is not prerendered: it would run next/og (and sharp) on a request`)

      const img = await bytes(cardPath)
      const size = img.status === 200 ? pngSize(img.buf) : null
      if (img.status !== 200) fail.push(`${cardPath} answered ${img.status}`)
      else if (!/^image\/png\b/.test(img.headers.get('content-type') ?? '')) fail.push(`${cardPath} is ${img.headers.get('content-type')}, not image/png`)
      else if (!size || size.w !== 1200 || size.h !== 630) fail.push(`${cardPath} is ${size ? `${size.w}×${size.h}` : 'not a PNG'}, not 1200×630`)
      else cards++
      if (!labPublic && !(img.headers.get('x-robots-tag') ?? '').split(',').map((s) => s.trim()).includes(LAB_X_ROBOTS_HIDDEN))
        fail.push(`${cardPath} has no X-Robots-Tag: ${LAB_X_ROBOTS_HIDDEN} while the Lab is hidden`)

      const res = await ctx.get(r.path)
      if (res.status !== 200) {
        notYet.push(r.path)
        continue
      }
      pages++
      const html = res.text
      const url = canonical(r.path)
      const where = r.path

      // the card, named once, absolute, on the site's origin
      const images = metas(html, 'og:image')
      if (images.length !== 1) fail.push(`${where} has ${images.length} og:image tags, not one`)
      const og = images[0] ?? ''
      let ogUrl = null
      try {
        ogUrl = new URL(og)
      } catch {
        fail.push(`${where}: og:image "${og}" is not an absolute URL`)
      }
      if (ogUrl && (ogUrl.origin !== site.origin || ogUrl.pathname !== cardPath)) fail.push(`${where}: og:image is ${og}, not its own card ${canonical(cardPath)}`)
      if (meta(html, 'og:image:width') !== '1200' || meta(html, 'og:image:height') !== '630') fail.push(`${where}: og:image is not declared 1200×630`)
      if (!meta(html, 'og:image:alt')) fail.push(`${where}: its card has no og:image:alt`)
      if (meta(html, 'twitter:card') !== 'summary_large_image') fail.push(`${where}: twitter:card is ${meta(html, 'twitter:card')}, not summary_large_image`)
      if (meta(html, 'twitter:image') !== og) fail.push(`${where}: twitter:image is ${meta(html, 'twitter:image')}, not its card`)

      // the words and the URL
      const canon = tags(html, 'link').find((l) => (l.rel ?? '').split(/\s+/).includes('canonical'))?.href
      if (canon !== url) fail.push(`${where}: canonical is ${canon}, not ${url}`)
      if (meta(html, 'og:url') !== url) fail.push(`${where}: og:url is ${meta(html, 'og:url')}, not ${url}`)
      const e = r.kind === 'entry' ? entryByPath(r.path.split('/').slice(2)) : null
      const section = r.kind === 'section' ? sections.find((s) => s.id === r.path.split('/')[2]) : null
      const wantTitle = e ? e.title : section ? section.title : copy.ogHomeKind
      if (meta(html, 'og:title') !== wantTitle) fail.push(`${where}: og:title is "${meta(html, 'og:title')}", not "${wantTitle}"`)
      if (meta(html, 'twitter:title') !== wantTitle) fail.push(`${where}: twitter:title is "${meta(html, 'twitter:title')}", not "${wantTitle}"`)
      const wantDesc = e ? entryDescription(e) : r.kind === 'home' ? copy.homeTitle : null
      if (wantDesc && meta(html, 'og:description') !== wantDesc) fail.push(`${where}: og:description is "${meta(html, 'og:description')}", not its lede "${wantDesc}"`)
      if (!meta(html, 'og:description')) fail.push(`${where} has no og:description`)

      if (!e) continue
      if (meta(html, 'og:type') !== 'article') fail.push(`${where}: og:type is ${meta(html, 'og:type')}, not article`)
      if (meta(html, 'article:published_time') !== e.published) fail.push(`${where}: article:published_time is ${meta(html, 'article:published_time')}, not ${e.published}`)

      // JSON-LD: an Article and a BreadcrumbList
      const blocks = ldScripts(html)
      const nodes = []
      for (const raw of blocks) {
        if (raw.includes('<')) fail.push(`${where}: a JSON-LD script holds a raw "<"`)
        try {
          const v = JSON.parse(raw)
          nodes.push(...(Array.isArray(v) ? v : [v]))
        } catch (err) {
          fail.push(`${where}: JSON-LD does not parse (${err.message})`)
        }
      }
      const article = nodes.find((n) => n['@type'] === 'Article')
      const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList')
      if (!article) fail.push(`${where} has no Article JSON-LD`)
      else {
        if (article['@context'] !== 'https://schema.org') fail.push(`${where}: the Article's @context is ${article['@context']}`)
        if (article.headline !== e.title) fail.push(`${where}: the Article's headline is "${article.headline}"`)
        if (article.url !== url || article.mainEntityOfPage !== url) fail.push(`${where}: the Article's url is ${article.url}`)
        if (article.datePublished !== e.published || !/^\d{4}-\d{2}-\d{2}$/.test(article.dateModified ?? '')) fail.push(`${where}: the Article's dates are ${article.datePublished} / ${article.dateModified}`)
        if (article.image !== og) fail.push(`${where}: the Article's image is ${article.image}, not its card`)
        if (article.author?.['@type'] !== 'Person' || !article.author?.name || article.author?.url !== SITE_URL) fail.push(`${where}: the Article has no Person author on ${SITE_URL}`)
      }
      if (!crumbs) fail.push(`${where} has no BreadcrumbList JSON-LD`)
      else {
        const items = crumbs.itemListElement ?? []
        if (crumbs['@context'] !== 'https://schema.org') fail.push(`${where}: the BreadcrumbList's @context is ${crumbs['@context']}`)
        if (items.length < 2) fail.push(`${where}: the breadcrumbs have ${items.length} steps`)
        items.forEach((it, i) => {
          if (it['@type'] !== 'ListItem' || it.position !== i + 1 || !it.name) fail.push(`${where}: breadcrumb ${i + 1} is malformed`)
          if (!String(it.item).startsWith(`${SITE_URL}/lab`)) fail.push(`${where}: breadcrumb ${i + 1} is ${it.item}, not an absolute Lab URL`)
        })
        if (items.at(-1)?.item !== url) fail.push(`${where}: the breadcrumbs end at ${items.at(-1)?.item}, not the page`)
        if (items[0]?.item !== canonical('/lab')) fail.push(`${where}: the breadcrumbs start at ${items[0]?.item}, not the Lab`)
      }
    }
    notes.push(`${cards} cards (1200×630 PNG, prerendered) and ${pages} pages checked`)
    if (notYet.length) notes.push(`no page yet (PR 9) at ${notYet.join(', ')}: their cards are checked, their tags wait`)
    return { fail, notes }
  },
}

export default seo
