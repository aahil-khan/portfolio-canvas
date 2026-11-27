/**
 * Rule X: Share. Lane module for scripts/check-lab.mjs (API.md §5 and §11; decision 7 as revised
 * on 27 Nov: the actions themselves, no menu; DIRECTION, "Link copied" 140ms, back after 1.8s).
 *
 * On every entry, at 1440 (the end and the rail) and 390 (the end only), with and without
 * `navigator.share`:
 *   - exactly one `[data-share="end"]`, after `[data-body-end]`, and from 1200px exactly one
 *     `[data-share="rail"]` inside `[data-rail]`;
 *   - each is one row, visible without pressing anything: `button[data-share-copy]`,
 *     `a[data-share-x]` and `a[data-share-linkedin]`, both links carrying the canonical URL; and
 *     `button[data-share-native]` exactly when the browser has `navigator.share`;
 *   - no menu: no `[data-share-menu]`, nothing `aria-expanded`;
 *   - Share… calls `navigator.share` once, with a title and the canonical URL (`SITE_URL` + path);
 *   - Copy link writes the canonical URL (clipboard stubbed), reads `copy.shareCopied` at ~1.0s and
 *     `copy.shareCopy` again at ~2.4s.
 */
import { builtRoutes, collector, labCopy, openPage, pool, siteUrl } from './layout.mjs'

// Each init script is serialized on its own, so each carries its own clipboard stub.
function stubShare() {
  window.__copied = []
  const writeText = async (t) => {
    window.__copied.push(String(t))
  }
  try {
    if (navigator.clipboard) Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: writeText })
    else Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => ({ writeText }) })
  } catch {
    /* fine */
  }
  window.__shareCalls = []
  Object.defineProperty(Navigator.prototype, 'share', {
    configurable: true,
    writable: true,
    value: function share(d) {
      window.__shareCalls.push(JSON.parse(JSON.stringify(d ?? {})))
      return Promise.resolve()
    },
  })
  Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, writable: true, value: () => true })
}

function noShare() {
  window.__copied = []
  const writeText = async (t) => {
    window.__copied.push(String(t))
  }
  try {
    if (navigator.clipboard) Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: writeText })
    else Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => ({ writeText }) })
  } catch {
    /* fine */
  }
  try {
    delete Navigator.prototype.share
    delete Navigator.prototype.canShare
  } catch {
    /* fine */
  }
}

function LAYOUT() {
  const L = window.__lc
  const end = document.querySelector('[data-body-end]')
  const docTop = (el) => el.getBoundingClientRect().top + scrollY
  const e = [...document.querySelectorAll('[data-share="end"]')]
  const r = [...document.querySelectorAll('[data-share="rail"]')]
  const row = (root) => {
    const shown = (sel) => {
      const el = root.querySelector(sel)
      return el && L.visible(el) && el.getBoundingClientRect().width > 0 ? el : null
    }
    return {
      copy: !!shown('button[data-share-copy]'),
      x: shown('a[data-share-x]')?.getAttribute('href') ?? null,
      linkedin: shown('a[data-share-linkedin]')?.getAttribute('href') ?? null,
      native: root.querySelectorAll('button[data-share-native]').length,
      menu: root.querySelectorAll('[data-share-menu], [aria-expanded]').length,
    }
  }
  return {
    end: e.length,
    rail: r.length,
    railInRail: r.every((x) => !!x.closest('[data-rail]')),
    endAfterBody: e[0] && end ? docTop(e[0]) >= docTop(end) - 1 : null,
    rows: { end: e[0] ? row(e[0]) : null, rail: r[0] ? row(r[0]) : null },
  }
}

/** Scrolls a share row into view (through Lenis when it runs). */
async function REVEAL(where) {
  const L = window.__lc
  const el = document.querySelector(`[data-share="${where}"] [data-share-row]`)
  if (!el) return false
  if (where === 'end') L.scrollToY(Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY - innerHeight / 2)))
  else L.scrollToY(Math.round(0.3 * innerHeight))
  await L.frames(300)
  return true
}

const strip = (u) => String(u ?? '').replace(/\/$/, '')

export default {
  id: 'X',
  title: 'Share: Copy link, X and LinkedIn in a row at the end and in the rail, no menu; Share… only with navigator.share, given the canonical URL; "Link copied" returns after 1.8s',
  needs: ['server', 'browser'],
  async run(ctx) {
    const info = await builtRoutes(ctx)
    if (info.notBuilt) return { notBuilt: info.notBuilt }
    const c = collector(['X'])
    for (const m of info.missing) c.fail('X', m)
    const copy = labCopy(ctx.root)
    const SITE = siteUrl(ctx.root)
    const look = ctx.looks[0]
    const widths = [390, 1440].filter((w) => ctx.widths.some((x) => x.width === w))
    const jobs = info.entries.flatMap((route) => widths.flatMap((width) => [{ route, width, native: true }, { route, width, native: false }]))
    let built = 0
    await pool(jobs, 2, async ({ route, width, native }) => {
      const canonical = SITE + route.path
      const tag = `${route.path} @${width} ${native ? 'with' : 'without'} navigator.share`
      const o = await openPage(ctx, route.path, {
        width,
        query: look.query,
        init: [native ? stubShare : noShare],
        contextOptions: { permissions: ['clipboard-read', 'clipboard-write'] },
      })
      const p = o.page
      try {
        const lay = await p.evaluate(LAYOUT)
        if (!lay.end && !lay.rail) return c.fail('X', `${tag}: no [data-share] on the page`)
        built += 1
        if (lay.end !== 1) c.fail('X', `${tag}: ${lay.end} [data-share="end"]; exactly one`)
        if (lay.endAfterBody === false) c.fail('X', `${tag}: [data-share="end"] sits before [data-body-end]`)
        if (width >= 1200 && lay.rail !== 1) c.fail('X', `${tag}: ${lay.rail} [data-share="rail"]; exactly one from 1200px`)
        if (!lay.railInRail) c.fail('X', `${tag}: a [data-share="rail"] outside [data-rail]`)
        const carries = (href) => !!href && (href.includes(encodeURIComponent(canonical)) || href.includes(canonical))
        for (const where of width >= 1200 ? ['end', 'rail'] : ['end']) {
          const t = `${tag} ${where}`
          if (!(await p.evaluate(REVEAL, where))) {
            c.fail('X', `${t}: no [data-share-row]`)
            continue
          }
          const row = (await p.evaluate(LAYOUT)).rows[where]
          if (!row) continue
          if (!row.copy) c.fail('X', `${t}: no visible button[data-share-copy]`)
          if (!carries(row.x)) c.fail('X', `${t}: a[data-share-x] is "${row.x}", not shown with the canonical URL`)
          if (!carries(row.linkedin)) c.fail('X', `${t}: a[data-share-linkedin] is "${row.linkedin}", not shown with the canonical URL`)
          if (row.menu) c.fail('X', `${t}: ${row.menu} menu part(s) ([data-share-menu] or aria-expanded); the actions show directly`)
          if (row.native !== (native ? 1 : 0)) c.fail('X', `${t}: ${row.native} button[data-share-native] ${native ? 'with' : 'without'} navigator.share; want ${native ? 1 : 0}`)
          if (native && row.native) {
            await p.evaluate(() => (window.__shareCalls = []))
            await p.locator(`[data-share="${where}"] button[data-share-native]`).first().click()
            await p.waitForTimeout(200)
            const calls = await p.evaluate(() => window.__shareCalls)
            if (calls.length !== 1) c.fail('X', `${t}: navigator.share was called ${calls.length} times, not once`)
            else {
              if (strip(calls[0].url) !== strip(canonical)) c.fail('X', `${t}: navigator.share got url "${calls[0].url}", not ${canonical}`)
              if (!calls[0].title || typeof calls[0].title !== 'string') c.fail('X', `${t}: navigator.share got no title`)
            }
          }
          // Copy link, once per page (the end's on a phone, the rail's on desktop)
          if (native || where !== (width >= 1200 ? 'rail' : 'end') || !row.copy) continue
          const sel = `[data-share="${where}"] button[data-share-copy]`
          const cp = p.locator(sel).first()
          const before = await cp.evaluate((el) => window.__lc.visibleText(el))
          if (before !== copy.shareCopy) c.fail('X', `${t}: the copy button reads "${before}", not copy.shareCopy ("${copy.shareCopy}")`)
          await p.evaluate(() => (window.__copied = []))
          const t0 = Date.now()
          await cp.click()
          await p.waitForTimeout(Math.max(0, 1000 - (Date.now() - t0)))
          const mid = await p.evaluate((s) => ({ text: window.__lc.visibleText(document.querySelector(s)), copied: window.__copied }), sel)
          if (mid.copied.at(-1) == null || strip(mid.copied.at(-1)) !== strip(canonical)) c.fail('X', `${t}: Copy link wrote ${JSON.stringify(mid.copied.at(-1) ?? null)}, not ${canonical}`)
          if (mid.text !== copy.shareCopied) c.fail('X', `${t}: ~1.0s after Copy the button reads "${mid.text}", not copy.shareCopied ("${copy.shareCopied}")`)
          await p.waitForTimeout(Math.max(0, 2400 - (Date.now() - t0)))
          const late = await p.evaluate((s) => window.__lc.visibleText(document.querySelector(s)), sel)
          if (late !== copy.shareCopy) c.fail('X', `${t}: ~2.4s after Copy the button reads "${late}", not copy.shareCopy ("${copy.shareCopy}") again`)
        }
      } catch (e) {
        c.fail('X', `${tag}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    })
    if (!built && !c.map.get('X').fail.some((f) => !/no \[data-share\] on the page/.test(f))) return { notBuilt: 'no entry page renders [data-share] yet' }
    c.note('X', `${jobs.length} loads; canonical origin ${SITE}`)
    return c.result('X')
  },
}
