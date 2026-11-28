import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { register } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

/*
 * The share cards (plan PR 13): what each card says, how its words are sized to the card, that a
 * picture is always kept whole, the palettes, and that a card with no picture (sharp missing, or a
 * file it can't read) falls back to its words alone. Drawing the PNGs is check:lab rule OG's job.
 *
 * No demo id is named here (API.md, "Demo mode"): the cards under test are found by kind.
 */

// palette.ts reaches ink.ts, which imports through the app's `@/` alias: map `@/x` to `<repo>/x.ts`
const ROOT = pathToFileURL(new URL('../../../', import.meta.url).pathname).href
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) return next(${JSON.stringify(ROOT)} + spec.slice(2) + (/\\.[a-z]+$/.test(spec) ? '' : '.ts'), ctx)
        return next(spec, ctx)
      }`),
)
const card = await import('./card.ts')
const metrics = await import('./metrics.ts')
const { cardFor, address, kindList, cardDay } = await import('./model.ts')
const { palette, OG_THEME } = await import('./palette.ts')
const { cardFonts } = await import('./fonts.ts')
const { routes, entryByPath, getLab } = await import('../content.ts')
const { allThemes } = await import('../../../content/themes.ts')
const { contrast, solid } = await import('../ink.ts')

const repo = fileURLToPath(new URL('../../../', import.meta.url))
const { metrics: m } = cardFonts(repo)
const cardRoutes = routes().filter((r) => r.kind === 'home' || r.kind === 'section' || r.kind === 'entry')
const entryOf = (p: string) => entryByPath(p.split('/').slice(2))

test('a picture is fitted whole: never cropped, never enlarged, its shape kept', () => {
  const { STILL_BOX, fitWhole } = card
  for (const [w, h] of [
    [1200, 675], // wide
    [420, 560], // tall, PR 3's sixth card
    [800, 219], // a strip
    [300, 2000], // a very tall one
    [200, 120], // smaller than the box: drawn at its own size
  ]) {
    const f = fitWhole(w, h, STILL_BOX.w, STILL_BOX.h)
    assert.ok(f.w <= STILL_BOX.w && f.h <= STILL_BOX.h, `${w}×${h} fits the column`)
    assert.ok(f.w <= w && f.h <= h, `${w}×${h} is not enlarged`)
    assert.ok(Math.abs(f.w / f.h - w / h) < 0.02 * (w / h) + 1 / f.h, `${w}×${h} keeps its shape: ${f.w}×${f.h}`)
    assert.ok(f.w === Math.min(w, STILL_BOX.w) || f.h === Math.min(h, STILL_BOX.h), `${w}×${h} meets the column on one side`)
  }
})

test('lines are counted and cut at a word, never inside one', () => {
  const size = 28
  assert.equal(metrics.countLines(m.regular, '', size, 500), 0)
  assert.equal(metrics.countLines(m.regular, 'short', size, 500), 1)
  const long = 'Every word here is ordinary, and there are enough of them to run well past two lines of a card at this size, which is the point.'
  assert.ok(metrics.countLines(m.regular, long, size, 500) > 2)
  const cut = metrics.clampText(m.regular, long, size, 500, 2)
  assert.ok(metrics.countLines(m.regular, cut, size, 500) <= 2)
  assert.ok(cut.endsWith('…') && !/[\s,]…$/.test(cut), `ends on a word: ${cut}`)
  assert.ok(long.startsWith(cut.slice(0, -1)), 'a prefix of the text')
  assert.equal(metrics.clampText(m.regular, 'fits', size, 500, 1), 'fits')
})

test('every Lab page has a card, and its words fit the card', () => {
  assert.ok(cardRoutes.length > 0, 'routes() lists the home at least')
  for (const r of cardRoutes) {
    const model = cardFor(r.path, repo)
    assert.ok(model, `${r.path} has a card`)
    const still = model.image ? { src: '', ...card.fitWhole(model.image.w, model.image.h, card.STILL_BOX.w, card.STILL_BOX.h) } : null
    const L = card.layoutCard(model, m, still)
    assert.ok(L.height <= card.BODY.h, `${r.path}: laid out ${L.height.toFixed(0)}px tall in ${card.BODY.h}`)
    assert.ok(L.titleLines >= 1 && L.titleLines <= 3, `${r.path}: ${L.titleLines} title lines`)
    assert.ok(model.title.length && model.eyebrow.length && model.alt.includes(model.kind === 'home' ? getLab().copy.homeTitle : model.title))
    assert.ok(!/\{\w+\}/.test(model.eyebrow + model.meta + model.alt), `${r.path}: every placeholder filled`)
  }
})

test('the words a card shows come from the page they share', () => {
  const { copy } = getLab()
  const home = cardFor('/lab', repo)
  assert.ok(home)
  assert.equal(home.kind, 'home')
  assert.equal(home.title, copy.homeTitle)
  assert.equal(home.address.last, 'lab')
  for (const r of cardRoutes.filter((x) => x.kind === 'entry')) {
    const e = entryOf(r.path)
    const model = cardFor(r.path, repo)
    assert.ok(e && model)
    assert.equal(model.title, e.title)
    assert.equal(model.address.last, r.path.split('/').pop())
    assert.match(model.date ?? '', /\d{4}$/, 'the date carries its year')
    if (e.kind === 'chapter') {
      assert.equal(model.numeral, String(e.order).padStart(2, '0'), 'a chapter shows its number')
      assert.equal(model.image, null, 'a chapter shows its numeral, not a picture')
    } else assert.equal(model.numeral, null)
    if (model.image) {
      assert.ok(model.image.src.startsWith('/') && fs.existsSync(model.image.file), `${r.path}: its picture is a local file`)
      assert.match(model.image.src, /\.(webp|png|jpe?g)$/)
    }
  }
  for (const r of cardRoutes.filter((x) => x.kind === 'section')) {
    const model = cardFor(r.path, repo)
    assert.ok(model && model.meta && !model.meta.includes('{'), `${r.path}: says what it holds`)
  }
  assert.equal(cardFor('/lab/__nothing-here__', repo), null)
})

test('an essay with no lead picture takes its body’s first one', () => {
  const essays = cardRoutes.map((r) => entryOf(r.path)).filter((e) => e?.kind === 'essay' && !e.lead?.cover)
  for (const e of essays) {
    const r = cardRoutes.find((x) => entryOf(x.path)?.id === e?.id)
    const model = r && cardFor(r.path, repo)
    assert.ok(model?.image, `${r?.path} shows its first picture`)
  }
})

test('addresses, counts and days read as the card writes them', () => {
  assert.deepEqual(address('/lab/a/b', 'example.com'), { lead: 'example.com/lab/a/', last: 'b' })
  assert.deepEqual(address('/lab', 'example.com'), { lead: 'example.com/', last: 'lab' })
  const copy = { nounStudy: 'study|studies', nounNote: 'note|notes' }
  assert.equal(kindList(copy, { study: 1, note: 2 }), '1 study, 2 notes')
  assert.equal(cardDay('2026-11-26'), '26 Nov 2026')
  assert.equal(cardDay(null), null)
})

test('the long-content fallbacks: a long title steps down, a lede gives up lines, nothing runs out', () => {
  const base = {
    kind: 'entry' as const,
    address: { lead: 'example.com/lab/x/', last: 'y' },
    eyebrow: 'A note from a study with a very long name indeed, longer than any line',
    title: 'A title that goes on and on, far longer than anyone should ever write one, so long that even at the smallest size the card offers it cannot fit in three lines of the column',
    large: false,
    lede: 'A lede that is also long, with enough words in it to need more than two lines of the card, so it must be cut at a word.',
    chips: [],
    date: '1 Jan 2026',
    meta: '9 min read',
    numeral: null,
    image: null,
    alt: 'x',
    by: 'Someone',
  }
  for (const still of [null, { src: '', w: 271, h: 362 }]) {
    const L = card.layoutCard(base, m, still)
    assert.ok(L.height <= card.BODY.h, `laid out ${L.height.toFixed(0)} in ${card.BODY.h}`)
    assert.ok(L.title.endsWith('…') && L.titleLines === 3)
    assert.ok(L.eyebrow.endsWith('…'))
    assert.ok(L.titleSize < card.G.title.sizes[0], 'stepped down a size')
    assert.ok(L.ledeLines >= 1 && metrics.countLines(m.regular, L.lede, card.G.lede.size, L.textW) <= L.ledeLines)
    if (still) assert.ok(L.lede.endsWith('…'), 'the narrower column cuts the lede at a word')
  }
  const chips = { ...base, kind: 'home' as const, large: true, lede: '', title: 'Short', chips: Array.from({ length: 12 }, (_, i) => `Section ${i + 1}`) }
  const L = card.layoutCard(chips, m, null)
  assert.ok(L.chipRows > 1)
})

test('with no picture, a card is its words alone', () => {
  const model = cardRoutes.map((r) => cardFor(r.path, repo)).find((x) => x?.image)
  assert.ok(model, 'some card has a picture')
  const flat = (n: unknown): { type: string; props: Record<string, unknown> }[] => {
    if (!n || typeof n !== 'object') return []
    const node = n as { type: string; props: { children?: unknown } }
    const kids = node.props.children
    return [node, ...(Array.isArray(kids) ? kids : [kids]).flatMap(flat)]
  }
  const p = palette()
  const without = flat(card.cardTree(model, p, m, null, 'AK'))
  assert.equal(without.filter((x) => x.type === 'img').length, 0, 'no image')
  assert.equal(card.layoutCard(model, m, null).textW, card.BODY.w, 'the words take the whole width')
  const withIt = flat(card.cardTree(model, p, m, { src: 'data:image/png;base64,', w: 300, h: 200 }, 'AK'))
  assert.equal(withIt.filter((x) => x.type === 'img').length, 1)
})

test('sharp missing or a file unreadable: no picture, and no error (raster.ts, as the build runs it)', () => {
  // raster.ts is `server-only`, so it loads only under the react-server condition, as in `next build`
  const script = `
    const { rasterStill } = await import(${JSON.stringify(pathToFileURL(path.join(repo, 'lib/lab/og/raster.ts')).href)})
    const { STILL_BOX } = await import(${JSON.stringify(pathToFileURL(path.join(repo, 'lib/lab/og/card.ts')).href)})
    const gone = await rasterStill('${path.join(repo, 'lib/lab/og/fonts/OFL.txt')}', () => Promise.reject(new Error('Cannot find module sharp')))
    const unreadable = await rasterStill('${path.join(repo, 'lib/lab/og/fonts/OFL.txt')}')
    const missing = await rasterStill('${path.join(repo, 'public/__nothing-here__.webp')}')
    console.log(JSON.stringify({ gone, unreadable, missing, box: STILL_BOX }))
  `
  const out = JSON.parse(
    execFileSync(process.execPath, ['--conditions=react-server', '--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', script], { cwd: repo, encoding: 'utf8' }).trim(),
  )
  assert.equal(out.gone, null, 'sharp missing: null')
  assert.equal(out.unreadable, null, 'not an image: null')
  assert.equal(out.missing, null, 'no file: null')
})

test('with sharp, a WebP becomes a PNG at its fitted size', () => {
  const webp = cardRoutes.map((r) => cardFor(r.path, repo)?.image).find((i) => i && /\.webp$/.test(i.file))
  assert.ok(webp, 'some card has a WebP picture')
  const script = `
    const { rasterStill } = await import(${JSON.stringify(pathToFileURL(path.join(repo, 'lib/lab/og/raster.ts')).href)})
    const s = await rasterStill(${JSON.stringify(webp.file)})
    console.log(JSON.stringify(s && { head: s.src.slice(0, 22), w: s.w, h: s.h }))
  `
  const out = JSON.parse(
    execFileSync(process.execPath, ['--conditions=react-server', '--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', script], { cwd: repo, encoding: 'utf8' }).trim(),
  )
  assert.ok(out, 'drawn')
  assert.equal(out.head, 'data:image/png;base64,')
  assert.ok(out.w <= card.STILL_BOX.w && out.h <= card.STILL_BOX.h)
})

test('raster.ts is the one file outside scripts/ that imports sharp, and it is server-only', () => {
  const src = fs.readFileSync(path.join(repo, 'lib/lab/og/raster.ts'), 'utf8')
  assert.match(src, /^import 'server-only'/m)
  const render = fs.readFileSync(path.join(repo, 'lib/lab/og/render.ts'), 'utf8')
  assert.match(render, /^import 'server-only'/m)
  for (const f of fs.readdirSync(path.join(repo, 'lib/lab/og')).filter((x) => /\.tsx?$/.test(x) && x !== 'raster.ts' && !x.endsWith('.test.ts')))
    assert.ok(!/from 'sharp'|import\(\s*'sharp'\s*\)/.test(fs.readFileSync(path.join(repo, 'lib/lab/og', f), 'utf8')), `${f} doesn't import sharp`)
})

test('every palette resolves to plain colours, and a card’s text reads on its box', () => {
  assert.equal(OG_THEME, 'lab-dark', 'the Lab’s default')
  for (const t of allThemes) {
    const p = palette(t.id)
    for (const [k, v] of Object.entries(p)) if (!['id', 'dark', 'grid'].includes(k)) assert.match(String(v), /^#[0-9A-F]{6}$/, `${t.id}.${k} = ${v}`)
    const box = solid(p.surface, [0, 0, 0])
    const c = (x: string) => contrast(solid(x, box), box)
    assert.ok(c(p.ink) >= 4.5, `${t.id}: ink`)
    assert.ok(c(p.inkMuted) >= 4.5, `${t.id}: muted ink ${c(p.inkMuted).toFixed(2)}`)
    assert.ok(contrast(solid(p.ink, box), solid(p.titlebar, box)) >= 4.5, `${t.id}: the address on the title bar`)
    assert.ok(contrast(solid(p.accentInk, box), solid(p.accent, box)) >= 4.5, `${t.id}: AK on the accent`)
    if (t.dark) assert.ok(c(p.inkMuted) >= 7, `${t.id}: lifted muted ink, as the Lab reads`)
  }
})

test('an address too long for the title bar folds its middle into …/, keeping the host and the page', () => {
  const short = card.fitAddress(m, 'example.com/lab/a/', 'b')
  assert.deepEqual(short, ['example.com/', 'lab/', 'a/'])
  const long = card.fitAddress(m, 'example.com/lab/a-very-long-section-name/a-very-long-parent-entry-name/', 'and-a-very-long-slug-for-the-page-itself')
  assert.equal(long[0], 'example.com/')
  assert.equal(long.at(-1), '…/')
  const width = [...long.join('')].reduce((w, ch) => w + m.medium.advance(ch), 0) * 26 + [...'and-a-very-long-slug-for-the-page-itself'].reduce((w, ch) => w + m.bold.advance(ch), 0) * 26
  assert.ok(width <= card.ADDRESS_W, `fits: ${width.toFixed(0)} in ${card.ADDRESS_W}`)
})
