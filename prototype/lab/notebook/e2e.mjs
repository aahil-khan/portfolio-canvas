// prototype/lab/night-mode/e2e.mjs: what the Lab does, in a real browser, at 1440×900 and 390×844.
//
//   node prototype/lab/night-mode/e2e.mjs [path/to/index.html or lab.html]
//
// Drives Chromium through playwright-core (cx-tools' copy, or PLAYWRIGHT_CORE=<dir>; no project
// dependency). It covers: arriving (the 1.2 s trip, the deck at rest, ← canvas, the toy's [next]),
// the living tiles (wake on hover and focus, the peek, a category with glyphs and its preview),
// the ask hero (types out, the transport only while it talks), the dial (behind its flag: right-
// click, hold space, long-press, the ? toggle), THE TRIP'S DOCK (25 frozen frames each way: no
// jump, wrap or overflow), the reader and narration, reduced motion, and the way back (Δ0).
// Exits 1 if anything fails. Takes no screenshots.
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || join(homedir(), '.local/share/cx-tools/node_modules/playwright-core'))
const base = pathToFileURL(resolve(process.argv[2] || join(here, 'index.html'))).href
let fails = 0, n = 0
const ok = (cond, msg) => { n++; console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++ }
const wait = (p, ms) => p.waitForTimeout(ms)

const deckCells = (p) => p.evaluate(() => [...document.querySelectorAll('.ldock')].filter((x) => x.getBoundingClientRect().width > 2 && getComputedStyle(x).visibility !== 'hidden').map((x) => x.innerText.replace(/\s+/g, ' ').trim()))
const SIZES = [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]

const b = await chromium.launch()
const errors = []
const page = async (size, url, opts = {}) => {
  const phone = size === 'phone'
  const ctx = await b.newContext({ viewport: SIZES.find((s) => s[0] === size)[1], isMobile: phone, hasTouch: phone, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`${size} ${url}: ${e.message}`))
  await p.goto(base + url)
  await p.evaluate(() => document.fonts.ready)
  await wait(p, opts.settle ?? 700)
  return p
}

for (const [size] of SIZES) {
  const phone = size === 'phone'
  console.log(`\n${size}`)

  // ── arriving, by keyboard ──────────────────────────────────────────────────────────────
  {
    const p = await page(size, '')
    await p.focus('.desk-dock__item[data-id="lab"]')
    await p.keyboard.press('Enter')
    await wait(p, 1700)
    const r = await p.evaluate(() => ({ t: NIGHT.state.t, ms: NIGHT.timing.in, f: document.activeElement.id, back: document.querySelector('.lab-back').getBoundingClientRect().toJSON(), next: !!document.querySelector('.toy__next').getClientRects().length, muted: NIGHT.sound.muted, playing: NIGHT.voice.state().playing }))
    ok(r.t === 1 && r.ms >= 1100 && r.ms <= 1400, `Enter on the Lab tile: the Lab in ${r.ms} ms (1.2 s, decode included)`)
    ok(r.f === 'tile-work', `focus lands on the first tile (${r.f})`)
    ok(r.muted && !r.playing, 'arrives muted, nothing playing')
    const cells = await deckCells(p)
    ok(cells.join(' │ ') === 'LAB │ snd:off pal:w │ / ?', `the deck at rest: ${cells.join(' │ ')}`)
    ok(r.back.left < 30 && r.back.top < 30 && r.back.width > 40, `← canvas is top left (${Math.round(r.back.left)}, ${Math.round(r.back.top)})`)
    ok(r.next, "the toy's [next] is beside the toy, not in the deck")
    // ← back with ~, focus on the Lab tile, Δ0 measured by the page's own proof below
    await p.keyboard.press('~')
    await wait(p, 1700)
    const back = await p.evaluate(() => ({ t: NIGHT.state.t, ms: NIGHT.timing.out, f: document.activeElement.dataset.id, inline: [...document.querySelectorAll('#deskDock *')].some((x) => /width|padding/.test(x.getAttribute('style') || '')) }))
    ok(back.t === 0 && back.ms >= 1100 && back.ms <= 1400 && back.f === 'lab' && !back.inline, `~ goes back in ${back.ms} ms, focus on the Lab tile, no inline sizes left on the dock`)
    await p.context().close()
  }

  // ── the living tiles ─────────────────────────────────────────────────────────────────────
  {
    const p = await page(size, '?mode=night')
    const texts = () => p.evaluate(() => [...document.querySelectorAll('.tile .vg')].map((x) => x.textContent))
    const changes = async (ms) => { let last = await texts(), c = [0, 0, 0, 0]; for (let i = 0; i < ms / 100; i++) { await wait(p, 100); const now = await texts(); now.forEach((t, k) => { if (t !== last[k]) c[k]++ }); last = now } return c }
    const t0 = await texts()
    ok(t0.length === 4 && t0.every((t) => t.split('\n').length === 6 && t.trim()), 'four tiles, each with a 6-line vignette')
    const idle = await changes(1500)
    ok(idle.every((c) => c <= 3), `at rest the vignettes are calm: ${idle.join(' / ')} frames in 1.5 s`)
    await p.focus('#tile-experiments')
    const woke = await changes(1500)
    const st = await p.evaluate(() => { const t = document.querySelector('.tile[data-sec="experiments"]'); return { awake: t.classList.contains('is-awake'), peek: getComputedStyle(t.querySelector('.tile__peek')).opacity, items: t.querySelectorAll('.tile__pi').length, others: document.querySelectorAll('.tile.is-awake').length } })
    ok(st.awake && st.others === 1 && woke[1] >= 8 && woke[0] <= 3, `focus wakes only that tile: experiments ${woke[1]} frames in 1.5 s, work ${woke[0]}`)
    if (!phone) ok(+st.peek > 0.9 && st.items >= 2, `awake, it peeks its latest ${st.items} items in place of its line`)
    if (!phone) {
      const box = await p.evaluate(() => document.querySelector('.tiles').getBoundingClientRect().height)
      await p.hover('#tile-research')
      await wait(p, 250)
      const h = await p.evaluate(() => ({ awake: document.querySelector('.tile[data-sec="research"]').classList.contains('is-awake'), tiles: document.querySelector('.tiles').getBoundingClientRect().height }))
      ok(h.awake && Math.abs(h.tiles - box) < 0.5, `hover wakes a tile, and nothing moves (tiles ${box.toFixed(1)} → ${h.tiles.toFixed(1)} px)`)
    }
    await p.keyboard.press('ArrowRight')
    ok(await p.evaluate(() => document.activeElement.id === 'tile-research'), 'arrow keys walk the tiles')
    await p.keyboard.press('Enter')
    await wait(p, 300)
    const cv = await p.evaluate(() => ({ view: NIGHT.home.view(), cat: NIGHT.home.cat(), rows: [...document.querySelectorAll('.cvs:not([hidden]) .dl__row')].map((r) => r.textContent), glyphs: document.querySelectorAll('.cvs:not([hidden]) .dl__g').length, f: document.activeElement.className, pane: (document.querySelector('.cvs:not([hidden]) .pane') || {}).textContent || '' }))
    ok(cv.view === 'cat' && cv.cat === 'research' && cv.f.includes('dl__row'), 'Enter opens research/, the cursor on its first row')
    ok(cv.rows.some((r) => /3 of ~6/.test(r)) && cv.glyphs >= 4, `the series row says 3 of ~6, and every row has its glyph (${cv.glyphs})`)
    if (!phone) ok(/reliability study/i.test(cv.pane), 'the preview pane shows the row under the cursor')
    const spin = await p.evaluate(async () => { const g = document.querySelector('.cvs:not([hidden]) .dl__g[data-g="spin"]'); const a = g.textContent; await new Promise((r) => setTimeout(r, 1600)); return [a, g.textContent] })
    ok(spin[0] !== spin[1], `the in-progress glyph turns (${spin.join(' → ')})`)
    await p.keyboard.press('Escape')
    ok(await p.evaluate(() => NIGHT.home.view() === 'home' && document.activeElement.id === 'tile-research'), 'Esc goes back to the tiles, focus on the one it came from')
    await p.keyboard.press('1')
    await wait(p, 200)
    if (!phone) {
      await p.hover('.cvs:not([hidden]) [data-row="work/holt"] .dl__row')
      await wait(p, 100)
      ok(/holt/i.test(await p.evaluate(() => document.querySelector('.cvs:not([hidden]) .pane').textContent)), 'hovering a row previews it in the pane')
    } else {
      await p.tap('.cvs:not([hidden]) [data-row="work/holt"] .dl__row')
      ok(await p.evaluate(() => !document.querySelector('[data-row="work/holt"] .dl__x').hidden), 'on a phone a row expands in place (no pane)')
    }
    await p.context().close()
  }

  // ── the ask hero, and the deck while it talks ────────────────────────────────────────────
  {
    const p = await page(size, '?mode=night')
    const hero = await p.evaluate(() => { const b = document.querySelector('.hero__go'), h = document.querySelector('.hello__1').getBoundingClientRect(), r = b.getBoundingClientRect(); return { text: b.textContent.trim(), below: r.top > h.bottom, chips: [...document.querySelectorAll('.hero .chip')].map((c) => c.textContent) } })
    ok(/^▶ what am i working on\?$/.test(hero.text) && hero.below && hero.chips.join() === 'something interesting,a joke', `the hero under the welcome: "${hero.text}", chips: ${hero.chips.join(' · ')}`)
    await p.click('.hero__go')
    await wait(p, 900)
    const a1 = await p.evaluate(() => document.querySelector('.ans__t').textContent.length)
    await wait(p, 900)
    const a2 = await p.evaluate(() => ({ n: document.querySelector('.ans__t').textContent.length, mark: document.querySelector('.ans__mark').textContent, mode: document.querySelector('.dk-m').textContent }))
    ok(a2.n > a1 && a1 > 0 && /sample/.test(a2.mark), `the answer types out right there (${a1} → ${a2.n} characters), marked a sample`)
    const talking = await deckCells(p)
    ok(a2.mode === 'ASK' && talking.length === (phone ? 4 : 5) && /◂◂ ❚❚ ▸▸/.test(talking[1]) && /voice|ai|synth|sam/.test(talking[2]), `while it talks the transport and the voice slide in: ${talking.join(' │ ')}`)
    const fits = await p.evaluate(() => { const r = document.querySelector('.desk-dock__panel').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height < 60 })
    ok(fits, 'and the deck still fits on one line, inside the screen')
    await p.keyboard.press('Escape')
    await wait(p, 2300)
    const after = await p.evaluate(() => ({ full: document.querySelector('.ans__t').textContent, mode: document.querySelector('.dk-m').textContent }))
    ok(!after.full.endsWith('▌') && after.mode === 'LAB' && (await deckCells(p)).join(' │ ') === 'LAB │ snd:off pal:w │ / ?', 'Esc stops it: the answer shows whole, and a moment later the deck is back at rest')
    await p.context().close()
  }

  // ── the dial ─────────────────────────────────────────────────────────────────────────────
  {
    const off = await page(size, '?mode=night')
    if (!phone) { await off.mouse.move(700, 450); await off.mouse.down({ button: 'right' }); await wait(off, 100) }
    ok(await off.evaluate(() => !NIGHT.dial.enabled() && document.querySelector('.dial').hidden), 'off by default: no dial')
    await off.keyboard.press('?')
    await wait(off, 150)
    await off.click('.deckpop [data-do="dial"]')
    ok(await off.evaluate(() => NIGHT.dial.enabled() && /on/.test(document.querySelector('.deckpop [data-do="dial"]').textContent)), 'the "experimental dial" toggle under ? turns it on')
    await off.context().close()

    const p = await page(size, '?mode=night&dial=1')
    if (!phone) {
      await p.mouse.move(640, 420)
      await p.mouse.down({ button: 'right' })
      await wait(p, 60)
      const d = await p.evaluate(() => ({ open: NIGHT.dial.isOpen(), pos: NIGHT.dial.pos(), w: document.querySelector('.dial').getBoundingClientRect().width }))
      ok(d.open && Math.abs(d.pos.x - 640) < 1 && Math.abs(d.pos.y - 420) < 1 && d.w >= 160 && d.w <= 200, `right-click summons a ${d.w}px dial centred on the pointer`)
      await p.mouse.move(650, 421); await wait(p, 60)
      ok(await p.evaluate(() => NIGHT.dial.lit() === null), 'inside the dead zone nothing is lit')
      await p.mouse.move(720, 425); await wait(p, 80)
      const lit = await p.evaluate(() => ({ lit: NIGHT.dial.lit(), needle: document.querySelector('.dial__needle').style.transform, mode: document.querySelector('.dk-m').textContent }))
      ok(lit.lit === 1 && lit.needle === 'rotate(90deg)' && lit.mode === 'DIAL', `pointing east turns the needle to experiments (${lit.needle}), deck mode ${lit.mode}`)
      await p.mouse.move(680, 375); await wait(p, 80)
      ok(await p.evaluate(() => NIGHT.dial.lit() === 1), 'hysteresis: just past the diagonal it holds experiments')
      await p.mouse.up({ button: 'right' })
      await wait(p, 100)
      ok(await p.evaluate(() => !NIGHT.dial.isOpen() && NIGHT.home.cat() === 'experiments'), 'letting go commits: experiments/ opens')
      await p.keyboard.press('Escape')
      await p.mouse.move(500, 300)
      await p.mouse.down({ button: 'right' }); await p.mouse.up({ button: 'right' })
      ok(await p.evaluate(() => NIGHT.dial.isOpen()), 'a right-click let go at once leaves it open')
      await p.mouse.click(500, 300)
      ok(await p.evaluate(() => !NIGHT.dial.isOpen() && NIGHT.home.view() === 'home'), 'a click in the dead zone cancels')
      await p.keyboard.down(' '); await wait(p, 420)
      ok(await p.evaluate(() => NIGHT.dial.isOpen()), 'holding space summons it')
      await p.keyboard.press('4'); await p.keyboard.up(' ')
      await wait(p, 100)
      ok(await p.evaluate(() => !NIGHT.dial.isOpen() && NIGHT.home.cat() === 'writing'), '4 commits writing/')
      await p.keyboard.press('Escape')
      await p.focus('#tile-work')
      await p.keyboard.press(' ')
      await wait(p, 200)
      ok(await p.evaluate(() => !NIGHT.dial.isOpen() && NIGHT.home.cat() === 'work'), 'a short press of space is still space (it pressed the focused tile)')
    } else {
      const cdp = await p.context().newCDPSession(p)
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
      await touch('touchStart', 195, 470); await wait(p, 600)
      ok(await p.evaluate(() => NIGHT.dial.isOpen()), 'a long-press summons it')
      await touch('touchMove', 195, 400); await wait(p, 80)
      ok(await p.evaluate(() => NIGHT.dial.lit() === 0), 'the finger turns it (north: work)')
      await touch('touchEnd'); await wait(p, 100)
      ok(await p.evaluate(() => !NIGHT.dial.isOpen() && NIGHT.home.cat() === 'work'), 'lifting it commits work/')
    }
    await p.context().close()
  }

  // ── the trip: the dock becomes the deck with no jump, wrap or overflow ───────────────────
  {
    const ctx = await b.newContext({ viewport: SIZES.find((s) => s[0] === size)[1], isMobile: phone, hasTouch: phone })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => errors.push(`${size} freeze: ${e.message}`))
    const ts = [...Array.from({ length: 25 }, (_, i) => i / 24), 0.31, 0.33]
    for (const back of [false, true]) {
      const rows = []
      for (const t of ts.sort((x, y) => x - y)) {
        await p.goto(`${base}?freeze=${t}${back ? '&back=1' : ''}`)
        await p.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))
        rows.push(await p.evaluate(() => {
          const panel = document.querySelector('.desk-dock__panel'), r = panel.getBoundingClientRect()
          const kids = [...panel.children].map((k) => k.getBoundingClientRect()).filter((k) => k.width > 0.5)
          const cellsWrap = [...panel.querySelectorAll('.ldock')].some((c) => c.getBoundingClientRect().width > 2 && c.scrollHeight > c.clientHeight + 1)
          return { t: NIGHT.state.t, w: r.width, h: r.height, l: r.left, r: r.right, vw: innerWidth, over: panel.scrollWidth - panel.clientWidth, rows: Math.max(...kids.map((k) => k.top)) < Math.min(...kids.map((k) => k.bottom)) ? 1 : 2, cellsWrap }
        }))
      }
      const w0 = rows[0].w, w1 = rows[rows.length - 1].w, span = Math.abs(w1 - w0)
      const dir = Math.sign(w1 - w0)
      const steps = rows.slice(1).map((x, i) => x.w - rows[i].w)
      const mono = steps.every((d) => d * dir >= -1)
      const inside = rows.every((x) => x.l >= -0.5 && x.r <= x.vw + 0.5)
      const oneRow = rows.every((x) => x.rows === 1 && !x.cellsWrap && x.h <= rows[0].h + 0.5)
      const overDay = rows[0].over
      const over = rows.every((x) => x.over <= overDay + 1)
      ok(mono && inside && oneRow && over,
        `the trip ${back ? 'back' : 'in'}, ${rows.length} frames at ?freeze=t: width ${w0.toFixed(0)} → ${w1.toFixed(0)} px, one way only ${mono}, one row and no cell wraps ${oneRow}, inside the screen ${inside}, no overflow beyond the day dock's own (${overDay} px) ${over}${over ? '' : ' — ' + rows.filter((x) => x.over > overDay + 1).map((x) => `t ${x.t.toFixed(3)}: ${x.over} px`).join(', ')}`)
      // continuity: the same trip scrubbed in 480 steps in the page, and the first and last instant
      const fine = await p.evaluate((back) => {
        const panel = document.querySelector('.desk-dock__panel'), out = []
        for (let i = 0; i <= 480; i++) { NIGHT.scrub(i / 480, back); out.push(panel.getBoundingClientRect().width) }
        NIGHT.scrub(0.0001, back); const a = panel.getBoundingClientRect().width
        NIGHT.scrub(0.9999, back); const z = panel.getBoundingClientRect().width
        return { out, a, z }
      }, back)
      const big = Math.max(...fine.out.slice(1).map((w, i) => Math.abs(w - fine.out[i])))
      ok(big <= 0.08 * span + 2 && Math.abs(fine.a - w0) < 2 && Math.abs(fine.z - w1) < 2,
        `…and scrubbed in 480 steps: the biggest step is ${big.toFixed(1)} px (${((100 * big) / span).toFixed(1)}% of the ${span.toFixed(0)} px morph); at t = 0⁺ it is ${Math.abs(fine.a - w0).toFixed(1)} px from the day dock, at 1⁻ ${Math.abs(fine.z - w1).toFixed(1)} px from the deck`)
    }
    await ctx.close()
  }

  // ── the reader and narration ─────────────────────────────────────────────────────────────
  {
    const p = await page(size, '?mode=night&voice=synth#/writing/old-laptop-cloud', { settle: 1200 })
    const r = await p.evaluate(() => ({ open: NIGHT.reader.isOpen(), toc: document.querySelectorAll('.rd__toc [data-toc]').length, figs: document.querySelectorAll('.rd__page [data-fig]').length, listen: !!document.querySelector('[data-listen]'), cells: [...document.querySelectorAll('.ldock')].filter((x) => x.getBoundingClientRect().width > 2).length, words: document.querySelectorAll('.w[data-w]').length }))
    ok(r.open && r.toc > 2 && r.figs > 0 && r.listen && r.words >= 119, `the reader: the essay, ${r.toc} sections in its TOC, ${r.figs} figures, [▸ listen], ${r.words} words wrapped`)
    ok(r.cells === 3, 'its section is loaded, not played, so the deck stays at rest')
    await p.click('.rd__page [data-fig]')
    await wait(p, 500)
    ok(await p.evaluate(() => !document.querySelector('.lbx').hidden), 'a figure opens in the lightbox')
    await p.keyboard.press('Escape')
    await wait(p, 500)
    await p.click('[data-listen]')
    await wait(p, 2500)
    const s = await p.evaluate(() => ({ playing: NIGHT.voice.state().playing, lit: document.querySelectorAll('.w.is-w').length, mode: document.querySelector('.dk-m').textContent, wave: document.querySelector('.dk-wave').textContent }))
    const cells = await deckCells(p)
    ok(s.playing && s.lit > 0 && s.mode === 'NARRATE', `[▸ listen] plays it in synth: the spoken word is lit, mode ${s.mode}`)
    ok(cells.length === (phone ? 4 : 5) && /◂◂ ❚❚ ▸▸/.test(cells[1]), `the transport and the voice are in the deck while it plays${phone ? ' (the flags step aside on a phone)' : ''}: ${cells.join(' │ ')}`)
    await p.keyboard.press(' ')
    await wait(p, 1800)
    ok(await p.evaluate(() => !NIGHT.voice.state().playing) && (await deckCells(p)).length === (phone ? 4 : 5), 'space pauses it, and the transport stays (▸ has to be somewhere)')
    await p.keyboard.press('Escape')
    await wait(p, 2400)
    ok(await p.evaluate(() => !NIGHT.reader.isOpen()) && (await deckCells(p)).join(' │ ') === 'LAB │ snd:off pal:w │ / ?', 'closing the post unloads it, and the deck slides back to rest')
    await p.context().close()
  }

  // ── the way back, measured; #lab lands in the Lab ────────────────────────────────────────
  {
    const p = await page(size, '?roundtrip=1', { settle: 4200 })
    const badge = await p.evaluate(() => document.querySelector('.proof').textContent)
    ok(/7 of 7 where they were · max Δ 0\.00 px/.test(badge), `round trip: ${badge}`)
    await p.context().close()
    const q = await page(size, '#lab')
    ok(await q.evaluate(() => NIGHT.state.t === 1), '#lab lands straight in the Lab')
    await q.context().close()
  }
}

// ── reduced motion ─────────────────────────────────────────────────────────────────────────
{
  console.log('\nreduced motion')
  const p = await page('desktop', '?mode=night', { reduce: true })
  const a = await p.evaluate(() => [...document.querySelectorAll('.vg')].map((x) => x.textContent).join())
  await p.focus('#tile-work')
  await wait(p, 1200)
  const c = await p.evaluate(() => [...document.querySelectorAll('.vg')].map((x) => x.textContent).join())
  ok(a === c, 'the vignettes are still frames, awake or not')
  await p.click('.hero__go')
  await wait(p, 300)
  ok(await p.evaluate(() => !document.querySelector('.ans__t').textContent.endsWith('▌') && document.querySelector('.ans__t').textContent.length > 40), 'an answer appears whole')
  await p.context().close()
}

ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''))
await b.close()
console.log(fails ? `\n${fails} of ${n} failed` : `\nthe Lab in a browser: all ${n} pass`)
process.exit(fails ? 1 : 0)
