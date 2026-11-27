/**
 * Rule SB: site basics. Lane module for scripts/check-lab.mjs (API.md §11; plan PR 5).
 *
 *   - A path nothing serves answers 404 with the site's own page (`[data-error-page="404"]`, its
 *     heading from `content/errors.ts`), server-rendered, so it is complete without JavaScript.
 *   - `/manifest.webmanifest` is valid JSON with the fields an install needs, and every icon it
 *     names answers with its declared type and, for a PNG, its declared size. `/apple-icon.png` is
 *     180×180. `/` links the manifest, the icon and the touch icon.
 *   - `/feed.xml` parses as strict XML (Chromium's DOMParser), is RSS 2.0 with every required
 *     channel field, every item has a title, link, guid, description and a valid pubDate, and its
 *     links are on `SITE_URL`'s origin or are the posts' own. `/` links it as an alternate.
 *   - JSON-LD on `/` and every `/work/*` page parses, and its raw text holds no `<` (so no field can
 *     close the script). `/` describes the owner as a Person on `SITE_URL`. The serializer escapes a
 *     `</script>` inside a field.
 *   - Every sitemap URL is on `SITE_URL`, and each page it lists has an absolute canonical equal to
 *     that URL, an absolute OG image that answers as an image, `og:title`, `og:url`, and Twitter's
 *     card, title, description and image. A project page's images are its own card, not the site's.
 *   - `SITE_URL` is an https origin with no path or trailing slash.
 *   - The five unused Next starter files are gone from `public/`.
 *
 * Over HTTP, plus one browser page for the XML parser. Nothing here touches the live site.
 */
import fs from 'node:fs'
import path from 'node:path'

import { SITE_URL } from '../../lib/site.ts'
import { jsonLd } from '../../lib/seo/json-ld.ts'
import { errors } from '../../content/errors.ts'

const STARTER_FILES = ['file.svg', 'globe.svg', 'next.svg', 'vercel.svg', 'window.svg']
const PROBES = ['/nope', '/work/__nothing-here__']

/** The attributes of every `<name …>` tag in `html`, as plain objects, entities decoded. */
function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'gi'))].map((m) => {
    const a = {}
    for (const x of m[1].matchAll(/([\w:-]+)="([^"]*)"/g)) a[x[1].toLowerCase()] = decode(x[2])
    return a
  })
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const meta = (html, key) => tags(html, 'meta').find((m) => m.property === key || m.name === key)?.content
const links = (html, rel) => tags(html, 'link').filter((l) => (l.rel ?? '').split(/\s+/).includes(rel))
const ldScripts = (html) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])

/** The PNG's own width and height, from its IHDR chunk. */
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

const basics = {
  id: 'SB',
  title: 'Site basics: 404, manifest, icons, feed, JSON-LD, canonicals, Twitter tags',
  needs: ['server', 'browser'],
  async run(ctx) {
    const fail = []
    const notes = []
    const site = new URL(SITE_URL)
    /** A URL on SITE_URL, fetched from the server under test instead. */
    const local = (u) => {
      const url = new URL(u, SITE_URL)
      return url.origin === site.origin ? url.pathname + url.search : null
    }
    const bytes = async (p) => {
      const res = await fetch(ctx.base + p, { redirect: 'manual' })
      return { status: res.status, type: res.headers.get('content-type') ?? '', buf: Buffer.from(await res.arrayBuffer()) }
    }

    // SITE_URL itself
    if (site.protocol !== 'https:' || SITE_URL !== site.origin) fail.push(`SITE_URL (${SITE_URL}) must be a bare https origin, no path or trailing slash`)

    // the starter files
    for (const f of STARTER_FILES) if (fs.existsSync(path.join(ctx.root, 'public', f))) fail.push(`public/${f} is still there, and nothing uses it`)

    // 404
    for (const p of PROBES) {
      const res = await ctx.get(p)
      if (res.status !== 404) fail.push(`${p} answered ${res.status}, not 404`)
      if (!/data-error-page="404"/.test(res.text)) fail.push(`${p} does not render the site's 404 page ([data-error-page="404"])`)
      else if (!res.text.includes(errors.notFound.title)) fail.push(`${p}'s 404 page does not say "${errors.notFound.title}"`)
      if (/<link[^>]+rel="canonical"/.test(res.text)) fail.push(`${p} carries a canonical link; a 404 has no canonical URL`)
    }

    // manifest and icons
    const home = await ctx.get('/')
    if (home.status !== 200) fail.push(`/ answered ${home.status}`)
    const manifestLink = links(home.text, 'manifest')[0]?.href
    if (!manifestLink) fail.push('/ has no <link rel="manifest">')
    const mres = await ctx.get('/manifest.webmanifest')
    if (mres.status !== 200) fail.push(`/manifest.webmanifest answered ${mres.status}`)
    else {
      if (!/application\/manifest\+json/.test(mres.headers.get('content-type') ?? '')) fail.push(`/manifest.webmanifest is served as ${mres.headers.get('content-type')}`)
      let m = null
      try {
        m = JSON.parse(mres.text)
      } catch (e) {
        fail.push(`/manifest.webmanifest is not JSON: ${e.message}`)
      }
      if (m) {
        for (const k of ['name', 'short_name', 'start_url', 'display', 'background_color', 'theme_color'])
          if (typeof m[k] !== 'string' || !m[k]) fail.push(`the manifest has no ${k}`)
        for (const k of ['background_color', 'theme_color']) if (m[k] && !/^#[0-9a-f]{6}$/i.test(m[k])) fail.push(`the manifest's ${k} (${m[k]}) is not a #rrggbb colour`)
        if (!['fullscreen', 'standalone', 'minimal-ui', 'browser'].includes(m.display)) fail.push(`the manifest's display (${m.display}) is not a display mode`)
        if (m.start_url && local(m.start_url) === null) fail.push(`the manifest's start_url (${m.start_url}) leaves the site`)
        const icons = Array.isArray(m.icons) ? m.icons : []
        if (!icons.length) fail.push('the manifest names no icons')
        const pngSizes = new Set()
        for (const icon of icons) {
          const p = local(icon.src)
          if (!p) {
            fail.push(`manifest icon ${icon.src} is not on the site`)
            continue
          }
          const r = await bytes(p)
          if (r.status !== 200) fail.push(`manifest icon ${icon.src} answered ${r.status}`)
          else if (icon.type && !r.type.startsWith(icon.type)) fail.push(`manifest icon ${icon.src} says ${icon.type}, is served as ${r.type}`)
          else if (icon.type === 'image/png') {
            const s = pngSize(r.buf)
            if (!s || `${s.w}x${s.h}` !== icon.sizes) fail.push(`manifest icon ${icon.src} says ${icon.sizes}, is ${s ? `${s.w}x${s.h}` : 'not a PNG'}`)
            else pngSizes.add(icon.sizes)
          }
        }
        for (const need of ['192x192', '512x512']) if (!pngSizes.has(need)) fail.push(`the manifest has no ${need} PNG icon`)
      }
    }
    const apple = await bytes('/apple-icon.png')
    const appleSize = apple.status === 200 ? pngSize(apple.buf) : null
    if (apple.status !== 200) fail.push(`/apple-icon.png answered ${apple.status}`)
    else if (!appleSize || appleSize.w !== 180 || appleSize.h !== 180) fail.push(`/apple-icon.png is ${appleSize ? `${appleSize.w}×${appleSize.h}` : 'not a PNG'}, not 180×180`)
    if (!links(home.text, 'apple-touch-icon').length) fail.push('/ has no <link rel="apple-touch-icon">')
    if (!links(home.text, 'icon').length) fail.push('/ has no <link rel="icon">')

    // feed
    const alt = links(home.text, 'alternate').find((l) => l.type === 'application/rss+xml')
    if (!alt) fail.push('/ has no <link rel="alternate" type="application/rss+xml">')
    else if (alt.href !== `${SITE_URL}/feed.xml`) fail.push(`/'s feed link is ${alt.href}, not ${SITE_URL}/feed.xml`)
    const feed = await ctx.get('/feed.xml')
    if (feed.status !== 200) fail.push(`/feed.xml answered ${feed.status}`)
    else {
      if (!/^application\/(rss\+)?xml/.test(feed.headers.get('content-type') ?? '')) fail.push(`/feed.xml is served as ${feed.headers.get('content-type')}`)
      const { page, close } = await ctx.page(null)
      const parsed = await page.evaluate((xml) => {
        const doc = new DOMParser().parseFromString(xml, 'application/xml')
        const err = doc.getElementsByTagName('parsererror')[0]
        if (err) return { error: err.textContent }
        const text = (el, name) => el.getElementsByTagName(name)[0]?.textContent?.trim() ?? null
        const rss = doc.documentElement
        const channel = rss.getElementsByTagName('channel')[0]
        if (!channel) return { root: rss.nodeName, version: rss.getAttribute('version') }
        const self = [...channel.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'link')].find((l) => l.getAttribute('rel') === 'self')
        return {
          root: rss.nodeName,
          version: rss.getAttribute('version'),
          channel: { title: text(channel, 'title'), link: text(channel, 'link'), description: text(channel, 'description'), self: self?.getAttribute('href') ?? null },
          items: [...channel.getElementsByTagName('item')].map((it) => ({
            title: text(it, 'title'),
            link: text(it, 'link'),
            guid: text(it, 'guid'),
            description: text(it, 'description'),
            pubDate: text(it, 'pubDate'),
          })),
        }
      }, feed.text)
      await close()
      if (parsed.error) fail.push(`/feed.xml is not well-formed XML: ${parsed.error.split('\n')[0]}`)
      else if (parsed.root !== 'rss' || parsed.version !== '2.0') fail.push(`/feed.xml's root is <${parsed.root} version="${parsed.version}">, not RSS 2.0`)
      else {
        const c = parsed.channel
        for (const k of ['title', 'link', 'description']) if (!c[k]) fail.push(`the feed's channel has no ${k}`)
        if (c.link && c.link.replace(/\/$/, '') !== SITE_URL) fail.push(`the feed's channel link is ${c.link}, not ${SITE_URL}`)
        if (c.self !== `${SITE_URL}/feed.xml`) fail.push(`the feed's atom:link rel="self" is ${c.self}, not ${SITE_URL}/feed.xml`)
        if (!parsed.items.length) fail.push('the feed has no items')
        for (const [i, it] of parsed.items.entries()) {
          const at = `feed item ${i + 1} (${it.title ?? 'untitled'})`
          for (const k of ['title', 'link', 'guid', 'description', 'pubDate']) if (!it[k]) fail.push(`${at} has no ${k}`)
          if (it.pubDate && !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} (GMT|[+-]\d{4})$/.test(it.pubDate)) fail.push(`${at}'s pubDate "${it.pubDate}" is not RFC 822`)
          if (it.link && !/^https:\/\//.test(it.link)) fail.push(`${at}'s link ${it.link} is not absolute https`)
        }
        notes.push(`feed: ${parsed.items.length} items`)
      }
    }

    // the serializer, directly
    const probe = jsonLd({ name: 'a</script><script>x</script>' })
    if (/<\/script/i.test(probe) || JSON.parse(probe).name !== 'a</script><script>x</script>') fail.push('jsonLd() does not escape </script> inside a field, or does not read back')

    // sitemap, and each page it lists
    const sm = await ctx.get('/sitemap.xml')
    const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
    if (!locs.length) fail.push('the sitemap lists nothing')
    const ogImages = new Map()
    for (const loc of locs) {
      const p = local(loc)
      if (p === null) {
        fail.push(`the sitemap lists ${loc}, which is not on ${SITE_URL}`)
        continue
      }
      const res = await ctx.get(p)
      if (res.status !== 200) {
        fail.push(`${p} (in the sitemap) answered ${res.status}`)
        continue
      }
      const html = res.text
      const canon = links(html, 'canonical').map((l) => l.href)
      const want = loc.replace(/\/$/, '')
      if (canon.length !== 1) fail.push(`${p} has ${canon.length} canonical links`)
      else if (canon[0].replace(/\/$/, '') !== want) fail.push(`${p}'s canonical is ${canon[0]}, not ${loc}`)
      for (const k of ['og:title', 'og:url', 'og:image', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
        const v = meta(html, k)
        if (!v) fail.push(`${p} has no ${k}`)
        else if (/(url|image)$/.test(k) && !/^https:\/\//.test(v)) fail.push(`${p}'s ${k} (${v}) is not an absolute https URL`)
        else if (/(url|image)$/.test(k) && local(v) === null) fail.push(`${p}'s ${k} (${v}) is not on ${SITE_URL}`)
      }
      if (meta(html, 'og:url') && meta(html, 'og:url').replace(/\/$/, '') !== want) fail.push(`${p}'s og:url is ${meta(html, 'og:url')}, not ${loc}`)
      for (const k of ['og:image', 'twitter:image']) {
        const v = meta(html, k)
        // a project has its own card (app/work/[slug]/opengraph-image.tsx); the site's must not replace it
        if (v && /^\/work\/[^/]+$/.test(p) && !new URL(v).pathname.startsWith(`${p}/`)) fail.push(`${p}'s ${k} is ${v}, not the project's own card under ${p}/`)
        const lp = v && local(v)
        if (lp && !ogImages.has(lp)) ogImages.set(lp, await bytes(lp))
        const r = lp && ogImages.get(lp)
        if (r && (r.status !== 200 || !r.type.startsWith('image/'))) fail.push(`${p}'s ${k} answered ${r.status} ${r.type}`)
      }

      // JSON-LD on / and /work/*
      if (p === '/' || p.startsWith('/work')) {
        const blocks = ldScripts(html)
        if (!blocks.length) fail.push(`${p} has no JSON-LD`)
        const data = []
        for (const b of blocks) {
          if (b.includes('<')) fail.push(`${p}'s JSON-LD has a raw "<", so a field could close the script`)
          try {
            data.push(JSON.parse(b))
          } catch (e) {
            fail.push(`${p}'s JSON-LD does not parse: ${e.message}`)
          }
        }
        for (const d of data) if (d['@context'] !== 'https://schema.org' || !d['@type']) fail.push(`${p}'s JSON-LD has no schema.org @context or @type`)
        if (p === '/') {
          const person = data.find((d) => d['@type'] === 'Person')
          if (!person) fail.push('/ has no Person JSON-LD')
          else if (person.url !== SITE_URL || !person.name) fail.push(`/'s Person is ${person.name} at ${person.url}, not on ${SITE_URL}`)
        }
      }
    }
    notes.push(`${locs.length} sitemap pages checked for canonical, OG and Twitter tags`)

    return { fail, notes }
  },
}

export default basics
