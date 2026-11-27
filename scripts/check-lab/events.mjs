/**
 * Rule EV: analytics. Nothing is sent before admission; bots and synthetic input are refused; the
 * event allowlist holds. Lane module for scripts/check-lab.mjs (API.md §9 and §11; plan PR 4).
 *
 * Over HTTP (only against a local server, so a check never writes counts into production):
 *   - `/api/events` refuses a bot UA, an absent UA, a cross-site Origin, a wrong content type, an
 *     oversized body, bad JSON, an unknown event name, a value outside its bucket, an extra key;
 *     accepts a valid batch with 204; answers every request with an empty body; rate-limits;
 *   - `/api/opens` refuses a bot UA, and still counts a real card for a browser UA;
 *   - `/stats` renders the events table and opens against visits, when `STATS_TOKEN` is set.
 *
 * In Chromium, on `/canvas`, with real (trusted) and synthetic input:
 *   - synthetic `dispatchEvent` input, however long the page stays, sends nothing;
 *   - trusted input from a browser with `navigator.webdriver` true sends nothing;
 *   - trusted input from an honest browser sends nothing for 8 s, then the queued card open and
 *     every queued event, each in one batch;
 *   - a reload in that tab is admitted at once (one admission per tab session).
 *   - and, once a Lab page exists, it sends nothing to /api/events without input.
 *
 * The events in the browser come from the real `lib/events.ts`, `lib/admission.ts` and
 * `lib/ping.ts`, served on the page's own origin with their types stripped (Node's
 * `stripTypeScriptTypes`) and imported as a module, because no page calls `track()` before the Lab
 * shell lands (PR 6). Nothing in the app grows a test hook for it.
 */
import fs from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import path from 'node:path'

const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const COUNTERS = /\/api\/(events|opens|visitors)$/
const DWELL_MS = 8000
/** A dock card the canvas does not open at boot, so clicking it opens it. */
const CARD = 'stack'
/** Something a response would contain if it echoed the request back. */
const MARK = 'echo-marker-7f3a'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isLocal = (base) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(base)

const batch = (...events) => JSON.stringify({ events })
const ev = (name, props = {}) => ({ name, props })

async function post(base, p, body, headers = {}) {
  const res = await fetch(base + p, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': BROWSER_UA, ...headers },
    body,
    redirect: 'manual',
  })
  return { status: res.status, text: await res.text() }
}

/** The real client modules, types stripped, served on the page's own origin under /__ev/. */
function moduleRoute(root) {
  return async (route) => {
    const name = path.basename(new URL(route.request().url()).pathname)
    if (!['events.ts', 'admission.ts', 'ping.ts'].includes(name)) return route.fulfill({ status: 404, body: '' })
    const src = fs.readFileSync(path.join(root, 'lib', name), 'utf8')
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: stripTypeScriptTypes(src) })
  }
}

/** Opens /canvas (or `p`) with the real modules importable, watching every POST to a counter. */
async function open(ctx, p, { webdriver, ua = BROWSER_UA } = {}) {
  const { page, context, errors, close } = await ctx.page(null, { userAgent: ua })
  await context.addInitScript((wd) => {
    // the modules read process.env.NODE_ENV, which a bundler would have replaced
    globalThis.process ??= { env: { NODE_ENV: 'production' } }
    if (wd !== null) Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => wd, configurable: true })
  }, webdriver ?? null)
  await context.route('**/__ev/*', moduleRoute(ctx.root))
  const posts = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && COUNTERS.test(new URL(r.url()).pathname)) {
      posts.push({ path: new URL(r.url()).pathname, at: Date.now(), body: r.postData() ?? '' })
    }
  })
  const go = async () => {
    await page.goto(ctx.base + p, { waitUntil: 'load' })
    const origin = await page.evaluate(() => performance.timeOrigin)
    await page.addScriptTag({ type: 'module', content: "import { track } from '/__ev/events.ts'; window.__evTrack = track" })
    await page.waitForFunction(() => typeof window.__evTrack === 'function', null, { timeout: 10_000 })
    return origin
  }
  const track = (name, props = {}) => page.evaluate(([n, p]) => window.__evTrack(n, p), [name, props])
  return { page, context, errors, close, posts, go, track }
}

async function httpChecks(ctx, fail, notes) {
  const base = ctx.base
  const good = batch(ev('lab_view', { path: '/lab', kind: 'home', source: 'direct' }), ev('name_say'))
  const xff = (n) => ({ 'x-forwarded-for': `203.0.113.${n}` })

  const cases = [
    ['a bot UA', good, { 'user-agent': BOT_UA }, 403],
    ['curl', good, { 'user-agent': 'curl/8.5.0' }, 403],
    ['no UA', good, { 'user-agent': '' }, 403],
    ['a cross-site Origin', good, { origin: 'https://evil.example' }, 403],
    ['Sec-Fetch-Site: cross-site', good, { 'sec-fetch-site': 'cross-site' }, 403],
    ['text/plain', good, { 'content-type': 'text/plain' }, 415],
    ['a body over 8 KB', JSON.stringify({ events: [], pad: 'x'.repeat(9000) }), {}, 413],
    ['bad JSON', '{"events":[', {}, 400],
    ['an unknown event name', batch(ev('page_view', { path: '/lab', m: MARK })), {}, 400],
    ['a value outside its bucket', batch(ev('read_depth', { path: '/lab', depth: 33 })), {}, 400],
    ['the old look values', batch(ev('look_switch', { look: 'premium', mode: 'night' })), {}, 400],
    ['an extra prop', batch(ev('name_say', { who: MARK })), {}, 400],
    ['an extra top-level key', JSON.stringify({ events: [ev('name_say')], id: MARK }), {}, 400],
    ['one bad event among good ones', batch(ev('name_say'), ev('nope')), {}, 400],
    ['an empty batch', batch(), {}, 400],
    ['a valid batch', good, {}, 204],
  ]
  for (const [i, [why, body, headers, want]] of cases.entries()) {
    const r = await post(base, '/api/events', body, { ...xff(10 + i), ...headers })
    if (r.status !== want) fail.push(`/api/events with ${why}: ${r.status}, wanted ${want}`)
    if (r.text !== '') fail.push(`/api/events with ${why} answered with a body (${r.text.slice(0, 80)}); nothing may be echoed`)
  }
  const get = await fetch(base + '/api/events')
  if (get.status !== 405) fail.push(`GET /api/events: ${get.status}, wanted 405 (write-only)`)

  const opensBot = await post(base, '/api/opens', JSON.stringify({ opens: [CARD] }), { 'user-agent': BOT_UA, ...xff(40) })
  if (opensBot.status !== 403) fail.push(`/api/opens with a bot UA: ${opensBot.status}, wanted 403`)
  const opensCurl = await post(base, '/api/opens', JSON.stringify({ opens: [CARD] }), { 'user-agent': 'curl/8.5.0', ...xff(41) })
  if (opensCurl.status !== 403) fail.push(`/api/opens with curl's UA: ${opensCurl.status}, wanted 403`)
  const opensOk = await post(base, '/api/opens', JSON.stringify({ opens: [CARD] }), xff(42))
  if (opensOk.status !== 200 || !/"counted":true/.test(opensOk.text)) fail.push(`/api/opens with a browser UA and a real card: ${opensOk.status} ${opensOk.text}`)
  notes.push(`HTTP: ${cases.length} /api/events cases, GET 405, /api/opens refuses bot and curl UAs`)

  const token = process.env.STATS_TOKEN
  if (!token) {
    notes.push('/stats not checked: STATS_TOKEN is not set for this run')
  } else {
    const r = await ctx.get(`/stats?t=${encodeURIComponent(token)}`)
    if (r.status !== 200) fail.push(`/stats: ${r.status}`)
    else {
      const { EVENT_NAMES } = await import('../../lib/events.ts')
      if (!/data-stats-events/.test(r.text)) fail.push('/stats has no Events section')
      for (const n of EVENT_NAMES) if (!r.text.includes(`<code>${n}</code>`)) fail.push(`/stats' events table has no row for ${n}`)
      if (!/Opens against admitted visits/.test(r.text)) fail.push('/stats has no opens-against-visits table')
      // the in-memory fallback is one copy per bundle, so without a shared store the page reads zeros
      if (/No shared store is configured/.test(r.text)) notes.push('/stats renders the events table and opens against admitted visits (no shared store, so its counts are zero)')
      else if (!/<code>name_say<\/code>[\s\S]*?<td class="stats__n">[1-9]/.test(r.text)) fail.push('/stats does not show the name_say this check just counted')
      else notes.push('/stats renders the events table and opens against admitted visits, with the name_say just counted')
    }
  }
}

async function rateCheck(ctx, fail, notes) {
  const headers = { 'x-forwarded-for': '198.51.100.77' }
  const body = batch(ev('agents_view'))
  let first429 = 0
  for (let i = 1; i <= 125; i++) {
    const r = await post(ctx.base, '/api/events', body, headers)
    if (r.status === 429) {
      first429 = i
      break
    }
  }
  if (!first429) fail.push('/api/events never rate-limited 125 batches from one address in an hour')
  else notes.push(`rate limit: batch ${first429} from one address was refused with 429`)
}

async function browserChecks(ctx, fail, notes) {
  // 1. synthetic input never unlocks the gate, even with an honest navigator
  {
    const t = await open(ctx, '/canvas', { webdriver: false })
    await t.go()
    await t.track('lab_view', { path: '/lab', kind: 'home', source: 'direct' })
    await t.page.evaluate((card) => {
      const make = (type) =>
        type === 'keydown' ? new KeyboardEvent(type, { key: 'a', bubbles: true }) : new Event(type, { bubbles: true })
      for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
        window.dispatchEvent(make(type))
        document.body.dispatchEvent(make(type))
      }
      // a synthetic click on a dock card still queues a card open
      document.querySelector(`button[data-app-id="${card}"]`)?.click()
    }, CARD)
    await sleep(DWELL_MS + 2500)
    const opened = await t.page.evaluate((card) => !!document.querySelector(`button[data-app-id="${card}"][data-open]`), CARD)
    if (!opened) notes.push('synthetic: the synthetic click did not open the card, so no open was queued')
    if (t.posts.length) fail.push(`synthetic input unlocked the gate: ${t.posts.map((p) => p.path).join(', ')}`)
    else notes.push(`synthetic input: no request to any counter in ${(DWELL_MS + 2500) / 1000}s, with an open and an event queued`)
    await t.close()
  }

  // 2. webdriver: true never unlocks the gate, even with trusted input
  {
    const t = await open(ctx, '/canvas', { webdriver: true })
    await t.go()
    await t.track('lab_view', { path: '/lab', kind: 'home', source: 'direct' })
    await t.page.locator(`button[data-app-id="${CARD}"]`).click()
    await t.page.keyboard.press('Shift')
    await sleep(DWELL_MS + 2500)
    const sent = t.posts.filter((p) => p.path !== '/api/visitors')
    if (sent.length) fail.push(`webdriver: true unlocked the gate: ${sent.map((p) => p.path).join(', ')}`)
    const visits = t.posts.filter((p) => p.path === '/api/visitors')
    for (const v of visits) if (!/"webdriver":true/.test(v.body)) fail.push(`webdriver: the visit ping did not say webdriver: ${v.body}`)
    notes.push(`webdriver: true: nothing to /api/events or /api/opens; ${visits.length} visit ping reporting webdriver for the server to refuse`)
    await t.close()
  }

  // 3. an honest browser with trusted input: nothing for 8 s, then one batch of each
  {
    const t = await open(ctx, '/canvas', { webdriver: false })
    const origin = await t.go()
    await t.track('lab_view', { path: '/lab', kind: 'home', source: 'linkedin' })
    await t.track('read_depth', { path: '/lab', depth: 25 })
    await t.page.locator(`button[data-app-id="${CARD}"]`).click()
    const inputAt = Date.now()
    await t.track('look_switch', { look: 'lab', mode: 'dark' })
    await sleep(Math.max(0, origin + DWELL_MS + 3000 - Date.now()))

    const early = t.posts.filter((p) => p.at - origin < DWELL_MS || p.at < inputAt)
    if (early.length) fail.push(`sent before trusted input plus 8 s: ${early.map((p) => `${p.path} at ${p.at - origin}ms`).join(', ')}`)
    const evs = t.posts.filter((p) => p.path === '/api/events')
    const opens = t.posts.filter((p) => p.path === '/api/opens')
    if (evs.length !== 1) fail.push(`admitted: ${evs.length} requests to /api/events, wanted exactly one batch`)
    else {
      const names = JSON.parse(evs[0].body).events.map((e) => e.name)
      if (names.join() !== 'lab_view,read_depth,look_switch') fail.push(`admitted: the batch held ${names.join()}, wanted the three queued events`)
    }
    if (opens.length !== 1 || !opens[0].body.includes(`"${CARD}"`)) fail.push(`admitted: /api/opens got ${opens.length} requests (${opens.map((o) => o.body).join(' | ')}), wanted one with ${CARD}`)
    const visit = t.posts.filter((p) => p.path === '/api/visitors')
    if (visit.length !== 1) fail.push(`admitted: ${visit.length} visit pings, wanted one`)
    const first = Math.min(...t.posts.map((p) => p.at))
    if (t.posts.length) notes.push(`admitted: input at ${Math.round(inputAt - origin)}ms; first counter request at ${Math.round(first - origin)}ms; one batch each to /api/events (3 events), /api/opens and /api/visitors`)

    // 4. the same tab, reloaded, is admitted at once: an event goes out on the debounce, < 8 s
    t.posts.length = 0
    const again = await t.go()
    await t.track('agents_view')
    await sleep(5500)
    const after = t.posts.filter((p) => p.path === '/api/events')
    if (after.length !== 1) fail.push(`reload in an admitted tab: ${after.length} event batches in 5.5s, wanted one (one admission per tab session)`)
    else notes.push(`reload in an admitted tab: with no input at all, the event went out at ${Math.round(after[0].at - again)}ms`)
    if (t.errors.length) fail.push(`page errors on /canvas: ${t.errors.slice(0, 3).join(' | ')}`)
    await t.close()
  }

  // 5. a real Lab page, once one exists, sends nothing on its own without input
  const labPage = ctx.lab.routes.map((r) => r.path)[0]
  if (!labPage) {
    notes.push('no Lab page yet (PR 6): the bundled gate was checked on /canvas only')
  } else {
    const { page, close } = await ctx.page(null, { userAgent: BROWSER_UA })
    const posts = []
    page.on('request', (r) => r.method() === 'POST' && COUNTERS.test(new URL(r.url()).pathname) && posts.push(r.url()))
    await page.goto(ctx.base + labPage, { waitUntil: 'load' })
    await sleep(DWELL_MS + 1500)
    if (posts.length) fail.push(`${labPage} sent ${posts.join(', ')} with no input`)
    else notes.push(`${labPage}: nothing sent without input`)
    await close()
  }
}

export default {
  id: 'EV',
  title: 'Analytics: nothing sent before admission; bots and synthetic input refused; the event allowlist',
  needs: ['server', 'browser'],
  async run(ctx) {
    const fail = []
    const notes = []
    if (!fs.existsSync(path.join(ctx.root, 'app/api/events/route.ts'))) return { notBuilt: 'no /api/events yet' }
    if (!isLocal(ctx.base)) {
      return { notBuilt: `EV posts counts, so it runs only against a local server, not ${ctx.base}` }
    }
    await httpChecks(ctx, fail, notes)
    await browserChecks(ctx, fail, notes)
    // last, so the limiter it fills cannot touch the browser's own requests
    await rateCheck(ctx, fail, notes)
    return { fail, notes }
  },
}
