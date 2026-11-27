/**
 * Rule V: the rail. Lane module for scripts/check-lab.mjs (API.md §5 and §11; DIRECTION, "Layout";
 * decision 6, NEXT shortcut 5).
 *
 * At 1440 and 1920, on every entry:
 *   - `[data-rail]` is `position: sticky` at `top: bar + 24px`;
 *   - at scrollY 0 it waits: `data-waiting` and computed opacity 0;
 *   - scrolled to 0.3 × innerHeight (past the quarter-screen sentinel) it shows: opacity 1, no
 *     `data-waiting`;
 *   - when taller than the viewport minus the bar minus 48px, it scrolls on its own
 *     (`overflow-y: auto`) and is no taller than that;
 *   - with ≥ 2 headings in `[data-toc]`, scrolling a heading `#s-…` to just below the bar marks its
 *     link `aria-current="location"`, and only its link.
 * At 390 and 1024: `[data-rail]` is in normal flow after the body (its top below `[data-body-end]`'s),
 * shows once reached, and holds no visible `[data-toc]` and no visible `[data-share="rail"]`.
 */
import { builtRoutes, collector, openPage, pool } from './layout.mjs'

async function WIDE() {
  const L = window.__lc
  const rail = document.querySelector('[data-rail]')
  if (!rail) return { missing: true }
  const bar = document.querySelector('header[data-bar]')
  const barH = bar ? bar.getBoundingClientRect().height : 56
  L.scrollToY(0)
  await L.frames(120)
  const s0 = getComputedStyle(rail)
  const at0 = { pos: s0.position, top: parseFloat(s0.top), op: +s0.opacity, waiting: rail.hasAttribute('data-waiting') }
  const max = document.documentElement.scrollHeight - innerHeight
  const y = Math.round(0.3 * innerHeight)
  if (max < y) return { at0, barH, short: true }
  L.scrollToY(y)
  await L.frames(400)
  const s1 = getComputedStyle(rail)
  const shown = { op: +s1.opacity, waiting: rail.hasAttribute('data-waiting'), scrollH: rail.scrollHeight, clientH: rail.clientHeight, overflowY: s1.overflowY, avail: innerHeight - barH - 48 }
  const links = [...rail.querySelectorAll('[data-toc] a[href^="#s-"]')]
  const ids = links.map((a) => decodeURIComponent(a.getAttribute('href').slice(1)))
  const toc = []
  const picks = ids.length >= 2 ? [...new Set([1, ids.length - 1])] : []
  for (const i of picks) {
    const h = document.getElementById(ids[i])
    if (!h) {
      toc.push({ id: ids[i], missing: true })
      continue
    }
    L.scrollToY(Math.round(h.getBoundingClientRect().top + scrollY - barH - 16))
    await L.frames(350)
    const off = h.getBoundingClientRect().top - (barH + 16)
    if (Math.abs(off) > 4) {
      toc.push({ id: ids[i], unreachable: Math.round(off) })
      continue
    }
    toc.push({ id: ids[i], cur: links.filter((a) => a.getAttribute('aria-current') === 'location').map((a) => decodeURIComponent(a.getAttribute('href').slice(1))) })
  }
  const bodyHeads = document.querySelectorAll('[data-column] h2[id^="s-"]').length
  return { at0, barH, shown, headings: ids.length, bodyHeads, toc, hasToc: !!rail.querySelector('[data-toc]') }
}

async function NARROW() {
  const L = window.__lc
  const rail = document.querySelector('[data-rail]')
  const end = document.querySelector('[data-body-end]')
  if (!rail) return { missing: true }
  const s = getComputedStyle(rail)
  const docTop = (el) => el.getBoundingClientRect().top + scrollY
  const shownOutside = (sel) => [...document.querySelectorAll(sel)].some((el) => L.visible(el) && el.getClientRects().length > 0)
  const r = { pos: s.position, railTop: Math.round(docTop(rail)), endTop: end ? Math.round(docTop(end)) : null, toc: [...rail.querySelectorAll('[data-toc]')].some((el) => L.visible(el) && el.getClientRects().length > 0), shareRail: shownOutside('[data-share="rail"]') }
  L.scrollToY(Math.max(0, docTop(rail) - 120))
  await L.frames(350)
  r.op = L.opacity(rail)
  return r
}

export default {
  id: 'V',
  title: 'The rail: sticky from 1200px, revealed after a quarter screen, On this page marks the heading; a block after the text below',
  needs: ['server', 'browser'],
  async run(ctx) {
    const info = await builtRoutes(ctx)
    if (info.notBuilt) return { notBuilt: info.notBuilt }
    const c = collector(['V'])
    for (const m of info.missing) c.fail('V', m)
    const look = ctx.looks[0]
    const widths = [390, 1024, 1440, 1920].filter((w) => ctx.widths.some((x) => x.width === w))
    if (!widths.some((w) => w >= 1200)) c.note('V', 'no width ≥ 1200 in this run, so the sticky rail is not checked')
    const jobs = info.entries.flatMap((route) => widths.map((width) => ({ route, width })))
    let rails = 0
    await pool(jobs, 2, async ({ route, width }) => {
      const tag = `${route.path} @${width}`
      const o = await openPage(ctx, route.path, { width, query: look.query })
      try {
        if (width >= 1200) {
          const r = await o.page.evaluate(WIDE)
          if (r.missing) return c.fail('V', `${tag}: no [data-rail]`)
          rails += 1
          if (r.at0.pos !== 'sticky') c.fail('V', `${tag}: [data-rail] is position ${r.at0.pos}, not sticky`)
          else if (Math.abs(r.at0.top - (r.barH + 24)) > 1) c.fail('V', `${tag}: the rail sticks at top ${r.at0.top}px, not bar + 24 = ${r.barH + 24}px`)
          if (!r.at0.waiting || r.at0.op !== 0) c.fail('V', `${tag}: before any scroll the rail ${r.at0.waiting ? '' : 'has no data-waiting'}${!r.at0.waiting && r.at0.op !== 0 ? ' and ' : ''}${r.at0.op !== 0 ? `shows at opacity ${r.at0.op}` : ''}`)
          if (r.short) return c.note('V', `${tag}: too short to scroll 0.3 × innerHeight`)
          if (r.shown.waiting || r.shown.op < 0.99) c.fail('V', `${tag}: after 0.3 × innerHeight the rail still waits (data-waiting ${r.shown.waiting}, opacity ${r.shown.op})`)
          if (r.shown.scrollH > r.shown.avail + 1) {
            if (!/^(auto|scroll)$/.test(r.shown.overflowY)) c.fail('V', `${tag}: the rail is ${r.shown.scrollH}px tall in ${r.shown.avail}px and overflow-y is ${r.shown.overflowY}, not auto`)
            if (r.shown.clientH > r.shown.avail + 1) c.fail('V', `${tag}: the rail's box is ${r.shown.clientH}px, more than 100vh − bar − 48 = ${r.shown.avail}px`)
          }
          // On this page lists the body's headings, when it has two or more
          if (r.bodyHeads >= 2 && !r.hasToc) c.fail('V', `${tag}: ${r.bodyHeads} headings in the body, and no [data-toc] in the rail`)
          if (r.bodyHeads < 2 && r.hasToc) c.fail('V', `${tag}: On this page shows with ${r.bodyHeads} heading in the body`)
          for (const t of r.toc) {
            if (t.missing) c.fail('V', `${tag}: On this page links #${t.id}, which is not on the page`)
            else if (t.unreachable != null) c.note('V', `${tag}: could not scroll #${t.id} under the bar (off by ${t.unreachable}px)`)
            else if (t.cur.length !== 1 || t.cur[0] !== t.id) c.fail('V', `${tag}: with #${t.id} just under the bar, aria-current="location" is on ${t.cur.length ? t.cur.map((x) => '#' + x).join(', ') : 'no link'}`)
          }
        } else {
          const r = await o.page.evaluate(NARROW)
          if (r.missing) return c.fail('V', `${tag}: no [data-rail]`)
          rails += 1
          if (r.pos === 'sticky' || r.pos === 'fixed') c.fail('V', `${tag}: below 1200px the rail is position ${r.pos}, not in normal flow`)
          if (r.endTop == null) c.fail('V', `${tag}: no [data-body-end]`)
          else if (!(r.railTop > r.endTop)) c.fail('V', `${tag}: the rail starts at ${r.railTop}px, not after the body's end (${r.endTop}px)`)
          if (r.toc) c.fail('V', `${tag}: below 1200px On this page ([data-toc]) still shows`)
          if (r.shareRail) c.fail('V', `${tag}: below 1200px the rail's Share ([data-share="rail"]) still shows`)
          if (r.op < 0.99) c.fail('V', `${tag}: reached, the rail's block is at opacity ${r.op.toFixed(2)}`)
        }
      } catch (e) {
        c.fail('V', `${tag}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    })
    if (!rails && !c.map.get('V').fail.some((f) => !/no \[data-rail\]/.test(f))) return { notBuilt: 'no entry page renders [data-rail] yet' }
    c.note('V', `${jobs.length} loads in ${look.name}`)
    return c.result('V')
  },
}
