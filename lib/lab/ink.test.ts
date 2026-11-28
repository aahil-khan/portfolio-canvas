import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// ink.ts imports through the app's `@/` alias: map `@/x` to `<repo>/x.ts`, as look.test.ts does
const ROOT = pathToFileURL(new URL('../../', import.meta.url).pathname).href
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) return next(${JSON.stringify(ROOT)} + spec.slice(2) + (/\\.[a-z]+$/.test(spec) ? '' : '.ts'), ctx)
        return next(spec, ctx)
      }`),
)
const ink = await import('./ink.ts')
const { allThemes } = await import('../../content/themes.ts')

const dark = allThemes.filter((t) => t.dark)

test('every dark theme reads at 10 / 7 / 5.5 to 1 in the Lab', () => {
  assert.equal(dark.length, 14, 'thirteen dark site themes and Lab Dark')
  for (const t of dark) {
    const i = ink.labInks(t)
    const [canvas, ...rest] = ink.grounds(t)
    const text = [canvas, ...rest.slice(0, 2)]
    const c = (s: string) => ink.solid(s, canvas)
    assert.ok(ink.contrast(c(i.ink), canvas) >= ink.DARK_FLOOR.body, `${t.id}: body ${ink.contrast(c(i.ink), canvas).toFixed(2)}`)
    for (const g of [canvas, ...rest]) assert.ok(ink.contrast(c(i.ink), g) >= ink.DARK_FLOOR.secondary, `${t.id}: ink on a box or bar`)
    for (const g of text) {
      assert.ok(ink.contrast(c(i.inkMuted), g) >= ink.DARK_FLOOR.secondary, `${t.id}: secondary ${ink.contrast(c(i.inkMuted), g).toFixed(2)}`)
      assert.ok(ink.contrast(c(i.inkSubtle), g) >= ink.DARK_FLOOR.label, `${t.id}: labels ${ink.contrast(c(i.inkSubtle), g).toFixed(2)}`)
    }
    const onMark = ink.contrast(c(t.tokens.accentInk), c(i.mark))
    assert.ok(onMark >= ink.DARK_FLOOR.body, `${t.id}: highlighted text ${onMark.toFixed(2)}`)
  }
})

test('a tier that already passes keeps its colour, and the tiers stay in order', () => {
  const mocha = allThemes.find((t) => t.id === 'mocha')!
  assert.equal(ink.labInks(mocha).ink, mocha.tokens.ink.toUpperCase())
  for (const t of dark) {
    const i = ink.labInks(t)
    const [canvas] = ink.grounds(t)
    const cr = (s: string) => ink.contrast(ink.solid(s, canvas), canvas)
    assert.ok(cr(i.ink) >= cr(i.inkMuted) && cr(i.inkMuted) >= cr(i.inkSubtle), `${t.id}: ink ≥ muted ≥ subtle`)
  }
})

test('only dark themes are lifted, and only inside the Lab', () => {
  const css = ink.labInkCss()
  for (const t of allThemes) assert.equal(css.includes(`[data-theme="${t.id}"]`), t.dark, t.id)
  for (const line of css.split('\n')) assert.match(line, /^html\[data-theme="[a-z-]+"\] \.lab\{/)
})

test('without JavaScript the Lab is Lab Dark', () => {
  const css = ink.labFallbackCss()
  assert.match(css, /^html:not\(\[data-look\]\):has\(\.lab\)\{--canvas-base:#0B0B0A;/)
  assert.match(css, /--border:#7F6C45/)
})
