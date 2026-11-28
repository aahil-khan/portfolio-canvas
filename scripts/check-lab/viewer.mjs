/**
 * Rule LB: every image on an entry opens full size. Lane module for scripts/check-lab.mjs (API.md
 * §11). Aahil, 28 Nov: "make images clickable too for full screen just like canvas has".
 *
 * Which entries: every entry route whose page has an image the viewer opens (the body's
 * `img[data-zoom]`, the lead's `[data-lead] img`), found by loading it, never by id (rule 4).
 *
 *   - **JavaScript off is honest**: the server's HTML marks body images `data-zoom` and nothing
 *     else; no image carries the button role, a tab stop or the hint, which only the listener writes.
 *   - **Marked**: with JavaScript on, every such image (outside a link) is `[data-zoom-ready]`, a
 *     button with a label, and its figure carries the hint.
 *   - **On demand**: no script the page loaded before the first open holds the viewer
 *     (`data-lab-viewer`), and one fetched by the first open does.
 *   - **Open** (a click at 1440, a tap at 390): a modal dialog in the Lab's frame (2px edge, a
 *     zero-blur offset, 12px radius), focus inside it, the image's alt as its title, the image's own
 *     `src`, as large as fits and never past its natural size; the page under it does not scroll.
 *   - **Paging**, where an entry has two or more: "1 / n", then ArrowRight, the next button, the
 *     previous button and ArrowLeft past the first (it wraps), each showing that image's `src`; at 390
 *     a one-finger swipe left pages and a two-finger one does not.
 *   - **Close**: Escape, the close button and the scrim each close it, focus goes back to the image
 *     that opened it, and the page scrolls again from the same place.
 *   - **Arrows** (at 390, 1024 and 1440): previous and next never overlap the window's frame. From
 *     600px they sit inside the stage, 14px from its edges; on a phone they are 44px buttons in a row
 *     under the picture, never on it.
 *   - **Themes**: the frame holds in every look of the matrix (Lab Dark, Lab Light, cream,
 *     tokyo-night); with reduced motion the window never travels.
 */
import { builtRoutes, collector, labCopy, openPage, pool } from './layout.mjs'

const MARKER = 'data-lab-viewer'
const SELECTOR = '[data-lead] img, img[data-zoom]'

/** In the page: what the listener marked, and what it should have. */
function SURVEY(sel) {
  const article = document.querySelector('#lab-main article[data-entry]')
  if (!article) return null
  const all = [...article.querySelectorAll(sel)].filter((i) => !i.closest('a[href]'))
  const marked = [...article.querySelectorAll('img[data-zoom-ready]')]
  return {
    candidates: all.length,
    marked: marked.length,
    srcs: marked.map((i) => i.src),
    alts: marked.map((i) => i.alt),
    unlabeled: marked.filter((i) => i.getAttribute('role') !== 'button' || !i.getAttribute('aria-label') || i.tabIndex !== 0).length,
    noHint: marked.filter((i) => i.parentElement?.tagName === 'FIGURE' && !i.parentElement.getAttribute('data-zoom-hint')).length,
    cursor: marked[0] ? getComputedStyle(marked[0]).cursor : null,
  }
}

/** In the page: the open viewer, measured. */
function VIEWER() {
  const v = document.querySelector('[data-lab-viewer]')
  if (!v) return null
  const win = v.querySelector('[data-viewer-win]')
  const img = v.querySelector('[data-viewer-img]')
  const s = getComputedStyle(win)
  const ir = img.getBoundingClientRect()
  const wr = win.getBoundingClientRect()
  return {
    role: v.getAttribute('role'),
    modal: v.getAttribute('aria-modal'),
    title: document.getElementById(v.getAttribute('aria-labelledby') ?? '')?.textContent ?? null,
    count: v.querySelector('[data-viewer-count]')?.textContent ?? null,
    src: img.src,
    natural: [img.naturalWidth, img.naturalHeight],
    shown: [ir.width, ir.height],
    win: [wr.left, wr.top, wr.right, wr.bottom],
    vw: document.documentElement.clientWidth,
    vh: innerHeight,
    focusInside: v.contains(document.activeElement),
    border: [s.borderTopWidth, s.borderTopStyle],
    radius: s.borderTopLeftRadius,
    shadow: s.boxShadow,
    winTransform: s.transform,
    overflow: getComputedStyle(document.documentElement).overflow,
    lenisStopped: window.__lenis ? !!window.__lenis.isStopped : null,
    scrollY,
  }
}

/** In the page: where previous and next sit against the window's frame, the stage and the picture. */
function ARROWS() {
  const v = document.querySelector('[data-lab-viewer]')
  if (!v) return null
  const r = (el) => {
    const b = el.getBoundingClientRect()
    return { l: b.left, t: b.top, r: b.right, b: b.bottom }
  }
  const win = v.querySelector('[data-viewer-win]')
  const edge = parseFloat(getComputedStyle(win).borderTopWidth) || 0
  const w = r(win)
  return {
    inner: { l: w.l + edge, t: w.t + edge, r: w.r - edge, b: w.b - edge },
    stage: r(v.querySelector('[data-viewer-stage]')),
    img: r(v.querySelector('[data-viewer-img]')),
    foot: v.querySelector('[data-viewer-foot]') ? r(v.querySelector('[data-viewer-foot]')) : null,
    arrows: [...v.querySelectorAll('[data-viewer-prev], [data-viewer-next]')].map((a) => ({
      which: a.hasAttribute('data-viewer-prev') ? 'previous' : 'next',
      box: r(a),
      // the offset shadow is part of what the eye reads as the button
      shadow: Math.max(0, ...[...getComputedStyle(a).boxShadow.matchAll(/(-?\d*\.?\d+)px (-?\d*\.?\d+)px 0px/g)].map((m) => Math.max(+m[1], +m[2]))),
      inFoot: !!a.closest('[data-viewer-foot]'),
    })),
  }
}

/** Every same-origin script the page has fetched so far. */
const SCRIPTS = () => performance.getEntriesByType('resource').filter((e) => e.initiatorType === 'script' || /\.js(\?|$)/.test(e.name)).map((e) => e.name)

/** Zero-blur offset shadows only: every shadow's blur radius is 0 and one is offset. */
function hardShadow(shadow) {
  if (!shadow || shadow === 'none') return false
  const parts = shadow.split(/,(?![^(]*\))/).map((p) => p.trim())
  let offset = false
  for (const p of parts) {
    const nums = (p.replace(/rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]+/gi, '').match(/-?\d*\.?\d+px/g) ?? []).map(parseFloat)
    if (p.includes('inset')) continue
    const [x = 0, y = 0, blur = 0] = nums
    if (blur !== 0) return false
    if (x || y) offset = true
  }
  return offset
}

async function scriptHas(ctx, urls, cache) {
  const out = []
  for (const u of urls) {
    if (!cache.has(u)) {
      let text = ''
      try {
        const r = await fetch(u)
        text = r.ok ? await r.text() : ''
      } catch {
        text = ''
      }
      cache.set(u, text.includes(MARKER))
    }
    if (cache.get(u)) out.push(u)
  }
  return out
}

const near = (a, b) => Math.abs(a - b) <= 1

const viewer = {
  id: 'LB',
  title: 'Images open full size: open, close (Esc, Close, the scrim) with focus back, paging by keys, buttons and swipe; the viewer loads on demand',
  needs: ['server', 'browser'],
  async run(ctx) {
    const info = await builtRoutes(ctx)
    if (info.notBuilt) return { notBuilt: info.notBuilt }
    const c = collector(['LB'])
    const copy = labCopy(ctx.root)
    const fill = (s, v) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m))
    const cache = new Map()

    // 1. the server's HTML: which entries have images, and that none pretends to be pressable
    const withImages = []
    await pool(info.entries, 4, async (route) => {
      const { text } = await ctx.get(route.path)
      const article = text.slice(text.indexOf('<article'), text.lastIndexOf('</article>'))
      const imgs = article.match(/<img\b[^>]*>/g) ?? []
      if (!imgs.length) return
      for (const tag of imgs) {
        if (/\b(data-zoom-ready|data-zoom-hint|role="button"|tabindex=|aria-haspopup)/.test(tag))
          c.fail('LB', `${route.path}: the server's HTML already marks an image pressable (${tag.slice(0, 90)}…); only the listener may`)
      }
      if (/<figure\b[^>]*data-zoom-hint/.test(article)) c.fail('LB', `${route.path}: a figure carries the hint in the server's HTML`)
      withImages.push(route)
    })
    if (!withImages.length) {
      c.note('LB', 'no entry has an image yet; nothing to open')
      return c.result('LB')
    }

    // 2. each entry with images, at 1440 (a mouse) and 390 (touch)
    const widths = [1440, 390].filter((w) => ctx.widths.some((x) => x.width === w))
    const jobs = withImages.flatMap((route) => widths.map((width) => ({ route, width })))
    let opened = 0
    let paged = 0
    let swiped = 0
    let onDemand = false
    const multi = new Set()
    await pool(jobs, 2, async ({ route, width }) => {
      const tag = `${route.path} @${width}`
      const o = await openPage(ctx, route.path, { width, query: ctx.looks[0].query })
      const p = o.page
      try {
        // the listener marks images once the page has hydrated, which a loaded machine can delay
        let s = await p.evaluate(SURVEY, SELECTOR)
        for (let t = 0; s && s.candidates && s.marked < s.candidates && t < 50; t++) {
          await p.waitForTimeout(100)
          s = await p.evaluate(SURVEY, SELECTOR)
        }
        if (!s) return c.fail('LB', `${tag}: no #lab-main article[data-entry]`)
        if (!s.candidates) return
        if (s.marked !== s.candidates) c.fail('LB', `${tag}: ${s.marked} of ${s.candidates} images are marked [data-zoom-ready]`)
        if (s.unlabeled) c.fail('LB', `${tag}: ${s.unlabeled} marked image(s) without role=button, an aria-label and tabindex 0`)
        if (s.noHint) c.fail('LB', `${tag}: ${s.noHint} figure(s) without data-zoom-hint`)
        if (width === 1440 && s.cursor !== 'zoom-in') c.fail('LB', `${tag}: a marked image's cursor is "${s.cursor}", not zoom-in`)
        if (!s.marked) return
        const n = s.marked
        if (n > 1) multi.add(route.path)

        // the viewer's chunk is not in the first load
        const before = await p.evaluate(SCRIPTS)
        const early = await scriptHas(ctx, before, cache)
        if (early.length) c.fail('LB', `${tag}: the first load already fetched the viewer (${early[0]})`)

        const img = (i) => p.locator('#lab-main article[data-entry] img[data-zoom-ready]').nth(i)
        const isOpen = () => p.evaluate(() => !!document.querySelector('[data-lab-viewer]'))
        const waitOpen = async (want) => {
          for (let t = 0; t < 40; t++) {
            if ((await isOpen()) === want) return true
            await p.waitForTimeout(50)
          }
          return false
        }
        const activeIs = (i) =>
          p.evaluate((k) => document.activeElement === document.querySelectorAll('#lab-main article[data-entry] img[data-zoom-ready]')[k], i)
        const open = async (i, how) => {
          await img(i).scrollIntoViewIfNeeded()
          await p.waitForTimeout(150)
          if (how === 'tap') await img(i).tap()
          else if (how === 'key') {
            await img(i).focus()
            await p.keyboard.press('Enter')
          } else await img(i).click()
          if (!(await waitOpen(true))) {
            c.fail('LB', `${tag}: ${how === 'key' ? 'Enter on' : how === 'tap' ? 'a tap on' : 'a click on'} image ${i + 1} opened no viewer`)
            return null
          }
          await p.waitForTimeout(260)
          return p.evaluate(VIEWER)
        }

        // open
        const v = await open(0, width < 600 ? 'tap' : 'click')
        if (!v) return
        opened += 1
        const after = await p.evaluate(SCRIPTS)
        const late = await scriptHas(ctx, after.filter((u) => !before.includes(u)), cache)
        if (late.length) onDemand = true
        else c.note('LB', `${tag}: no new script held the viewer on the first open (already cached by this browser?)`)
        if (v.role !== 'dialog' || v.modal !== 'true') c.fail('LB', `${tag}: the viewer is role=${v.role} aria-modal=${v.modal}, not a modal dialog`)
        if (!v.focusInside) c.fail('LB', `${tag}: focus did not move into the viewer`)
        const wantTitle = s.alts[0] || copy.viewerUntitled
        if (v.title?.trim() !== wantTitle) c.fail('LB', `${tag}: the title is "${v.title}", not the image's alt`)
        if (v.src !== s.srcs[0]) c.fail('LB', `${tag}: the viewer shows ${v.src}, not the image's own src ${s.srcs[0]}`)
        if (v.natural[0] && (v.shown[0] > v.natural[0] + 0.5 || v.shown[1] > v.natural[1] + 0.5))
          c.fail('LB', `${tag}: the image shows at ${v.shown.map(Math.round).join('×')}, past its natural ${v.natural.join('×')}`)
        if (v.win[0] < -0.5 || v.win[1] < -0.5 || v.win[2] > v.vw + 0.5 || v.win[3] > v.vh + 0.5)
          c.fail('LB', `${tag}: the viewer's window (${v.win.map(Math.round).join(', ')}) runs off the ${v.vw}×${v.vh} screen`)
        const fits = v.natural[0] && (near(v.shown[0], v.natural[0]) || v.win[2] - v.win[0] >= v.vw - 2 * 24 - 2 || v.win[3] - v.win[1] >= v.vh - 2 * 24 - 2)
        if (v.natural[0] && !fits) c.fail('LB', `${tag}: the image shows at ${v.shown.map(Math.round).join('×')}, smaller than its ${v.natural.join('×')} although the screen has room`)
        if (v.border[0] !== '2px' || v.border[1] !== 'solid') c.fail('LB', `${tag}: the viewer's edge is ${v.border.join(' ')}, not 2px solid`)
        if (v.radius !== '12px') c.fail('LB', `${tag}: the viewer's radius is ${v.radius}, not 12px`)
        if (!hardShadow(v.shadow)) c.fail('LB', `${tag}: the viewer's shadow "${v.shadow}" is not a zero-blur offset`)
        if (v.overflow !== 'hidden') c.fail('LB', `${tag}: the page under the viewer can scroll (html overflow ${v.overflow})`)
        if (v.lenisStopped === false) c.fail('LB', `${tag}: Lenis still runs under the viewer`)
        if (width >= 600) {
          await p.mouse.move(v.vw / 2, v.vh / 2)
          await p.mouse.wheel(0, 700)
          await p.waitForTimeout(300)
          const y = await p.evaluate(() => scrollY)
          if (Math.abs(y - v.scrollY) > 1) c.fail('LB', `${tag}: the wheel scrolled the page under the viewer (${v.scrollY} → ${y})`)
        }

        // paging
        if (n > 1) {
          const at = async (i, how) => {
            await p.waitForTimeout(260)
            const w = await p.evaluate(VIEWER)
            const want = fill(copy.viewerCount, { i: i + 1, n })
            if (w?.count?.trim() !== want) c.fail('LB', `${tag}: after ${how} the count reads "${w?.count}", not "${want}"`)
            if (w?.src !== s.srcs[i]) c.fail('LB', `${tag}: after ${how} the viewer shows ${w?.src}, not image ${i + 1}`)
          }
          await at(0, 'opening')
          await p.keyboard.press('ArrowRight')
          await at(1, 'ArrowRight')
          await p.locator('[data-lab-viewer] [data-viewer-next]').click()
          await at(2 % n, 'the next button')
          await p.locator('[data-lab-viewer] [data-viewer-prev]').click()
          await at(1, 'the previous button')
          await p.keyboard.press('ArrowLeft')
          await at(0, 'ArrowLeft')
          await p.keyboard.press('ArrowLeft')
          await at(n - 1, 'ArrowLeft past the first (it wraps)')
          await p.keyboard.press('ArrowRight')
          await at(0, 'ArrowRight past the last (it wraps)')
          paged += 1
          if (width < 600) {
            const cdp = await p.context().newCDPSession(p)
            const stage = await p.locator('[data-lab-viewer] [data-viewer-stage]').boundingBox()
            const y = stage.y + stage.height / 2
            const stroke = async (fingers, x0, x1) => {
              const pts = (x) => Array.from({ length: fingers }, (_, k) => ({ x, y: y + k * 40, id: k }))
              await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(x0) })
              for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(x0 + ((x1 - x0) * k) / 6) })
              await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
            }
            await stroke(2, stage.x + stage.width * 0.8, stage.x + stage.width * 0.2)
            await at(0, 'a two-finger stroke (a pinch is not a swipe)')
            await stroke(1, stage.x + stage.width * 0.8, stage.x + stage.width * 0.2)
            await at(1, 'a swipe left')
            await stroke(1, stage.x + stage.width * 0.2, stage.x + stage.width * 0.8)
            await at(0, 'a swipe right')
            await cdp.detach()
            swiped += 1
          }
        } else if (v.count) c.fail('LB', `${tag}: a count ("${v.count}") on an entry with one image`)

        // close: Escape, then the close button, then the scrim; focus back to the opener each time
        const closed = async (how, i) => {
          if (!(await waitOpen(false))) return c.fail('LB', `${tag}: ${how} did not close the viewer`)
          await p.waitForTimeout(120)
          if (!(await activeIs(i))) c.fail('LB', `${tag}: after ${how} focus is not back on the image that opened it`)
          const st = await p.evaluate(() => ({ overflow: getComputedStyle(document.documentElement).overflow, y: scrollY, inert: !!document.querySelector('[data-lab] > [inert]') }))
          if (st.overflow === 'hidden') c.fail('LB', `${tag}: after ${how} the page still cannot scroll`)
          if (st.inert) c.fail('LB', `${tag}: after ${how} part of the page is still inert`)
          return st
        }
        await p.keyboard.press('Escape')
        const st = await closed('Escape', 0)
        if (st && Math.abs(st.y - v.scrollY) > 1) c.fail('LB', `${tag}: closing moved the page (${v.scrollY} → ${st.y})`)
        const last = n - 1
        if (await open(last, width < 600 ? 'tap' : 'key')) {
          await p.locator('[data-lab-viewer] [data-viewer-close]').click()
          await closed('the close button', last)
        }
        if (await open(0, width < 600 ? 'tap' : 'click')) {
          const w = await p.evaluate(VIEWER)
          // a corner of the scrim, outside the window
          await p.mouse.click(Math.max(2, w.win[0] / 2), Math.max(2, w.win[1] / 2))
          await closed('a click on the scrim', 0)
        }
        const errs = o.errors.filter((e) => !/favicon|Failed to load resource/.test(e))
        if (errs.length) c.fail('LB', `${tag}: page errors: ${errs.slice(0, 2).join(' | ')}`)
      } catch (e) {
        c.fail('LB', `${tag}: threw ${e.message.split('\n')[0]}`)
      } finally {
        await o.close()
      }
    })
    if (opened && !onDemand) c.fail('LB', 'no first open fetched a script holding the viewer: is it in the first load, or not split out?')

    // 3. every look keeps the frame; reduced motion never moves the window
    const first = withImages[0]
    const looks = ctx.looks.slice(1)
    await pool(
      [...looks.map((look) => ({ look, reduced: false })), { look: ctx.looks[0], reduced: true }],
      2,
      async ({ look, reduced }) => {
        const tag = `${first.path} @1440 ${look.name}${reduced ? ' reduced motion' : ''}`
        const o = await openPage(ctx, first.path, { width: 1440, query: look.query, reduced })
        const p = o.page
        try {
          await p.waitForSelector('#lab-main article[data-entry] img[data-zoom-ready]', { timeout: 5000 })
          const im = p.locator('#lab-main article[data-entry] img[data-zoom-ready]').first()
          await im.scrollIntoViewIfNeeded()
          await p.waitForTimeout(100)
          if (reduced) {
            await p.evaluate(() => {
              window.__moves = []
              const tick = () => {
                const w = document.querySelector('[data-lab-viewer] [data-viewer-win]')
                if (w) window.__moves.push(getComputedStyle(w).transform)
                if (window.__moves.length < 30) requestAnimationFrame(tick)
              }
              requestAnimationFrame(tick)
            })
          }
          await im.click()
          await p.waitForTimeout(400)
          const v = await p.evaluate(VIEWER)
          if (!v) return c.fail('LB', `${tag}: a click opened no viewer`)
          if (v.border[0] !== '2px') c.fail('LB', `${tag}: the viewer's edge is ${v.border[0]}, not 2px`)
          if (!hardShadow(v.shadow)) c.fail('LB', `${tag}: the viewer's shadow "${v.shadow}" is not a zero-blur offset`)
          if (reduced) {
            const moves = (await p.evaluate(() => window.__moves)).filter((t) => t && t !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(t))
            if (moves.length) c.fail('LB', `${tag}: the window travelled under reduced motion (${moves[0]})`)
          }
          await p.keyboard.press('Escape')
        } catch (e) {
          c.fail('LB', `${tag}: threw ${e.message.split('\n')[0]}`)
        } finally {
          await o.close()
        }
      },
    )

    // 4. previous and next never touch the frame: inside the stage 14px from its edges, or on a
    //    phone in the row under the picture, off it
    const geoRoute = [...multi][0]
    const geoWidths = [390, 1024, 1440]
    if (!geoRoute) c.note('LB', 'no entry has two images: the arrow placement waits')
    else
      await pool(geoWidths, 2, async (width) => {
        const tag = `${geoRoute} @${width} arrows`
        const o = await openPage(ctx, geoRoute, { width, query: ctx.looks[0].query })
        const p = o.page
        try {
          await p.waitForSelector('#lab-main article[data-entry] img[data-zoom-ready]', { timeout: 5000 })
          const im = p.locator('#lab-main article[data-entry] img[data-zoom-ready]').first()
          await im.scrollIntoViewIfNeeded()
          await p.waitForTimeout(150)
          if (width < 600) await im.tap()
          else await im.click()
          await p.waitForTimeout(450)
          const g = await p.evaluate(ARROWS)
          if (!g) return c.fail('LB', `${tag}: no viewer opened`)
          if (g.arrows.length !== 2) return c.fail('LB', `${tag}: ${g.arrows.length} arrow buttons, not 2`)
          const px = (b) => [b.l, b.t, b.r, b.b].map(Math.round).join(',')
          for (const a of g.arrows) {
            const b = a.box
            const out = b.l < g.inner.l - 0.5 || b.t < g.inner.t - 0.5 || b.r + a.shadow > g.inner.r + 0.5 || b.b + a.shadow > g.inner.b + 0.5
            if (out) c.fail('LB', `${tag}: ${a.which} (${px(b)}, shadow ${a.shadow}px) overlaps the frame (inside ${px(g.inner)})`)
            const overImg = b.l < g.img.r && b.r > g.img.l && b.t < g.img.b && b.b > g.img.t
            if (width < 600) {
              if (!a.inFoot) c.fail('LB', `${tag}: ${a.which} is not in the row under the picture ([data-viewer-foot])`)
              if (overImg) c.fail('LB', `${tag}: ${a.which} (${px(b)}) covers the picture (${px(g.img)})`)
              if (b.r - b.l < 44 - 0.5 || b.b - b.t < 44 - 0.5) c.fail('LB', `${tag}: ${a.which} is ${Math.round(b.r - b.l)}×${Math.round(b.b - b.t)}, under 44×44`)
            } else {
              if (a.inFoot || g.foot) c.fail('LB', `${tag}: the phone's row shows at ${width}`)
              const gap = a.which === 'previous' ? b.l - g.stage.l : g.stage.r - b.r
              if (Math.abs(gap - 14) > 1) c.fail('LB', `${tag}: ${a.which} sits ${Math.round(gap)}px from the stage's edge, not 14px`)
              if (b.t < g.stage.t - 0.5 || b.b + a.shadow > g.stage.b + 0.5) c.fail('LB', `${tag}: ${a.which} runs out of the stage vertically`)
            }
          }
          if (width < 600 && g.foot && g.foot.t < g.img.b - 0.5) c.fail('LB', `${tag}: the row starts above the picture's bottom`)
        } catch (e) {
          c.fail('LB', `${tag}: threw ${e.message.split('\n')[0]}`)
        } finally {
          await o.close()
        }
      })

    c.note('LB', `${withImages.length} entries with images; opened ${opened}, paged ${paged}, swiped ${swiped}; looks ${ctx.looks.map((l) => l.name).join(', ')}`)
    if (!opened) c.fail('LB', 'no viewer opened on any entry')
    return c.result('LB')
  },
}

export default viewer
