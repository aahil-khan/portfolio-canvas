/**
 * Rule J: with JavaScript disabled, every route is complete. Lane module for scripts/check-lab.mjs
 * (API.md §11). Non-negotiable 5 for `/`, and the same promise for the Lab.
 *
 * Routes: `/` and every Lab route `scripts/lab-routes.ts` lists, so a new entry is covered with no
 * edit here. A route that does not answer 200 with HTML yet is skipped, with a note. Each at 390
 * and 1440. (The plan's other pages join this list when they are built; the route list is the
 * place to add them.)
 *
 * With JavaScript off:
 *   - **every paragraph**: each run of text in `main` that the page lays out with JavaScript on is
 *     laid out and visible with it off. Laid-out-with-JS-on ignores opacity and visibility, since
 *     entry reveals start transparent; text hidden at that width with JS on too is responsive
 *     layout, not a JS dependence. Text inside controls is a label, not content, and is skipped
 *     (a phone's "Show details" exists only where its toggle can work), and so is text marked
 *     `aria-hidden`, which declares itself decoration (the back-to-top arrow).
 *   - **nothing hidden**: no text is laid out but transparent or `visibility: hidden` (a reveal
 *     that waits for a script that never runs).
 *   - **no dead control**: nothing visible looks pressable and needs a script to work — a
 *     `<button>` outside a form, `[role=button]`, `a[href="#"]`, `javascript:` links, an `<a>`
 *     with no href. `<summary>` and form submits work without JS and are fine. Gate a JS-only
 *     control on `@media (scripting: none)` (or `(scripting: enabled)`), as `/` does.
 *
 * Numbers are compared as `#`, so a clock or a count that a script refreshes is not a difference.
 */

const WIDTHS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]
const LIMIT = 12


/** Runs in the page: every run of text and every control, with what the browser makes of each. */
function survey() {
  const scope = document.querySelector('main') ?? document.body
  const SKIP = 'script, style, noscript, template, [hidden], [aria-hidden="true"], details:not([open]) > :not(summary), button, [role="button"], select'
  const norm = (s) => s.replace(/\s+/g, ' ').trim().replace(/\d/g, '#')
  const opaque = (el) => {
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false
    // checkVisibility's opacity test is per element; a transparent ancestor hides it all the same
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < 0.01) return false
    return true
  }
  const range = document.createRange()
  const texts = []
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
  for (let n; (n = walker.nextNode()); ) {
    const text = norm(n.data)
    const el = n.parentElement
    if (!text || !el || el.closest(SKIP)) continue
    range.selectNodeContents(n)
    const box = [...range.getClientRects()].some((r) => r.width >= 1 && r.height >= 1)
    const laidOut = box && el.checkVisibility()
    const block = el.closest('p, li, h1, h2, h3, h4, h5, h6, dt, dd, figcaption, blockquote, pre, td, th, a, div, section') ?? el
    texts.push({ text, laidOut, seen: laidOut && opaque(el), tag: block.tagName.toLowerCase() })
  }

  const seen = (el) => {
    const r = el.getBoundingClientRect()
    return r.width >= 1 && r.height >= 1 && opaque(el)
  }
  const dead = []
  for (const el of document.querySelectorAll('button, [role="button"], a')) {
    if (!seen(el) || el.closest('[inert]')) continue
    const name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50)
    const what = `<${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? ` class="${el.className}"` : ''}> "${name}"`
    if (el.tagName === 'BUTTON') {
      if (el.disabled) continue
      const type = (el.getAttribute('type') || 'submit').toLowerCase()
      if (el.form && (type === 'submit' || type === 'reset')) continue
      dead.push(what)
    } else if (el.tagName === 'A') {
      const href = el.getAttribute('href')
      if (href === null) {
        if (el.getAttribute('role') === 'button' || el.hasAttribute('tabindex')) dead.push(what)
      } else if (href === '#' || /^javascript:/i.test(href)) dead.push(what)
    } else if (el.tagName !== 'SUMMARY') dead.push(what)
  }
  return { texts, dead }
}

async function routesToCheck(ctx, notes) {
  const paths = ['/', ...ctx.lab.routes.map((r) => r.path)]
  if (!ctx.lab.built) notes.push('no Lab loaders yet (PR 2): checking / only')
  const skipped = []
  const out = []
  for (const p of [...new Set(paths)]) {
    const res = await ctx.get(p)
    const html = /^text\/html/.test(res.headers.get('content-type') ?? '')
    if (res.status === 200 && html) out.push(p)
    else skipped.push(`${p} (${res.status}${html ? '' : ', not HTML'})`)
  }
  if (skipped.length) notes.push(`${skipped.length} route${skipped.length === 1 ? '' : 's'} not answering yet, skipped: ${skipped.slice(0, 4).join(', ')}${skipped.length > 4 ? ', …' : ''}`)
  return out
}

const nojs = {
  id: 'J',
  title: 'JavaScript off: every route complete, nothing hidden, no dead control',
  needs: ['server', 'browser'],
  async run(ctx) {
    const fail = []
    const notes = []
    const routes = await routesToCheck(ctx, notes)
    for (const p of routes) {
      for (const w of WIDTHS) {
        const tag = `${p} at ${w.width}`
        const look = async (js) => {
          const { page, close } = await ctx.page(null, { viewport: w, javaScriptEnabled: js, reducedMotion: 'reduce' })
          await page.goto(ctx.base + p, { waitUntil: 'networkidle' })
          const s = await page.evaluate(survey)
          await close()
          return s
        }
        const off = await look(false)
        const on = await look(true)

        const visibleOff = new Set(off.texts.filter((t) => t.seen).map((t) => t.text))
        const missing = [...new Set(on.texts.filter((t) => t.laidOut).map((t) => t.text))].filter((t) => !visibleOff.has(t))
        for (const t of missing.slice(0, LIMIT)) fail.push(`${tag}: shown with JS, missing or hidden without it: "${t.slice(0, 80)}"`)
        if (missing.length > LIMIT) fail.push(`${tag}: …and ${missing.length - LIMIT} more runs of text missing without JS`)

        const transparent = off.texts.filter((t) => t.laidOut && !t.seen)
        for (const t of transparent.slice(0, LIMIT)) fail.push(`${tag}: text in a <${t.tag}> is laid out but invisible without JS: "${t.text.slice(0, 80)}"`)
        if (transparent.length > LIMIT) fail.push(`${tag}: …and ${transparent.length - LIMIT} more invisible runs of text`)
        if (!off.texts.some((t) => t.seen)) fail.push(`${tag}: no visible text at all without JS`)

        for (const d of off.dead) fail.push(`${tag}: a control that needs JS is visible without it: ${d}`)
      }
    }
    notes.push(`${routes.length} route${routes.length === 1 ? '' : 's'} at ${WIDTHS.map((w) => w.width).join(' and ')}: ${routes.join(', ')}`)
    return { fail, notes }
  },
}

export default nojs
