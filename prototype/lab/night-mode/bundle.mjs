// prototype/lab/night-mode/bundle.mjs: the whole Lab mockup as ONE standalone HTML file.
//
//   node prototype/lab/night-mode/bundle.mjs [out.html]
//   (default: ~/projects/scratch/lab-mockups/lab.html, outside the repo; never commit it)
//
// Inlines every stylesheet and script index.html loads (the shared kit's and this folder's).
// Every image the desk and the Lab use (/work, /archive, /logos) becomes a data: URI: rasters are
// resized to at most 1400 px wide and re-encoded as WebP (sharp, from the repo's node_modules),
// SVGs go in as they are. LAB.asset passes a data: URI through untouched, so no code changes.
// The SAM sample's audio (narration/sample-audio.js, ~0.8 MB) rides along as an inert text
// script and is run on the first press that needs it, exactly as the folder loads it lazily.
// Left as links: the Medium CDN figures in the two essays, and the Google Fonts @imports (offline,
// the faces fall back to the system's sans and monospace; every vignette is plain ASCII for that).
// Opens from disk on the desk; #lab lands in the Lab.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const pub = join(repo, 'public')
const out = resolve(process.argv[2] || join(homedir(), 'projects/scratch/lab-mockups/lab.html'))
const sharp = createRequire(join(repo, 'package.json'))('sharp')
const read = (p) => readFileSync(join(here, p), 'utf8')
const kb = (n) => `${(n / 1024).toFixed(0)} KB`

// ── images: every /work, /archive, /logos path named in a script, as a data: URI ───────────
const IMG = /(["'`])(\/(?:work|archive|logos|pfp)\/[^"'`\s)]+\.(?:png|jpe?g|webp|gif|svg))\1/g
const cache = new Map()
let rawBytes = 0, outBytes = 0
async function dataUri(path) {
  if (cache.has(path)) return cache.get(path)
  const file = join(pub, path)
  if (!existsSync(file)) throw new Error(`bundle: ${path} is named in a script but missing from public/`)
  const buf = readFileSync(file)
  rawBytes += buf.length
  let uri
  if (extname(file) === '.svg') uri = `data:image/svg+xml;base64,${buf.toString('base64')}`
  else {
    const webp = await sharp(buf).resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer()
    uri = `data:image/webp;base64,${webp.toString('base64')}`
  }
  outBytes += uri.length
  cache.set(path, uri)
  return uri
}
async function inlineImages(src) {
  const paths = [...new Set([...src.matchAll(IMG)].map((m) => m[2]))]
  for (const p of paths) src = src.split(p).join(await dataUri(p))
  return src
}

// ── the page ────────────────────────────────────────────────────────────────────────────────
let html = read('index.html')
const safe = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
for (const m of [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]) html = html.replace(m[0], () => `<style>/* ${m[1]} */\n${read(m[1])}\n</style>`)
for (const m of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]) {
  let js = read(m[1])
  if (m[1] === '../shared/pieces.js') js = await inlineImages(js)
  if (m[1] === '../shared/desk.js') {
    const logo = '${opts.publicRoot}/logos/github-original.svg'
    if (!js.includes(logo)) throw new Error('bundle: desk.js no longer names its GitHub logo the way this expects')
    js = js.replace(logo, await dataUri('/logos/github-original.svg'))
  }
  if (m[1] === 'voice.js') {
    const lazy = "await script('narration/sample-audio.js')"
    if (!js.includes(lazy)) throw new Error('bundle: voice.js no longer loads the sample the way this expects')
    js = js.replace(lazy, "await new Promise((ok) => { const n = document.createElement('script'); n.textContent = document.getElementById('lab-sample-audio').textContent; document.head.appendChild(n); ok() })")
  }
  html = html.replace(m[0], () => `<script>/* ${m[1]} */\n${safe(js)}\n</script>`)
}
if (/<script src=|<link rel="stylesheet" href=(?!"https)/.test(html)) throw new Error('bundle: something is still loaded from a file')
const audio = read('narration/sample-audio.js')
html = html.replace('</body>', () => `<script type="text/plain" id="lab-sample-audio">${safe(audio)}</script>\n</body>`)
html = html.replace('<title>', '<!-- bundled by prototype/lab/night-mode/bundle.mjs: one file, nothing beside it -->\n<title>')

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, html)
const size = Buffer.byteLength(html)
console.log(`${out}\n  ${kb(size)} in all · ${cache.size} images ${kb(rawBytes)} → ${kb(outBytes)} as data: URIs · sample audio ${kb(audio.length)}`)
if (size > 15 * 1024 * 1024) { console.error('  over 15 MB'); process.exit(1) }
