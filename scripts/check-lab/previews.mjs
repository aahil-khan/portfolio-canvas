/**
 * Rules P, W, W2, Z and M: the previews (plan PR 10; DIRECTION "Windows, cards and the sheet" and
 * "Motion and hover timing"; NEXT.md decisions 9–11, shortcuts 2 and 3). Lane module for
 * scripts/check-lab.mjs (API.md §11).
 *
 *   P   every internal link, term, tag and citation on every route carries a `data-preview` that
 *       names what its href names, and every citation has its References line; one of each kind,
 *       hovered, opens the right card or window with the right words; `/lab/previews.json` answers
 *       (noindex while hidden); `lab:preview-open` fires with the right `via` (hover, focus, tap).
 *   W   a whole-entry window holds the whole entry (paragraphs equal the page's); the wheel inside
 *       never scrolls the page, and over the title bar scrolls the body; a stack of 3 cascades
 *       right and stops at 3; Esc closes the top only; a press in a lower window closes those above;
 *       ids are prefixed `w<n>-` and none repeats; no console or page error.
 *   W2  never over its link, at every width, for links near every edge; 360 / 460 wide, entries at
 *       most `min(60vh, 500px)`; a first open at 300ms ± 40, the next at 90 ± 40 within the grace;
 *       a close at 220 ± 40, cancelled by re-entry; the safe triangle holds; re-placement on resize
 *       and on growth; the phone sheet (≤ 55vh card, ≤ 92vh entry, 44px Close, the tapped words in
 *       view, a second tap follows the link).
 *   Z   unfurl cards: image, favicon, domain, two-line title, three-line description, a text card
 *       without an image, the quiet card for a link with no unfurl, and zero cross-origin requests.
 *   M   windows enter in 180ms (opacity over 120), rising 6px from 0.98, a cascaded one from its
 *       side; leave in 120ms, 4px down, no scale; the one easing; reduced motion opacity only, ≤ 120ms.
 *       Then the home bands' stagger and the leads drawing in, from lists.mjs's `bandMotion(ctx)`
 *       (PR 9) and instruments.mjs's `leadMotion(ctx)` (PR 11) when they export them.
 *
 * The hooks it reads (components/lab/preview/**): `[data-preview-layer][data-count]` (open windows),
 * `[data-preview-window="<kind>"][data-level][data-for][data-via][data-state][data-side][data-step]`,
 * `[data-pv-body]`, `[data-pv-close]`, `[data-pv-entry-holder]`, `[data-unfurl="image|text|none"]`
 * with `[data-unfurl-img|icon|site|title|desc]`.
 */
import { builtRoutes, capped, collector, fifthChapter, openPage, pool, sleep, tagOf } from './layout.mjs'

const IDS = ['P', 'W', 'W2', 'Z', 'M']
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const TOL = 40

// ---------------------------------------------------------------------------------------------
// In-page instrumentation, installed before the page's scripts
// ---------------------------------------------------------------------------------------------

function INSTR() {
  const pv = (window.__pv = { enters: [], overs: [], counts: [], events: [], anims: [] })
  const kf = (el) =>
    el.getAnimations().map((a) => {
      const k = a.effect?.getKeyframes?.() ?? []
      const t = a.effect?.getTiming?.() ?? {}
      const props = [...new Set(k.flatMap((x) => Object.keys(x).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))]
      return { props, duration: typeof t.duration === 'number' ? t.duration : 0, easing: t.easing || k[0]?.easing || '', first: k[0] ?? {}, last: k[k.length - 1] ?? {} }
    })
  pv.kf = kf
  document.addEventListener(
    'pointerover',
    (e) => {
      const a = e.target.closest?.('a[data-preview]')
      pv.overs.push({ t: e.timeStamp, inWin: !!e.target.closest?.('[data-preview-window]'), link: a ? a.getAttribute('data-preview') : null })
      if (a) pv.enters.push({ t: e.timeStamp, key: a.getAttribute('data-preview') })
    },
    true,
  )
  document.addEventListener('lab:preview-open', (e) => pv.events.push({ t: performance.now(), via: e.detail?.via }))
  const watch = (n) => {
    const t = performance.now()
    const snap = (phase) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          pv.anims.push({ phase, at: t, for: n.getAttribute('data-for'), step: n.getAttribute('data-step'), side: n.getAttribute('data-side'), sheet: n.classList.contains('is-sheet'), list: kf(n) })
        }),
      )
    snap('in')
    new MutationObserver(() => {
      if (n.getAttribute('data-state') === 'closing') snap('out')
    }).observe(n, { attributes: true, attributeFilter: ['data-state'] })
  }
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'attributes') pv.counts.push({ t: performance.now(), n: +m.target.getAttribute('data-count') })
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue
        if (n.matches('[data-preview-layer]')) pv.counts.push({ t: performance.now(), n: +n.getAttribute('data-count') })
        if (n.matches('[data-preview-window]')) watch(n)
        for (const w of n.querySelectorAll?.('[data-preview-window]') ?? []) watch(w)
      }
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-count'] })
}

/** The open windows (not the ones on their way out), bottom first. */
function WINS() {
  return [...document.querySelectorAll('[data-preview-window][data-state="open"]')]
    .sort((a, b) => +a.dataset.level - +b.dataset.level)
    .map((w) => {
      const r = w.getBoundingClientRect()
      const body = w.querySelector('[data-pv-body]')
      return {
        kind: w.dataset.previewWindow,
        level: +w.dataset.level,
        for: w.dataset.for,
        via: w.dataset.via,
        side: w.dataset.side,
        step: w.dataset.step,
        sheet: w.classList.contains('is-sheet'),
        r: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
        body: body ? { scrollTop: body.scrollTop, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight } : null,
        text: (w.querySelector('[data-pv-body]')?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
        bar: (w.querySelector('.lab-pv-bar')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      }
    })
}

const count = (page) => page.evaluate(() => +(document.querySelector('[data-preview-layer]')?.dataset.count ?? 0))
async function waitCount(page, n, timeout = 2500) {
  try {
    await page.waitForFunction((n) => +(document.querySelector('[data-preview-layer]')?.dataset.count ?? 0) === n && document.querySelectorAll('[data-preview-window][data-state="open"]').length >= n, n, { timeout })
    return true
  } catch {
    return false
  }
}
/** Waits for the window at `level` to be positioned and its entry (if any) filled. */
async function settled(page, level, timeout = 4000) {
  try {
    await page.waitForFunction(
      (level) => {
        const w = [...document.querySelectorAll('[data-preview-window][data-state="open"]')].find((x) => +x.dataset.level === level)
        if (!w || getComputedStyle(w).visibility === 'hidden') return false
        if (w.dataset.previewWindow === 'entry' && !w.querySelector('[data-pv-entry-holder] > *')) return false
        return w.getAnimations().every((a) => a.playState !== 'running')
      },
      level,
      { timeout },
    )
    await sleep(60)
    return true
  } catch {
    return false
  }
}
/** Closes everything with Esc presses, and moves the pointer off. */
async function closeAll(page) {
  for (let i = 0; i < 4 && (await count(page)); i++) await page.keyboard.press('Escape')
  await page.mouse.move(2, 2)
  await sleep(380)
}

const overlaps = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5

/** The link's client rects and a point on it, after scrolling it to `where` ('keep' | 'top' | 'bottom' | 'middle'). */
async function aim(page, sel, i, where = 'middle', scope = null) {
  return page.evaluate(
    async ({ sel, i, where, scope }) => {
      const root = scope ? [...document.querySelectorAll('[data-preview-window][data-state="open"]')].find((w) => +w.dataset.level === scope) : document.querySelector('main')
      const a = [...(root?.querySelectorAll(sel) ?? [])].filter((x) => window.__lc.visible(x) && x.getClientRects().length)[i]
      if (!a) return null
      const L = window.__lc
      const bar = document.querySelector('header[data-bar]')?.getBoundingClientRect().bottom ?? 56
      if (scope) {
        a.scrollIntoView({ block: 'center', behavior: 'instant' })
      } else if (where !== 'keep') {
        const r = a.getBoundingClientRect()
        const docTop = r.top + scrollY
        const y = where === 'top' ? docTop - bar - 8 : where === 'bottom' ? docTop + r.height - innerHeight + 12 : docTop - innerHeight / 2
        L.scrollToY(Math.max(0, Math.round(y)))
        await L.frames(120)
      }
      const rects = [...a.getClientRects()].map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }))
      const first = rects.find((r) => r.bottom > 0 && r.top < innerHeight) ?? rects[0]
      return { key: a.getAttribute('data-preview'), href: a.href, words: a.textContent.trim(), rects, x: Math.round((first.left + Math.min(first.right, first.left + 40)) / 2), y: Math.round((first.top + first.bottom) / 2), vw: document.documentElement.clientWidth, vh: innerHeight, bar }
    },
    { sel, i, where, scope },
  )
}

/** Hovers a link and waits for its window: `{ link, win }`, or `{ link, err }`. */
async function hover(page, sel, i = 0, where = 'middle', level = 0, scope = null) {
  const link = await aim(page, sel, i, where, scope)
  if (!link) return { err: `no visible ${sel}` }
  await page.mouse.move(link.x, link.y)
  if (!(await waitCount(page, level + 1)) || !(await settled(page, level))) {
    const hit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return el ? `${el.tagName.toLowerCase()}${el.getAttribute('data-preview') ? `[${el.getAttribute('data-preview')}]` : ''} in ${el.closest('[data-preview-window]')?.getAttribute('data-for') ?? 'the page'}` : 'nothing'
    }, link)
    return { link, err: `${link.key}: no window opened within 2.5s of hovering it (at ${link.x},${link.y}: ${hit}; ${await count(page)} open)` }
  }
  const wins = await page.evaluate(WINS)
  // the link may have moved while the window placed itself (it never should): re-read its rects
  const now = await page.evaluate(({ key, level }) => {
    const all = [...document.querySelectorAll(`a[data-preview="${CSS.escape(key)}"]`)].filter((a) => {
      const w = a.closest('[data-preview-window]')
      return level === 0 ? !w : w && +w.dataset.level === level - 1
    })
    return all.map((a) => [...a.getClientRects()].map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })))
  }, { key: link.key, level })
  return { link: { ...link, rects: now.flat().length ? now.flat() : link.rects }, win: wins.find((w) => w.level === level), wins }
}

/** Every rect check on one open window against its link. */
function placementFails(tag, link, win, width) {
  const out = []
  const vw = link.vw
  const vh = link.vh
  for (const r of link.rects) if (r.bottom > 0 && r.top < vh && overlaps(win.r, r)) out.push(`${tag}: the ${win.kind} window covers its link "${link.words}" (${JSON.stringify(r)} under ${JSON.stringify(win.r)})`)
  const want = Math.min(win.kind === 'entry' ? 460 : 360, vw - 32)
  if (Math.abs(win.r.width - want) > 1.5) out.push(`${tag}: a ${win.kind} window is ${Math.round(win.r.width)}px wide, not ${want}`)
  if (win.kind === 'entry' && win.r.height > Math.min(vh * 0.6, 500) + 1.5) out.push(`${tag}: an entry window is ${Math.round(win.r.height)}px tall, over min(60vh, 500px) = ${Math.round(Math.min(vh * 0.6, 500))}`)
  if (win.r.left < 15 || win.r.right > vw - 15) out.push(`${tag}: the window runs off the side (${Math.round(win.r.left)}–${Math.round(win.r.right)} of ${vw})`)
  if (win.r.bottom > vh + 0.5 || win.r.top < Math.max(0, link.bar) - 0.5) out.push(`${tag}: the window runs off the top or bottom (${Math.round(win.r.top)}–${Math.round(win.r.bottom)} of ${vh}, bar ${Math.round(link.bar)})`)
  void width
  return out
}

/** One page's static audit: every link that should preview does, and names what its href names. */
function AUDIT() {
  const out = { bad: [], counts: { entry: 0, term: 0, tag: 0, ref: 0, out: 0 }, terms: [], tags: [], outs: [] }
  const main = document.querySelector('main')
  if (!main) return out
  const kinds = ['entry', 'term', 'tag', 'ref', 'out']
  for (const a of main.querySelectorAll('a[href]')) {
    if (a.closest('[data-share], [data-toc], [data-picker], .lab-pv')) continue
    const href = a.getAttribute('href')
    const v = a.getAttribute('data-preview')
    const u = new URL(a.href, location.href)
    const words = a.textContent.trim().slice(0, 40)
    let want = null
    if (/^#ref-/.test(href)) want = 'ref'
    else if (/^https?:/.test(href)) want = 'out'
    else if (u.origin === location.origin && /^\/lab\/glossary$/.test(u.pathname) && /^#t-/.test(u.hash)) want = 'term'
    else if (u.origin === location.origin && /^\/lab\/tags\/[\w-]+$/.test(u.pathname)) want = 'tag'
    else if (u.origin === location.origin && /^\/lab\/[\w-]+\/[\w-]+(\/[\w-]+)?$/.test(u.pathname) && !/^\/lab\/(tags|index|glossary)\//.test(u.pathname)) want = 'entry'
    if (!want) continue
    const [k, ...rest] = (v ?? '').split(':')
    const id = rest.join(':')
    if (!v || !kinds.includes(k) || !id) {
      out.bad.push(`"${words}" (${href}) has no data-preview`)
      continue
    }
    if (k !== want) out.bad.push(`"${words}" (${href}) previews ${v}, but its href is a ${want}`)
    out.counts[k]++
    if (k === 'ref') {
      if (href !== `#ref-${id}`) out.bad.push(`citation ${v} jumps to ${href}`)
      if (!document.getElementById(`ref-${id}`)) out.bad.push(`citation ${v} has no References line (#ref-${id})`)
    }
    if (k === 'term') {
      out.terms.push(id)
      if (u.hash !== `#t-${id}`) out.bad.push(`term ${v} links to ${u.hash}`)
    }
    if (k === 'tag') {
      out.tags.push(id)
      if (!u.pathname.endsWith(`/${id}`)) out.bad.push(`tag ${v} links to ${u.pathname}`)
    }
    if (k === 'out') {
      out.outs.push(id)
      if (id !== a.href && id !== href) out.bad.push(`link out ${v} has href ${href}`)
    }
    if (k === 'entry') out.entryLinks = [...(out.entryLinks ?? []), { id, path: u.pathname }]
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// The run: everything once, shared by the five rules
// ---------------------------------------------------------------------------------------------

const cache = new WeakMap()
function all(ctx) {
  if (!cache.has(ctx)) cache.set(ctx, runAll(ctx))
  return cache.get(ctx)
}

async function runAll(ctx) {
  const info = await builtRoutes(ctx)
  if (info.notBuilt) return { notBuilt: info.notBuilt }
  const c = collector(IDS)
  const origin = new URL(ctx.base).origin
  // PR 9 builds the glossary and tag pages; until it lands, SoftNav's prefetch of a term's or a
  // tag's href 404s on hover. That is not a preview's error, so it is noted rather than failed.
  const listsMissing = (await ctx.get('/lab/glossary')).status === 404
  if (listsMissing) c.note('W', '/lab/glossary is not built yet (PR 9): its prefetch 404s on hovering a term are not counted')
  const errs = (list) => list.filter((e) => !(listsMissing && /Failed to load resource: the server responded with a status of 404/.test(e)))
  const entries = info.routes.filter((r) => r.kind === 'entry')
  const ch5 = fifthChapter(entries) ?? entries[0]

  // ---------- the data ----------
  let data = null
  try {
    const res = await ctx.get('/lab/previews.json')
    if (res.status !== 200) c.fail('P', `/lab/previews.json answered ${res.status}`)
    else {
      data = JSON.parse(res.text)
      c.note('P', `/lab/previews.json: ${(res.text.length / 1024).toFixed(1)} KB raw; ${Object.keys(data.terms).length} terms, ${Object.keys(data.tags).length} tags, ${Object.keys(data.entries).length} entries, ${Object.keys(data.unfurls).length} unfurls`)
      if (!ctx.visibility.labPublic && !/noindex/.test(res.headers.get?.('x-robots-tag') ?? res.headers['x-robots-tag'] ?? '')) c.fail('P', '/lab/previews.json carries no X-Robots-Tag: noindex while the Lab is hidden')
      for (const [url, u] of Object.entries(data.unfurls)) {
        for (const src of [u.img?.src, u.icon].filter(Boolean)) if (!/^\/(?!\/)/.test(src)) c.fail('Z', `the unfurl for ${url} names ${src}, not a same-origin file`)
      }
    }
  } catch (e) {
    c.fail('P', `/lab/previews.json: ${e.message}`)
  }

  // ---------- P: the static audit, every route ----------
  const seen = { entry: 0, term: 0, tag: 0, ref: 0, out: 0 }
  const outsSeen = new Set()
  await pool(info.routes, 4, async (route) => {
    const o = await openPage(ctx, route.path, { width: 1440 })
    try {
      const a = await o.page.evaluate(AUDIT)
      for (const b of a.bad) c.fail('P', `${route.path}: ${b}`)
      for (const k of Object.keys(seen)) seen[k] += a.counts[k]
      if (data) {
        for (const t of a.terms) if (!data.terms[t]) c.fail('P', `${route.path}: term ${t} is not in /lab/previews.json`)
        for (const t of a.tags) if (!data.tags[t]) c.fail('P', `${route.path}: tag ${t} is not in /lab/previews.json`)
        for (const x of a.entryLinks ?? []) {
          const r = entries.find((e) => e.path === x.path)
          if (!r) c.fail('P', `${route.path}: entry:${x.id} links to ${x.path}, which is not an entry route`)
          else if (r.entry !== x.id) c.fail('P', `${route.path}: entry:${x.id} links to ${x.path}, the page of ${r.entry}`)
        }
      }
      for (const u of a.outs) outsSeen.add(u)
    } finally {
      await o.close()
    }
  })
  c.note('P', `links that preview, across ${info.routes.length} routes: ${Object.entries(seen).map(([k, n]) => `${n} ${k}`).join(', ')}`)
  for (const k of ['entry', 'term', 'ref', 'out']) if (!seen[k]) c.fail('P', `no route has a single ${k} link to preview`)

  // ---------- desktop, chapter 05: one of each kind, stack, wheel, timing, triangle, motion ----------
  const o = await openPage(ctx, ch5.path, { width: 1440, init: [INSTR] })
  const cross = []
  o.page.on('request', (req) => {
    try {
      if (new URL(req.url()).origin !== origin && !/^(data|blob):/.test(req.url())) cross.push(req.url())
    } catch {
      /* fine */
    }
  })
  const tag1440 = tagOf(ch5, 1440)
  try {
    const p = o.page
    // the first intent loads the controller; that first open is noted, not held to ±40
    {
      const first = await hover(p, 'a[data-preview^="term:"]', 0)
      if (first.err) c.fail('P', `${tag1440}: ${first.err}`)
      const t = await p.evaluate(() => {
        const e = window.__pv.enters.at(-1)
        const open = window.__pv.counts.find((x) => x.n === 1 && x.t >= e.t)
        return open ? Math.round(open.t - e.t) : null
      })
      c.note('W2', `the very first open, the controller loading with it: ${t}ms`)
      await closeAll(p)
      await sleep(700)
    }

    // P: one of each kind, with its words
    for (const kind of ['term', 'tag', 'ref', 'out', 'entry']) {
      const h = await hover(p, `a[data-preview^="${kind}:"]`, 0)
      if (h.err) {
        if (kind !== 'tag') c.fail('P', `${tag1440}: ${h.err}`)
        await closeAll(p)
        continue
      }
      const w = h.win
      const id = h.link.key.slice(kind.length + 1)
      if (w.kind !== kind) c.fail('P', `${tag1440}: ${h.link.key} opened a ${w.kind} window`)
      if (kind === 'term' && data?.terms[id] && !w.text.includes(data.terms[id].def.slice(0, 30))) c.fail('P', `${tag1440}: the card for ${h.link.key} does not hold its definition`)
      if (kind === 'tag' && data?.tags[id] && !w.text.includes(data.tags[id].title)) c.fail('P', `${tag1440}: the card for ${h.link.key} does not name its tag`)
      if (kind === 'ref') {
        const title = await p.evaluate((k) => document.getElementById(`ref-${k}`)?.querySelector('.ref-title')?.textContent.trim(), id)
        const shownUnfurl = await p.evaluate(() => !!document.querySelector('[data-preview-window][data-state="open"] [data-unfurl]'))
        if (title && !shownUnfurl && !w.text.includes(title)) c.fail('P', `${tag1440}: the card for ${h.link.key} does not hold its reference's title "${title}"`)
        if (!w.bar.includes(h.link.words)) c.fail('P', `${tag1440}: the card for ${h.link.key} does not say its number (${h.link.words}) in its bar ("${w.bar}")`)
      }
      if (kind === 'entry') {
        const want = await p.evaluate(async (href) => {
          const doc = new DOMParser().parseFromString(await (await fetch(href)).text(), 'text/html')
          return doc.querySelector('article[data-entry] h1')?.textContent.trim()
        }, h.link.href)
        const got = await p.evaluate(() => document.querySelector('[data-preview-window="entry"][data-state="open"] h1')?.textContent.trim())
        if (want !== got) c.fail('P', `${tag1440}: the window for ${h.link.key} is titled "${got}", not "${want}"`)
      }
      await closeAll(p)
    }
    const vias = await p.evaluate(() => window.__pv.events.map((e) => e.via))
    if (vias.some((v) => v !== 'hover')) c.fail('P', `${tag1440}: hovering fired lab:preview-open with via ${[...new Set(vias)].join(', ')}, not only "hover"`)
    if (!vias.length) c.fail('P', `${tag1440}: no lab:preview-open on any hover`)

    // P: focus by keyboard opens with via "focus"
    {
      await p.evaluate(() => {
        window.__pv.events.length = 0
        const a = document.querySelector('main a[data-preview^="term:"]')
        const all = [...document.querySelectorAll('main a[href], main button')]
        const before = all[all.indexOf(a) - 1]
        before?.focus({ preventScroll: false })
      })
      await p.keyboard.press('Tab')
      const opened = await waitCount(p, 1, 1500)
      const via = await p.evaluate(() => window.__pv.events.map((e) => e.via))
      if (!opened) c.fail('P', `${tag1440}: tabbing onto a term opened nothing`)
      else if (!via.includes('focus')) c.fail('P', `${tag1440}: a focus-open fired via ${via.join(', ') || 'nothing'}, not "focus"`)
      // the Tab bridge: Tab from the link goes into its window
      if (opened) {
        await settled(p, 0)
        await p.keyboard.press('Tab')
        const inWin = await p.evaluate(() => !!document.activeElement?.closest('[data-preview-window]'))
        if (!inWin) c.fail('W', `${tag1440}: Tab from a focus-opened term's link did not move into its card`)
        await p.keyboard.press('Escape')
        const back = await p.evaluate(() => document.activeElement?.getAttribute('data-preview'))
        if (!back?.startsWith('term:')) c.fail('W', `${tag1440}: Esc inside the card did not return focus to its link (${back})`)
      }
      await closeAll(p)
      await p.evaluate(() => document.activeElement?.blur())
    }

    // W: the whole entry; the wheel; the stack of three; Esc; a press in a lower window; ids
    {
      const h = await hover(p, 'main [data-column] a[data-preview^="entry:"], main a[data-preview^="entry:"]', 0, 'top')
      if (h.err) c.fail('W', `${tag1440}: ${h.err}`)
      else {
        const paras = await p.evaluate(async (href) => {
          const doc = new DOMParser().parseFromString(await (await fetch(href)).text(), 'text/html')
          const a = doc.querySelector('article[data-entry]')
          const n = [...a.querySelectorAll('p')].filter((x) => !x.closest('[data-share], [data-toc], .lab-rail-wide, button')).length
          const w = document.querySelector('[data-preview-window="entry"][data-state="open"] [data-pv-entry-holder]')
          return { page: n, win: w ? w.querySelectorAll('p').length : -1 }
        }, h.link.href)
        if (paras.page !== paras.win) c.fail('W', `${tag1440}: the window for ${h.link.key} holds ${paras.win} paragraphs, the page ${paras.page}`)
        else c.note('W', `the window for ${h.link.key} holds all ${paras.win} paragraphs`)

        // the wheel inside the body, then over the title bar
        const before = await p.evaluate(() => ({ y: scrollY, s: document.querySelector('[data-preview-window][data-state="open"] [data-pv-body]').scrollTop }))
        const w0 = h.win.r
        await p.mouse.move(Math.round(w0.left + w0.width / 2), Math.round(w0.top + w0.height / 2))
        await p.mouse.wheel(0, 360)
        await sleep(500)
        const mid = await p.evaluate(() => ({ y: scrollY, s: document.querySelector('[data-preview-window][data-state="open"] [data-pv-body]').scrollTop }))
        if (Math.abs(mid.y - before.y) > 1) c.fail('W', `${tag1440}: the wheel inside a window scrolled the page (${before.y} → ${mid.y})`)
        if (mid.s <= before.s) c.fail('W', `${tag1440}: the wheel inside a window did not scroll its body`)
        await p.mouse.move(Math.round(w0.left + 30), Math.round(w0.top + 14))
        await p.mouse.wheel(0, 240)
        await sleep(500)
        const bar = await p.evaluate(() => ({ y: scrollY, s: document.querySelector('[data-preview-window][data-state="open"] [data-pv-body]').scrollTop }))
        if (Math.abs(bar.y - before.y) > 1) c.fail('W', `${tag1440}: the wheel over a window's title bar scrolled the page`)
        if (bar.s <= mid.s) c.fail('W', `${tag1440}: the wheel over a window's title bar did not scroll its body (${mid.s} → ${bar.s})`)

        // the stack: an entry link inside window 0, then inside window 1, then a fourth refused
        let depth = 1
        for (const level of [1, 2]) {
          const s = await hover(p, 'a[data-preview^="entry:"]', 0, 'keep', level, level - 1)
          if (s.err) {
            c.fail('W', `${tag1440}: window ${level + 1} of the stack: ${s.err}`)
            break
          }
          depth++
          const ws = s.wins
          const lower = ws[level - 1]
          const up = ws[level]
          if (up.step !== 'right' && up.step !== 'left') c.fail('W', `${tag1440}: window ${level + 1} did not step from its parent (data-step "${up.step}")`)
          if (up.step === 'right' && up.r.left < lower.r.left + 31) c.fail('W', `${tag1440}: window ${level + 1} sits at ${Math.round(up.r.left)}, not 32px right of window ${level} (${Math.round(lower.r.left)})`)
          for (const f of placementFails(`${tag1440} window ${level + 1}`, s.link, up, 1440)) c.fail('W2', f)
        }
        if (depth === 3) {
          const fourth = await aim(p, 'a[data-preview]', 0, 'keep', 2)
          if (fourth) {
            await p.mouse.move(fourth.x, fourth.y)
            await sleep(500)
            if ((await count(p)) > 3) c.fail('W', `${tag1440}: a fourth window opened`)
          }
          c.note('W', 'a stack of three opened and cascaded; a fourth was refused')

          // ids: prefixed in every window, and none repeats in the document
          const ids = await p.evaluate(() => {
            const bad = []
            for (const w of document.querySelectorAll('[data-preview-window][data-state="open"]')) for (const el of w.querySelectorAll('[id]')) if (!/^w\d+-/.test(el.id)) bad.push(el.id)
            const all = [...document.querySelectorAll('[id]')].map((x) => x.id)
            const dup = all.filter((x, i) => all.indexOf(x) !== i)
            return { bad, dup: [...new Set(dup)] }
          })
          for (const x of ids.bad.slice(0, 5)) c.fail('W', `${tag1440}: an id in a window is not prefixed: #${x}`)
          for (const x of ids.dup.slice(0, 5)) c.fail('W', `${tag1440}: #${x} appears twice in the document with a stack open`)

          // Esc closes the top one only
          await p.keyboard.press('Escape')
          await sleep(250)
          if ((await count(p)) !== 2) c.fail('W', `${tag1440}: Esc left ${await count(p)} windows open, not 2`)
          // a press inside window 1 (on its padding, clear of window 2) closes the ones above it
          const ws = await p.evaluate(WINS)
          if (ws.length >= 2) {
            await p.keyboard.press('Escape') // back to one, then open a second again by press test below
          }
        }
        await closeAll(p)
      }
      // a press in a lower window: open two, press on window 1's padding
      const a1 = await hover(p, 'main a[data-preview^="entry:"]', 0, 'top')
      if (!a1.err) {
        const a2 = await hover(p, 'a[data-preview]', 0, 'keep', 1, 0)
        if (!a2.err) {
          const w0 = a2.wins[0].r
          await p.mouse.click(Math.round(w0.left + 6), Math.round(w0.bottom - 6))
          await sleep(250)
          if ((await count(p)) !== 1) c.fail('W', `${tag1440}: a press inside the lower window left ${await count(p)} open, not 1`)
        } else c.fail('W', `${tag1440}: ${a2.err}`)
      }
      await closeAll(p)
    }

    // W2: timing. A first open (no grace) at 300, the next within the grace at 90, a close at 220
    {
      await sleep(800)
      const t1 = await hover(p, 'a[data-preview^="term:"]', 0)
      const m = await p.evaluate(() => {
        const e = window.__pv.enters.at(-1)
        const open = window.__pv.counts.find((x) => x.n === 1 && x.t >= e.t)
        return open ? open.t - e.t : null
      })
      if (t1.err || m === null) c.fail('W2', `${tag1440}: no first open to time`)
      else if (Math.abs(m - 300) > TOL) c.fail('W2', `${tag1440}: a first open took ${Math.round(m)}ms, not 300 ± ${TOL}`)
      else c.note('W2', `first open ${Math.round(m)}ms`)
      // the next link, with the first still open: 90ms
      const t2 = await hover(p, 'a[data-preview^="term:"]', 1)
      const g = await p.evaluate(() => {
        const e = window.__pv.enters.at(-1)
        const ev = window.__pv.events.find((x) => x.t >= e.t)
        return ev ? ev.t - e.t : null
      })
      if (t2.err || g === null) c.fail('W2', `${tag1440}: no second open to time`)
      else if (Math.abs(g - 90) > TOL) c.fail('W2', `${tag1440}: the next open, a window being open, took ${Math.round(g)}ms, not 90 ± ${TOL}`)
      else c.note('W2', `next open in the grace ${Math.round(g)}ms`)
      // the close: off to the bar's empty middle, straight up (out of the triangle)
      const bar = await p.evaluate(() => {
        const b = document.querySelector('header[data-bar]').getBoundingClientRect()
        return { x: Math.round(b.width / 2), y: Math.round(b.top + b.height / 2) }
      })
      // the next link's spot, found now so the hover can follow the close at once
      const next = await aim(p, 'a[data-preview^="term:"]', 2, 'keep')
      await p.mouse.move(bar.x, bar.y)
      await waitCount(p, 0, 1500)
      const cl = await p.evaluate(() => {
        const leave = window.__pv.overs.filter((o) => !o.inWin && !o.link).at(-1)
        const gone = window.__pv.counts.find((x) => x.n === 0 && x.t >= leave.t)
        return gone ? gone.t - leave.t : null
      })
      if (cl === null) c.fail('W2', `${tag1440}: the card never closed after the pointer left`)
      else if (Math.abs(cl - 220) > TOL) c.fail('W2', `${tag1440}: closing took ${Math.round(cl)}ms, not 220 ± ${TOL}`)
      else c.note('W2', `close ${Math.round(cl)}ms`)
      // within 600ms of that close, the next opens at 90 again
      if (next) {
        await sleep(120)
        await p.mouse.move(next.x, next.y)
        await waitCount(p, 1)
        const g2 = await p.evaluate(() => {
          const e = window.__pv.enters.at(-1)
          const closed = window.__pv.counts.filter((x) => x.n === 0 && x.t <= e.t).at(-1)
          const ev = window.__pv.events.find((x) => x.t >= e.t)
          return ev ? { open: ev.t - e.t, sinceClose: closed ? e.t - closed.t : null } : null
        })
        if (!g2 || Math.abs(g2.open - 90) > TOL) c.fail('W2', `${tag1440}: ${g2 ? Math.round(g2.sinceClose) + 'ms' : 'just'} after a close the next open took ${g2 ? Math.round(g2.open) + 'ms' : 'forever'}, not 90 ± ${TOL}`)
        else c.note('W2', `${Math.round(g2.sinceClose)}ms after a close, the next open ${Math.round(g2.open)}ms`)
        await settled(p, 0)
      }
      // re-entry cancels a close
      const cur = (await p.evaluate(WINS))[0]
      if (cur) {
        await p.mouse.move(bar.x, bar.y)
        await sleep(110)
        await p.mouse.move(Math.round(cur.r.left + cur.r.width / 2), Math.round(cur.r.top + Math.min(cur.r.height - 10, 40)))
        await sleep(500)
        if ((await count(p)) !== 1) c.fail('W2', `${tag1440}: coming back onto the card 110ms after leaving did not keep it open`)
      }
      await closeAll(p)
    }

    // W2: the safe triangle. Slowly (over ~700ms) from the link toward the window's far top corner,
    // never touching it on the way: the window stays; the same time spent moving away closes it.
    {
      await sleep(700)
      const h = await hover(p, 'main [data-column] a[data-preview^="term:"], main a[data-preview^="term:"]', 0, 'top')
      if (!h.err && h.win.side === 'below') {
        const r = h.link.rects[0]
        const from = { x: Math.min(r.right - 2, h.link.x + 4), y: Math.round(r.bottom - 2) }
        const to = { x: Math.round(h.win.r.right - 6), y: Math.round(h.win.r.top - 1) }
        await p.mouse.move(from.x, from.y)
        await sleep(30)
        const N = 14
        let closedAt = -1
        for (let i = 1; i <= N; i++) {
          await p.mouse.move(Math.round(from.x + ((to.x - from.x) * i) / N), Math.round(from.y + ((to.y - from.y) * i) / N))
          await sleep(50)
          if (closedAt < 0 && (await count(p)) === 0) closedAt = i
        }
        if (closedAt >= 0) c.fail('W2', `${tag1440}: moving through the safe triangle toward the card closed it (step ${closedAt} of ${N})`)
        await p.mouse.move(to.x - 10, to.y + 12)
        await sleep(400)
        if ((await count(p)) !== 1) c.fail('W2', `${tag1440}: the card was gone on arriving through the triangle`)
        else c.note('W2', 'the safe triangle held a card over a 700ms path')
        // the control: away from the card for the same time closes it
        await closeAll(p)
        await sleep(700)
        const h2 = await hover(p, 'main [data-column] a[data-preview^="term:"], main a[data-preview^="term:"]', 0, 'keep')
        if (!h2.err) {
          const r2 = h2.link.rects[0]
          for (let i = 1; i <= N; i++) {
            await p.mouse.move(Math.round(h2.link.x), Math.round(r2.top - 4 * i))
            await sleep(50)
          }
          if ((await count(p)) !== 0) c.fail('W2', `${tag1440}: moving away from the card for 700ms did not close it`)
        }
      } else if (!h.err) c.note('W2', `the triangle's link opened its card ${h.win.side}; not tried`)
      else c.fail('W2', `${tag1440}: ${h.err}`)
      await closeAll(p)
    }

    // W2: re-placement on growth and on resize
    {
      await sleep(700)
      const h = await hover(p, 'main a[data-preview^="term:"]', 0, 'middle')
      if (!h.err) {
        await p.evaluate(() => {
          const body = document.querySelector('[data-preview-window][data-state="open"] .lab-pv-card')
          const pad = document.createElement('div')
          pad.style.height = '520px'
          pad.setAttribute('data-check-pad', '')
          body.append(pad)
        })
        await sleep(300)
        const grown = (await p.evaluate(WINS))[0]
        if (grown) for (const f of placementFails(`${tag1440} after the card grew`, h.link, { ...grown, kind: 'card' }, 1440)) c.fail('W2', f)
        if (grown && grown.r.height < h.win.r.height + 40 && grown.r.bottom < h.link.vh - 20) c.fail('W2', `${tag1440}: the card did not grow or re-place with its content (${Math.round(h.win.r.height)} → ${Math.round(grown.r.height)})`)
        await p.setViewportSize({ width: 1024, height: 700 })
        await sleep(400)
        const link = await aim(p, 'main a[data-preview^="term:"]', 0, 'keep')
        const after = (await p.evaluate(WINS))[0]
        if (after && link) for (const f of placementFails(`${tag1440} resized to 1024×700`, link, { ...after, kind: 'card' }, 1024)) c.fail('W2', f)
        await p.setViewportSize({ width: 1440, height: 900 })
      } else c.fail('W2', `${tag1440}: ${h.err}`)
      await closeAll(p)
    }

    // Z: every unfurl on this page, and a link with none
    await zUnfurls(c, p, tag1440, data)

    if (cross.length) c.fail('Z', `${tag1440}: ${cross.length} cross-origin request(s) during the previews: ${capped(cross, 4).join(', ')}`)
    else c.note('Z', 'zero cross-origin requests across every hover on chapter 05')

    // M: what the instrumentation saw
    motionFails(c, await p.evaluate(() => window.__pv.anims), tag1440, false)
    for (const e of errs(o.errors)) c.fail('W', `${tag1440}: ${e}`)
  } catch (e) {
    c.fail('W', `${tag1440}: threw ${e.message.split('\n')[0]}`)
  } finally {
    await o.close()
  }

  // ---------- Z on every other page with links out ----------
  for (const route of entries.filter((r) => r !== ch5)) {
    const has = await ctx.get(route.path).then((r) => /data-preview="out:/.test(r.text))
    if (!has) continue
    const q = await openPage(ctx, route.path, { width: 1440, init: [INSTR] })
    const cross2 = []
    q.page.on('request', (req) => {
      try {
        if (new URL(req.url()).origin !== origin && !/^(data|blob):/.test(req.url())) cross2.push(req.url())
      } catch {
        /* fine */
      }
    })
    try {
      await zUnfurls(c, q.page, tagOf(route, 1440), data, { all: true })
      if (cross2.length) c.fail('Z', `${tagOf(route, 1440)}: cross-origin requests on hover: ${capped(cross2, 4).join(', ')}`)
      for (const e of errs(q.errors)) c.fail('W', `${tagOf(route, 1440)}: ${e}`)
    } finally {
      await q.close()
    }
  }

  // ---------- W2: never over the link, at every hover width, near every edge ----------
  for (const { width, height } of ctx.widths.filter((w) => w.width >= 600)) {
    const q = await openPage(ctx, ch5.path, { width, height, init: [INSTR] })
    const tag = tagOf(ch5, width)
    try {
      const p = q.page
      const plan = await p.evaluate(() => {
        const links = [...document.querySelectorAll('main a[data-preview]')].filter((a) => window.__lc.visible(a) && a.getClientRects().length)
        const r = (a) => a.getBoundingClientRect()
        const by = (f) => links.reduce((best, a, i) => (best < 0 || f(r(a), r(links[best])) ? i : best), -1)
        const kinds = (k) => links.map((a, i) => [a, i]).filter(([a]) => a.getAttribute('data-preview').startsWith(k)).map(([, i]) => i)
        return { n: links.length, left: by((a, b) => a.left < b.left), right: by((a, b) => a.right > b.right), entries: kinds('entry:'), terms: kinds('term:') }
      })
      const tries = [
        ['left edge', plan.left, 'middle'],
        ['right edge', plan.right, 'middle'],
        ['top edge (an entry)', plan.entries[0], 'top'],
        ['bottom edge (an entry)', plan.entries[0], 'bottom'],
        ['top edge (a term)', plan.terms[0], 'top'],
        ['bottom edge (a term)', plan.terms[1] ?? plan.terms[0], 'bottom'],
      ]
      let tried = 0
      for (const [name, i, where] of tries) {
        if (i === undefined || i < 0) continue
        await sleep(650)
        const h = await hover(p, 'main a[data-preview]', i, where)
        if (h.err) {
          c.fail('W2', `${tag} ${name}: ${h.err}`)
          await closeAll(p)
          continue
        }
        tried++
        for (const f of placementFails(`${tag} ${name}`, h.link, h.win, width)) c.fail('W2', f)
        await closeAll(p)
      }
      c.note('W2', `${tag}: ${tried} links near the edges placed`)
      for (const e of errs(q.errors)) c.fail('W', `${tag}: ${e}`)
    } catch (e) {
      c.fail('W2', `${tag}: threw ${e.message.split('\n')[0]}`)
    } finally {
      await q.close()
    }
  }

  // ---------- the phone sheet, 390 ----------
  {
    const q = await openPage(ctx, ch5.path, { width: 390, init: [INSTR] })
    const tag = tagOf(ch5, 390)
    try {
      const p = q.page
      // a card: tap a term
      const term = await aim(p, 'main [data-column] a[data-preview^="term:"]', 0, 'middle')
      if (term) {
        await p.touchscreen.tap(term.x, term.y)
        if (!(await waitCount(p, 1)) || !(await settled(p, 0))) c.fail('W2', `${tag}: a tap on a term opened no sheet`)
        else {
          const s = await sheetFacts(p, term.key)
          if (!s.sheet) c.fail('W2', `${tag}: a tap opened a window, not a sheet`)
          if (s.h > s.vh * 0.55 + 1) c.fail('W2', `${tag}: a card sheet is ${Math.round(s.h)}px, over 55vh`)
          if (s.close.w < 44 || s.close.h < 44) c.fail('W2', `${tag}: the sheet's Close is ${s.close.w}×${s.close.h}, under 44×44`)
          if (!s.wordsClear) c.fail('W2', `${tag}: the tapped words are not in view above the sheet (${JSON.stringify(s.link)} vs sheet top ${Math.round(s.top)})`)
          const via = await p.evaluate(() => window.__pv.events.map((e) => e.via))
          if (!via.includes('tap')) c.fail('P', `${tag}: a tap fired lab:preview-open via ${via.join(', ') || 'nothing'}, not "tap"`)
          // its Close
          await p.locator('[data-preview-window][data-state="open"] [data-pv-close]').tap()
          if (!(await waitCount(p, 0))) c.fail('W2', `${tag}: the sheet's Close left it open`)
        }
      } else c.fail('W2', `${tag}: no term to tap`)

      // a whole entry: tap, check, then a second tap follows the link
      const ent = await aim(p, 'main a[data-preview^="entry:"]', 0, 'middle')
      if (ent) {
        await sleep(300)
        await p.touchscreen.tap(ent.x, ent.y)
        if (!(await waitCount(p, 1)) || !(await settled(p, 0))) c.fail('W2', `${tag}: a tap on an entry link opened no sheet`)
        else {
          const s = await sheetFacts(p, ent.key)
          if (s.h > s.vh * 0.92 + 1) c.fail('W2', `${tag}: an entry sheet is ${Math.round(s.h)}px, over 92vh`)
          if (s.h < s.vh * 0.5) c.fail('W2', `${tag}: an entry sheet is only ${Math.round(s.h)}px tall`)
          if (!s.wordsClear) c.fail('W2', `${tag}: the tapped entry link is not in view above its sheet (${JSON.stringify(s.link)} vs top ${Math.round(s.top)})`)
          if (s.close.w < 44 || s.close.h < 44) c.fail('W2', `${tag}: the entry sheet's Close is ${s.close.w}×${s.close.h}`)
          // a link inside the sheet opens the next sheet
          const inner = await aim(p, 'a[data-preview^="term:"], a[data-preview^="entry:"]', 0, 'keep', 0)
          if (inner) {
            await p.touchscreen.tap(inner.x, inner.y)
            if (!(await waitCount(p, 2))) c.fail('W2', `${tag}: a tap on a link inside the sheet opened no second sheet`)
            await p.locator('[data-preview-window][data-state="open"][data-level="1"] [data-pv-close]').tap()
            await waitCount(p, 1)
          }
          // the second tap on the same words follows the link
          const again = s.link
          const path = new URL(ent.href).pathname
          await p.touchscreen.tap(Math.round(again.left + 6), Math.round((again.top + again.bottom) / 2))
          try {
            await p.waitForURL((u) => u.pathname === path, { timeout: 4000 })
            c.note('W2', `${tag}: a second tap on the tapped words followed the link to ${path}`)
          } catch {
            c.fail('W2', `${tag}: a second tap on the tapped words did not follow the link (still ${new URL(p.url()).pathname})`)
          }
        }
      } else c.fail('W2', `${tag}: no entry link to tap`)
      for (const e of errs(q.errors)) c.fail('W', `${tag}: ${e}`)
    } catch (e) {
      c.fail('W2', `${tag}: threw ${e.message.split('\n')[0]}`)
    } finally {
      await q.close()
    }
  }

  // ---------- M under reduced motion ----------
  {
    const q = await openPage(ctx, ch5.path, { width: 1440, reduced: true, init: [INSTR] })
    try {
      const p = q.page
      await hover(p, 'main a[data-preview^="term:"]', 0)
      await sleep(200)
      await closeAll(p)
      await hover(p, 'main a[data-preview^="entry:"]', 0, 'top')
      await closeAll(p)
      motionFails(c, await p.evaluate(() => window.__pv.anims), `${tagOf(ch5, 1440)} reduced`, true)
    } finally {
      await q.close()
    }
  }

  // ---------- M: the other lanes' motion, each from its own file when it exports it ----------
  // Rule M is one id with three owners: this file (windows), PR 9 (the home bands' stagger, from
  // lists.mjs's `bandMotion`) and PR 11 (leads drawing on first view, from instruments.mjs's
  // `leadMotion`). check-lab allows one definition per id, so the others export a function instead.
  for (const [file, fn, owner] of [
    ['./lists.mjs', 'bandMotion', 'the band stagger is PR 9’s'],
    ['./instruments.mjs', 'leadMotion', 'leads drawing in are PR 11’s'],
  ]) {
    let mod = null
    try {
      mod = await import(file)
    } catch {
      /* not landed yet */
    }
    if (typeof mod?.[fn] === 'function') {
      const r = await mod[fn](ctx)
      for (const f of r?.fail ?? []) c.fail('M', f)
      for (const n of r?.notes ?? []) c.note('M', n)
    } else c.note('M', `${file.slice(2)} exports no ${fn} yet: ${owner}`)
  }

  return { c }
}

async function sheetFacts(p, key) {
  return p.evaluate((key) => {
    const w = [...document.querySelectorAll('[data-preview-window][data-state="open"]')].find((x) => x.dataset.level === '0')
    const r = w.getBoundingClientRect()
    const close = w.querySelector('[data-pv-close]').getBoundingClientRect()
    const a = [...document.querySelectorAll(`main a[data-preview="${CSS.escape(key)}"]`)][0]
    const lr = [...a.getClientRects()].map((x) => ({ left: x.left, top: x.top, right: x.right, bottom: x.bottom }))
    const bar = document.querySelector('header[data-bar]')?.getBoundingClientRect()
    const barB = bar && bar.bottom > 0 ? bar.bottom : 0
    const line = lr.find((x) => x.bottom <= r.top + 0.5 && x.top >= barB - 0.5)
    return { sheet: w.classList.contains('is-sheet'), h: r.height, top: r.top, vh: innerHeight, close: { w: Math.round(close.width), h: Math.round(close.height) }, link: line ?? lr[0], wordsClear: !!line }
  }, key)
}

/** Z: hovers every link out on the page with an unfurl (or the first `n`), checks its card; then a link with none. */
async function zUnfurls(c, p, tag, data, { all = false } = {}) {
  if (!data) return
  const outs = await p.evaluate(() => [...new Set([...document.querySelectorAll('main a[data-preview^="out:"]')].map((a) => a.getAttribute('data-preview').slice(4)))])
  let img = 0
  let text = 0
  for (const url of outs) {
    const u = data.unfurls[url]
    if (!u) continue
    if (!all && ((u.img && img) || (!u.img && text))) continue
    await sleep(650)
    const i = await p.evaluate((url) => [...document.querySelectorAll('main a[data-preview]')].filter((a) => window.__lc.visible(a) && a.getClientRects().length).findIndex((a) => a.getAttribute('data-preview') === `out:${url}`), url)
    if (i < 0) continue
    const h = await hover(p, 'main a[data-preview]', i, 'top')
    if (h.err) {
      c.fail('Z', `${tag}: ${h.err}`)
      await closeAll(p)
      continue
    }
    const f = await p.evaluate(async () => {
      const w = document.querySelector('[data-preview-window][data-state="open"]')
      const card = w.querySelector('[data-unfurl]')
      if (!card) return null
      const im = card.querySelector('[data-unfurl-img]')
      if (im && !im.complete) await new Promise((r) => im.addEventListener('load', r, { once: true }) || setTimeout(r, 1500))
      const cs = (sel) => {
        const el = card.querySelector(sel)
        return el ? { text: el.textContent.trim(), clamp: getComputedStyle(el).webkitLineClamp, lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) } : null
      }
      return {
        kind: card.dataset.unfurl,
        img: im ? { src: im.getAttribute('src'), w: im.naturalWidth, shown: im.getBoundingClientRect().width } : null,
        icon: card.querySelector('[data-unfurl-icon]')?.getAttribute('src') ?? null,
        site: cs('[data-unfurl-site]'),
        title: cs('[data-unfurl-title]'),
        desc: cs('[data-unfurl-desc]'),
      }
    })
    const t = `${tag} ${url}`
    if (!f) c.fail('Z', `${t}: the card holds no unfurl`)
    else {
      if (u.img) {
        img++
        if (f.kind !== 'image' || !f.img) c.fail('Z', `${t}: the unfurl has an image, the card shows none`)
        else if (!f.img.w) c.fail('Z', `${t}: the card's image did not load (${f.img.src})`)
      } else {
        text++
        if (f.kind !== 'text' || f.img) c.fail('Z', `${t}: a site with no image should get the text card (${f.kind})`)
      }
      if (u.icon && f.icon !== u.icon) c.fail('Z', `${t}: the card's favicon is ${f.icon}, not ${u.icon}`)
      if (!f.site?.text.includes(u.domain)) c.fail('Z', `${t}: the card does not show the domain ${u.domain}`)
      if (f.title?.clamp !== '2' || f.title.lines > 2) c.fail('Z', `${t}: the title is not held to two lines (clamp ${f.title?.clamp}, ${f.title?.lines} lines)`)
      if (u.description && (f.desc?.clamp !== '3' || f.desc.lines > 3)) c.fail('Z', `${t}: the description is not held to three lines (clamp ${f.desc?.clamp}, ${f.desc?.lines})`)
    }
    await closeAll(p)
  }
  if (!all) {
    if (!img) c.note('Z', `${tag}: no link out with an image unfurl here`)
    if (!text) c.note('Z', `${tag}: no link out with a text-only unfurl here`)
    // a link with no unfurl at all (one of Aahil's own, added at /edit): the quiet text card
    await sleep(650)
    await p.evaluate(() => {
      const para = document.querySelector('main [data-column] p')
      const a = document.createElement('a')
      a.href = 'https://no-unfurl.example/a/page'
      a.setAttribute('data-preview', 'out:https://no-unfurl.example/a/page')
      a.setAttribute('data-check-link', '')
      a.textContent = 'a page with no card'
      para.append(' ', a)
    })
    const i = await p.evaluate(() => [...document.querySelectorAll('main a[data-preview]')].filter((a) => window.__lc.visible(a) && a.getClientRects().length).findIndex((a) => a.hasAttribute('data-check-link')))
    const h = await hover(p, 'main a[data-preview]', i, 'middle')
    if (h.err) c.fail('Z', `${tag}: a link with no unfurl: ${h.err}`)
    else {
      const f = await p.evaluate(() => {
        const card = document.querySelector('[data-preview-window][data-state="open"] [data-unfurl]')
        return card ? { kind: card.dataset.unfurl, text: card.textContent } : null
      })
      if (f?.kind !== 'none' || !f.text.includes('no-unfurl.example') || !f.text.includes('a page with no card')) c.fail('Z', `${tag}: a link with no unfurl did not get the quiet card of its words and domain (${JSON.stringify(f)})`)
      else c.note('Z', 'a link with no unfurl got the quiet text card')
    }
    await closeAll(p)
  }
}

/** M: the enter and exit animations the instrumentation captured. */
function motionFails(c, anims, tag, reduced) {
  const ins = anims.filter((a) => a.phase === 'in' && !a.sheet)
  const outs = anims.filter((a) => a.phase === 'out' && !a.sheet)
  if (!ins.length) c.fail('M', `${tag}: no window's enter animation was seen`)
  if (!outs.length) c.fail('M', `${tag}: no window's exit animation was seen`)
  const near = (a, b, t = 6) => Math.abs(a - b) <= t
  const mat = (s) => {
    if (!s || s === 'none') return { a: 1, d: 1, e: 0, f: 0 }
    const m = String(s).match(/translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)(?:\s*scale\(([\d.]+)\))?/)
    if (m) return { a: m[3] ? +m[3] : 1, d: m[3] ? +m[3] : 1, e: +m[1], f: +m[2] }
    const mm = String(s).match(/matrix\(([^)]+)\)/)
    if (mm) {
      const v = mm[1].split(',').map(Number)
      return { a: v[0], d: v[3], e: v[4], f: v[5] }
    }
    return null
  }
  for (const a of [...ins, ...outs]) {
    const where = `${tag}: ${a.phase === 'in' ? 'entering' : 'leaving'} (${a.for}${a.step ? `, stepped ${a.step}` : ''})`
    const op = a.list.find((x) => x.props.includes('opacity'))
    const tr = a.list.find((x) => x.props.includes('transform'))
    for (const x of a.list) if (x.easing && x.easing !== EASE && x.easing !== 'linear') c.fail('M', `${where}: easing ${x.easing}, not ${EASE}`)
    if (reduced) {
      if (tr) c.fail('M', `${where}: under reduced motion a transform animates`)
      for (const x of a.list) if (x.duration > 120.5) c.fail('M', `${where}: under reduced motion an animation runs ${x.duration}ms, over 120`)
      continue
    }
    if (!op) c.fail('M', `${where}: no opacity animation`)
    if (!tr) {
      c.fail('M', `${where}: no transform animation (rise, scale, drop)`)
      continue
    }
    if (a.phase === 'in') {
      if (!near(tr.duration, 180)) c.fail('M', `${where}: the transform runs ${tr.duration}ms, not 180`)
      if (op && !near(op.duration, 120)) c.fail('M', `${where}: opacity runs ${op.duration}ms, not over the first 120`)
      const m = mat(tr.first.transform)
      if (!m) c.fail('M', `${where}: could not read the first transform "${tr.first.transform}"`)
      else {
        if (!near(m.a, 0.98, 0.003)) c.fail('M', `${where}: starts at scale ${m.a}, not 0.98`)
        if (a.step === 'right' || a.step === 'left') {
          if (!near(Math.abs(m.e), 6, 0.5) || Math.sign(m.e) !== (a.step === 'right' ? 1 : -1) || !near(m.f, 0, 0.5)) c.fail('M', `${where}: a cascaded window should enter from the side it steps to (6px), starts at translate(${m.e}, ${m.f})`)
        } else if (!near(m.f, 6, 0.5) || !near(m.e, 0, 0.5)) c.fail('M', `${where}: should rise 6px, starts at translate(${m.e}, ${m.f})`)
      }
      const last = mat(tr.last.transform)
      if (last && (!near(last.a, 1, 0.001) || !near(last.e, 0, 0.5) || !near(last.f, 0, 0.5))) c.fail('M', `${where}: does not end at rest (${tr.last.transform})`)
    } else {
      if (!near(tr.duration, 120)) c.fail('M', `${where}: runs ${tr.duration}ms, not 120`)
      if (op && !near(op.duration, 120)) c.fail('M', `${where}: opacity runs ${op.duration}ms, not 120`)
      const m = mat(tr.last.transform)
      if (!m || !near(m.f, 4, 0.5) || !near(m.a, 1, 0.001)) c.fail('M', `${where}: should end 4px down with no scale, ends at ${tr.last.transform}`)
      if (op && +op.last.opacity !== 0) c.fail('M', `${where}: does not fade to 0`)
    }
  }
  if (ins.length && !reduced) {
    const stepped = ins.filter((a) => a.step)
    c.note('M', `${tag}: ${ins.length} enters (${stepped.length} cascaded) and ${outs.length} exits checked`)
    if (!stepped.length) c.note('M', `${tag}: no cascaded window entered here`)
  }
}

const rule = (id, title, needs = ['server', 'browser']) => ({
  id,
  title,
  needs,
  async run(ctx) {
    const r = await all(ctx)
    if (r.notBuilt) return { notBuilt: r.notBuilt }
    return r.c.result(id)
  },
})

const rules = [
  rule('P', 'Every internal link, term, tag and citation previews (and has its References line); each kind opens the right card; lab:preview-open carries the right via'),
  rule('W', 'Whole-entry windows: every paragraph, contained wheel, a stack of 3 cascading, Esc closes the top, a press closes those above, prefixed ids'),
  rule('W2', 'Never over the link at any width or edge; 360/460 and min(60vh, 500px); 300 / 90 / 220ms; the safe triangle; re-placement; the phone sheet'),
  rule('Z', 'Unfurl cards: image, favicon, domain, 2-line title, 3-line description; a text card; the quiet card; zero cross-origin requests'),
  rule('M', 'Motion: windows in 180ms (opacity 120) rising 6px from 0.98, cascaded from their side, out 120ms 4px down; reduced: opacity ≤ 120ms; the bands (PR 9)'),
]

export default rules
