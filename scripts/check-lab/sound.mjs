/**
 * Rules N, S, 20, 23, 24, 25 and 26: the name, the Sound menu, the cues and the ambience. Lane
 * module for scripts/check-lab.mjs (API.md §11), plan PR 12. Rule N is the one Aahil settled on
 * 28 Nov, which replaces the plan's "said once per hover":
 *
 *   N   the name's tooltip shows आहिल · اءحل and a bubble labelled "AA-hil"; hovering never plays;
 *       a click on the bubble plays the clip once (one `<audio>`, nothing fetched before the first
 *       open); the dots move while it plays and stop at the end; Escape closes it; nothing on load
 *       fetches the fonts or the clip. Also: never over the name, on screen at 390, the arrival
 *       default doesn't block it and Mute does, keyboard and touch work, reduced motion is still.
 *   S   the Lab's menu measures the canvas's 292 × 417 (±10%) at 1440 and 390, opening it reflows
 *       nothing, it holds the canvas's six stations, keeps the frame, and its text holds 4.5:1; the
 *       canvas's own menu still measures 292 × 417.
 *   20  no AudioContext and no media on load, on every Lab route; the Lab's cue peaks ≤ 0.08; a
 *       hover-opened preview, and hovering anything, plays nothing.
 *   23  a stored "on" (interface, ambience, station) never resumes, not even on the first gesture.
 *   24  the open menu never covers the reading column where the rail stands beside it (1440, 1920),
 *       and a press outside closes it at every width; on a phone a pick, a scroll, Esc and a tap
 *       outside each close it; on a desktop a pick does not.
 *   25  a station plus a noise survive three soft navigations: the same `<audio>`, still playing,
 *       the same AudioContext, one of it, the noise still sounding.
 *   26  each noise peaks ≤ 0.25 at full level, through a limiter (−12 dB, 8:1), fades in and out
 *       over ≥ 0.5s, and nothing of it is routed through the interface cue bus.
 *
 * Stations are stubbed: every request off the server's origin is answered with a few seconds of
 * silent WAV, so nothing here reaches the internet.
 */
import { builtRoutes, collector, fifthChapter, openPage, pool, sleep } from './layout.mjs'

const IDS = ['N', 'S', '20', '23', '24', '25', '26']
const CLIP = '/audio/name.opus'
const FONTS = '/fonts/lab-name/'
/** The canvas's menu, measured at 1440 × 900 in cream (27 Nov): `.sound__menu[data-open]`. */
const CANVAS_MENU = { w: 292, h: 417 }
const DEV = 'आहिल'
const AR = 'اءحل'

/** Web Audio and media, counted before the page's own scripts run. */
function instrument() {
  const A = (window.__audio = { contexts: 0, ctxs: [], media: 0, mediaSrc: [], gains: [], connects: [], ramps: [], comps: [], taps: new Map() })
  const tagged = new WeakSet()
  const Ctx = window.AudioContext
  window.AudioContext = class extends Ctx {
    constructor(...a) {
      super(...a)
      A.contexts += 1
      A.ctxs.push(this)
    }
  }
  const createGain = BaseAudioContext.prototype.createGain
  BaseAudioContext.prototype.createGain = function () {
    const g = createGain.call(this)
    tagged.add(g.gain)
    A.gains.push({ node: g, max: 0, at: performance.now() })
    return g
  }
  const record = (param, v) => {
    if (!tagged.has(param)) return
    const g = A.gains.find((x) => x.node.gain === param)
    if (g) g.max = Math.max(g.max, v)
  }
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) {
    const orig = AudioParam.prototype[m]
    AudioParam.prototype[m] = function (v, t) {
      record(this, v)
      if (m === 'linearRampToValueAtTime' && tagged.has(this)) {
        const c = A.ctxs[A.ctxs.length - 1]
        A.ramps.push({ v, dt: t - (c ? c.currentTime : 0) })
      }
      return orig.apply(this, arguments)
    }
  }
  const createComp = BaseAudioContext.prototype.createDynamicsCompressor
  BaseAudioContext.prototype.createDynamicsCompressor = function () {
    const n = createComp.call(this)
    A.comps.push(n)
    return n
  }
  // every connection, and a tap on whatever reaches the speakers, for peaks
  let tapping = false
  const connect = AudioNode.prototype.connect
  AudioNode.prototype.connect = function (target) {
    if (!tapping) A.connects.push({ from: this, to: target })
    const out = connect.apply(this, arguments)
    if (!tapping && target instanceof AudioDestinationNode) {
      tapping = true
      try {
        let tap = A.taps.get(this.context)
        if (!tap) {
          const an = this.context.createAnalyser()
          an.fftSize = 2048
          const sink = this.context.createGain()
          sink.gain.value = 0
          connect.call(an, sink)
          connect.call(sink, this.context.destination)
          tap = an
          A.taps.set(this.context, tap)
        }
        connect.call(this, tap)
      } finally {
        tapping = false
      }
    }
    return out
  }
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    A.media += 1
    A.mediaSrc.push(this.currentSrc || this.src)
    return play.apply(this, arguments)
  }
  /** The loudest sample reaching the speakers over `ms`. */
  window.__peak = async (ms = 1500) => {
    const tap = [...A.taps.values()][0]
    if (!tap) return { peak: 0, state: 'none' }
    const buf = new Float32Array(tap.fftSize)
    let peak = 0
    const end = performance.now() + ms
    while (performance.now() < end) {
      tap.getFloatTimeDomainData(buf)
      for (const v of buf) peak = Math.max(peak, Math.abs(v))
      await new Promise((r) => setTimeout(r, 40))
    }
    return { peak, state: A.ctxs[0]?.state ?? 'none' }
  }
}

function storage(items) {
  try {
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v)
  } catch {
    /* fine */
  }
}

/** A few seconds of silence, for the stations. */
function silentWav(seconds = 6, rate = 8000) {
  const n = seconds * rate
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 2, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 2, 40)
  return b
}
const SILENCE = silentWav()

async function stubStations(ctx, context) {
  const origin = new URL(ctx.base).origin
  await context.route(
    (url) => url.origin !== origin,
    (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: SILENCE }),
  )
}

/** Every same-origin request a page makes, for "nothing fetched on load". */
function requests(page) {
  const list = []
  page.on('request', (r) => list.push(new URL(r.url()).pathname))
  return list
}

/** Names the URL behind a bare "Failed to load resource" console error. */
function missing(page) {
  const list = []
  page.on('response', (r) => r.status() >= 400 && list.push(`${r.status()} ${new URL(r.url()).pathname}`))
  return list
}

/** The page's state of the name, in one read. */
function NAME_STATE() {
  const tip = document.querySelector('[data-name-tip]')
  const name = document.querySelector('button[data-name]')
  const say = tip?.querySelector('[data-name-say]')
  const shown = !!tip && !tip.hidden && tip.getBoundingClientRect().width > 0
  const r = (el) => {
    const b = el.getBoundingClientRect()
    return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }
  }
  const dots = say ? [...say.querySelectorAll('.lab-name-dots i, [class*="dots"] i')] : []
  const moving = dots.some((d) => d.getAnimations().some((a) => a.playState === 'running'))
  // the scripts and the separator, without the bubble
  let line = ''
  if (tip) for (const n of tip.childNodes) if (n !== say) line += ` ${n.textContent}`
  const clip = [...document.querySelectorAll('audio')].filter((a) => /name\.opus/.test(a.currentSrc || a.src))
  return {
    shown,
    hasName: !!name,
    line: line.replace(/\s+/g, ' ').trim(),
    sayLabel: say?.getAttribute('aria-label') ?? '',
    sayTitle: say?.getAttribute('title') ?? '',
    sayText: say?.textContent.trim() ?? '',
    playing: !!say?.hasAttribute('data-playing'),
    moving,
    dotHeights: dots.map((d) => Math.round(d.getBoundingClientRect().height)),
    clips: clip.length,
    clipEnded: clip[0] ? clip[0].ended || clip[0].paused : null,
    media: window.__audio.media,
    contexts: window.__audio.contexts,
    tip: tip && shown ? r(tip) : null,
    name: name ? r(name) : null,
    vw: document.documentElement.clientWidth,
    vh: innerHeight,
    expanded: name?.getAttribute('aria-expanded') ?? null,
    active: document.activeElement?.matches?.('[data-name]') ? 'name' : document.activeElement?.matches?.('[data-name-say]') ? 'say' : document.activeElement?.tagName,
    devFont: tip ? getComputedStyle(tip.querySelector('[lang="hi"]')).fontFamily : '',
    devLoaded: [...document.fonts].some((f) => /Lab Name Devanagari/.test(f.family) && f.status === 'loaded'),
    arLoaded: [...document.fonts].some((f) => /Lab Name Arabic/.test(f.family) && f.status === 'loaded'),
    arDir: tip?.querySelector('[lang="ar"]')?.getAttribute('dir') ?? null,
  }
}

const overlaps = (a, b) => a && b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5

/** Contrast of every text in `sel` against its own ground, through layout.mjs's helpers. */
function CONTRAST(sel) {
  const L = window.__lc
  const root = document.querySelector(sel)
  if (!root) return []
  const out = []
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n; (n = tw.nextNode()); ) {
    if (!n.data.trim()) continue
    const el = n.parentElement
    if (!el || !L.visible(el) || el.closest('[aria-hidden="true"]:not([data-name-say] *)')) continue
    const cs = getComputedStyle(el)
    const fg = L.parse(cs.color)
    const bg = L.bgOf(el)
    const big = parseFloat(cs.fontSize) >= 24
    const ratio = L.ratio(L.over(fg, bg), bg)
    if (ratio < (big ? 3 : 4.5)) out.push(`"${n.data.trim().slice(0, 24)}" ${ratio.toFixed(2)}:1`)
  }
  return out
}

/** The bounding box of an entry's paragraphs: the reading column. */
function COLUMN() {
  // the body's own paragraphs: before [data-body-end], outside the rail and the lead (which may
  // run the width of the column and the rail together)
  const end = document.querySelector('[data-body-end]')
  const ps = [...document.querySelectorAll('article[data-entry] p')].filter(
    (p) =>
      p.getBoundingClientRect().width > 0 &&
      !p.closest('[data-rail], [data-lead]') &&
      (!end || p.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING),
  )
  if (!ps.length) return null
  const rs = ps.map((p) => p.getBoundingClientRect())
  return { l: Math.min(...rs.map((r) => r.left)), r: Math.max(...rs.map((r) => r.right)), t: 0, b: innerHeight }
}

function MENU() {
  const m = document.querySelector('[data-sound-menu]')
  if (!m) return { open: false }
  const r = m.getBoundingClientRect()
  const cs = getComputedStyle(m)
  const split = (v) => v.split(/,(?![^(]*\))/).map((x) => x.trim())
  const shadows = cs.boxShadow === 'none' ? [] : split(cs.boxShadow).filter((x) => !/inset/.test(x)).map((x) => x.replace(/rgba?\([^)]*\)|color\([^)]*\)/g, '').trim().split(/\s+/).map(parseFloat))
  return {
    open: r.width > 0,
    rect: { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height },
    stations: m.querySelectorAll('[data-station]').length,
    noises: m.querySelectorAll('[data-noise]').length,
    tabs: [...m.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim()),
    edge: parseFloat(cs.borderTopWidth),
    hard: shadows.some((n) => (n[0] > 0 || n[1] > 0) && !(n[2] > 0)),
    soft: shadows.some((n) => n[2] > 0),
    backdrop: cs.backdropFilter && cs.backdropFilter !== 'none',
  }
}
const mainBox = () => {
  const m = document.querySelector('main')
  const r = m.getBoundingClientRect()
  const p = document.querySelector('main p, main h1')
  const q = p ? p.getBoundingClientRect() : r
  return [Math.round(r.left), Math.round(r.width), Math.round(q.left), Math.round(q.top + scrollY)]
}

async function openMenu(p) {
  await p.click('button[data-sound]')
  await sleep(300)
}

// ---------------------------------------------------------------------------------------------

async function ruleN(ctx, info, c) {
  // where the name renders
  const pages = []
  for (const r of info.routes) {
    const res = await ctx.get(r.path)
    if (/class="lab-name"/.test(res.text)) pages.push(r)
  }
  if (!pages.length) {
    c.fail('N', 'no Lab page renders his name (`Name`, API.md §6)')
    return
  }
  const home = pages.find((r) => r.kind === 'home') ?? pages[0]
  c.note('N', `the name renders on ${pages.map((r) => r.path).join(', ')}`)

  // desktop, in every look: the line, the label, hover never plays, a click plays once, the dots
  for (const look of ctx.looks) {
    const tag = `${home.path} @1440 ${look.name}`
    const o = await openPage(ctx, home.path, { width: 1440, query: look.query, init: [instrument] })
    const p = o.page
    const reqs = requests(p)
    try {
      const st = () => p.evaluate(NAME_STATE)
      let s = await st()
      if (!s.hasName) {
        c.fail('N', `${tag}: the name is not a button once the page has hydrated`)
        continue
      }
      if (s.shown) c.fail('N', `${tag}: the tooltip is open on arrival`)
      // nothing on load fetched the fonts or the clip (openPage waited for network idle)
      const early = reqs.filter((u) => u.startsWith(FONTS) || u === CLIP)
      if (early.length) c.fail('N', `${tag}: fetched on load, before any open: ${early.join(', ')}`)
      if (s.clips) c.fail('N', `${tag}: an <audio> for the clip exists on load`)

      // hover: the tooltip opens, its one line, the bubble's label, and no sound
      await p.locator('button[data-name]').scrollIntoViewIfNeeded()
      const box = await p.locator('button[data-name]').boundingBox()
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 })
      await sleep(500)
      s = await st()
      if (!s.shown) c.fail('N', `${tag}: hovering the name did not open the tooltip`)
      if (s.line !== `${DEV} · ${AR}`) c.fail('N', `${tag}: the tooltip reads "${s.line}", want "${DEV} · ${AR}"`)
      if (/aahil/i.test(s.line)) c.fail('N', `${tag}: the tooltip repeats the Latin name`)
      if (!/AA-hil/.test(s.sayLabel) || s.sayTitle !== 'AA-hil' || /AH-hil/.test(s.sayLabel + s.sayTitle + s.sayText))
        c.fail('N', `${tag}: the bubble is labelled "${s.sayLabel}", titled "${s.sayTitle}"; want "AA-hil" in both, never "AH-hil"`)
      if (s.arDir !== 'rtl') c.fail('N', `${tag}: the Arabic script is not dir="rtl"`)
      if (overlaps(s.tip, s.name)) c.fail('N', `${tag}: the tooltip covers the name`)
      if (s.tip && (s.tip.l < 0 || s.tip.r > s.vw)) c.fail('N', `${tag}: the tooltip leaves the screen (${Math.round(s.tip.l)}–${Math.round(s.tip.r)} of ${s.vw})`)
      if (s.media) c.fail('N', `${tag}: hovering the name played something (${s.media})`)
      if (s.playing || s.moving) c.fail('N', `${tag}: the bubble shows playing on hover`)
      await p.evaluate(() => document.fonts.ready)
      await sleep(200)
      s = await st()
      if (!s.devLoaded || !s.arLoaded) c.fail('N', `${tag}: the name's fonts did not load on the first open (Devanagari ${s.devLoaded}, Arabic ${s.arLoaded})`)
      if (!/Lab Name Devanagari/.test(s.devFont)) c.fail('N', `${tag}: the Devanagari is set in ${s.devFont}`)
      const fetched = reqs.filter((u) => u.startsWith(FONTS)).length
      if (fetched !== 2) c.fail('N', `${tag}: ${fetched} font requests on the first open (want the two subsets)`)
      if (!reqs.includes(CLIP)) c.fail('N', `${tag}: the first open did not start fetching the clip`)
      // contrast, in this look
      for (const x of await p.evaluate(CONTRAST, '[data-name-tip]')) c.fail('N', `${tag}: the tooltip's text ${x}`)
      // moving on the name and the tooltip still plays nothing
      await p.mouse.move(box.x + 4, box.y + box.height / 2, { steps: 4 })
      if (s.tip) await p.mouse.move(s.tip.l + 20, s.tip.t + s.tip.h / 2, { steps: 6 })
      await sleep(400)
      s = await st()
      if (!s.shown) c.fail('N', `${tag}: the tooltip closed while the pointer crossed to it`)
      if (s.media) c.fail('N', `${tag}: hovering played something`)

      // a click on the bubble: once, the dots move, and stop at the end
      await p.click('[data-name-say]')
      let playingSeen = false
      let movedSeen = false
      for (let i = 0; i < 20; i++) {
        s = await st()
        if (s.playing) playingSeen = true
        if (s.moving) movedSeen = true
        if (playingSeen && movedSeen) break
        await sleep(50)
      }
      if (s.media !== 1) c.fail('N', `${tag}: a click on the bubble played ${s.media} times (want 1)`)
      if (s.clips !== 1) c.fail('N', `${tag}: ${s.clips} <audio> elements for the clip (want 1)`)
      if (!playingSeen) c.fail('N', `${tag}: the bubble never showed playing`)
      if (!movedSeen) c.fail('N', `${tag}: the dots did not move while it played`)
      for (let i = 0; i < 60 && (s.playing || !s.clipEnded); i++) {
        await sleep(100)
        s = await st()
      }
      if (s.playing || s.moving) c.fail('N', `${tag}: the dots still move after the clip ended`)
      if (s.contexts) c.fail('N', `${tag}: the name started an AudioContext`)
      // again: the same element, played once more
      await p.click('[data-name-say]')
      await sleep(150)
      s = await st()
      if (s.media !== 2 || s.clips !== 1) c.fail('N', `${tag}: a second click (plays ${s.media}, ${s.clips} clip elements)`)
      // Escape closes
      await p.keyboard.press('Escape')
      await sleep(150)
      if ((await st()).shown) c.fail('N', `${tag}: Escape did not close the tooltip`)
      // the pointer leaving closes, after its grace
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 })
      await sleep(300)
      await p.mouse.move(20, 700, { steps: 3 })
      await sleep(600)
      if ((await st()).shown) c.fail('N', `${tag}: the tooltip stayed after the pointer left`)
      if (o.errors.length) c.fail('N', `${tag}: ${o.errors[0].slice(0, 160)}`)
    } catch (e) {
      c.fail('N', `${tag}: threw ${e.message.split('\n')[0]}`)
    } finally {
      await o.close()
    }
  }

  // Mute silences it; the keyboard opens it and Enter plays it
  {
    const tag = `${home.path} @1440 keyboard, Mute`
    const o = await openPage(ctx, home.path, { width: 1440, init: [instrument] })
    const p = o.page
    try {
      const st = () => p.evaluate(NAME_STATE)
      let reached = false
      for (let i = 0; i < 40 && !reached; i++) {
        await p.keyboard.press('Tab')
        reached = (await st()).active === 'name'
      }
      if (!reached) c.fail('N', `${tag}: Tab never reached the name`)
      else {
        await sleep(250)
        let s = await st()
        if (!s.shown) c.fail('N', `${tag}: focusing the name did not open the tooltip`)
        if (s.media) c.fail('N', `${tag}: focusing the name played something`)
        await p.keyboard.press('Tab')
        await sleep(100)
        s = await st()
        if (s.active !== 'say' || !s.shown) c.fail('N', `${tag}: Tab from the name did not reach the bubble with the tooltip open (${s.active})`)
        await p.keyboard.press('Enter')
        await sleep(200)
        if ((await st()).media !== 1) c.fail('N', `${tag}: Enter on the bubble did not play it once`)
        await p.keyboard.press(' ')
        await sleep(200)
        if ((await st()).media !== 2) c.fail('N', `${tag}: Space on the bubble did not play it`)
        await p.keyboard.press('Escape')
        await sleep(150)
        s = await st()
        if (s.shown) c.fail('N', `${tag}: Escape did not close it`)
        if (s.active !== 'name') c.fail('N', `${tag}: Escape did not return focus to the name (${s.active})`)
      }
      // Mute, which the reader sets, silences it
      await openMenu(p)
      await p.click('[data-sound-mute]')
      await p.keyboard.press('Escape')
      const before = (await st()).media
      const box = await p.locator('button[data-name]').boundingBox()
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 })
      await sleep(400)
      await p.click('[data-name-say]')
      await sleep(300)
      const s = await st()
      if (s.media !== before || s.playing) c.fail('N', `${tag}: Mute did not silence the name (${s.media - before} plays)`)
      if (o.errors.length) c.fail('N', `${tag}: ${o.errors[0].slice(0, 160)}`)
    } catch (e) {
      c.fail('N', `${tag}: threw ${e.message.split('\n')[0]}`)
    } finally {
      await o.close()
    }
  }

  // a phone: tap to open, on screen, tap the bubble, tap outside
  for (const reduced of [false, true]) {
    const tag = `${home.path} @390${reduced ? ' reduced motion' : ''}`
    const o = await openPage(ctx, home.path, { width: 390, reduced, init: [instrument] })
    const p = o.page
    try {
      const st = () => p.evaluate(NAME_STATE)
      await p.locator('button[data-name]').scrollIntoViewIfNeeded()
      await p.locator('button[data-name]').tap()
      await sleep(350)
      let s = await st()
      if (!s.shown) c.fail('N', `${tag}: a tap on the name did not open the tooltip`)
      if (s.tip && (s.tip.l < 0 || s.tip.r > s.vw || s.tip.t < 0)) c.fail('N', `${tag}: the tooltip leaves the screen (${Math.round(s.tip.l)}–${Math.round(s.tip.r)} of ${s.vw}, top ${Math.round(s.tip.t)})`)
      if (overlaps(s.tip, s.name)) c.fail('N', `${tag}: the tooltip covers the name`)
      if (s.media) c.fail('N', `${tag}: the tap on the name played something`)
      await p.locator('[data-name-say]').tap()
      let playingSeen = false
      let moved = false
      let heights = []
      for (let i = 0; i < 20; i++) {
        s = await st()
        if (s.playing) {
          playingSeen = true
          heights = s.dotHeights
        }
        if (s.moving) moved = true
        if (playingSeen && (moved || reduced)) break
        await sleep(50)
      }
      if (s.media !== 1) c.fail('N', `${tag}: a tap on the bubble played ${s.media} times`)
      if (!playingSeen) c.fail('N', `${tag}: the bubble never showed playing`)
      if (reduced) {
        if (moved) c.fail('N', `${tag}: the dots move under reduced motion`)
        if (playingSeen && new Set(heights).size < 2) c.fail('N', `${tag}: no still "playing" state under reduced motion (dots ${heights.join('/')}px)`)
      } else if (!moved) c.fail('N', `${tag}: the dots did not move while it played`)
      await p.touchscreen.tap(195, 800)
      await sleep(250)
      if ((await st()).shown) c.fail('N', `${tag}: a tap outside did not close the tooltip`)
      if (o.errors.length) c.fail('N', `${tag}: ${o.errors[0].slice(0, 160)}`)
    } catch (e) {
      c.fail('N', `${tag}: threw ${e.message.split('\n')[0]}`)
    } finally {
      await o.close()
    }
  }
}

async function ruleS(ctx, info, c, entry) {
  // the canvas's own menu, the reference
  {
    const o = await ctx.page('/canvas?theme=cream', { viewport: { width: 1440, height: 900 } })
    try {
      const p = o.page
      const btn = p.locator('.arrange.sound > button').first()
      if (!(await btn.count())) c.fail('S', 'the canvas has no Sound pill (.arrange.sound > button)')
      else {
        await btn.click()
        await sleep(400)
        const r = await p.evaluate(() => {
          const m = document.querySelector('.sound__menu[data-open]')
          const b = m?.getBoundingClientRect()
          return b ? { w: b.width, h: b.height } : null
        })
        if (!r) c.fail('S', 'the canvas Sound menu did not open')
        else {
          if (Math.abs(r.w - CANVAS_MENU.w) > 3 || Math.abs(r.h - CANVAS_MENU.h) > 4) c.fail('S', `the canvas's own menu now measures ${Math.round(r.w)} × ${Math.round(r.h)}, not ${CANVAS_MENU.w} × ${CANVAS_MENU.h}`)
          c.note('S', `canvas menu ${Math.round(r.w)} × ${Math.round(r.h)}`)
        }
      }
    } catch (e) {
      c.fail('S', `canvas: threw ${e.message.split('\n')[0]}`)
    } finally {
      await o.close()
    }
  }
  for (const width of [1440, 390]) {
    for (const look of ctx.looks) {
      const tag = `${entry.path} @${width} ${look.name}`
      const o = await openPage(ctx, entry.path, { width, query: look.query, init: [instrument] })
      const p = o.page
      try {
        const before = await p.evaluate(mainBox)
        await openMenu(p)
        const m = await p.evaluate(MENU)
        const after = await p.evaluate(mainBox)
        if (!m.open) {
          c.fail('S', `${tag}: the Sound menu did not open`)
          continue
        }
        const { w, h } = m.rect
        if (Math.abs(w / CANVAS_MENU.w - 1) > 0.1 || Math.abs(h / CANVAS_MENU.h - 1) > 0.1) c.fail('S', `${tag}: the menu is ${Math.round(w)} × ${Math.round(h)}, the canvas's ${CANVAS_MENU.w} × ${CANVAS_MENU.h} (±10%)`)
        if (before.some((v, i) => Math.abs(v - after[i]) > 1)) c.fail('S', `${tag}: opening the menu moved the page (${before} → ${after})`)
        if (m.stations !== 6) c.fail('S', `${tag}: ${m.stations} stations (the canvas has 6)`)
        if (m.tabs.length !== 2) c.fail('S', `${tag}: sources ${m.tabs.join(' · ')} (want Radio · Noise, Tracks hidden)`)
        if (!(m.edge >= 2) || !m.hard || m.soft || m.backdrop) c.fail('S', `${tag}: the menu has lost the frame (edge ${m.edge}, hard ${m.hard}, blur ${m.soft}, glass ${m.backdrop})`)
        if (m.rect.l < 0 || m.rect.r > width) c.fail('S', `${tag}: the menu leaves the screen`)
        for (const x of await p.evaluate(CONTRAST, '[data-sound-menu]')) c.fail('S', `${tag}: ${x}`)
        // the noise list, too
        await p.click('[data-sound-tab="noise"]')
        await sleep(150)
        const n = await p.evaluate(MENU)
        if (n.noises !== 5) c.fail('S', `${tag}: ${n.noises} noises (want 5)`)
        if (Math.abs(n.rect.h / CANVAS_MENU.h - 1) > 0.1) c.fail('S', `${tag}: on Noise the menu is ${Math.round(n.rect.h)} tall`)
        for (const x of await p.evaluate(CONTRAST, '[data-sound-menu]')) c.fail('S', `${tag} (Noise): ${x}`)
        if (look === ctx.looks[0]) c.note('S', `${tag}: ${Math.round(w)} × ${Math.round(h)}`)
        if (o.errors.length) c.fail('S', `${tag}: ${o.errors[0].slice(0, 160)}`)
        const a = await p.evaluate(() => window.__audio)
        if (a.contexts || a.media) c.fail('20', `${tag}: opening the Sound menu started sound (contexts ${a.contexts}, media ${a.media})`)
      } catch (e) {
        c.fail('S', `${tag}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    }
  }
}

async function rule20and23(ctx, info, c) {
  // 20: on every route, nothing on load
  const routes = info.routes
  await pool(routes, 3, async (r) => {
    const tag = `${r.path} @1440`
    const o = await openPage(ctx, r.path, { width: 1440, init: [instrument] })
    try {
      const a = await o.page.evaluate(() => ({ contexts: window.__audio.contexts, media: window.__audio.media, els: document.querySelectorAll('audio, video').length, menu: !!document.querySelector('[data-sound-menu]') }))
      if (a.contexts || a.media || a.els) c.fail('20', `${tag}: sound on load (contexts ${a.contexts}, media ${a.media}, elements ${a.els})`)
      if (a.menu) c.fail('23', `${tag}: the Sound menu is open on arrival`)
    } finally {
      await o.close()
    }
  })
  c.note('20', `${routes.length} routes loaded silent`)

  // 23: a stored "on" for everything, then a first gesture: still nothing
  {
    const r = routes.find((x) => x.kind === 'entry') ?? routes[0]
    const tag = `${r.path} stored on`
    const o = await openPage(ctx, r.path, { width: 1440, init: [instrument, [storage, { 'canvas.sound': 'on', 'canvas.ambience': 'on', 'canvas.station': 'chillhop' }]] })
    try {
      const p = o.page
      await stubStations(ctx, o.context)
      await p.mouse.click(8, 600)
      await p.keyboard.press('ArrowDown')
      await sleep(600)
      const a = await p.evaluate(() => ({ contexts: window.__audio.contexts, media: window.__audio.media, els: document.querySelectorAll('audio').length }))
      if (a.contexts || a.media || a.els) c.fail('23', `${tag}: a first gesture resumed it (contexts ${a.contexts}, media ${a.media})`)
      // the stored station is the one shown, without playing
      await openMenu(p)
      const shown = await p.evaluate(() => ({ sel: document.querySelector('[data-station][data-selected]')?.dataset.station, on: document.querySelector('[data-sound-ambience]')?.getAttribute('aria-checked') }))
      if (shown.sel !== 'chillhop') c.fail('23', `${tag}: the stored station is not the one shown (${shown.sel})`)
      if (shown.on !== 'false') c.fail('23', `${tag}: Ambience reads on before anything plays`)
    } finally {
      await o.close()
    }
  }

  // 20: cue peaks, and hover plays nothing
  {
    const r = routes.find((x) => x.kind === 'entry') ?? routes[0]
    const tag = `${r.path} cues`
    const o = await openPage(ctx, r.path, { width: 1440, init: [instrument] })
    const gone = missing(o.page)
    try {
      const p = o.page
      await openMenu(p)
      await p.click('[data-sound-ui]')
      await p.keyboard.press('Escape')
      await sleep(900)
      const peaks = await p.evaluate(async () => {
        const A = window.__audio
        const out = {}
        const fire = (name) => (name === 'peek' ? document.dispatchEvent(new CustomEvent('lab:preview-open', { detail: { via: 'click' } })) : document.dispatchEvent(new CustomEvent('lab:cue', { detail: { name } })))
        for (const name of ['peek', 'turn', 'counter', 'deal']) {
          const from = A.gains.length
          fire(name)
          await new Promise((res) => setTimeout(res, 60))
          // the voices made for this cue; their peaks summed, as if they all landed at once
          const made = A.gains.slice(from)
          out[name] = { n: made.length, sum: made.reduce((s, g) => s + g.max, 0) }
          await new Promise((res) => setTimeout(res, 400))
        }
        const from = A.gains.length
        document.dispatchEvent(new CustomEvent('lab:preview-open', { detail: { via: 'hover' } }))
        await new Promise((res) => setTimeout(res, 100))
        out.hover = { n: A.gains.length - from, sum: 0 }
        return out
      })
      for (const [k, v] of Object.entries(peaks)) {
        if (k === 'hover') {
          if (v.n) c.fail('20', `${tag}: a preview opened by hover played a cue`)
          continue
        }
        if (!(v.n > 0)) c.fail('20', `${tag}: the ${k} cue made no sound`)
        else if (!(v.sum <= 0.08)) c.fail('20', `${tag}: the ${k} cue peaks at ${v.sum.toFixed(3)} (≤ 0.08)`)
        c.note('20', `${k}: ${v.n} voices, peak ≤ ${v.sum.toFixed(3)}`)
      }
      // hovering everything that can be hovered: no new voice
      const before = await p.evaluate(() => window.__audio.gains.length)
      const targets = await p.evaluate(() =>
        [...document.querySelectorAll('header[data-bar] a, header[data-bar] button, main a, [data-rail] a')]
          .slice(0, 40)
          .map((el) => el.getBoundingClientRect())
          .filter((b) => b.width && b.top > 0 && b.bottom < innerHeight)
          .map((b) => [b.left + b.width / 2, b.top + b.height / 2]),
      )
      for (const [x, y] of targets) await p.mouse.move(x, y, { steps: 2 })
      await sleep(300)
      const after = await p.evaluate(() => window.__audio.gains.length)
      if (after !== before) c.fail('20', `${tag}: hovering ${targets.length} controls made ${after - before} voices`)
      // hovering a link prefetches its page; a page another PR has yet to build answers 404, which
      // is that route's business (rule 21 and the route list), not a sound
      const prefetch404 = gone.filter((g) => /^404 \/lab\//.test(g))
      const errors = o.errors.filter((e) => !(prefetch404.length && /status of 404/.test(e)))
      if (prefetch404.length) c.note('20', `${tag}: hover prefetches answered ${prefetch404.join(', ')}`)
      if (errors.length) c.fail('20', `${tag}: ${errors[0].slice(0, 160)}${gone.length ? ` (${gone.join(', ')})` : ''}`)
    } finally {
      await o.close()
    }
  }
}

async function rule24(ctx, info, c, entry) {
  for (const width of ctx.widths.map((w) => w.width)) {
    const tag = `${entry.path} @${width}`
    const o = await openPage(ctx, entry.path, { width, init: [instrument] })
    const p = o.page
    const phone = width < 768
    try {
      await stubStations(ctx, o.context)
      const isOpen = () => p.evaluate(() => !!document.querySelector('[data-sound-menu]'))
      await openMenu(p)
      if (!(await isOpen())) {
        c.fail('24', `${tag}: the menu did not open`)
        continue
      }
      if (width >= 1200) {
        const col = await p.evaluate(COLUMN)
        const m = (await p.evaluate(MENU)).rect
        if (col && m.l < col.r && m.r > col.l) c.fail('24', `${tag}: the open menu covers the reading column (menu ${Math.round(m.l)}–${Math.round(m.r)}, column ${Math.round(col.l)}–${Math.round(col.r)})`)
      }
      if (!phone) {
        await p.click('[data-station="lofi"]')
        await sleep(200)
        if (!(await isOpen())) c.fail('24', `${tag}: a pick closed the menu on a desktop`)
        await p.mouse.click(10, (await p.evaluate(() => innerHeight)) - 10)
        await sleep(300)
        if (await isOpen()) c.fail('24', `${tag}: a press outside did not close the menu`)
        await openMenu(p)
        await p.keyboard.press('Escape')
        await sleep(300)
        if (await isOpen()) c.fail('24', `${tag}: Esc did not close the menu`)
        if (!(await p.evaluate(() => document.activeElement?.matches('button[data-sound]')))) c.fail('24', `${tag}: Esc did not return focus to the Sound button`)
      } else {
        const steps = [
          ['a pick', () => p.locator('[data-station="chillhop"]').tap()],
          ['a scroll', () => p.evaluate(() => scrollBy(0, 240))],
          ['Esc', () => p.keyboard.press('Escape')],
          ['a tap outside', () => p.touchscreen.tap(30, 780)],
        ]
        await p.keyboard.press('Escape')
        await sleep(250)
        for (const [what, act] of steps) {
          await p.evaluate(() => scrollTo(0, 0))
          await sleep(200)
          await p.locator('button[data-sound]').tap()
          await sleep(300)
          if (!(await isOpen())) {
            c.fail('24', `${tag}: the menu did not open before ${what}`)
            continue
          }
          await act()
          await sleep(400)
          if (await isOpen()) c.fail('24', `${tag}: the menu stayed open after ${what}`)
        }
      }
      if (o.errors.length) c.fail('24', `${tag}: ${o.errors[0].slice(0, 160)}`)
    } catch (e) {
      c.fail('24', `${tag}: threw ${e.message.split('\n')[0]}`)
    } finally {
      await o.close()
    }
  }
}

async function rule25(ctx, info, c, entry) {
  const tag = `${entry.path} @1440`
  const o = await openPage(ctx, entry.path, { width: 1440, init: [instrument] })
  const p = o.page
  try {
    await stubStations(ctx, o.context)
    await openMenu(p)
    await p.click('[data-station="lofi"]')
    await p.waitForFunction(() => document.querySelector('[data-station="lofi"]')?.hasAttribute('data-live'), null, { timeout: 8000 }).catch(() => {})
    await p.click('[data-sound-tab="noise"]')
    await p.click('[data-noise="rain"]')
    await p.keyboard.press('Escape')
    await sleep(1200)
    const start = await p.evaluate(() => {
      window.__marker = 1
      window.__el = [...document.querySelectorAll('audio')].find((a) => !a.hasAttribute('data-clip'))
      window.__ctx = window.__audio.ctxs[0]
      return { el: !!window.__el, playing: window.__el ? !window.__el.paused : false, contexts: window.__audio.contexts }
    })
    if (!start.el || !start.playing) c.fail('25', `${tag}: the stubbed station did not start (element ${start.el}, playing ${start.playing})`)
    const path0 = new URL(p.url()).pathname
    const hops = [
      ['the bar\'s Lab link', 'header[data-bar] a[href="/lab"]'],
      ['a row on the home', 'main a[href^="/lab/"]'],
      ['the bar\'s Lab link', 'header[data-bar] a[href="/lab"]'],
    ]
    let last = path0
    for (const [what, sel] of hops) {
      const link = p.locator(sel).first()
      if (!(await link.count())) {
        c.fail('25', `${tag}: no ${what} (${sel}) to navigate by`)
        break
      }
      await link.click()
      await p.waitForFunction((from) => location.pathname !== from, last, { timeout: 8000 }).catch(() => {})
      await sleep(500)
      last = new URL(p.url()).pathname
    }
    const s = await p.evaluate(async () => {
      const el = [...document.querySelectorAll('audio')].find((a) => !a.hasAttribute('data-clip'))
      const { peak, state } = await window.__peak(1200)
      return {
        soft: window.__marker === 1,
        same: el === window.__el,
        playing: el ? !el.paused : false,
        ctx: window.__audio.ctxs[0] === window.__ctx,
        contexts: window.__audio.contexts,
        peak,
        state,
        path: location.pathname,
      }
    })
    if (!s.soft) c.fail('25', `${tag}: a navigation reloaded the page`)
    if (!s.same || !s.playing) c.fail('25', `${tag}: the station did not survive three soft navigations (same <audio> ${s.same}, playing ${s.playing})`)
    if (!s.ctx || s.contexts !== 1) c.fail('25', `${tag}: the AudioContext changed (${s.contexts} made)`)
    if (s.state === 'running' && !(s.peak > 0)) c.fail('25', `${tag}: the noise went silent after navigating`)
    await openMenu(p)
    await p.click('[data-sound-tab="noise"]')
    const rain = await p.evaluate(() => document.querySelector('[data-noise="rain"]')?.getAttribute('aria-pressed'))
    if (rain !== 'true') c.fail('25', `${tag}: the menu no longer shows the noise playing after navigating`)
    c.note('25', `${path0} → ${s.path}, three soft navigations; noise peak ${s.peak.toFixed(3)} (${s.state})`)
    // Mute silences both, and unmutes back
    await p.click('[data-sound-mute]')
    const muted = await p.evaluate(() => {
      const el = [...document.querySelectorAll('audio')].find((a) => !a.hasAttribute('data-clip'))
      return { el: el ? el.muted : null }
    })
    await sleep(200) // the analyser's window still holds the last 40ms before Mute
    const mp = await p.evaluate(() => window.__peak(600))
    if (muted.el !== true || mp.peak > 0.0001) c.fail('25', `${tag}: Mute left something audible (element muted ${muted.el}, peak ${mp.peak.toFixed(4)})`)
    await p.click('[data-sound-mute]')
    if (o.errors.length) c.fail('25', `${tag}: ${o.errors[0].slice(0, 160)}`)
  } catch (e) {
    c.fail('25', `${tag}: threw ${e.message.split('\n')[0]}`)
  } finally {
    await o.close()
  }
}

async function rule26(ctx, info, c, entry) {
  const tag = `${entry.path} @1440`
  const o = await openPage(ctx, entry.path, { width: 1440, init: [instrument] })
  const p = o.page
  try {
    await openMenu(p)
    // the cue bus, from one cue
    await p.click('[data-sound-ui]')
    await sleep(300)
    const cueBus = await p.evaluate(() => {
      const A = window.__audio
      const from = A.connects.length
      document.dispatchEvent(new CustomEvent('lab:cue', { detail: { name: 'counter' } }))
      window.__cueTargets = new Set(A.connects.slice(from).map((x) => x.to).filter((t) => !(t instanceof AudioDestinationNode)))
      return window.__cueTargets.size
    })
    if (!cueBus) c.fail('26', `${tag}: could not find the interface cue bus`)
    await p.click('[data-sound-ui]')
    await sleep(600)
    // full level
    await p.click('button[aria-controls="lab-mix-detail"]')
    await p.locator('input[type="range"]').first().fill('100')
    await p.locator('#lab-mix-detail input[type="range"]').nth(1).fill('100')
    await p.click('[data-sound-tab="noise"]')
    const ids = await p.evaluate(() => [...document.querySelectorAll('[data-noise]')].map((b) => b.dataset.noise))
    if (ids.length !== 5) c.fail('26', `${tag}: ${ids.length} noises (want 5)`)
    for (const id of ids) {
      await p.evaluate(() => {
        window.__mark = { c: window.__audio.connects.length, r: window.__audio.ramps.length }
      })
      await p.click(`[data-noise="${id}"]`)
      await sleep(900)
      const r = await p.evaluate(async () => {
        const A = window.__audio
        const conns = A.connects.slice(window.__mark.c)
        const cueHit = conns.some((x) => window.__cueTargets.has(x.to) || window.__cueTargets.has(x.from))
        const fadeIn = A.ramps.slice(window.__mark.r).filter((x) => x.v >= 0.99)
        const { peak, state } = await window.__peak(2200)
        const limiters = A.comps.filter((n) => n.threshold.value === -12 && n.ratio.value === 8)
        const through = limiters.some((n) => A.connects.some((x) => x.to === n))
        return { cueHit, fade: fadeIn.length ? Math.min(...fadeIn.map((x) => x.dt)) : null, peak, state, limiters: limiters.length, through }
      })
      if (r.cueHit) c.fail('26', `${tag}: ${id} is routed through the interface cue bus`)
      if (!(r.fade >= 0.5)) c.fail('26', `${tag}: ${id} fades in over ${r.fade}s (≥ 0.5)`)
      if (r.peak > 0.25) c.fail('26', `${tag}: ${id} peaks at ${r.peak.toFixed(3)} at full level (≤ 0.25)`)
      if (r.state === 'running' && !(r.peak > 0)) c.fail('26', `${tag}: ${id} made no sound`)
      if (r.limiters !== 1 || !r.through) c.fail('26', `${tag}: ${r.limiters} limiters at −12 dB, 8:1 (want one, on the noise's path)`)
      c.note('26', `${id}: peak ${r.peak.toFixed(3)}, fade in ${r.fade?.toFixed(2)}s (${r.state})`)
      // stopping fades out too
      await p.evaluate(() => {
        window.__mark = { c: window.__audio.connects.length, r: window.__audio.ramps.length }
      })
      await p.click(`[data-noise="${id}"]`)
      const out = await p.evaluate(() => window.__audio.ramps.slice(window.__mark.r).filter((x) => x.v === 0))
      if (!out.length || Math.min(...out.map((x) => x.dt)) < 0.5) c.fail('26', `${tag}: ${id} stops without a fade of ≥ 0.5s`)
      await sleep(1000)
    }
    if (o.errors.length) c.fail('26', `${tag}: ${o.errors[0].slice(0, 160)}`)
  } catch (e) {
    c.fail('26', `${tag}: threw ${e.message.split('\n')[0]}`)
  } finally {
    await o.close()
  }
}

// ---------------------------------------------------------------------------------------------

const cache = new WeakMap()
function runAll(ctx) {
  if (!cache.has(ctx)) cache.set(ctx, runSound(ctx))
  return cache.get(ctx)
}

async function runSound(ctx) {
  const info = await builtRoutes(ctx)
  const c = collector(IDS)
  if (info.notBuilt) return { info, c }
  const entry = fifthChapter(info.entries) ?? info.entries[0]
  const steps = [
    ['N', () => ruleN(ctx, info, c)],
    ['S', () => ruleS(ctx, info, c, entry)],
    ['20', () => rule20and23(ctx, info, c)],
    ['24', () => rule24(ctx, info, c, entry)],
    ['25', () => rule25(ctx, info, c, entry)],
    ['26', () => rule26(ctx, info, c, entry)],
  ]
  for (const [id, step] of steps) {
    try {
      await step()
    } catch (e) {
      c.fail(id, `threw ${e.stack || e.message}`)
    }
  }
  return { info, c }
}

const rule = (id, title) => ({
  id,
  title,
  needs: ['server', 'browser'],
  async run(ctx) {
    const { info, c } = await runAll(ctx)
    if (info.notBuilt) return { notBuilt: info.notBuilt }
    return c.result(id)
  },
})

export default [
  rule('20', 'No AudioContext and no media on load; the Lab\'s cues peak ≤ 0.08; no hover sound'),
  rule('N', 'The name: आहिल · اءحل and a bubble labelled AA-hil; hover never plays; a click plays once; the dots move only while it plays; Escape closes; nothing fetched on load'),
  rule('S', 'The Sound menu is the canvas\'s 292 × 417 (±10%), reflows nothing, keeps the frame; the canvas\'s own menu unchanged'),
  rule('23', 'A stored "on" never resumes, not even on the first gesture'),
  rule('24', 'The menu never covers the column beside the rail; closes outside, and on a phone on a pick, a scroll, Esc and a tap outside'),
  rule('25', 'A station and a noise survive three soft navigations: the same <audio>, the same AudioContext'),
  rule('26', 'Noise: peaks ≤ 0.25, a limiter (−12 dB, 8:1), fades ≥ 0.5s, never through the cue bus'),
]
