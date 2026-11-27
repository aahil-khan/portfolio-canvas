/**
 * The Lab's link unfurls: each link out's own card, the way a chat app unfurls a link (its OG
 * title, description, site, image and favicon), fetched once here and committed, so neither
 * `next build` nor the page makes a network request for it. Plan `plan-the-real-lab`, PR 7; NEXT
 * shortcut 4.
 *
 *   node --experimental-strip-types scripts/lab-unfurl.mjs [--set demo|real] [--keep]
 *
 *   --set    which set to unfurl; the active one by default (`labDemo`, lib/lab/visibility.ts)
 *   --keep   fetch only links the set's unfurls file does not hold yet
 *
 * It writes the set's unfurls file (`SET_PATHS[set].unfurls`) and the set's images: the real set's
 * under `public/lab/unfurl/`, the demo set's under `public<DEMO_PUBLIC>/unfurl/`. That directory is
 * the script's own: a file no card names any more is removed.
 *
 * - **One honest user agent**, `lab-unfurl/1.0`, and no retry as a browser. A site that refuses it
 *   keeps the last card it gave, or, the first time, a text card from the content's own words for
 *   the link (a reference's title and site), marked `standIn`.
 * - **His own essays** (a link that is an entry's `canonical`, Medium today) are never fetched:
 *   their card is a stand-in built from his own copy (the title, the lede or opening, the first
 *   picture), marked `standIn`, until the essays are canonical here and Medium is the copy.
 * - A site with no OG image keeps a text card: title, description, domain, favicon.
 * - Images are re-encoded with `sharp`: OG images to 640×336 WebP, favicons to 32px PNG.
 *
 * The links come from `linksOut()` in lib/lab/rules.ts, the list rule O holds, so the two never
 * disagree about what a link out is.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ogs from 'open-graph-scraper'
import sharp from 'sharp'

import { loadSet, SET_PATHS } from '../lib/lab/content.ts'
import { linksOut } from '../lib/lab/rules.ts'
import { plainInline, scanBody } from '../lib/lab/text.ts'
import { DEMO_PUBLIC, labDemo } from '../lib/lab/visibility.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const UA = 'lab-unfurl/1.0 (link previews for a static page, fetched once by hand; one request per link)'
const TIMEOUT_MS = 15000
const OG = { w: 640, h: 336 }
const FAVICON = 32
const DESCRIPTION_MAX = 220

const argv = process.argv.slice(2)
const keep = argv.includes('--keep')
const setArg = argv.find((a) => a.startsWith('--set='))?.slice(6) ?? (argv.includes('--set') ? argv[argv.indexOf('--set') + 1] : undefined)
const setName = setArg ?? (labDemo ? 'demo' : 'real')
if (setName !== 'demo' && setName !== 'real') {
  console.error(`lab-unfurl: --set must be demo or real, not "${setName}"`)
  process.exit(2)
}

const URL_DIR = setName === 'demo' ? `${DEMO_PUBLIC}/unfurl` : '/lab/unfurl'
const OUT_DIR = path.join(ROOT, 'public', URL_DIR.slice(1))
const OUT_FILE = path.join(ROOT, SET_PATHS[setName].unfurls)

const set = loadSet(setName, { root: ROOT })
const { lab, bodies } = set

const short = (s) => createHash('sha1').update(s).digest('hex').slice(0, 10)
const hostOf = (url) => new URL(url).hostname.replace(/^www\./, '')
const clip = (s) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > DESCRIPTION_MAX ? t.slice(0, DESCRIPTION_MAX - 3).replace(/\s+\S*$/, '') + '…' : t
}
const prune = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))

/** A plain GET in the one honest user agent. No retry, and never as a browser. */
async function get(url, accept) {
  if (!/^https?:\/\//.test(url)) throw new Error(`not an http(s) URL: ${url}`)
  const r = await fetch(url, { headers: { 'user-agent': UA, accept }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return Buffer.from(await r.arrayBuffer())
}

// ---------- images ----------

/**
 * A `.ico` file's best entry for a 32px favicon, as something sharp can read: an embedded PNG as
 * it is, or a BMP entry decoded to raw RGBA (sharp reads neither ICO nor headerless BMP).
 */
function fromIco(buf) {
  if (buf.length < 6 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null
  const n = buf.readUInt16LE(4)
  const entries = []
  for (let i = 0; i < n; i++) {
    const o = 6 + i * 16
    if (o + 16 > buf.length) break
    entries.push({ size: buf[o] || 256, bpp: buf.readUInt16LE(o + 6), len: buf.readUInt32LE(o + 8), at: buf.readUInt32LE(o + 12) })
  }
  // the smallest at least 32px, deepest colour first; else the largest there is
  entries.sort((a, b) => (a.size >= FAVICON) === (b.size >= FAVICON) ? (a.size >= FAVICON ? a.size - b.size : b.size - a.size) || b.bpp - a.bpp : a.size >= FAVICON ? -1 : 1)
  const e = entries[0]
  if (!e || e.at + e.len > buf.length) return null
  const d = buf.subarray(e.at, e.at + e.len)
  if (d.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { input: d }
  // BITMAPINFOHEADER; the height counts the XOR image and the AND mask together
  const head = d.readUInt32LE(0), w = d.readInt32LE(4), h = Math.abs(d.readInt32LE(8)) / 2, bpp = d.readUInt16LE(14)
  if (d.readUInt32LE(16) !== 0 || ![1, 4, 8, 24, 32].includes(bpp) || !w || !h) return null
  const colours = bpp <= 8 ? d.readUInt32LE(32) || 1 << bpp : 0
  const palette = head
  const pixels = head + colours * 4
  const stride = Math.ceil((w * bpp) / 32) * 4
  const maskStride = Math.ceil(w / 32) * 4
  const mask = pixels + stride * h
  const rgba = Buffer.alloc(w * h * 4)
  let anyAlpha = false
  for (let y = 0; y < h; y++) {
    const row = pixels + (h - 1 - y) * stride // bottom-up
    for (let x = 0; x < w; x++) {
      const q = (y * w + x) * 4
      let b, g, r, a = 255
      if (bpp === 32) [b, g, r, a] = [d[row + x * 4], d[row + x * 4 + 1], d[row + x * 4 + 2], d[row + x * 4 + 3]]
      else if (bpp === 24) [b, g, r] = [d[row + x * 3], d[row + x * 3 + 1], d[row + x * 3 + 2]]
      else {
        const bit = x * bpp
        const idx = (d[row + (bit >> 3)] >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1)
        ;[b, g, r] = [d[palette + idx * 4], d[palette + idx * 4 + 1], d[palette + idx * 4 + 2]]
      }
      if (bpp === 32 && a) anyAlpha = true
      rgba[q] = r
      rgba[q + 1] = g
      rgba[q + 2] = b
      rgba[q + 3] = a
    }
  }
  // the AND mask: transparency for every depth without an alpha channel of its own
  if (!anyAlpha && mask + maskStride * h <= d.length)
    for (let y = 0; y < h; y++) {
      const row = mask + (h - 1 - y) * maskStride
      for (let x = 0; x < w; x++) rgba[(y * w + x) * 4 + 3] = (d[row + (x >> 3)] >> (7 - (x & 7))) & 1 ? 0 : 255
    }
  return { input: rgba, raw: { width: w, height: h, channels: 4 } }
}

/** Any image buffer as a sharp pipeline: ICO decoded here, everything else read by sharp. */
function open(buf) {
  const ico = fromIco(buf)
  if (ico) return ico.raw ? sharp(ico.input, { raw: ico.raw }) : sharp(ico.input)
  return sharp(buf, { animated: false, limitInputPixels: 64e6 })
}

/** Re-encodes an image to the card's 640×336 WebP, cropped from the centre. A logo too small to
 *  fill a card is refused: blown up, it would read as a broken image, and a text card reads better. */
async function writeOg(buf, file) {
  const { width = 0, height = 0 } = await open(buf).metadata()
  if (width < OG.w / 2 || height < OG.h / 2) throw new Error(`${width}×${height} is too small for a card`)
  await open(buf).rotate().resize(OG.w, OG.h, { fit: 'cover', position: 'centre' }).webp({ quality: 62, effort: 6 }).toFile(file)
}
/** Re-encodes a favicon to a 32px PNG, padded on transparency when it is not square. */
async function writeFavicon(buf, file) {
  await open(buf).resize(FAVICON, FAVICON, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(file)
}

/** The page's own icons, best first: apple-touch-icon (large, PNG), then `rel=icon`, then `/favicon.ico`. */
function iconUrls(html, base) {
  const links = String(html ?? '').match(/<link\b[^>]*>/gi) ?? []
  const rel = (l) => (l.match(/\brel\s*=\s*["']?([^"'>]+)/i) ?? [])[1]?.toLowerCase().trim() ?? ''
  const href = (l) => (l.match(/\bhref\s*=\s*["']([^"']+)["']/i) ?? l.match(/\bhref\s*=\s*([^\s>]+)/i) ?? [])[1]
  const of = (test) => links.filter((l) => test(rel(l)) && href(l)).map((l) => href(l).replace(/&amp;/g, '&'))
  const hrefs = [...of((r) => r.includes('apple-touch-icon')), ...of((r) => r.split(/\s+/).includes('icon')), '/favicon.ico']
  return [...new Set(hrefs.map((h) => new URL(h, base).href))]
}

// ---------- cards ----------

/** The entry whose own copy this link is (an essay's `canonical`), if any. */
const ownEntry = (url) => lab.entries.find((e) => 'canonical' in e && e.canonical === url && !e.draft && e.published !== null)

/** His own essay's card, built from his own copy: no request is made. */
async function standIn(url, e, words) {
  const firstPicture = scanBody(bodies[e.id] ?? '').images[0]?.src ?? e.lead?.cover?.src ?? e.lead?.images?.[0]?.src
  let img
  if (firstPicture) {
    const name = `og-${short(url)}.webp`
    await writeOg(fs.readFileSync(path.join(ROOT, 'public', firstPicture.slice(1))), path.join(OUT_DIR, name))
    img = { src: `${URL_DIR}/${name}`, ...OG, alt: '' }
  }
  return prune({
    title: words.title || e.title,
    description: clip(plainInline(e.lede ?? '') || ('opening' in e ? e.opening : '')),
    site: words.site?.split(' · ')[0] || hostOf(url),
    domain: hostOf(url),
    img,
    standIn: true,
  })
}

/** A site that refused, the first time: a text card from the content's own words for the link. */
const textCard = (url, words) => prune({ title: words.title || hostOf(url), site: words.site?.split(' · ')[0] || hostOf(url), domain: hostOf(url), standIn: true })

const favicons = new Map() // host -> public path, or null when it has none
async function favicon(url, html, base) {
  const host = hostOf(url)
  if (favicons.has(host)) return favicons.get(host)
  const name = `fav-${short(host)}.png`
  let out = null
  const tried = []
  for (const icon of iconUrls(html, base)) {
    try {
      await writeFavicon(await get(icon, 'image/*'), path.join(OUT_DIR, name))
      out = `${URL_DIR}/${name}`
      break
    } catch (e) {
      tried.push(e.message.split('\n')[0])
    }
  }
  if (!out) console.log(`       no favicon (${tried.join('; ')})`)
  favicons.set(host, out)
  return out
}

/** The fetched card: OG fields through open-graph-scraper, image and favicon re-encoded here. */
async function fetched(url) {
  let data
  try {
    // the image only from og:image or twitter:image, never the page's first <img>: a card shows the
    // picture the site chose for its links, or none
    data = await ogs({ url, timeout: TIMEOUT_MS / 1000, onlyGetOpenGraphInfo: ['image'], fetchOptions: { headers: { 'user-agent': UA, accept: 'text/html' } } })
  } catch (e) {
    throw new Error(e?.result?.error ?? e?.message ?? String(e))
  }
  const { result: r, html, response } = data
  if (!r?.success) throw new Error(r?.error ?? 'no result')
  const base = response?.url || r.requestUrl || url
  const title = r.ogTitle || r.twitterTitle || r.dcTitle
  if (!title) throw new Error('the page names no title')
  const card = {
    title: clip(title),
    description: clip(r.ogDescription || r.twitterDescription || r.dcDescription),
    site: r.ogSiteName || hostOf(base),
    domain: hostOf(url),
  }
  const src = [...(r.ogImage ?? []), ...(r.twitterImage ?? [])].map((i) => i?.url).find(Boolean)
  if (src) {
    const name = `og-${short(url)}.webp`
    try {
      await writeOg(await get(new URL(src, base).href, 'image/*'), path.join(OUT_DIR, name))
      card.img = { src: `${URL_DIR}/${name}`, ...OG, alt: '' }
    } catch (e) {
      console.log(`       no image (${e.message.split('\n')[0]})`)
    }
  }
  const icon = await favicon(url, html, base)
  if (icon) card.icon = icon
  return prune(card)
}

// ---------- the run ----------

/** Each link once, with the content's best words for it (a reference's title over a build's). */
const links = new Map()
for (const o of linksOut(lab, bodies)) {
  const had = links.get(o.url)
  if (!had) links.set(o.url, { title: o.title, site: o.site })
  else if (o.site && !had.site) links.set(o.url, { title: o.title ?? had.title, site: o.site })
}

const old = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : {}
fs.mkdirSync(OUT_DIR, { recursive: true })

const result = {}
const count = { fetched: 0, kept: 0, standIn: 0, refused: 0 }
const lastHit = new Map() // host -> time of the last request, to space out a burst to one site
for (const [url, words] of links) {
  if (keep && old[url]) {
    result[url] = old[url]
    count.kept++
    continue
  }
  const own = ownEntry(url)
  if (own) {
    result[url] = await standIn(url, own, words)
    count.standIn++
    console.log(`own  ${url}  (stand-in from his own copy)`)
    continue
  }
  const host = hostOf(url)
  const gap = /wikipedia\.org$/.test(host) ? 4000 : 1000 // Wikipedia answers 429 to a burst
  const wait = (lastHit.get(host) ?? 0) + gap - Date.now()
  if (wait > 0) await new Promise((ok) => setTimeout(ok, wait))
  lastHit.set(host, Date.now())
  count.fetched++
  try {
    result[url] = await fetched(url)
    console.log(`ok   ${url}${result[url].img ? '' : '  (no image: a text card)'}`)
  } catch (e) {
    count.refused++
    result[url] = old[url] ?? textCard(url, words)
    console.log(`FAIL ${url}: ${e.message.split('\n')[0]} (${old[url] ? 'kept the last card' : 'a text card from the content'})`)
  }
}

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2) + '\n')

// the directory is the script's own: what no card names is gone
const named = new Set(Object.values(result).flatMap((u) => [u.img?.src, u.icon].filter(Boolean).map((p) => path.basename(p))))
const removed = fs.readdirSync(OUT_DIR).filter((f) => !named.has(f))
for (const f of removed) fs.rmSync(path.join(OUT_DIR, f))

console.log(
  `\n${Object.keys(result).length} unfurls (${setName} set) -> ${path.relative(ROOT, OUT_FILE)}; images in public${URL_DIR}/\n` +
    `fetched ${count.fetched} (${count.refused} refused), kept ${count.kept}, stand-ins ${count.standIn}, removed ${removed.length} unused file${removed.length === 1 ? '' : 's'}`,
)
