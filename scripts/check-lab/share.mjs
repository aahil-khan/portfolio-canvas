/**
 * Rule X: Share. Lane module for scripts/check-lab.mjs (API.md §5 and §11; decision 7, NEXT
 * shortcut 7; DIRECTION, "Link copied" 140ms, back after 1.8s).
 *
 * On every entry, at 1440 (the end and the rail) and 390 (the end only):
 *   - exactly one `[data-share="end"]`, after `[data-body-end]`, and from 1200px exactly one
 *     `[data-share="rail"]` inside `[data-rail]`; each holds one `button[data-share-open]`;
 *   - with `navigator.share` present (stubbed, calls recorded), a press calls it once with a title
 *     and the canonical URL (`SITE_URL` + the path), and opens no menu;
 *   - with `navigator.share` deleted, a press opens `[data-share-menu]` (aria-expanded true) holding
 *     `button[data-share-copy]`, `a[data-share-x]` and `a[data-share-linkedin]`, both links carrying
 *     the canonical URL; Esc closes it and returns focus to the button; a press outside closes it;
 *   - Copy writes the canonical URL (clipboard stubbed), reads `copy.shareCopied` at ~1.0s and
 *     `copy.shareCopy` again at ~2.4s.
 */
import { builtRoutes, collector, labCopy, openPage, pool, siteUrl } from './layout.mjs'

function stubShare() {
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
  try {
    delete Navigator.prototype.share
    delete Navigator.prototype.canShare
  } catch {
    /* fine */
  }
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
}

function LAYOUT() {
  const end = document.querySelector('[data-body-end]')
  const docTop = (el) => el.getBoundingClientRect().top + scrollY
  const shares = (sel) => [...document.querySelectorAll(sel)]
  const e = shares('[data-share="end"]')
  const r = shares('[data-share="rail"]')
  return {
    end: e.length,
    rail: r.length,
    railInRail: r.every((x) => !!x.closest('[data-rail]')),
    endAfterBody: e[0] && end ? docTop(e[0]) >= docTop(end) - 1 : null,
    buttons: [...e, ...r].map((x) => x.querySelectorAll('button[data-share-open]').length),
  }
}

/** Scrolls a share block into view (through Lenis when it runs) and waits for the rail to show. */
async function REVEAL(where) {
  const L = window.__lc
  const el = document.querySelector(`[data-share="${where}"] button[data-share-open]`)
  if (!el) return false
  if (where === 'rail') L.scrollToY(Math.round(0.3 * innerHeight))
  else L.scrollToY(Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY - innerHeight / 2)))
  await L.frames(420)
  return true
}

function MENU(where) {
  const L = window.__lc
  const root = document.querySelector(`[data-share="${where}"]`)
  const btn = root?.querySelector('button[data-share-open]')
  const menu = root?.querySelector('[data-share-menu]')
  const r = menu?.getBoundingClientRect()
  return {
    expanded: btn?.getAttribute('aria-expanded'),
    menu: !!menu,
    hiddenAttr: menu ? menu.hasAttribute('hidden') : null,
    shown: menu ? L.visible(menu) && r.width > 0 : false,
    rect: r ? [r.left, r.top, r.right, r.bottom] : null,
    copy: !!menu?.querySelector('button[data-share-copy]'),
    x: menu?.querySelector('a[data-share-x]')?.getAttribute('href') ?? null,
    linkedin: menu?.querySelector('a[data-share-linkedin]')?.getAttribute('href') ?? null,
    focusOnButton: !!btn && document.activeElement === btn,
  }
}

const strip = (u) => String(u ?? '').replace(/\/$/, '')

export default {
  id: 'X',
  title: 'Share: one control at the end and in the rail; navigator.share gets the canonical URL; the fallback closes on Esc and outside; "Link copied" returns after 1.8s',
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
      const tag = `${route.path} @${width} ${native ? 'native' : 'fallback'}`
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
        if (native) {
          if (lay.end !== 1) c.fail('X', `${tag}: ${lay.end} [data-share="end"]; exactly one`)
          if (lay.endAfterBody === false) c.fail('X', `${tag}: [data-share="end"] sits before [data-body-end]`)
          if (width >= 1200 && lay.rail !== 1) c.fail('X', `${tag}: ${lay.rail} [data-share="rail"]; exactly one from 1200px`)
          if (!lay.railInRail) c.fail('X', `${tag}: a [data-share="rail"] outside [data-rail]`)
          lay.buttons.forEach((n, i) => n !== 1 && c.fail('X', `${tag}: share block ${i + 1} holds ${n} button[data-share-open]; exactly one`))
        }
        for (const where of width >= 1200 ? ['end', 'rail'] : ['end']) {
          const t = `${tag} ${where}`
          if (!(await p.evaluate(REVEAL, where))) {
            c.fail('X', `${t}: no button[data-share-open]`)
            continue
          }
          const btn = p.locator(`[data-share="${where}"] button[data-share-open]`).first()
          if (native) {
            await p.evaluate(() => (window.__shareCalls = []))
            await btn.click()
            await p.waitForTimeout(200)
            const calls = await p.evaluate(() => window.__shareCalls)
            if (calls.length !== 1) c.fail('X', `${t}: navigator.share was called ${calls.length} times, not once`)
            else {
              if (strip(calls[0].url) !== strip(canonical)) c.fail('X', `${t}: navigator.share got url "${calls[0].url}", not ${canonical}`)
              if (!calls[0].title || typeof calls[0].title !== 'string') c.fail('X', `${t}: navigator.share got no title`)
            }
            const m = await p.evaluate(MENU, where)
            if (m.shown) c.fail('X', `${t}: the fallback menu opened although navigator.share exists`)
            continue
          }
          // the fallback menu
          const closed0 = await p.evaluate(MENU, where)
          if (!closed0.menu) {
            c.fail('X', `${t}: no [data-share-menu]`)
            continue
          }
          if (!closed0.hiddenAttr) c.fail('X', `${t}: [data-share-menu] has no hidden attribute while closed`)
          await btn.click()
          await p.waitForTimeout(250)
          const open = await p.evaluate(MENU, where)
          if (!open.shown || open.hiddenAttr) {
            c.fail('X', `${t}: without navigator.share, pressing Share… opened no menu`)
            continue
          }
          if (open.expanded !== 'true') c.fail('X', `${t}: aria-expanded is "${open.expanded}" with the menu open`)
          if (!open.copy) c.fail('X', `${t}: the menu has no button[data-share-copy]`)
          const carries = (href) => !!href && (href.includes(encodeURIComponent(canonical)) || href.includes(canonical))
          if (!carries(open.x)) c.fail('X', `${t}: a[data-share-x] is "${open.x}", without the canonical URL`)
          if (!carries(open.linkedin)) c.fail('X', `${t}: a[data-share-linkedin] is "${open.linkedin}", without the canonical URL`)
          // Esc
          await p.keyboard.press('Escape')
          await p.waitForTimeout(250)
          const esc = await p.evaluate(MENU, where)
          if (esc.shown || !esc.hiddenAttr) c.fail('X', `${t}: Esc left the menu open`)
          if (esc.expanded !== 'false') c.fail('X', `${t}: after Esc aria-expanded is "${esc.expanded}"`)
          if (!esc.focusOnButton) c.fail('X', `${t}: after Esc focus is not on the Share… button`)
          // a press outside
          await btn.click()
          await p.waitForTimeout(250)
          const again = await p.evaluate(MENU, where)
          if (again.shown) {
            const vp = p.viewportSize()
            const [l, tp, r, b] = again.rect
            const x = l > 6 ? 3 : Math.min(vp.width - 3, r + 3)
            const y = tp > 80 ? 70 : Math.min(vp.height - 3, b + 10)
            await p.mouse.click(x, y)
            await p.waitForTimeout(250)
            if ((await p.evaluate(MENU, where)).shown) c.fail('X', `${t}: a press outside (at ${x},${y}) left the menu open`)
          } else c.fail('X', `${t}: the menu did not reopen`)
          // Copy link (the end's only)
          if (where !== 'end' || !open.copy) continue
          await btn.click()
          await p.waitForTimeout(250)
          const cp = p.locator(`[data-share="${where}"] [data-share-menu] button[data-share-copy]`).first()
          const before = await cp.evaluate((el) => window.__lc.visibleText(el))
          if (before !== copy.shareCopy) c.fail('X', `${t}: the copy button reads "${before}", not copy.shareCopy ("${copy.shareCopy}")`)
          await p.evaluate(() => (window.__copied = []))
          const t0 = Date.now()
          await cp.click()
          await p.waitForTimeout(Math.max(0, 1000 - (Date.now() - t0)))
          const mid = await p.evaluate(() => {
            const el = document.querySelector('[data-share="end"] [data-share-menu] button[data-share-copy]')
            return { text: window.__lc.visibleText(el), copied: window.__copied }
          })
          if (mid.copied.at(-1) == null || strip(mid.copied.at(-1)) !== strip(canonical)) c.fail('X', `${t}: Copy link wrote ${JSON.stringify(mid.copied.at(-1) ?? null)}, not ${canonical}`)
          if (mid.text !== copy.shareCopied) c.fail('X', `${t}: ~1.0s after Copy the button reads "${mid.text}", not copy.shareCopied ("${copy.shareCopied}")`)
          await p.waitForTimeout(Math.max(0, 2400 - (Date.now() - t0)))
          const late = await p.evaluate(() => window.__lc.visibleText(document.querySelector('[data-share="end"] [data-share-menu] button[data-share-copy]')))
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
