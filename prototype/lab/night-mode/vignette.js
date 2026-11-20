/*
 * prototype/lab/night-mode/vignette.js: THE LIVING TILES' little pictures. Each category has a
 * looping ASCII vignette that suits it, 16 columns by 6 rows, the same size in every frame:
 *
 *   work         a little machine: a gear turning a smaller one, a belt running under them
 *   experiments  a flask, bubbling: bubbles rise through the liquid, out of the neck
 *   research     an oscilloscope: a trace scrolling across a framed screen
 *   writing      a cursor typing a line; a finished line joins the ones above it
 *
 * Plain ASCII only, so every glyph is the same width in any monospace face (no box drawing).
 * Every frame is a pure function of a frame number (and, for writing, of the lines it types), so
 * check.mjs draws them in Node: same size every frame, a loop that comes back round, no frame
 * empty. Plus the rows' status glyph: ◐ ◓ ◑ ◒ for something in progress.
 *
 * THE RUNNER, one for the page: one rAF loop, and each vignette steps on its own clock. At rest a
 * frame every 700 ms (calm); awake (hovered or focused) every 110 ms and brighter, which is CSS
 * (.is-awake). Nothing runs off screen (IntersectionObserver), in a hidden tab, outside the Lab,
 * or under reduced motion (LAB.sky.reduced, the one owner): there a vignette is its first frame,
 * and still. Nothing flashes: a frame changes a few characters, and the cursor never blinks.
 *
 *   NIGHT.vignette.frame(kind, f, lines?)   → string, 6 lines of 16
 *   NIGHT.vignette.spin(f)                  → ◐ ◓ ◑ ◒
 *   NIGHT.vignette.attach(node, kind, { lines, awake })  → { wake(on), detach() }
 *   NIGHT.vignette.live(on)                 the Lab is (or is not) on screen
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  const W = 16, H = 6
  const grid = () => Array.from({ length: H }, () => Array(W).fill(' '))
  const put = (g, r, c, s) => { for (let i = 0; i < s.length; i++) if (c + i >= 0 && c + i < W && r >= 0 && r < H) g[r][c + i] = s[i] }
  const out = (g) => g.map((r) => r.join('')).join('\n')
  const mod = (a, n) => ((a % n) + n) % n

  // work: a gear (spokes + and × in turn, its teeth walking round), meshing with a small one that
  // turns the other way, and a belt under both
  function work(f) {
    const g = grid(), p = mod(f, 4)
    const top = ["  .-'-.  ", "  '-.-'  "], bot = ["  '-.-'  ", "  .-'-.  "]
    put(g, 0, 0, top[(p >> 1) % 2])
    put(g, 1, 0, ' /     \\ ')
    put(g, 2, 0, '|   o   |')
    put(g, 3, 0, ' \\     / ')
    put(g, 4, 0, bot[(p >> 1) % 2])
    if (p % 2 === 0) { put(g, 1, 4, '|'); put(g, 2, 2, '--'); put(g, 2, 5, '--'); put(g, 3, 4, '|') }
    else { put(g, 1, 3, '\\'); put(g, 1, 5, '/'); put(g, 3, 3, '/'); put(g, 3, 5, '\\') }
    put(g, 2, 9, p % 2 ? '=' : '-')
    put(g, 1, 10, p % 2 ? ' .-. ' : " .'. ")
    put(g, 2, 10, `( ${'x+'[p % 2]} )`)
    put(g, 3, 10, p % 2 ? " '-' " : " '.' ")
    // the belt: a pattern sliding right, one cell a frame
    const belt = '=---'
    for (let c = 1; c < W - 1; c++) g[5][c] = belt[mod(c - f, belt.length)]
    g[5][0] = '('; g[5][W - 1] = ')'
    return out(g)
  }

  // experiments: a flask; bubbles start in the liquid, rise, squeeze through the neck, and pop
  const TRACKS = [{ x: 5, ph: 0 }, { x: 9, ph: 3 }, { x: 7, ph: 5 }, { x: 11, ph: 2 }]
  function experiments(f) {
    const g = grid()
    put(g, 1, 6, '|  |')
    put(g, 2, 5, '/    \\')
    put(g, 3, 4, '/' + (mod(f, 2) ? '~-~-~-' : '-~-~-~') + '\\')
    put(g, 4, 3, '/        \\')
    put(g, 5, 2, "'----------'")
    for (const t of TRACKS) {
      const age = mod(f + t.ph, 7) // 0..6: rows 4 → 0, then two frames gone
      const r = 4 - age
      if (r < 0) continue
      const x = r <= 2 ? 7 + (t.x > 7 ? 1 : 0) : t.x // through the neck
      const ch = r === 4 ? '.' : r === 3 ? 'o' : r === 0 ? '*' : 'O'
      if (r === 0 || g[r][x] === ' ' || r === 3) g[r][x] = ch
    }
    return out(g)
  }

  // research: a framed screen; the trace is two sines, drawn at 9 heights (3 rows × ‾ - _)
  const LV = ["'", '-', '_']
  function research(f) {
    const g = grid()
    put(g, 0, 0, '.' + '-'.repeat(W - 2) + '.')
    for (let r = 1; r <= 3; r++) { g[r][0] = '|'; g[r][W - 1] = '|' }
    put(g, 4, 0, "'" + '-'.repeat(W - 2) + "'")
    for (let c = 1; c < W - 1; c++) {
      const x = c + f * 0.9
      const v = 0.75 * Math.sin(x * 0.62) + 0.25 * Math.sin(x * 1.9 + 1)
      const i = Math.max(0, Math.min(8, Math.round(((1 - v) / 2) * 8)))
      g[1 + Math.floor(i / 3)][c] = LV[i % 3]
    }
    put(g, 5, 1, `ch1 ${'o*'[mod(f >> 2, 2)]}   2ms/div`)
    return out(g)
  }

  // writing: a page; the cursor types the current line a letter a frame, holds, and the finished
  // line joins the squiggles above it
  const HOLD = 5
  function writing(f, lines = ['a line']) {
    const L = lines.length ? lines.map((l) => String(l).toLowerCase().slice(0, W - 5)) : ['…']
    const lens = L.map((l) => l.length + HOLD), cycle = lens.reduce((a, b) => a + b, 0)
    let c = mod(f, cycle), i = 0
    while (c >= lens[i]) { c -= lens[i]; i++ }
    const g = grid()
    put(g, 0, 0, '.' + '-'.repeat(W - 2) + '.')
    for (let r = 1; r <= 4; r++) { g[r][0] = '|'; g[r][W - 1] = '|' }
    put(g, 5, 0, "'" + '-'.repeat(W - 2) + "'")
    // the two lines before this one, as squiggles of their own length
    for (let k = 1; k <= 2; k++) {
      const prev = L[mod(i - (3 - k), L.length)]
      put(g, k, 2, prev.replace(/\S/g, '~'))
    }
    const typed = L[i].slice(0, Math.min(c, L[i].length))
    put(g, 3, 2, typed + '_')
    return out(g)
  }

  const KINDS = { work, experiments, research, writing }
  const SPIN = '◐◓◑◒'
  const V = (NIGHT.vignette = {
    W, H,
    kinds: Object.keys(KINDS),
    frame: (kind, f, lines) => KINDS[kind](f, lines),
    spin: (f) => SPIN[mod(f, 4)],
    // how many frames before each loop comes back round (writing: depends on its lines)
    period: (kind, lines) => kind === 'work' ? 12 : kind === 'experiments' ? 14 : kind === 'research' ? 0 : (lines || []).reduce((a, l) => a + Math.min(l.length, W - 5) + HOLD, 0),
    REST: 700, AWAKE: 110,
  })
  if (typeof document === 'undefined') return

  // ── the runner ───────────────────────────────────────────────────────────────────────────
  const all = new Set()
  let raf = 0, live = false
  const reduced = () => root_.LAB && root_.LAB.sky && root_.LAB.sky.reduced
  const io = 'IntersectionObserver' in root_ ? new IntersectionObserver((es) => { for (const e of es) { const h = e.target.__vg; if (h) h.seen = e.isIntersecting } kick() }) : null
  function draw(h) {
    const txt = h.kind === 'spin' ? V.spin(h.f) : V.frame(h.kind, h.f, h.lines)
    if (h.node.textContent !== txt) h.node.textContent = txt
  }
  function tick(now) {
    raf = 0
    if (!running()) return
    for (const h of all) {
      if (!h.seen) continue
      const every = h.awake ? V.AWAKE : V.REST
      if (now - h.last >= every) { h.last = now; h.f++; draw(h) }
    }
    raf = requestAnimationFrame(tick)
  }
  const running = () => live && !document.hidden && !reduced() && all.size > 0
  function kick() { if (running() && !raf) raf = requestAnimationFrame(tick) }
  V.attach = (node, kind, { lines = [], awake = false } = {}) => {
    const h = { node, kind, lines, awake, f: 0, last: 0, seen: !io }
    node.__vg = h
    all.add(h)
    if (io) io.observe(node)
    draw(h)
    kick()
    return {
      wake: (on) => { h.awake = !!on; if (on) h.last = 0; kick() },
      detach: () => { all.delete(h); if (io) io.unobserve(node) },
      get f() { return h.f },
    }
  }
  // a re-render replaced the nodes: forget the ones that left the page
  V.prune = () => { for (const h of [...all]) if (!h.node.isConnected) { all.delete(h); if (io) io.unobserve(h.node) } }
  V.live = (on) => { live = !!on; if (!live) { cancelAnimationFrame(raf); raf = 0 } else kick() }
  V.running = () => running() && !!raf
  document.addEventListener('visibilitychange', kick)
})()
