/**
 * Rule G: reading progress. Lane module for scripts/check-lab.mjs (API.md §5 and §11; DIRECTION,
 * "The reading progress"; NEXT shortcut 1, decision 13).
 *
 * On every entry, at 390 (one look) and 1440 (every look), reduced motion off:
 *   - `[data-trail]` is full-width and its computed transform reads scaleX 0 (±0.005) at the top;
 *   - scrolled in 12 instant steps to where `[data-body-end]` meets the viewport's bottom edge, it
 *     never falls, reads < 1 one step before, and exactly 1.000 ± 0.005 there;
 *   - `[data-reading-dot]` carries no `data-in-footer` before that point, and does once scrolled to
 *     the very bottom with the footer in view;
 *   - the trail is visible once p > 0: opacity > 0 and a painted background, in every look.
 * The trail is read from computed style, so a CSS-driven implementation passes too. Scrolls go
 * through `window.__lenis` when Lenis runs (html.lenis), else `window.scrollTo`.
 */
import { builtRoutes, collector, fifthChapter, openPage, pool } from './layout.mjs'

const STEPS = 12

async function TRACK({ steps }) {
  const L = window.__lc
  const trail = document.querySelector('[data-trail]')
  const end = document.querySelector('[data-body-end]')
  const dot = document.querySelector('[data-reading-dot]')
  if (!trail) return { missing: '[data-trail]' }
  if (!end) return { missing: '[data-body-end]' }
  L.scrollToY(0)
  await L.frames()
  const s0 = L.scaleX(trail)
  const fullWidth = trail.offsetWidth >= document.documentElement.clientWidth - 1
  const max = document.documentElement.scrollHeight - innerHeight
  let target = Math.round(end.getBoundingClientRect().top + scrollY - innerHeight)
  if (target <= 0) return { short: true, target, s0, fullWidth }
  if (target > max) return { unreachable: true, target, max, s0, fullWidth }
  const hop = () => (dot ? dot.hasAttribute('data-in-footer') : null)
  const reads = []
  let vis = null
  for (let i = 1; i <= steps; i++) {
    L.scrollToY(i === steps ? target : Math.round((target * i) / steps))
    await L.frames()
    if (i === steps) {
      // re-aim once, in case anything above the body's end moved while scrolling
      const off = end.getBoundingClientRect().top - innerHeight
      if (Math.abs(off) > 1) {
        target = Math.round(scrollY + off)
        L.scrollToY(target)
        await L.frames()
      }
    }
    const p = L.scaleX(trail)
    reads.push({ y: Math.round(scrollY), p, hop: hop(), off: Math.round(end.getBoundingClientRect().top - innerHeight) })
    if (vis == null && p > 0.05) {
      // the trail fades in over 180ms once p > 0 (DIRECTION "Hover"); read it once that has run,
      // or a loaded machine samples the transition's first, unpainted frame
      await new Promise((r) => setTimeout(r, 260))
      const s = getComputedStyle(trail)
      const bg = L.parse(s.backgroundColor)
      vis = { opacity: L.opacity(trail), painted: bg[3] > 0 || s.backgroundImage !== 'none', shown: L.visible(trail), bg: s.backgroundColor }
    }
  }
  L.scrollToY(max + 200)
  await L.frames()
  await new Promise((r) => setTimeout(r, 450))
  const foot = document.querySelector('footer[data-footer]')
  const footIn = foot ? foot.getBoundingClientRect().top < innerHeight : false
  return { s0, fullWidth, reads, vis, dot: !!dot, hopEnd: hop(), footIn, foot: !!foot, target }
}

/** At the top of the page: the bar's bottom edge is drawn, and the reading dot sits on it. */
function REST() {
  const L = window.__lc
  const bar = document.querySelector('header[data-bar]')
  const dot = document.querySelector('[data-reading-dot]')
  if (!bar || !dot) return { missing: !bar ? 'header[data-bar]' : '[data-reading-dot]' }
  L.scrollToY(0)
  const st = getComputedStyle(bar)
  const sh = st.boxShadow && st.boxShadow !== 'none' ? st.boxShadow : ''
  const col = sh.match(/(rgba?|color|oklab|lab)\([^)]*\)/)?.[0]
  const nums = sh.replace(/(rgba?|color|oklab|lab)\([^)]*\)/g, '').trim().split(/\s+/).map(parseFloat)
  const ground = L.resolve('var(--canvas-base)')
  let edge = null
  if (col && nums[1] > 0) edge = L.ratio(L.over(L.parse(col), ground), ground)
  else if (parseFloat(st.borderBottomWidth) > 0) edge = L.ratio(L.over(L.parse(st.borderBottomColor), ground), ground)
  const b = bar.getBoundingClientRect()
  const d = dot.getBoundingClientRect()
  return { edge, barBottom: Math.round(b.bottom), dotMid: Math.round((d.top + d.bottom) / 2), dotShown: L.visible(dot) && L.opacity(dot) > 0.5 }
}

export default {
  id: 'G',
  title: 'Progress: 0 at the top, monotonic, 1.000 ± 0.005 when the body meets the viewport bottom; the hop after; visible in every look; at rest the bar edge shows and the dot sits on it',
  needs: ['server', 'browser'],
  async run(ctx) {
    const info = await builtRoutes(ctx)
    if (info.notBuilt) return { notBuilt: info.notBuilt }
    const c = collector(['G'])
    for (const m of info.missing) c.fail('G', m)
    const jobs = []
    for (const route of info.entries)
      for (const w of ctx.widths.filter((x) => x.width === 390 || x.width === 1440))
        for (const look of w.width === 1440 ? ctx.looks : ctx.looks.slice(0, 1)) jobs.push({ route, w, look })
    let trails = 0
    await pool(jobs, 2, async ({ route, w, look }) => {
      const tag = `${route.path} @${w.width} ${look.name}`
      const o = await openPage(ctx, route.path, { width: w.width, height: w.height, query: look.query })
      try {
        const r = await o.page.evaluate(TRACK, { steps: STEPS })
        if (r.missing) {
          c.fail('G', `${tag}: no ${r.missing}`)
          return
        }
        trails += 1
        if (!(Math.abs(r.s0) <= 0.005)) c.fail('G', `${tag}: the trail reads scaleX ${r.s0} at the top, not 0`)
        if (!r.fullWidth) c.fail('G', `${tag}: [data-trail] is not full-width (scaleX on a full-width element, never a width)`)
        if (r.short) {
          c.note('G', `${tag}: the body ends on the first screen (target ${r.target}); nothing to scroll`)
          return
        }
        if (r.unreachable) {
          c.fail('G', `${tag}: [data-body-end] cannot reach the viewport's bottom (needs scrollY ${r.target}, max ${r.max})`)
          return
        }
        const { reads } = r
        for (let i = 1; i < reads.length; i++)
          if (reads[i].p < reads[i - 1].p - 0.001) c.fail('G', `${tag}: progress fell from ${reads[i - 1].p.toFixed(3)} to ${reads[i].p.toFixed(3)} (scrollY ${reads[i - 1].y} → ${reads[i].y})`)
        const last = reads.at(-1)
        const prev = reads.at(-2)
        if (Math.abs(last.off) > 1) c.fail('G', `${tag}: could not land [data-body-end] on the viewport's bottom (off by ${last.off}px)`)
        if (!(Math.abs(last.p - 1) <= 0.005)) c.fail('G', `${tag}: at the body's end (scrollY ${last.y}) the trail reads ${last.p.toFixed(4)}, not 1.000 ± 0.005`)
        if (prev && !(prev.p < 0.999)) c.fail('G', `${tag}: one step before the body's end (scrollY ${prev.y}) the trail already reads ${prev.p.toFixed(4)}`)
        if (!r.dot) c.fail('G', `${tag}: no [data-reading-dot]`)
        else {
          const early = reads.slice(0, -1).find((x) => x.hop)
          if (early) c.fail('G', `${tag}: the dot hopped into the footer at scrollY ${early.y}, before p = 1 (p ${early.p.toFixed(3)})`)
          if (r.footIn && !r.hopEnd) c.fail('G', `${tag}: at the very bottom, with the footer in view, the dot has no data-in-footer`)
          if (!r.foot) c.fail('G', `${tag}: no footer[data-footer] for the dot to hop into`)
        }
        if (!r.vis) c.fail('G', `${tag}: the trail never read above 0.05 while scrolling`)
        else if (!(r.vis.opacity > 0) || !r.vis.shown || !r.vis.painted) c.fail('G', `${tag}: the trail is not visible once p > 0 (opacity ${r.vis.opacity}, background ${r.vis.bg})`)
      } catch (e) {
        c.fail('G', `${tag}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    })
    // at rest (scrollY 0), chapter 05 at every width and in every look: the edge is there from the
    // first frame, ≥ 3:1, and the dot sits on it rather than floating under the bar's words
    const chapter = fifthChapter(info.entries) ?? info.entries[0]
    const rest = chapter ? ctx.widths.flatMap((w) => ctx.looks.map((look) => ({ w, look }))) : []
    await pool(rest, 2, async ({ w, look }) => {
      const tag = `${chapter.path} @${w.width} ${look.name} at rest`
      const o = await openPage(ctx, chapter.path, { width: w.width, height: w.height, query: look.query })
      try {
        const r = await o.page.evaluate(REST)
        if (r.missing) return c.fail('G', `${tag}: no ${r.missing}`)
        if (r.edge == null) c.fail('G', `${tag}: the bar draws no bottom edge before any scroll`)
        else if (r.edge < 3) c.fail('G', `${tag}: the bar's edge is ${r.edge.toFixed(2)}:1 against the page, need 3`)
        if (!r.dotShown) c.fail('G', `${tag}: the reading dot is not shown at the top of the page`)
        else if (Math.abs(r.dotMid - r.barBottom) > 3) c.fail('G', `${tag}: the dot's middle is at ${r.dotMid}px, not on the bar's edge at ${r.barBottom}px`)
      } catch (e) {
        c.fail('G', `${tag}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    })
    if (!trails && !c.map.get('G').fail.some((f) => !/no \[data-trail\]/.test(f))) return { notBuilt: 'no entry page renders [data-trail] yet' }
    c.note('G', `${jobs.length} loads, ${STEPS} steps each`)
    return c.result('G')
  },
}
