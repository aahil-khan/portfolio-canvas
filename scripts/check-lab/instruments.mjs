/**
 * The instruments' rules (plan PR 11): 22 (the fixture, and every lead working) and 22h (the
 * haggle's fidelity), and `leadMotion`, the leads' half of rule M. Lane module for
 * scripts/check-lab.mjs (API.md §11). Rule M belongs to PR 10 (previews.mjs), which calls
 * `leadMotion`; until that file defines M, rule 22 runs it.
 *
 *   leadMotion  Motion as DIRECTION's Lab table says, read through `getAnimations()` and frame sampling:
 *        - every lead draws once on first view: CSS animations `lab-draw-*`, 450ms on the one
 *          easing, delays in 30ms steps, all finished soon after load, and none under reduced motion;
 *        - a figure in the body does not draw (it is read where it stands, never caught
 *          half-transparent by a reader or the contrast sweep);
 *        - an instrument's enter (a new line in the haggle) rises ≤ 6px over ≤ 180ms (opacity in
 *          ≤ 120ms), and under reduced motion only fades, in ≤ 120ms;
 *        - a page change: the column fades and rises 8px over 240ms, the bar does not move;
 *        - the home's band stagger, once its bands exist (PR 9); a note until then.
 *   22   The fixture (`LAB_FIXTURE=kinds`, its own build): every kind's template renders with the
 *        lead its chain reaches (`resolveLead`), on the first screen at 390 and 1440; the fixture's
 *        section is shown and its empty one never is. And in the default build every interactive
 *        lead works: the board and the scenario list are each one tab stop moved by the arrow keys.
 *   22h  The haggle runs the spec: `lib/lab/haggle.ts` passes persona cards A1, A9, A10, B1 and B13
 *        (the unit test's table), and the page's toy, driven by A1's and B13's offers, answers
 *        exactly as the module does, fires `lab:cue` `counter` and `deal`, and shows the floor only
 *        in architecture A.
 *
 * Pages are found by what they render (`[data-instrument]`, `[data-lead]`), never by an entry id
 * (rule 4: no file outside the demo set names a demo id).
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { createShop, evaluate, fidelity, PERSONAS, simulate, ITEMS } from '../../lib/lab/haggle.ts'
import { LEAD_CHAINS } from '../../lib/lab/types.ts'
import { resolveLead } from '../../lib/lab/view.ts'
import { builtRoutes, collector, fifthChapter, heightOf, openPage, pool, sleep } from './layout.mjs'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const DRAW = { duration: 450, stagger: 30, cap: 16 }
const ENTER = { duration: 180, opacity: 120, rise: 6 }
const PAGE = { duration: 240, rise: 8 }
const REDUCED_MAX = 120
const JOBS = 3

/** Entry routes whose page holds an instrument, by name: found from the served HTML. */
const instrumentCache = new WeakMap()
function instrumentPages(ctx) {
  if (!instrumentCache.has(ctx))
    instrumentCache.set(
      ctx,
      (async () => {
        const info = await builtRoutes(ctx)
        const out = new Map()
        await pool(info.entries, 6, async (r) => {
          const html = (await ctx.get(r.path)).text
          for (const m of html.matchAll(/data-instrument="([\w-]+)"/g)) if (!out.has(m[1])) out.set(m[1], r)
          if (/<figure[^>]*data-figure=/.test(html) && !out.has('figure:body')) out.set('figure:body', r)
        })
        return out
      })(),
    )
  return instrumentCache.get(ctx)
}

// ---------------------------------------------------------------------------------------------
// In the page
// ---------------------------------------------------------------------------------------------

/** Every `lab-draw-*` CSS animation, with where it is and its timing. */
function DRAWS() {
  return document
    .getAnimations()
    .filter((a) => typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation && a.animationName.startsWith('lab-draw'))
    .map((a) => {
      const t = a.effect.getTiming()
      const el = a.effect.target
      return {
        name: a.animationName,
        duration: Number(t.duration),
        delay: Number(t.delay),
        easing: getComputedStyle(el).animationTimingFunction,
        state: a.playState,
        time: Number(a.currentTime ?? -1),
        inLead: !!el.closest('[data-lead]'),
        inFigure: !!el.closest('figure[data-figure]'),
        top: el.getBoundingClientRect().top + scrollY,
      }
    })
}

/** Samples an element's opacity and translateY every frame for `ms`, after `act` runs. */
async function SAMPLE({ sel, ms, act }) {
  const find = () => (typeof sel === 'string' ? document.querySelector(sel) : null)
  const read = (el) => {
    const s = getComputedStyle(el)
    const m = new DOMMatrixReadOnly(s.transform === 'none' ? undefined : s.transform)
    return { o: Number(s.opacity), y: m.m42 }
  }
  if (act === 'submit') document.querySelector('[data-instrument="haggle"] form').requestSubmit()
  const t0 = performance.now()
  const out = []
  let target = null
  while (performance.now() - t0 < ms) {
    await new Promise((r) => requestAnimationFrame(r))
    target = act === 'submit' ? document.querySelector('[data-instrument="haggle"] ol > li:last-child') : find()
    if (target) out.push({ t: performance.now() - t0, ...read(target) })
  }
  return out
}

/** From samples: how far it travelled, when it started moving and when it settled. */
function motionOf(samples) {
  if (!samples.length) return null
  const last = samples[samples.length - 1]
  const moving = samples.filter((s) => Math.abs(s.y - last.y) > 0.25 || Math.abs(s.o - last.o) > 0.01)
  const travel = Math.max(0, ...samples.map((s) => Math.abs(s.y - last.y)))
  const settled = moving.length ? moving[moving.length - 1].t : 0
  const start = moving.length ? moving[0].t : 0
  const fade = samples.filter((s) => Math.abs(s.o - last.o) > 0.01)
  return { travel, start, settled, fadeEnd: fade.length ? fade[fade.length - 1].t : 0, minO: Math.min(...samples.map((s) => s.o)) }
}

// ---------------------------------------------------------------------------------------------
// M
// ---------------------------------------------------------------------------------------------

/**
 * The leads' motion, as one function rule M calls (PR 10's scripts/check-lab/previews.mjs owns M).
 * Until a file defines M, rule 22 below runs it. Returns `{ fail, notes }`, or `{ notBuilt }`.
 */
export async function leadMotion(ctx) {
    const info = await builtRoutes(ctx)
    if (info.notBuilt) return { notBuilt: info.notBuilt }
    const c = collector(['M'])
    const pages = await instrumentPages(ctx)
    if (!pages.size) return { notBuilt: 'no entry page renders an instrument yet' }
    const widths = ctx.quick ? [1440] : [390, 1440]

    // 1. every entry's lead draws, on the one easing and the stagger's steps, and settles
    await pool(
      info.entries.flatMap((route) => widths.map((width) => ({ route, width }))),
      JOBS,
      async ({ route, width }) => {
        const tag = `${route.path} @${width}`
        const o = await openPage(ctx, route.path, { width })
        try {
          await sleep(DRAW.duration + DRAW.cap * DRAW.stagger + 200)
          const d = await o.page.evaluate(DRAWS)
          const vh = heightOf(ctx, width)
          const lead = d.filter((a) => a.inLead)
          if (!lead.length) c.fail('M', `${tag}: the lead does not draw (no lab-draw animation inside [data-lead])`)
          for (const a of d) {
            if (Math.abs(a.duration - DRAW.duration) > 1) c.fail('M', `${tag}: ${a.name} runs ${a.duration}ms, not ${DRAW.duration}`)
            if (a.easing !== EASE) c.fail('M', `${tag}: ${a.name} eases ${a.easing}, not ${EASE}`)
            const step = a.delay / DRAW.stagger
            if (Math.abs(step - Math.round(step)) > 0.01) c.fail('M', `${tag}: ${a.name} waits ${a.delay}ms, not a step of the ${DRAW.stagger}ms stagger`)
            if (a.delay > DRAW.cap * DRAW.stagger + 0.5) c.fail('M', `${tag}: ${a.name} waits ${a.delay}ms, past the stagger's cap of ${DRAW.cap * DRAW.stagger}ms`)
            if (a.top < vh && a.state !== 'finished') c.fail('M', `${tag}: a ${a.name} on the first screen is ${a.state} ${DRAW.duration + DRAW.cap * DRAW.stagger + 200}ms after load`)
          }
        } catch (e) {
          c.fail('M', `${tag}: threw ${e.message.split('\n')[0]}`)
        } finally {
          await o.close()
        }
      },
    )

    // 2. a figure in the body does not draw: it is read where it stands, never half-transparent
    const body = pages.get('figure:body')
    if (body) {
      const o = await openPage(ctx, body.path, { width: 1440 })
      try {
        await o.page.evaluate(() => document.querySelector('figure[data-figure]')?.scrollIntoView({ block: 'center' }))
        await sleep(150)
        const drawing = (await o.page.evaluate(DRAWS)).filter((a) => a.inFigure && !a.inLead)
        if (drawing.length) c.fail('M', `${body.path}: ${drawing.length} draws inside a body figure; only a lead draws`)
      } catch (e) {
        c.fail('M', `${body.path}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    } else c.note('M', 'no entry has a figure in its body')

    // 3. reduced motion: no draw at all, and an enter only fades, quickly
    const haggle = pages.get('haggle')
    for (const route of [haggle, info.entries[0]].filter(Boolean)) {
      const o = await openPage(ctx, route.path, { width: 1440, reduced: true })
      try {
        const d = await o.page.evaluate(DRAWS)
        if (d.length) c.fail('M', `${route.path} reduced: ${d.length} lab-draw animations ran; under reduced motion a lead is simply there`)
      } finally {
        await o.close()
      }
    }

    // 4. an enter inside an instrument: a new line in the haggle
    if (haggle) {
      for (const reduced of [false, true]) {
        const tag = `${haggle.path} haggle enter${reduced ? ' (reduced)' : ''}`
        const o = await openPage(ctx, haggle.path, { width: 1440, reduced })
        try {
          await o.page.fill('[data-instrument="haggle"] input[name="offer"]', '700')
          const m = motionOf(await o.page.evaluate(SAMPLE, { sel: null, ms: 500, act: 'submit' }))
          if (!m) c.fail('M', `${tag}: no new line appeared`)
          else if (reduced) {
            // timed from the first frame it moves, so React's commit is not counted as motion
            if (m.travel > 0.5) c.fail('M', `${tag}: travelled ${m.travel.toFixed(1)}px; under reduced motion nothing travels`)
            if (m.settled - m.start > REDUCED_MAX + 50) c.fail('M', `${tag}: took ${Math.round(m.settled - m.start)}ms; under reduced motion ≤ ${REDUCED_MAX}ms`)
          } else {
            if (m.travel > ENTER.rise + 0.5) c.fail('M', `${tag}: rose ${m.travel.toFixed(1)}px, more than ${ENTER.rise}`)
            if (m.travel < 1) c.fail('M', `${tag}: did not rise (travel ${m.travel.toFixed(1)}px)`)
            if (m.settled - m.start > ENTER.duration + 70) c.fail('M', `${tag}: settled ${Math.round(m.settled - m.start)}ms after it started, not ~${ENTER.duration}`)
            if (m.fadeEnd - m.start > ENTER.opacity + 70) c.fail('M', `${tag}: faded in over ${Math.round(m.fadeEnd - m.start)}ms, not ~${ENTER.opacity}`)
          }
        } catch (e) {
          c.fail('M', `${tag}: threw ${e.message.split('\n')[0]}`)
        } finally {
          await o.close()
        }
      }
    }

    // 5. a page change: the column fades and rises 8px over 240ms; the bar stays put
    const from = fifthChapter(info.entries)
    if (from) {
      const tag = `${from.path} → next`
      const o = await openPage(ctx, from.path, { width: 1440 })
      try {
        const next = o.page.locator('nav a[data-preview]').last()
        if (!(await next.count())) c.note('M', `${tag}: no next link to follow`)
        else {
          const bar0 = await o.page.evaluate(() => document.querySelector('header[data-bar]')?.getBoundingClientRect().top ?? 0)
          await next.scrollIntoViewIfNeeded()
          const href = await next.getAttribute('href')
          await next.click()
          const s = await o.page.evaluate(SAMPLE, { sel: 'article[data-entry] > :first-child', ms: 700, act: null })
          await o.page.waitForURL((u) => u.pathname === href, { timeout: 3000 }).catch(() => {})
          const m = motionOf(s)
          if (!m || m.travel < 1) c.fail('M', `${tag}: the column did not rise (travel ${m ? m.travel.toFixed(1) : '?'}px)`)
          else {
            if (m.travel > PAGE.rise + 0.5) c.fail('M', `${tag}: the column rose ${m.travel.toFixed(1)}px, more than ${PAGE.rise}`)
            if (m.settled - m.start > PAGE.duration + 100) c.fail('M', `${tag}: the column took ${Math.round(m.settled - m.start)}ms, not ~${PAGE.duration}`)
          }
          const bar1 = await o.page.evaluate(() => document.querySelector('header[data-bar]')?.getBoundingClientRect().top ?? 0)
          if (Math.abs(bar1 - bar0) > 1) c.fail('M', `${tag}: the bar moved (${bar0} → ${bar1})`)
        }
      } catch (e) {
        c.fail('M', `${tag}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    }

    // 6. the home's band stagger, once the bands exist
    const home = await openPage(ctx, '/lab', { width: 1440 })
    try {
      const bands = await home.page.evaluate(() => document.querySelectorAll('[data-band]').length)
      if (!bands) c.note('M', 'the home has no [data-band] yet (PR 9): its stagger is not measured here')
    } finally {
      await home.close()
    }

    c.note('M', `${info.entries.length} entries at ${widths.join(' and ')}; instruments seen: ${[...pages.keys()].filter((k) => !k.includes(':')).join(', ')}`)
    return c.result('M')
}

/** Whether another lane's file defines rule M (PR 10); until one does, rule 22 runs `leadMotion`. */
function mDefinedElsewhere(root) {
  const dir = path.join(root, 'scripts/check-lab')
  return readdirSync(dir).some((f) => f.endsWith('.mjs') && f !== 'instruments.mjs' && /\bid:\s*['"]M['"]/.test(readFileSync(path.join(dir, f), 'utf8')))
}

// ---------------------------------------------------------------------------------------------
// 22
// ---------------------------------------------------------------------------------------------

/** The fixture's entries, their paths and the lead each must reach. */
function fixtureEntries(root) {
  const lab = JSON.parse(readFileSync(path.join(root, 'content/lab/fixture/lab.json'), 'utf8'))
  const byId = new Map(lab.entries.map((e) => [e.id, e]))
  return {
    sections: lab.sections,
    entries: lab.entries.map((e) => {
      const parent = e.parent ? byId.get(e.parent) : null
      const p = parent ? `/lab/${e.section}/${parent.slug}/${e.slug}` : `/lab/${e.section}/${e.slug}`
      const chapters = lab.entries.filter((x) => x.kind === 'chapter' && x.parent === e.id).length
      return { e, path: p, lead: resolveLead(e, { studies: {}, chapters }) }
    }),
  }
}

/** Keyboard on a one-tab-stop widget: Tab reaches it once, and arrows move its active descendant. */
async function oneTabStop(page, sel) {
  return page.evaluate(async (sel) => {
    const w = document.querySelector(sel)
    if (!w) return { missing: true }
    const focusables = [...w.querySelectorAll('a[href], button, input, [tabindex]')].filter((x) => x.tabIndex >= 0 && x !== w)
    w.focus()
    const a0 = w.getAttribute('aria-activedescendant')
    const fire = (key) => w.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    fire('ArrowRight')
    fire('ArrowDown')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const a1 = w.getAttribute('aria-activedescendant')
    return { tab: w.tabIndex, inner: focusables.length, a0, a1, focused: document.activeElement === w }
  }, sel)
}

const fixture = {
  id: '22',
  title: 'Fixture: every kind’s template and lead renders on the first screen; its section shows, its empty one never; the board and the scenario list are each one tab stop; leads draw as DIRECTION says (until rule M runs leadMotion)',
  needs: ['server', 'browser', 'fixture'],
  async run(ctx) {
    const c = collector(['22'])
    const fx = fixtureEntries(ctx.root)
    const kinds = new Set(fx.entries.map((x) => x.e.kind))
    for (const k of Object.keys(LEAD_CHAINS)) if (!kinds.has(k)) c.fail('22', `the fixture has no ${k}`)

    for (const { e, path: p, lead } of fx.entries) {
      if (!lead) {
        c.fail('22', `${p}: its chain (${LEAD_CHAINS[e.kind].join(' → ')}) reaches nothing`)
        continue
      }
      for (const width of [390, 1440]) {
        const tag = `fixture ${p} @${width}`
        const o = await openPage(ctx, p, { width, contextOptions: {} }).catch((err) => ({ err }))
        if (o.err) {
          c.fail('22', `${tag}: ${o.err.message.split('\n')[0]}`)
          continue
        }
        try {
          // openPage loads from ctx.base; reload from the fixture server
          await o.page.goto(ctx.fixtureBase + p, { waitUntil: 'networkidle' })
          const m = await o.page.evaluate(() => {
            const leads = [...document.querySelectorAll('[data-lead]')]
            const l = leads[0]
            const r = l?.getBoundingClientRect()
            return { n: leads.length, name: l?.getAttribute('data-lead'), top: r?.top ?? null, h: r?.height ?? 0, text: (l?.textContent ?? '').trim().slice(0, 200), status: document.title }
          })
          const vh = heightOf(ctx, width)
          if (m.n !== 1) c.fail('22', `${tag}: ${m.n} [data-lead]; exactly one`)
          else {
            if (m.name !== lead) c.fail('22', `${tag}: the lead is "${m.name}", its chain reaches "${lead}"`)
            if (m.top >= vh - 60) c.fail('22', `${tag}: the lead starts at ${Math.round(m.top)}px, not on the first screen`)
            if (m.h < 20 || !m.text) c.fail('22', `${tag}: the lead is empty (${Math.round(m.h)}px, "${m.text}")`)
            if (e.kind === 'experiment' && !m.text.includes(e.result.value)) c.fail('22', `${tag}: the result lead does not show "${e.result.value}"`)
            if (e.kind === 'build' && lead === 'install' && !m.text.includes(e.install)) c.fail('22', `${tag}: the install lead does not show "${e.install}"`)
          }
        } catch (err) {
          c.fail('22', `${tag}: threw ${err.message.split('\n')[0]}`)
        } finally {
          await o.close()
        }
      }
    }

    // the fixture's section is shown; its empty section never is
    const shown = fx.sections.filter((s) => fx.entries.some((x) => x.e.section === s.id))
    const empty = fx.sections.filter((s) => !shown.includes(s))
    // section pages are PR 9's: hold the fixture's to them once the default build has any
    const sectionRoute = ctx.lab.routes.find((r) => r.kind === 'section')
    const sectionsBuilt = !!sectionRoute && (await ctx.get(sectionRoute.path)).status === 200
    if (!sectionsBuilt) c.note('22', 'no section page answers yet (PR 9): the fixture section is checked on the home only')
    else
      for (const s of shown) {
        const r = await ctx.get(`/lab/${s.id}`, { fixture: true })
        if (r.status !== 200) c.fail('22', `fixture /lab/${s.id} answered ${r.status}; a section with entries must have its page`)
      }
    for (const s of empty) {
      const r = await ctx.get(`/lab/${s.id}`, { fixture: true })
      if (r.status !== 404) c.fail('22', `fixture /lab/${s.id} answered ${r.status}; an empty section must never be a page`)
    }
    const home = (await ctx.get('/lab', { fixture: true })).text
    // the home shows a section by its title or a link to its page (PR 9's bands link it; PR 6's name it)
    const onHome = (s) => home.includes(`href="/lab/${s.id}"`) || home.includes(`>${s.title}<`)
    for (const s of shown) if (!onHome(s)) c.fail('22', `the fixture home does not show its section "${s.title}"`)
    for (const s of empty) if (onHome(s)) c.fail('22', `the fixture home shows the empty section "${s.title}"`)
    // and the default build never has them
    for (const s of fx.sections) if ((await ctx.get(`/lab/${s.id}`)).status === 200) c.fail('22', `the default build serves the fixture's /lab/${s.id}`)

    // the interactive leads in the default build: one tab stop each, moved by the arrows
    const pages = await instrumentPages(ctx)
    for (const [name, sel] of [
      ['board', '[data-instrument="board"] [role="grid"]'],
      ['scenarios', '[data-instrument="scenarios"] [role="listbox"]'],
    ]) {
      const route = pages.get(name)
      if (!route) {
        c.note('22', `no page renders the ${name} instrument`)
        continue
      }
      const o = await openPage(ctx, route.path, { width: 1440 })
      try {
        const k = await oneTabStop(o.page, sel)
        if (k.missing) c.fail('22', `${route.path}: no ${sel}`)
        else {
          if (k.tab !== 0) c.fail('22', `${route.path}: the ${name} is not a tab stop (tabIndex ${k.tab})`)
          if (k.inner) c.fail('22', `${route.path}: the ${name} holds ${k.inner} more tab stops; it must be one`)
          if (!k.a0 || !k.a1 || k.a0 === k.a1) c.fail('22', `${route.path}: the arrow keys did not move the ${name}'s active item (${k.a0} → ${k.a1})`)
        }
      } catch (err) {
        c.fail('22', `${route.path}: threw ${err.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    }
    c.note('22', `${fx.entries.length} fixture entries at 390 and 1440: ${fx.entries.map((x) => `${x.e.kind} → ${x.lead}`).join(', ')}`)

    // the leads' motion: rule M's (PR 10) once that file exists; here until then
    if (mDefinedElsewhere(ctx.root)) c.note('22', 'lead motion is checked by rule M (another lane defines it)')
    else {
      const m = await leadMotion(ctx)
      if (m.notBuilt) c.fail('22', `lead motion: not built (${m.notBuilt})`)
      for (const f of m.fail ?? []) c.fail('22', `lead motion: ${f}`)
      for (const n of m.notes ?? []) c.note('22', `lead motion: ${n}`)
    }
    return c.result('22')
  },
}

// ---------------------------------------------------------------------------------------------
// 22h
// ---------------------------------------------------------------------------------------------

/** The page's toy, driven by a list of offers: every round's action and price, and the cues heard. */
async function drive(page, offers) {
  await page.evaluate(() => {
    window.__cues = []
    document.addEventListener('lab:cue', (e) => window.__cues.push(e.detail?.name))
  })
  for (const o of offers) {
    await page.fill('[data-instrument="haggle"] input[name="offer"]', String(o))
    await page.press('[data-instrument="haggle"] input[name="offer"]', 'Enter')
    await sleep(60)
  }
  await sleep(250)
  return page.evaluate(() => ({
    rounds: [...document.querySelectorAll('[data-instrument="haggle"] [data-round]')].map((r) => ({ action: r.getAttribute('data-action'), price: Number(r.getAttribute('data-price')) })),
    cues: window.__cues,
    end: !!document.querySelector('[data-instrument="haggle"] [data-who="end"]'),
  }))
}

const haggle = {
  id: '22h',
  title: 'Haggle fidelity: A1, A9, A10, B1 and B13 meet the spec, and the page answers as lib/lab/haggle.ts does, with lab:cue counter and deal',
  needs: ['server', 'browser'],
  async run(ctx) {
    const c = collector(['22h'])
    for (const r of fidelity()) {
      if (!r.ok) c.fail('22h', `persona ${r.id}: ${r.run.outcome}${r.run.price ? ` at ₹${r.run.price}` : ''}, gap ${r.run.gap}; the spec expects ${JSON.stringify(PERSONAS[r.id].expect)}`)
    }
    const info = await builtRoutes(ctx)
    if (info.notBuilt) return { ...c.result('22h'), notes: ['the module passed; no entry pages yet to drive'] }
    const pages = await instrumentPages(ctx)
    const route = pages.get('haggle')
    if (!route) return { notBuilt: 'no entry page renders the haggle yet' }

    // the item the page prices, read from the page's own log (never assumed)
    for (const id of ['A1', 'B13']) {
      const card = PERSONAS[id]
      const offers = simulate(ITEMS[card.item], card).log.map((d) => d.offer)
      const o = await openPage(ctx, route.path, { width: 1440 })
      try {
        const got = await drive(o.page, offers)
        let shop = createShop(ITEMS[card.item])
        const want = offers.map((x) => {
          const r = evaluate(shop, x)
          shop = r.shop
          return { action: r.decision.action, price: r.decision.price }
        })
        if (got.rounds.length !== want.length) c.fail('22h', `${route.path} ${id}: ${got.rounds.length} rounds logged for ${want.length} offers`)
        want.forEach((w, i) => {
          const g = got.rounds[i]
          if (g && (g.action !== w.action || g.price !== w.price)) c.fail('22h', `${route.path} ${id} round ${i + 1} (₹${offers[i]}): the page says ${g.action} ₹${g.price}, the module ${w.action} ₹${w.price}`)
        })
        const wantCues = want.flatMap((w) => (w.action === 'accept' ? ['deal'] : w.action === 'agreed' ? [] : ['counter']))
        if (JSON.stringify(got.cues) !== JSON.stringify(wantCues)) c.fail('22h', `${route.path} ${id}: lab:cue fired ${JSON.stringify(got.cues)}, expected ${JSON.stringify(wantCues)}`)
        if (!got.end) c.fail('22h', `${route.path} ${id}: no deal line after the sale`)
      } catch (e) {
        c.fail('22h', `${route.path} ${id}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    }

    // the floor appears in the agent's context only in architecture A
    const o = await openPage(ctx, route.path, { width: 1440 })
    try {
      const floorShown = () => o.page.evaluate(() => !!document.querySelector('[data-instrument="haggle"] [data-tool-log] [data-floor]'))
      if (await floorShown()) c.fail('22h', `${route.path}: the floor is in the agent's context in architecture B`)
      const ab = o.page.locator('[data-instrument="haggle"] [role="group"] button[aria-pressed="false"]').first()
      await ab.click()
      await sleep(100)
      if (!(await floorShown())) c.fail('22h', `${route.path}: architecture A does not show the floor in the agent's context`)
    } catch (e) {
      c.fail('22h', `${route.path}: threw ${e.message.split('\n')[0]}`)
    } finally {
      await o.close()
    }
    c.note('22h', `module: ${fidelity().map((r) => `${r.id} ${r.ok ? 'ok' : 'FAIL'}`).join(', ')}; page: ${route.path}`)
    return c.result('22h')
  },
}

const rules = [fixture, haggle]

export default rules
