/**
 * Rule V: the rail. Lane module for scripts/check-lab.mjs (API.md §5 and §11; DIRECTION, "Layout";
 * decision 6 as revised on 27 Nov: always there, sections that scroll on their own).
 *
 * At 1440 and 1920, on every entry, in the Side panel layout (the default):
 *   - `[data-rail]` shows from the first screen: opacity 1 at scrollY 0, nothing waiting;
 *   - its `[data-rail-in]` is `position: sticky` at `top: bar + 24px`, no taller than the viewport
 *     minus the bar minus 48px, and never scrolls as one block (its content fits its box);
 *   - every `[data-rail-section]` keeps its heading inside the rail's box; a section whose
 *     `[data-rail-list]` is longer than its share scrolls that list on its own (`overflow-y: auto`),
 *     and scrolling it moves neither the page nor the section's heading;
 *   - with ≥ 2 headings in `[data-toc]`, scrolling a heading `#s-…` to just below the bar marks its
 *     link `aria-current="location"`, and only its link.
 * At 1440 in the Centred layout (`lab.aa` layout "centred"): the rail is a block after the body, with
 *   no visible `[data-toc]` or `[data-share="rail"]`, centred with the column (|Δ| ≤ 24px).
 * At 390 and 1024: `[data-rail]` is in normal flow after the body, shows once reached, and holds no
 *   visible `[data-toc]` and no visible `[data-share="rail"]`.
 */
import { builtRoutes, collector, openPage, pool } from './layout.mjs'

async function WIDE() {
  const L = window.__lc
  const rail = document.querySelector('[data-rail]')
  const box = rail?.querySelector('[data-rail-in]')
  if (!rail || !box) return { missing: true }
  const bar = document.querySelector('header[data-bar]')
  const barH = bar ? bar.getBoundingClientRect().height : 56
  L.scrollToY(0)
  await L.frames(120)
  const at0 = { op: L.opacity(rail), shown: L.visible(rail), waiting: rail.hasAttribute('data-waiting'), top: Math.round(rail.getBoundingClientRect().top) }
  const s = getComputedStyle(box)
  // scroll until the rail's box is stuck under the bar
  const y = Math.max(0, Math.round(rail.getBoundingClientRect().top + scrollY - barH - 24 + 400))
  L.scrollToY(Math.min(y, document.documentElement.scrollHeight - innerHeight))
  await L.frames(300)
  const b = box.getBoundingClientRect()
  const stuck = { pos: s.position, top: parseFloat(s.top), boxTop: Math.round(b.top), h: Math.round(b.height), scrollH: box.scrollHeight, clientH: box.clientHeight, avail: innerHeight - barH - 48 }
  const sections = []
  for (const sec of rail.querySelectorAll('[data-rail-section]')) {
    if (!L.visible(sec)) continue
    const h = sec.querySelector('h2')
    const list = sec.querySelector('[data-rail-list]')
    const r = sec.getBoundingClientRect()
    const o = { name: sec.getAttribute('data-rail-section'), inBox: r.top >= b.top - 1 && r.bottom <= b.bottom + 1, headIn: !!h && h.getBoundingClientRect().bottom <= b.bottom + 1 && h.getBoundingClientRect().top >= b.top - 1 }
    if (list) {
      o.overflowY = getComputedStyle(list).overflowY
      o.long = list.scrollHeight > list.clientHeight + 1
      if (o.long) {
        const page = scrollY
        const head = h.getBoundingClientRect().top
        list.scrollTop = list.scrollHeight
        await L.frames(80)
        o.scrolled = list.scrollTop > 0
        o.pageMoved = Math.abs(scrollY - page) > 1
        o.headMoved = Math.abs(h.getBoundingClientRect().top - head) > 1
        list.scrollTop = 0
      }
    }
    sections.push(o)
  }
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
  return { at0, barH, stuck, sections, headings: ids.length, bodyHeads, toc, hasToc: !!rail.querySelector('[data-toc]') }
}

async function NARROW() {
  const L = window.__lc
  const rail = document.querySelector('[data-rail]')
  const end = document.querySelector('[data-body-end]')
  const column = document.querySelector('[data-column]')
  if (!rail) return { missing: true }
  const s = getComputedStyle(rail)
  const docTop = (el) => el.getBoundingClientRect().top + scrollY
  const shownOutside = (sel) => [...document.querySelectorAll(sel)].some((el) => L.visible(el) && el.getClientRects().length > 0)
  const box = rail.querySelector('[data-rail-in]')
  const r = {
    pos: s.position,
    boxPos: box ? getComputedStyle(box).position : null,
    railTop: Math.round(docTop(rail)),
    endTop: end ? Math.round(docTop(end)) : null,
    toc: [...rail.querySelectorAll('[data-toc]')].some((el) => L.visible(el) && el.getClientRects().length > 0),
    shareRail: shownOutside('[data-share="rail"]'),
  }
  if (column) {
    const vw = document.documentElement.clientWidth
    const a = column.getBoundingClientRect()
    const b = rail.getBoundingClientRect()
    r.gap = [Math.round(Math.min(a.left, b.left)), Math.round(vw - Math.max(a.right, b.right))]
  }
  L.scrollToY(Math.max(0, docTop(rail) - 120))
  await L.frames(350)
  r.op = L.opacity(rail)
  return r
}

function centred() {
  try {
    localStorage.setItem('lab.aa', JSON.stringify({ layout: 'centred' }))
  } catch {
    /* fine */
  }
}

export default {
  id: 'V',
  title: 'The rail: there from the first screen at 1200px and up, sticky, each section scrolling its own list; a block after the text below 1200px and when Centred',
  needs: ['server', 'browser'],
  async run(ctx) {
    const info = await builtRoutes(ctx)
    if (info.notBuilt) return { notBuilt: info.notBuilt }
    const c = collector(['V'])
    for (const m of info.missing) c.fail('V', m)
    const look = ctx.looks[0]
    const widths = [390, 1024, 1440, 1920].filter((w) => ctx.widths.some((x) => x.width === w))
    if (!widths.some((w) => w >= 1200)) c.note('V', 'no width ≥ 1200 in this run, so the side rail is not checked')
    const jobs = info.entries.flatMap((route) => [
      ...widths.map((width) => ({ route, width, layout: 'side' })),
      ...(widths.includes(1440) ? [{ route, width: 1440, layout: 'centred' }] : []),
    ])
    let rails = 0
    let scrolled = 0
    await pool(jobs, 2, async ({ route, width, layout }) => {
      const tag = `${route.path} @${width}${layout === 'centred' ? ' Centred' : ''}`
      const o = await openPage(ctx, route.path, { width, query: look.query, init: layout === 'centred' ? [centred] : [] })
      try {
        if (width >= 1200 && layout === 'side') {
          const r = await o.page.evaluate(WIDE)
          if (r.missing) return c.fail('V', `${tag}: no [data-rail] with a [data-rail-in]`)
          rails += 1
          if (r.at0.waiting || !r.at0.shown || r.at0.op < 0.99) c.fail('V', `${tag}: before any scroll the rail is not shown (opacity ${r.at0.op}${r.at0.waiting ? ', data-waiting' : ''})`)
          if (r.at0.top > r.barH + 900) c.note('V', `${tag}: the rail starts ${r.at0.top}px down`)
          if (r.stuck.pos !== 'sticky') c.fail('V', `${tag}: [data-rail-in] is position ${r.stuck.pos}, not sticky`)
          else if (Math.abs(r.stuck.top - (r.barH + 24)) > 1) c.fail('V', `${tag}: the rail sticks at top ${r.stuck.top}px, not bar + 24 = ${r.barH + 24}px`)
          if (r.stuck.h > r.stuck.avail + 1) c.fail('V', `${tag}: the rail's box is ${r.stuck.h}px, more than 100vh − bar − 48 = ${r.stuck.avail}px`)
          if (r.stuck.scrollH > r.stuck.clientH + 1) c.fail('V', `${tag}: the rail scrolls as one block (${r.stuck.scrollH}px of content in ${r.stuck.clientH}px)`)
          for (const sec of r.sections) {
            if (!sec.inBox) c.fail('V', `${tag}: the ${sec.name} section runs outside the rail's box`)
            if (!sec.headIn) c.fail('V', `${tag}: the ${sec.name} section's heading is not inside the rail's box`)
            if (sec.long) {
              if (!/^(auto|scroll)$/.test(sec.overflowY)) c.fail('V', `${tag}: the ${sec.name} list is longer than its share and overflow-y is ${sec.overflowY}`)
              else if (!sec.scrolled) c.fail('V', `${tag}: the ${sec.name} list is longer than its share and does not scroll`)
              if (sec.pageMoved) c.fail('V', `${tag}: scrolling the ${sec.name} list scrolled the page`)
              if (sec.headMoved) c.fail('V', `${tag}: scrolling the ${sec.name} list moved its heading`)
              scrolled += 1
            }
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
          if (r.pos === 'sticky' || r.pos === 'fixed' || r.boxPos === 'sticky') c.fail('V', `${tag}: the rail is sticky here, not in normal flow`)
          if (r.endTop == null) c.fail('V', `${tag}: no [data-body-end]`)
          else if (!(r.railTop > r.endTop)) c.fail('V', `${tag}: the rail starts at ${r.railTop}px, not after the body's end (${r.endTop}px)`)
          if (r.toc) c.fail('V', `${tag}: On this page ([data-toc]) shows in the block after the text`)
          if (r.shareRail) c.fail('V', `${tag}: the rail's Share ([data-share="rail"]) shows in the block after the text`)
          if (r.op < 0.99) c.fail('V', `${tag}: reached, the rail's block is at opacity ${r.op.toFixed(2)}`)
          if (layout === 'centred' && r.gap && Math.abs(r.gap[0] - r.gap[1]) > 24) c.fail('V', `${tag}: the Centred column sits ${r.gap[0]}px from the left and ${r.gap[1]}px from the right`)
        }
      } catch (e) {
        c.fail('V', `${tag}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    })
    if (!rails && !c.map.get('V').fail.some((f) => !/no \[data-rail/.test(f))) return { notBuilt: 'no entry page renders [data-rail] yet' }
    if (widths.includes(1440) && !scrolled) c.note('V', 'no rail list was long enough to scroll at these widths')
    c.note('V', `${jobs.length} loads in ${look.name}; ${scrolled} long lists scrolled on their own`)
    return c.result('V')
  },
}
