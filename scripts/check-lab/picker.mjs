/**
 * Rule Y: the chapter picker. Lane module for scripts/check-lab.mjs (API.md §5 and §11; decision 12).
 *
 * On every chapter (`entryKind: 'chapter'`), at 390 and 1440 in the first look, and at 1440 in the
 * Lab theme's Dark too:
 *   - the page has a `details[data-picker]` > `summary` + `[data-picker-panel]`;
 *   - opening it (a click on the summary) shows the panel and moves nothing: the rects of
 *     `[data-lead]`, `h1` and the first three `article[data-entry] p` change by ≤ 1px;
 *   - Esc (with focus inside the panel) closes it and returns focus to the summary;
 *   - a press outside closes it.
 */
import { builtRoutes, collector, movedBetween, openPage, pool } from './layout.mjs'

function STATE() {
  const L = window.__lc
  const d = document.querySelector('details[data-picker]')
  const s = d?.querySelector(':scope > summary')
  const panel = d?.querySelector('[data-picker-panel]')
  const r = panel?.getBoundingClientRect()
  return {
    picker: !!d,
    summary: !!s,
    panel: !!panel,
    open: !!d?.open,
    shown: !!panel && !!d?.open && L.visible(panel) && r.width > 0,
    rect: r ? [r.left, r.top, r.right, r.bottom] : null,
    focusOnSummary: !!s && document.activeElement === s,
    rects: L.keyRects(),
  }
}

export default {
  id: 'Y',
  title: 'Picker: opening it moves nothing (≤ 1px); Esc closes it and returns focus; a press outside closes it',
  needs: ['server', 'browser'],
  async run(ctx) {
    const info = await builtRoutes(ctx)
    if (info.notBuilt) return { notBuilt: info.notBuilt }
    const c = collector(['Y'])
    for (const m of info.missing) c.fail('Y', m)
    const chapters = info.entries.filter((r) => r.entryKind === 'chapter')
    if (!chapters.length) return { notBuilt: 'no chapter answers 200 yet' }
    const widths = [390, 1440].filter((w) => ctx.widths.some((x) => x.width === w))
    const jobs = []
    for (const route of chapters)
      for (const width of widths) {
        jobs.push({ route, width, look: ctx.looks[0] })
        const dark = ctx.looks.find((l) => /look=lab/.test(l.query) && /mode=dark/.test(l.query))
        if (width === 1440 && dark && dark !== ctx.looks[0]) jobs.push({ route, width, look: dark })
      }
    let pickers = 0
    await pool(jobs, 2, async ({ route, width, look }) => {
      const tag = `${route.path} @${width} ${look.name}`
      const o = await openPage(ctx, route.path, { width, query: look.query })
      const p = o.page
      try {
        const s0 = await p.evaluate(STATE)
        if (!s0.picker) return c.fail('Y', `${tag}: a chapter with no details[data-picker]`)
        pickers += 1
        if (!s0.summary || !s0.panel) return c.fail('Y', `${tag}: details[data-picker] needs a summary and a [data-picker-panel] (summary ${s0.summary}, panel ${s0.panel})`)
        if (s0.open) c.fail('Y', `${tag}: the picker is open on arrival`)
        const summary = p.locator('details[data-picker] > summary').first()
        await summary.click()
        await p.waitForTimeout(300)
        const s1 = await p.evaluate(STATE)
        if (!s1.open || !s1.shown) {
          c.fail('Y', `${tag}: a click on the summary did not open the picker (open ${s1.open}, panel shown ${s1.shown})`)
          return
        }
        const mv = movedBetween(s0.rects, s1.rects)
        if (mv.d > 1) c.fail('Y', `${tag}: opening the picker moved ${mv.what} by ${Number.isFinite(mv.d) ? mv.d.toFixed(1) + 'px' : '(count changed)'}`)
        // Esc from inside the panel
        await p.evaluate(() => document.querySelector('details[data-picker] [data-picker-panel]')?.querySelector('a[href],button,[tabindex]:not([tabindex="-1"])')?.focus())
        await p.keyboard.press('Escape')
        await p.waitForTimeout(250)
        const s2 = await p.evaluate(STATE)
        if (s2.open) c.fail('Y', `${tag}: Esc left the picker open`)
        if (!s2.focusOnSummary) c.fail('Y', `${tag}: after Esc focus is not on the picker's summary`)
        // a press outside
        await summary.click()
        await p.waitForTimeout(300)
        const s3 = await p.evaluate(STATE)
        if (!s3.open) {
          c.fail('Y', `${tag}: the picker did not reopen`)
          return
        }
        const vp = p.viewportSize()
        const [l, t, r, b] = s3.rect
        const x = l > 6 ? 3 : Math.min(vp.width - 3, r + 3)
        const y = b + 12 < vp.height ? b + 12 : Math.max(70, t - 12)
        await p.mouse.click(x, y)
        await p.waitForTimeout(250)
        if ((await p.evaluate(STATE)).open) c.fail('Y', `${tag}: a press outside (at ${x},${Math.round(y)}) left the picker open`)
      } catch (e) {
        c.fail('Y', `${tag}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    })
    if (!pickers && !c.map.get('Y').fail.some((f) => !/no details\[data-picker\]/.test(f))) return { notBuilt: 'no chapter renders details[data-picker] yet' }
    c.note('Y', `${chapters.length} chapters, ${jobs.length} loads`)
    return c.result('Y')
  },
}
