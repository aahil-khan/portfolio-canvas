import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

/*
 * look.ts imports through the app's `@/` alias, which Node does not know. This resolve hook maps
 * `@/x` to `<repo>/x.ts` for the imports below, and nothing else.
 */
const ROOT = pathToFileURL(new URL('../../', import.meta.url).pathname).href
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) return next(${JSON.stringify(ROOT)} + spec.slice(2) + (/\\.[a-z]+$/.test(spec) ? '' : '.ts'), ctx)
        return next(spec, ctx)
      }`),
)
const look = await import('./look.ts')

interface Env {
  stored?: Record<string, string>
  search?: string
  prefersLight?: boolean
  siteTheme?: string
}

/** Runs the boot script against a fake document, and returns what it wrote on <html>. */
function boot({ stored = {}, search = '', prefersLight = false, siteTheme = 'cream' }: Env = {}) {
  const dataset: Record<string, string> = { theme: siteTheme }
  const writes: string[] = []
  const sandbox = {
    document: { documentElement: { dataset } },
    location: { search },
    localStorage: {
      getItem: (k: string) => stored[k] ?? null,
      setItem: (k: string) => writes.push(k),
    },
    matchMedia: (q: string) => ({ matches: q === '(prefers-color-scheme: light)' && prefersLight }),
    URLSearchParams,
  }
  const run = new Function(...Object.keys(sandbox), 'window', look.lookBootScript)
  run(...Object.values(sandbox), sandbox)
  return { ...dataset, writes } as Record<string, string> & { writes: string[] }
}

test('a first visit is Lab Dark, whatever the site theme or the system prefers', () => {
  assert.deepEqual(boot({ siteTheme: 'gruvbox-light', prefersLight: true }), {
    theme: 'lab-dark', look: 'lab', dark: '1',
    aaSize: '17', aaFont: 'grotesk', aaLeading: 'normal', aaMeasure: 'wide', aaLayout: 'side', writes: [],
  })
})

test('the stored theme can be any of the 20, and only those', () => {
  assert.equal(boot({ stored: { 'lab.theme': 'nord' } }).theme, 'nord')
  assert.equal(boot({ stored: { 'lab.theme': 'nord' } }).look, 'paper')
  assert.equal(boot({ stored: { 'lab.theme': 'lab-light' } }).dark, '0')
  assert.equal(boot({ stored: { 'lab.theme': 'solarized-light' } }).look, 'paper')
  assert.equal(boot({ stored: { 'lab.theme': 'not-a-theme' } }).theme, 'lab-dark')
})

test("the Lab's theme never follows or writes canvas.theme", () => {
  const d = boot({ stored: { 'canvas.theme': 'dracula' }, siteTheme: 'dracula' })
  assert.equal(d.theme, 'lab-dark')
  assert.deepEqual(d.writes, [])
})

test('?theme= overrides for one visit and is never saved', () => {
  const d = boot({ search: '?theme=lab-light', stored: { 'lab.theme': 'nord' } })
  assert.equal(d.theme, 'lab-light')
  assert.equal(d.dark, '0')
  assert.deepEqual(d.writes, [])
  assert.equal(boot({ search: '?theme=tokyo-night' }).theme, 'tokyo-night')
  assert.equal(boot({ search: '?theme=nope', stored: { 'lab.theme': 'cream' } }).theme, 'cream')
})

test('reader settings are read from storage, and a bad value falls back to its default', () => {
  const d = boot({ stored: { 'lab.aa': '{"size":21,"font":"serif","leading":"relaxed","measure":"narrow","layout":"centred"}' } })
  assert.deepEqual([d.aaSize, d.aaFont, d.aaLeading, d.aaMeasure, d.aaLayout], ['21', 'serif', 'relaxed', 'narrow', 'centred'])
  const bad = boot({ stored: { 'lab.aa': '{"size":23,"font":"comic","leading":2,"measure":"huge","layout":"left"}' } })
  assert.deepEqual([bad.aaSize, bad.aaFont, bad.aaLeading, bad.aaMeasure, bad.aaLayout], ['17', 'grotesk', 'normal', 'wide', 'side'])
  assert.equal(boot({ stored: { 'lab.aa': '{"size":16.5}' } }).aaSize, '17')
  assert.equal(boot({ stored: { 'lab.aa': '{"size":14}' } }).aaSize, '14')
  assert.equal(boot({ stored: { 'lab.aa': 'not json' } }).aaMeasure, 'wide')
})

test('cleanAa agrees with the boot script', () => {
  assert.deepEqual(look.cleanAa({ size: '22', font: 'system' }), { ...look.DEFAULT_AA, size: 22, font: 'system' })
  assert.deepEqual(look.cleanAa(null), look.DEFAULT_AA)
  assert.ok(look.isDefaultAa(look.cleanAa({})))
  assert.ok(!look.isDefaultAa(look.cleanAa({ layout: 'centred' })))
})

test('the server snapshot is fixed, so hydration always matches the HTML', () => {
  const s = look.getLookServerSnapshot()
  assert.equal(s, look.getLookServerSnapshot())
  assert.deepEqual(s, { theme: 'lab-dark', look: 'lab', dark: true, aa: { size: 17, font: 'grotesk', leading: 'normal', measure: 'wide', layout: 'side' } })
  assert.ok(Object.isFrozen(s))
})

test('the client snapshot is stable until <html> changes', () => {
  const dataset: Record<string, string> = { theme: 'nord', look: 'paper', dark: '1', aaSize: '16', aaFont: 'serif', aaLeading: 'tight', aaMeasure: 'comfortable', aaLayout: 'side' }
  const g = globalThis as { document?: unknown }
  g.document = { documentElement: { dataset } }
  try {
    const a = look.getLookSnapshot()
    assert.equal(a, look.getLookSnapshot())
    assert.equal(a.aa.size, 16)
    assert.equal(a.look, 'paper')
    assert.equal(a.dark, true)
    dataset.aaSize = '19'
    const b = look.getLookSnapshot()
    assert.notEqual(a, b)
    assert.equal(b.aa.size, 19)
  } finally {
    delete g.document
  }
})
