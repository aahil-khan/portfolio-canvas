/**
 * Rules H1, H2, H3 and 22, and `bandMotion` for rule M: the Lab's list pages (plan PR 9). Lane
 * module for scripts/check-lab.mjs (API.md §11). Ported from the mockup's checker
 * (`prototype/lab-v2b/check.mjs`, H1–H3 and 22) onto real routes and the DOM hooks below.
 *
 *   H1  the home: one framed band per shown section, each holding its first `min(5, n)` top-level
 *       entries by date and an "All N in <section>" link to the section, N counting every entry;
 *       a gap between bands; Latest is the six newest of any kind; "All N entries" to the index.
 *       Checked at 390 and 1440 in Lab Dark and cream, and once on the fixture's home.
 *   H2  the home's own words hold no time words and nothing counts progress.
 *   H3  section pages: their furniture holds no time words and counts no progress; the hero is the
 *       section's pick, or its three newest top-level entries; every entry of the section is listed
 *       once; New here? begins where `newHere()` says. And the other list pages: the index lists
 *       every entry by year and its kind filter works (and is linkable); a tag page lists its
 *       entries; the glossary holds every term at `#t-<id>`.
 *   22  the fixture (`LAB_FIXTURE=kinds`): its new section appears (home band and page), every
 *       kind's entry renders its template with one lead on the first screen, the index lists the
 *       fixture's entries and offers the experiment kind; an empty section (fx-empty, and
 *       Experiments, which holds nothing in either build) never appears.
 *
 * `bandMotion(ctx)` holds the home's band reveal to DIRECTION ("Motion and hover timing"): rows of a
 * band below the fold wait hidden and rise 8px over 240ms, 30ms apart, on the one easing, the first
 * time the band enters; never again that visit, a soft navigation home included; opacity only and
 * ≤ 120ms under reduced motion. Rule M is PR 10's (previews.mjs), which calls this export; until a
 * file defines M, H1 runs it, so the assertions hold either way.
 *
 * The DOM hooks (API.md §5, plus this PR's):
 *   [data-lists="home|section|index|tag|glossary"]   the page's list content
 *   [data-band="<section>"]        a home band; its `[data-band-rows]` (data-reveal, data-armed),
 *                                  and `a[data-band-all]`
 *   [data-latest]                  Latest's list
 *   a[data-row-title]              a row's title link, `data-preview="entry:<id>"`
 *   [data-list-head]               a list page's head: eyebrow, title, its line, New here?
 *   [data-new-here]                a section's New here? line
 *   [data-hero="pick|strip"]       a section's hero; `[data-hero-entry="<id>"]` per entry in it
 *   [data-index] [data-kind-filter] button[data-filter="<kind|all>"][aria-pressed]
 *   [data-years] [data-year], li[data-kind]
 *   [data-term="<id>"]#t-<id>      a glossary term
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { builtRoutes, collector, openPage, sleep } from './layout.mjs'

/** Words that date a page: the home and sections must read the same in a month (mockup H2, H3). */
const TIME_WORDS =
  /\b(now|currently|current|this (week|month|year)|latest work|just|ago|today|tonight|yesterday|recently|lately|so far|streak|in progress|still going|newest|up to date|soon)\b/i
const PROGRESS = /\b\d+ of \d+\b/

const fill = (t, vars) => String(t ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))

/**
 * What the loaders say each list page should hold, for one build: the default set, or the fixture
 * (`LAB_FIXTURE=kinds`, in a child process, since the loaders memoise the active set).
 */
const EXPECT = `
const root = process.argv.at(-1)
const c = await import(new URL('lib/lab/content.ts', root).href)
const l = await import(new URL('lib/lab/lists.ts', root).href)
const lab = c.getLab()
const out = lab.entries.filter((e) => !e.draft && e.published !== null)
const sectionRoutes = c.routes().filter((r) => r.kind === 'section').map((r) => r.section)
console.log(JSON.stringify({
  copy: lab.copy,
  bands: c.homeBands().map((b) => ({ id: b.section.id, title: b.section.title, rows: b.entries.map((e) => e.id), total: b.total })),
  latest: c.latest(6).map((e) => e.id),
  published: out.length,
  routes: c.routes(),
  sections: lab.sections.map((s) => ({
    id: s.id, title: s.title, hero: s.hero ?? null, shown: sectionRoutes.includes(s.id),
    strip: l.stripOf(lab.entries, s.id).map((e) => e.id),
    all: out.filter((e) => e.section === s.id).map((e) => e.id),
    start: c.newHere(s.id)?.start.id ?? null,
  })),
  entries: out.map((e) => ({ id: e.id, kind: e.kind, section: e.section, tags: e.tags ?? [] })),
  terms: lab.terms.map((t) => t.id),
  tags: lab.tags.map((t) => t.id),
}))
`
const expectCache = new Map()
function expected(root, fixture = false) {
  const key = `${root}|${fixture}`
  if (!expectCache.has(key)) {
    const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', EXPECT, pathToFileURL(root + path.sep).href], {
      cwd: root,
      env: { ...process.env, LAB_FIXTURE: fixture ? 'kinds' : '' },
      encoding: 'utf8',
    })
    if (r.status !== 0) throw new Error(`reading the loaders${fixture ? ' with the fixture' : ''} failed: ${r.stderr.slice(0, 400)}`)
    expectCache.set(key, JSON.parse(r.stdout))
  }
  return expectCache.get(key)
}

/** A page on the fixture server, with the same viewport rules as `openPage`. */
async function openFixture(ctx, p, { width = 1440, height = 900, query = '' } = {}) {
  const phone = width < 600
  const o = await ctx.page(null, { viewport: { width, height }, isMobile: phone, hasTouch: phone })
  const res = await o.page.goto(ctx.fixtureBase + p + (query ? `?${query}` : ''), { waitUntil: 'networkidle' })
  return { ...o, status: res?.status() ?? null }
}

// ---------------------------------------------------------------------------------------------
// In-page reads
// ---------------------------------------------------------------------------------------------

function READ_HOME() {
  const ids = (root, sel) => [...(root?.querySelectorAll(sel) ?? [])].map((a) => (a.dataset.preview || '').replace(/^entry:/, ''))
  const bands = [...document.querySelectorAll('[data-band]')].map((b) => {
    const all = b.querySelector('a[data-band-all]')
    const cs = getComputedStyle(b)
    const r = b.getBoundingClientRect()
    return {
      id: b.dataset.band,
      rows: ids(b, '[data-band-rows] a[data-row-title]'),
      all: all ? all.textContent.replace(/\s+/g, ' ').trim() : null,
      allHref: all?.getAttribute('href') ?? null,
      edge: parseFloat(cs.borderTopWidth),
      shadow: cs.boxShadow,
      top: r.top + scrollY,
      bottom: r.bottom + scrollY,
    }
  })
  const latest = document.querySelector('[data-latest]')
  const toIndex = [...document.querySelectorAll('main a[href="/lab/index"]')].map((a) => a.textContent.replace(/\s+/g, ' ').trim())
  // the home's own words: everything in main but entries' titles (their words are the entries')
  const main = document.querySelector('[data-lists="home"]') || document.querySelector('main')
  let words = ''
  const tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
  for (let n; (n = tw.nextNode()); ) if (!n.parentElement.closest('[data-row-title],script,style')) words += ' ' + n.data
  for (const el of main.querySelectorAll('[aria-label]')) words += ' ' + el.getAttribute('aria-label')
  const counters = main.querySelectorAll('progress, [role="progressbar"], meter').length
  return { bands, latest: ids(latest, 'a[data-row-title]'), toIndex, words, counters, lists: !!document.querySelector('[data-lists="home"]') }
}

function READ_SECTION() {
  const head = document.querySelector('[data-list-head]')
  let words = ''
  if (head) {
    const clone = head.cloneNode(true)
    clone.querySelectorAll('a[data-preview]').forEach((a) => a.remove())
    words = clone.textContent
  }
  for (const h of document.querySelectorAll('[data-lists] h2')) if (!h.closest('[data-hero]')) words += ' ' + h.textContent
  const hero = document.querySelector('[data-hero]')
  const rowIds = [...document.querySelectorAll('[data-lists] a[data-row-title]')].filter((a) => !a.closest('[data-hero]')).map((a) => a.dataset.preview.replace(/^entry:/, ''))
  const start = document.querySelector('[data-new-here] a[data-preview]')
  return {
    words,
    hero: hero ? { kind: hero.dataset.hero, ids: [...hero.querySelectorAll('[data-hero-entry]')].map((x) => x.dataset.heroEntry), top: hero.getBoundingClientRect().top } : null,
    rowIds,
    start: start ? start.dataset.preview.replace(/^entry:/, '') : null,
    newHere: !!document.querySelector('[data-new-here]'),
  }
}

function READ_INDEX() {
  const shown = [...document.querySelectorAll('[data-years] li[data-kind]')].filter((li) => !li.hidden && li.closest('[data-year]') && !li.closest('[data-year]').hidden)
  return {
    rows: shown.map((li) => ({ id: li.querySelector('a[data-row-title]')?.dataset.preview.replace(/^entry:/, ''), kind: li.dataset.kind, year: li.closest('[data-year]').dataset.year })),
    years: [...document.querySelectorAll('[data-year]')].map((y) => ({ year: y.dataset.year, hidden: y.hidden })),
    filters: [...document.querySelectorAll('[data-kind-filter] button[data-filter]')].map((b) => ({ k: b.dataset.filter, on: b.getAttribute('aria-pressed') === 'true' })),
    search: location.search,
  }
}

// ---------------------------------------------------------------------------------------------
// H1, H2: the home
// ---------------------------------------------------------------------------------------------

function judgeHome(c, tag, h, want) {
  if (!h.lists) {
    c.fail('H1', `${tag}: no [data-lists="home"]`)
    return
  }
  const wantIds = want.bands.map((b) => b.id)
  const gotIds = h.bands.map((b) => b.id)
  if (gotIds.join() !== wantIds.join()) c.fail('H1', `${tag}: bands ${gotIds.join(', ') || 'none'}, want one per shown section: ${wantIds.join(', ')}`)
  for (const [i, b] of h.bands.entries()) {
    const w = want.bands.find((x) => x.id === b.id)
    if (!w) continue
    if (b.rows.join() !== w.rows.join()) c.fail('H1', `${tag}: the ${b.id} band lists ${b.rows.join(', ') || 'nothing'}; want its first min(5, n) top-level entries by date: ${w.rows.join(', ')}`)
    const words = fill(want.copy.homeSecAll, { n: w.total, section: w.title })
    if (b.all !== words || b.allHref !== `/lab/${b.id}`) c.fail('H1', `${tag}: the ${b.id} band's link reads "${b.all}" to ${b.allHref}; want "${words}" to /lab/${b.id}`)
    if (!(b.edge > 0) || b.shadow === 'none') c.fail('H1', `${tag}: the ${b.id} band isn't framed (edge ${b.edge}px, shadow ${b.shadow})`)
    if (i && b.top - h.bands[i - 1].bottom < 16) c.fail('H1', `${tag}: the ${b.id} band sits ${Math.round(b.top - h.bands[i - 1].bottom)}px under the one above (at least 16)`)
  }
  if (h.latest.join() !== want.latest.join()) c.fail('H1', `${tag}: Latest lists ${h.latest.join(', ') || 'nothing'}; want the six newest of any kind: ${want.latest.join(', ')}`)
  const all = fill(want.copy.homeAll, { n: want.published })
  if (!h.toIndex.includes(all)) c.fail('H1', `${tag}: no "${all}" link to /lab/index (found: ${h.toIndex.join(' | ') || 'none'})`)
  const tw = h.words.match(TIME_WORDS)
  if (tw) c.fail('H2', `${tag}: the time word "${tw[0]}" in the home's own words`)
  const pg = h.words.match(PROGRESS)
  if (pg || h.counters) c.fail('H2', `${tag}: something counts progress (${pg ? `"${pg[0]}"` : `${h.counters} progress element(s)`})`)
}

async function home(ctx, c) {
  const want = expected(ctx.root)
  if (!want.bands.length) {
    // the empty Lab: the intro and the note, no bands, no Latest, no "All 0 entries"
    const o = await openPage(ctx, '/lab', { width: 1440 })
    try {
      const h = await o.page.evaluate(READ_HOME)
      if (h.bands.length || h.latest.length || h.toIndex.length) c.fail('H1', `/lab: the empty Lab shows ${h.bands.length} bands, ${h.latest.length} latest rows, ${h.toIndex.length} index links`)
      c.note('H1', 'the empty Lab: intro and note only')
    } finally {
      await o.close()
    }
    return
  }
  const looks = ctx.looks.filter((l) => /theme=(lab-dark|cream)\b/.test(l.query))
  for (const look of looks.length ? looks : ctx.looks.slice(0, 1))
    for (const width of [390, 1440]) {
      const tag = `/lab @${width} ${look.name}`
      const o = await openPage(ctx, '/lab', { width, query: look.query })
      try {
        if (o.status !== 200) {
          c.fail('H1', `${tag}: answered ${o.status}`)
          continue
        }
        judgeHome(c, tag, await o.page.evaluate(READ_HOME), want)
      } finally {
        await o.close()
      }
    }
  if (ctx.fixtureBase) {
    const fx = expected(ctx.root, true)
    const o = await openFixture(ctx, '/lab')
    try {
      judgeHome(c, '/lab @1440 fixture', await o.page.evaluate(READ_HOME), fx)
    } finally {
      await o.close()
    }
  }
  c.note('H1', `${want.bands.length} bands: ${want.bands.map((b) => `${b.id} (${b.rows.length} of ${b.total})`).join(', ')}`)
}

// ---------------------------------------------------------------------------------------------
// H3: section pages, and the index, tags and glossary
// ---------------------------------------------------------------------------------------------

async function sections(ctx, c) {
  const want = expected(ctx.root)
  const shown = want.sections.filter((s) => s.shown)
  for (const s of want.sections.filter((x) => !x.shown)) {
    const res = await ctx.get(`/lab/${s.id}`)
    if (res.status !== 404) c.fail('H3', `/lab/${s.id}: a section with no top-level entry answered ${res.status}, want 404`)
  }
  for (const s of shown)
    for (const width of [390, 1440]) {
      const tag = `/lab/${s.id} @${width}`
      const o = await openPage(ctx, `/lab/${s.id}`, { width, query: ctx.looks[0].query })
      try {
        if (o.status !== 200) {
          c.fail('H3', `${tag}: answered ${o.status}`)
          continue
        }
        const h = await o.page.evaluate(READ_SECTION)
        const tw = h.words.match(TIME_WORDS)
        if (tw) c.fail('H3', `${tag}: the time word "${tw[0]}" in the section's own words`)
        if (PROGRESS.test(h.words)) c.fail('H3', `${tag}: something counts progress ("${h.words.match(PROGRESS)[0]}")`)
        if (!h.hero) c.fail('H3', `${tag}: no [data-hero]`)
        else if (s.hero && (h.hero.kind !== 'pick' || h.hero.ids[0] !== s.hero)) c.fail('H3', `${tag}: the hero is ${h.hero.kind} ${h.hero.ids.join(', ')}; want the section's pick, ${s.hero}`)
        else if (!s.hero && (h.hero.kind !== 'strip' || h.hero.ids.join() !== s.strip.join())) c.fail('H3', `${tag}: the hero is ${h.hero.kind} ${h.hero.ids.join(', ')}; want the strip of its newest top-level entries, ${s.strip.join(', ')}`)
        if (h.hero && width === 390 && !(h.hero.top < 844 * 2)) c.fail('H3', `${tag}: the hero starts ${Math.round(h.hero.top)}px down, past the second screen`)
        const listed = [...h.rowIds].sort()
        const all = [...s.all].sort()
        if (listed.join() !== all.join()) c.fail('H3', `${tag}: the list holds ${h.rowIds.length} rows (${listed.join(', ')}); want every entry of the section once (${all.join(', ')})`)
        if (s.start && h.start !== s.start) c.fail('H3', `${tag}: New here? begins with ${h.start ?? 'nothing'}; want ${s.start}`)
      } finally {
        await o.close()
      }
    }
  c.note('H3', `sections: ${shown.map((s) => s.id).join(', ')}; ${want.sections.length - shown.length} empty, each 404`)
}

async function index(ctx, c) {
  const want = expected(ctx.root)
  const tag = '/lab/index @1440'
  const o = await openPage(ctx, '/lab/index', { width: 1440, query: ctx.looks[0].query })
  try {
    const first = await o.page.evaluate(READ_INDEX)
    if (first.rows.length !== want.published) c.fail('H3', `${tag}: ${first.rows.length} rows; want every entry, ${want.published}`)
    const years = first.years.map((y) => y.year)
    if ([...years].sort().reverse().join() !== years.join()) c.fail('H3', `${tag}: years run ${years.join(', ')}, not newest first`)
    const kinds = [...new Set(want.entries.map((e) => e.kind))]
    if (kinds.length > 1) {
      // wait for the island to answer: the server renders every button, the client wires them
      await o.page.waitForFunction(() => !!document.querySelector('[data-kind-filter] button[aria-pressed="true"]'), null, { timeout: 5000 })
      const k = kinds.includes('build') ? 'build' : kinds[0]
      await o.page.click(`[data-kind-filter] button[data-filter="${k}"]`)
      await sleep(80)
      const f = await o.page.evaluate(READ_INDEX)
      const n = want.entries.filter((e) => e.kind === k).length
      if (f.rows.length !== n || f.rows.some((r) => r.kind !== k)) c.fail('H3', `${tag}: the ${k} filter shows ${f.rows.length} rows (${[...new Set(f.rows.map((r) => r.kind))].join(', ')}); want the ${n} ${k} entries alone`)
      if (!f.filters.find((x) => x.k === k)?.on || f.filters.filter((x) => x.on).length !== 1) c.fail('H3', `${tag}: after choosing ${k}, aria-pressed reads ${JSON.stringify(f.filters)}`)
      if (!new URLSearchParams(f.search).get('kind')) c.fail('H3', `${tag}: the filter leaves no ?kind= in the address`)
      const withRows = new Set(f.rows.map((r) => r.year))
      for (const y of f.years) if (y.hidden === withRows.has(y.year)) c.fail('H3', `${tag}: under the ${k} filter, ${y.year} is ${y.hidden ? 'hidden with rows to show' : 'shown with nothing in it'}`)
      await o.page.click('[data-kind-filter] button[data-filter="all"]')
      await sleep(80)
      const back = await o.page.evaluate(READ_INDEX)
      if (back.rows.length !== want.published) c.fail('H3', `${tag}: Everything shows ${back.rows.length} rows again; want ${want.published}`)
      // a linked filter applies on arrival
      await o.page.goto(`${ctx.base}/lab/index?kind=${k}&${ctx.looks[0].query}`, { waitUntil: 'networkidle' })
      await o.page.waitForFunction((kk) => document.querySelector(`[data-kind-filter] button[data-filter="${kk}"]`)?.getAttribute('aria-pressed') === 'true', k, { timeout: 5000 }).catch(() => {})
      const linked = await o.page.evaluate(READ_INDEX)
      if (linked.rows.length !== n) c.fail('H3', `${tag}: /lab/index?kind=${k} shows ${linked.rows.length} rows; want ${n}`)
    }
  } finally {
    await o.close()
  }
  // with JavaScript off every entry is listed and no filter is offered (rule J covers the rest)
  const off = await ctx.page(null, { viewport: { width: 1440, height: 900 }, javaScriptEnabled: false })
  try {
    await off.page.goto(`${ctx.base}/lab/index?kind=build`, { waitUntil: 'networkidle' })
    const r = await off.page.evaluate(() => ({
      rows: document.querySelectorAll('[data-years] li[data-kind]').length,
      filter: [...document.querySelectorAll('[data-kind-filter] button')].filter((b) => b.getClientRects().length).length,
    }))
    if (r.rows !== want.published) c.fail('H3', `/lab/index without JS: ${r.rows} rows; want every entry, ${want.published}`)
    if (r.filter) c.fail('H3', `/lab/index without JS: ${r.filter} filter buttons shown, which cannot work`)
  } finally {
    await off.close()
  }
}

async function tagsAndTerms(ctx, c) {
  const want = expected(ctx.root)
  const tagRoutes = want.routes.filter((r) => r.kind === 'tag')
  for (const r of tagRoutes) {
    const res = await ctx.get(r.path)
    if (res.status !== 200) {
      c.fail('H3', `${r.path}: answered ${res.status}`)
      continue
    }
    const got = [...res.text.matchAll(/data-preview="entry:([\w-]+)"[^>]*data-row-title/g)].map((m) => m[1]).sort()
    const exp = want.entries.filter((e) => e.tags.includes(r.tag)).map((e) => e.id).sort()
    if (got.join() !== exp.join()) c.fail('H3', `${r.path}: lists ${got.join(', ') || 'nothing'}; want ${exp.join(', ')}`)
  }
  const unused = want.tags.filter((t) => !tagRoutes.some((r) => r.tag === t))
  for (const t of unused) {
    const res = await ctx.get(`/lab/tags/${t}`)
    if (res.status !== 404) c.fail('H3', `/lab/tags/${t}: a tag no entry carries answered ${res.status}, want 404`)
  }
  const g = await ctx.get('/lab/glossary')
  if (g.status !== 200) c.fail('H3', `/lab/glossary: answered ${g.status}`)
  else {
    const ids = [...g.text.matchAll(/id="t-([\w-]+)"[^>]*data-term=/g)].map((m) => m[1])
    const missing = want.terms.filter((t) => !ids.includes(t))
    if (missing.length) c.fail('H3', `/lab/glossary: no #t-<id> for ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ` and ${missing.length - 6} more` : ''}`)
    if (ids.length !== want.terms.length) c.fail('H3', `/lab/glossary: ${ids.length} terms; want ${want.terms.length}`)
  }
  c.note('H3', `index, ${tagRoutes.length} tag pages and ${want.terms.length} terms`)
}

// ---------------------------------------------------------------------------------------------
// bandMotion, for rule M
// ---------------------------------------------------------------------------------------------

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

function READ_BANDS() {
  return [...document.querySelectorAll('[data-band]')].map((b) => {
    const ul = b.querySelector('[data-band-rows]')
    const rows = [...(ul?.children ?? [])]
    return {
      id: b.dataset.band,
      top: b.getBoundingClientRect().top + scrollY,
      armed: !!ul && 'armed' in ul.dataset,
      reveal: ul?.dataset.reveal ?? null,
      opacity: rows.map((r) => Number(getComputedStyle(r).opacity)),
    }
  })
}
function ANIMS(id) {
  const rows = [...document.querySelectorAll(`[data-band="${id}"] [data-band-rows] > *`)]
  return rows.map((r) =>
    r.getAnimations().map((a) => {
      const t = a.effect.getTiming()
      return { duration: Number(t.duration), delay: Number(t.delay), easing: t.easing, frames: a.effect.getKeyframes().map((k) => ({ transform: k.transform ?? null, opacity: k.opacity ?? null })) }
    }),
  )
}
const travel = (frames) => {
  const t = frames.map((f) => f.transform).filter(Boolean)
  const y = (s) => Number((/translateY\((-?[\d.]+)px\)/.exec(s) ?? [])[1] ?? 0)
  return t.length ? Math.max(...t.map(y)) - Math.min(...t.map(y)) : 0
}

/** Waits (rAF polling) until a band's reveal has begun, so its animations can be read while they run. */
const started = (page, id) =>
  page
    .waitForFunction((b) => [...document.querySelectorAll(`[data-band="${b}"] [data-band-rows] > *`)].some((r) => r.getAnimations().length), id, { polling: 'raf', timeout: 3000 })
    .catch(() => {})

/** Loads the home, waits until it has hydrated (a band below the fold is armed), and returns the bands. */
async function homeBelowFold(ctx, opts) {
  const o = await openPage(ctx, '/lab', { width: 1440, height: 900, query: ctx.looks[0].query, ...opts })
  const ok = await o.page
    .waitForFunction(() => [...document.querySelectorAll('[data-band]')].some((b) => b.getBoundingClientRect().top > innerHeight && 'armed' in (b.querySelector('[data-band-rows]')?.dataset ?? {})), null, { timeout: 8000 })
    .then(() => true)
    .catch(() => false)
  return { o, ok, bands: await o.page.evaluate(READ_BANDS) }
}

export async function bandMotion(ctx) {
  const fail = []
  const notes = []
  const want = expected(ctx.root)
  if (want.bands.length < 2) return { fail, notes: ['fewer than two bands: nothing below the fold to reveal'] }

  // 1. hydrated in place: bands on screen stay as served; bands below wait hidden, then reveal once
  {
    const { o, ok, bands } = await homeBelowFold(ctx)
    try {
      const below = bands.filter((b) => b.top > 900)
      if (!ok || !below.length) fail.push(`/lab @1440: no band below the fold waits hidden after hydrating (${bands.map((b) => `${b.id}${b.armed ? ' armed' : ''} at ${Math.round(b.top)}`).join(', ')})`)
      for (const b of bands.filter((x) => x.top + 40 < 900)) if (b.armed || b.opacity.some((v) => v < 1)) fail.push(`/lab @1440: the ${b.id} band was on screen when the page hydrated, and was hidden (${b.opacity.join(', ')})`)
      for (const b of below) if (b.opacity.some((v) => v > 0)) fail.push(`/lab @1440: the ${b.id} band, below the fold, is visible before it enters (${b.opacity.join(', ')})`)
      const target = below[0]
      if (target) {
        await o.page.evaluate((y) => window.__lc.scrollToY(y), Math.max(0, target.top - 500))
        await started(o.page, target.id)
        const anims = await o.page.evaluate(ANIMS, target.id)
        if (!anims.length || anims.some((a) => !a.length)) fail.push(`/lab: the ${target.id} band entered and ${anims.filter((a) => !a.length).length} of ${anims.length} rows ran no animation`)
        anims.forEach((list, i) => {
          for (const a of list) {
            if (Math.abs(a.duration - 240) > 1) fail.push(`/lab ${target.id} row ${i + 1}: ${a.duration}ms; want 240`)
            if (Math.abs(a.delay - i * 30) > 1) fail.push(`/lab ${target.id} row ${i + 1}: starts ${a.delay}ms in; want ${i * 30} (a 30ms stagger)`)
            if (a.easing.replace(/\s/g, '') !== EASE.replace(/\s/g, '')) fail.push(`/lab ${target.id} row ${i + 1}: easing ${a.easing}; want ${EASE}`)
          }
          const moved = Math.max(0, ...list.map((a) => travel(a.frames)))
          if (list.length && Math.abs(moved - 8) > 0.5) fail.push(`/lab ${target.id} row ${i + 1}: rises ${moved}px; want 8`)
        })
        await sleep(600)
        const after = (await o.page.evaluate(READ_BANDS)).find((b) => b.id === target.id)
        if (after.opacity.some((v) => v < 1)) fail.push(`/lab: the ${target.id} band's rows end at opacity ${after.opacity.join(', ')}`)
        // once a visit: away and back again runs nothing
        await o.page.evaluate(() => window.__lc.scrollToY(0))
        await sleep(200)
        await o.page.evaluate((y) => window.__lc.scrollToY(y), Math.max(0, target.top - 500))
        await sleep(40)
        const again = await o.page.evaluate(ANIMS, target.id)
        if (again.some((a) => a.length)) fail.push(`/lab: the ${target.id} band revealed a second time on the same visit`)
        // a soft navigation away and home again: the bands already seen stay still
        const link = await o.page.$(`[data-band="${target.id}"] a[data-row-title]`)
        if (link) {
          await link.click()
          await o.page.waitForFunction(() => !!document.querySelector('article[data-entry]'), null, { timeout: 8000 })
          await o.page.click('footer[data-footer] a[href="/lab"]')
          await o.page.waitForFunction(() => !!document.querySelector('[data-lists="home"]'), null, { timeout: 8000 })
          await o.page.evaluate((y) => window.__lc.scrollToY(y), Math.max(0, target.top - 500))
          await sleep(60)
          const home = await o.page.evaluate(ANIMS, target.id)
          if (home.some((a) => a.some((x) => travel(x.frames) > 0))) fail.push(`/lab: after a soft navigation home, the ${target.id} band revealed again (once a visit)`)
        }
      }
    } finally {
      await o.close()
    }
  }

  // 2. reduced motion: opacity only, within 120ms
  {
    const { o, bands } = await homeBelowFold(ctx, { reduced: true })
    try {
      const target = bands.find((b) => b.top > 900)
      if (target) {
        await o.page.evaluate((y) => window.__lc.scrollToY(y), Math.max(0, target.top - 500))
        await started(o.page, target.id)
        for (const [i, list] of (await o.page.evaluate(ANIMS, target.id)).entries())
          for (const a of list) {
            if (a.duration + a.delay > 120) fail.push(`/lab reduced motion, ${target.id} row ${i + 1}: ${a.duration}ms after ${a.delay}ms; at most 120 in all`)
            if (travel(a.frames) > 0) fail.push(`/lab reduced motion, ${target.id} row ${i + 1}: travels ${travel(a.frames)}px; opacity only`)
          }
      }
    } finally {
      await o.close()
    }
  }
  notes.push('band reveal: hidden below the fold after hydrating, 240ms / 8px / 30ms stagger on the one easing, once a visit, opacity only when reduced')
  return { fail, notes }
}

// ---------------------------------------------------------------------------------------------
// 22: the fixture
// ---------------------------------------------------------------------------------------------

async function fixture(ctx, c) {
  const fx = expected(ctx.root, true)
  const def = expected(ctx.root)
  const fixtureDir = path.join(ctx.root, 'content/lab/fixture/lab.json')
  const raw = JSON.parse(fs.readFileSync(fixtureDir, 'utf8'))
  const fxSections = raw.sections ?? []
  const fxEntries = (raw.entries ?? []).filter((e) => !e.draft && e.published)
  const newSection = fxSections.find((s) => fxEntries.some((e) => e.section === s.id && !e.parent))
  const emptySections = [...fxSections, ...fx.sections].filter((s) => !fx.entries.some((e) => e.section === s.id)).map((s) => s.id)
  const kinds = [...new Set(fxEntries.map((e) => e.kind))]
  for (const k of ['study', 'note', 'series', 'chapter', 'build', 'experiment', 'essay']) if (!kinds.includes(k)) c.fail('22', `the fixture has no ${k} entry`)

  // the new section: a band on the home and a page; an empty section: neither, in either build
  if (!newSection) c.fail('22', 'the fixture adds no section with an entry')
  else {
    if (!fx.bands.some((b) => b.id === newSection.id)) c.fail('22', `the loaders give the fixture's ${newSection.id} no band`)
    const res = await ctx.get(`/lab/${newSection.id}`, { fixture: true })
    if (res.status !== 200) c.fail('22', `/lab/${newSection.id} (fixture): answered ${res.status}`)
    if ((await ctx.get(`/lab/${newSection.id}`)).status !== 404) c.fail('22', `/lab/${newSection.id} answers in the default build`)
  }
  const fxHome = await ctx.get('/lab', { fixture: true })
  const defHome = await ctx.get('/lab')
  if (newSection && !fxHome.text.includes(`data-band="${newSection.id}"`)) c.fail('22', `the fixture's home has no band for ${newSection.id}`)
  for (const id of new Set(emptySections)) {
    for (const [name, page, fixtureBuild] of [['fixture', fxHome, true], ['default', defHome, false]]) {
      if (page.text.includes(`data-band="${id}"`)) c.fail('22', `the ${name} home shows a band for the empty section ${id}`)
      const res = await ctx.get(`/lab/${id}`, { fixture: fixtureBuild })
      if (res.status !== 404) c.fail('22', `/lab/${id} (${name}): an empty section answered ${res.status}, want 404`)
    }
  }
  if (def.routes.some((r) => r.kind === 'section' && emptySections.includes(r.section))) c.fail('22', 'the default build routes an empty section')

  // every kind's template: one lead, on the first screen, at both sizes, in two looks
  const looks = ctx.looks.filter((l) => /theme=(lab-dark|cream)\b/.test(l.query))
  const entryRoutes = fx.routes.filter((r) => r.kind === 'entry' && fxEntries.some((e) => e.id === r.entry))
  for (const r of entryRoutes)
    for (const look of looks)
      for (const [width, height] of [
        [390, 844],
        [1440, 900],
      ]) {
        const tag = `${r.path} (fixture) @${width} ${look.name}`
        const o = await openFixture(ctx, r.path, { width, height, query: look.query })
        try {
          if (o.status !== 200) {
            c.fail('22', `${tag}: answered ${o.status}`)
            continue
          }
          const m = await o.page.evaluate(() => ({
            leads: [...document.querySelectorAll('[data-lead]')].map((e) => e.getBoundingClientRect().top),
            entry: !!document.querySelector('article[data-entry]'),
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          }))
          if (!m.entry) c.fail('22', `${tag}: no article[data-entry]`)
          if (m.leads.length !== 1) c.fail('22', `${tag}: ${m.leads.length} [data-lead]; exactly one`)
          else if (m.leads[0] >= height - 60) c.fail('22', `${tag}: the lead starts at ${Math.round(m.leads[0])}px, below the first screen`)
          if (m.overflow > 0) c.fail('22', `${tag}: horizontal overflow ${m.overflow}px`)
          for (const e of o.errors) c.fail('22', `${tag}: ${e.slice(0, 160)}`)
        } finally {
          await o.close()
        }
      }

  // the index lists the fixture and offers its kinds
  const idx = await ctx.get('/lab/index', { fixture: true })
  for (const e of fxEntries) if (!idx.text.includes(`data-preview="entry:${e.id}"`)) c.fail('22', `the fixture's index leaves out ${e.id}`)
  if (!idx.text.includes('data-filter="experiment"')) c.fail('22', "the fixture's index offers no experiment filter")
  c.note('22', `fixture: ${entryRoutes.length} entry routes (${kinds.join(', ')}), section ${newSection?.id ?? 'none'}; never shown: ${[...new Set(emptySections)].join(', ')}`)
}

// ---------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------

/** True when another lane file defines rule M (PR 10's previews.mjs), which runs bandMotion itself. */
function mElsewhere(root) {
  const dir = path.join(root, 'scripts/check-lab')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mjs') && f !== 'lists.mjs')
    .some((f) => /\bid:\s*['"]M['"]/.test(fs.readFileSync(path.join(dir, f), 'utf8')))
}

const IDS = ['H1', 'H2', 'H3', '22']
const cache = new WeakMap()
/** One run for H1, H2 and H3 together, cached per check run like layout.mjs's pass. */
function listsPass(ctx) {
  if (!cache.has(ctx)) {
    cache.set(
      ctx,
      (async () => {
        const c = collector(IDS)
        const info = await builtRoutes(ctx)
        if (info.notBuilt) return { c, notBuilt: info.notBuilt }
        if ((await ctx.get('/lab')).status !== 200) return { c, notBuilt: '/lab does not answer 200' }
        const guard = async (id, fn) => {
          try {
            await fn()
          } catch (e) {
            c.fail(id, `threw: ${e.message.split('\n')[0]}`)
          }
        }
        await guard('H1', () => home(ctx, c))
        await guard('H3', () => sections(ctx, c))
        await guard('H3', () => index(ctx, c))
        await guard('H3', () => tagsAndTerms(ctx, c))
        if (!mElsewhere(ctx.root))
          await guard('H1', async () => {
            const m = await bandMotion(ctx)
            for (const f of m.fail) c.fail('H1', `band motion (rule M's, run here until PR 10 defines M): ${f}`)
            for (const n of m.notes) c.note('H1', n)
          })
        return { c }
      })(),
    )
  }
  return cache.get(ctx)
}

const fromPass = (id, title) => ({
  id,
  title,
  needs: ['server', 'browser'],
  async run(ctx) {
    const { c, notBuilt } = await listsPass(ctx)
    return notBuilt ? { notBuilt } : c.result(id)
  },
})

const rules = [
  fromPass('H1', 'The home: a framed band per section, its first min(5, n) top-level entries, "All N in"; Latest'),
  fromPass('H2', 'The home: no time words, nothing counting progress'),
  fromPass('H3', 'Section pages evergreen, their hero from data, every entry listed; the index, tags and glossary'),
  {
    id: '22',
    title: 'Fixture: every kind renders, the new section appears, an empty section never does',
    needs: ['server', 'browser', 'fixture'],
    async run(ctx) {
      const c = collector(['22'])
      try {
        await fixture(ctx, c)
      } catch (e) {
        c.fail('22', `threw: ${e.message.split('\n')[0]}`)
      }
      return c.result('22')
    },
  },
]

export default rules
