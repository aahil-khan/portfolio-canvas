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

test('a first visit is Paper, in the site theme it already has', () => {
  assert.deepEqual(boot({ siteTheme: 'gruvbox-dark' }), {
    theme: 'gruvbox-dark', look: 'paper', mode: 'night', paperTheme: 'gruvbox-dark', dark: '1',
    aaMeasure: 'wide', aaSize: '17', writes: [],
  })
})

test("Premium shows its own palette and keeps the reader's site theme beside it", () => {
  const d = boot({ stored: { 'lab.look': 'premium' }, siteTheme: 'latte' })
  assert.equal(d.theme, 'lab-premium-night')
  assert.equal(d.paperTheme, 'latte')
  assert.equal(d.dark, '1')
})

test("Premium's first mode is Night, unless the system prefers light", () => {
  assert.equal(boot({ stored: { 'lab.look': 'premium' }, prefersLight: true }).theme, 'lab-premium-day')
  assert.equal(boot({ stored: { 'lab.look': 'premium', 'lab.premiumMode': 'night' }, prefersLight: true }).theme, 'lab-premium-night')
})

test('query parameters override for one visit and are never saved', () => {
  const premium = boot({ search: '?look=premium&mode=light' })
  assert.equal(premium.theme, 'lab-premium-day')
  assert.equal(premium.dark, '0')
  assert.deepEqual(premium.writes, [])
  assert.equal(boot({ search: '?mode=dark' }).theme, 'tokyo-night')
  assert.equal(boot({ search: '?theme=nord' }).theme, 'nord')
  assert.equal(boot({ search: '?theme=lab-premium-night' }).theme, 'cream', 'a Premium palette is not a Paper theme')
})

test('Aa is read from storage, and a bad value falls back to the default', () => {
  const d = boot({ stored: { 'lab.aa': '{"measure":"comfortable","size":19}' } })
  assert.equal(d.aaMeasure, 'comfortable')
  assert.equal(d.aaSize, '19')
  assert.equal(boot({ stored: { 'lab.aa': '{"size":42}' } }).aaSize, '17')
  assert.equal(boot({ stored: { 'lab.aa': 'not json' } }).aaMeasure, 'wide')
})

test('the server snapshot is fixed, so hydration always matches the HTML', () => {
  const s = look.getLookServerSnapshot()
  assert.equal(s, look.getLookServerSnapshot())
  assert.deepEqual(s, { look: 'paper', mode: 'night', theme: 'cream', paperTheme: 'cream', dark: false, aa: { measure: 'wide', size: 17 } })
  assert.ok(Object.isFrozen(s))
})

test('the client snapshot is stable until <html> changes', () => {
  const dataset: Record<string, string> = { look: 'premium', mode: 'day', theme: 'lab-premium-day', paperTheme: 'nord', dark: '0', aaMeasure: 'wide', aaSize: '16' }
  const g = globalThis as { document?: unknown }
  g.document = { documentElement: { dataset } }
  try {
    const a = look.getLookSnapshot()
    assert.equal(a, look.getLookSnapshot())
    assert.equal(a.aa.size, 16)
    dataset.aaSize = '19'
    const b = look.getLookSnapshot()
    assert.notEqual(a, b)
    assert.equal(b.aa.size, 19)
  } finally {
    delete g.document
  }
})
