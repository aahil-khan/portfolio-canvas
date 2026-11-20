/*
 * prototype/lab/night-mode/fx.js: the Lab's intro effects. Every visit plays one, picked at random.
 *
 *   NIGHT.fx.list                      [{ id, name, credit }], the pool (six)
 *   NIGHT.fx.frame(id, t, cols, rows, o)  → string: `rows` lines of `cols` characters, joined by \n
 *                                      t is seconds since the effect began. PURE of its arguments
 *                                      (o.seed, o.phase), so ?fx=<id>&hold=<ms> holds any frame
 *                                      and check.mjs can test every one in Node.
 *   NIGHT.fx.alpha(t)                  the fade envelope the intro applies on top (0 → 1 → 0)
 *   NIGHT.fx.pick(last, rnd)           a random id, never the one shown last
 *   NIGHT.fx.DURATION, .STILL          how long one plays (s); the frame reduced motion shows
 *
 * Calm on purpose: nothing strobes, nothing fills the screen with full-ink cells at once, every
 * effect enters and leaves on the same slow envelope. check.mjs measures each one's ink frame to
 * frame (the "nothing flashing" check) at 30 fps.
 *
 * Ideas, all reimplemented here from the technique (no code copied), credited per effect below.
 * The list of candidates came from ~/projects/scratch/lab-finds (finds.md and gallery.html).
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  const DURATION = 2.8, STILL = 1.3
  // a cell is about half as wide as it is tall in a mono face at this line height
  const ASPECT = 0.5

  // small integer hash (the same family as decode.js), and a [0, 1) float from it
  const hash = (a, b, c) => {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return (h ^ (h >>> 16)) >>> 0
  }
  const rnd = (a, b, c) => hash(a, b, c) / 4294967296
  const grid = (cols, rows) => new Array(cols * rows).fill(' ')
  const out = (g, cols) => { let s = ''; for (let i = 0; i < g.length; i += cols) s += (i ? '\n' : '') + g.slice(i, i + cols).join(''); return s }
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
  const smooth = (e0, e1, x) => { const k = clamp((x - e0) / (e1 - e0)); return k * k * (3 - 2 * k) }

  // ── 1. torus: donut.c ───────────────────────────────────────────────────────────────────
  // Idea: Andy Sloane's donut.c and "Donut math" (https://www.a1k0n.net/2011/07/20/donut-math.html):
  // a torus swept by two angles, z-buffered, lit by a fixed light and drawn with a 12-step ramp.
  const RAMP_T = '.,-~:;=!*#$@'
  function torus(t, cols, rows) {
    const g = grid(cols, rows), z = new Float32Array(cols * rows)
    const A = 0.7 + t * 0.85, B = 0.25 + t * 0.42, cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B)
    const R1 = 1, R2 = 2, K2 = 5, K1y = (rows * K2 * 0.34) / (R1 + R2), K1x = K1y / ASPECT
    const dth = Math.min(0.07, 2.4 / rows), dph = dth / 2.6
    for (let th = 0; th < 6.2832; th += dth) {
      const ct = Math.cos(th), st = Math.sin(th)
      for (let ph = 0; ph < 6.2832; ph += dph) {
        const cp = Math.cos(ph), sp = Math.sin(ph)
        const cx = R2 + R1 * ct, cy = R1 * st
        const x = cx * (cB * cp + sA * sB * sp) - cy * cA * sB
        const y = cx * (sB * cp - sA * cB * sp) + cy * cA * cB
        const ooz = 1 / (K2 + cA * cx * sp + cy * sA)
        const xp = Math.floor(cols / 2 + K1x * ooz * x), yp = Math.floor(rows / 2 - K1y * ooz * y)
        if (xp < 0 || xp >= cols || yp < 0 || yp >= rows) continue
        const L = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp)
        const i = yp * cols + xp
        if (L > 0 && ooz > z[i]) { z[i] = ooz; g[i] = RAMP_T[Math.min(11, Math.floor(L * 8))] }
      }
    }
    return out(g, cols)
  }

  // ── 2. warp: a starfield you fly into, slowing to a stop ────────────────────────────────
  // Idea: the classic 3D starfield (The Coding Train, "Starfield", challenge #1, credits it as a
  // classic). Here it only ever decelerates: it ends as still as the Lab's own ASCII sky.
  function warp(t, cols, rows, o) {
    const g = grid(cols, rows), n = Math.round((cols * rows) / 16), seed = o.seed | 0
    const V0 = 0.85, TAU = 0.8
    const d = V0 * TAU * (1 - Math.exp(-t / TAU)), v = V0 * Math.exp(-t / TAU)
    const put = (c, r, ch) => { if (c >= 0 && c < cols && r >= 0 && r < rows && g[r * cols + c] === ' ') g[r * cols + c] = ch }
    for (let k = 0; k < n; k++) {
      const x = rnd(seed, k, 1) * 2 - 1, y = rnd(seed, k, 2) * 2 - 1
      let z = rnd(seed, k, 3) - d
      z = z - Math.floor(z) // recycle: a star you pass comes back from the far end
      z = 0.06 + z * 0.94
      const px = cols / 2 + (x / z) * cols * 0.13, py = rows / 2 + (y / z) * rows * 0.13
      const c = Math.round(px), r = Math.round(py)
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue
      // a short trail behind it while there is speed, pointing back at the centre
      const len = Math.min(3, Math.floor((v / z) * 0.9))
      if (len > 0) {
        const dx = px - cols / 2, dy = (py - rows / 2) / ASPECT, m = Math.hypot(dx, dy) || 1
        const ch = Math.abs(dx / m) > 0.92 ? '-' : Math.abs(dy / m) > 0.92 ? '|' : (dx > 0) === (dy > 0) ? '\\' : '/'
        for (let j = 1; j <= len; j++) put(Math.round(px - (dx / m) * j * 1.2), Math.round(py - ((dy / m) * j * 1.2) * ASPECT), ch)
      }
      g[r * cols + c] = z < 0.22 ? '*' : z < 0.45 ? '+' : z < 0.7 ? ':' : '.'
    }
    return out(g, cols)
  }

  // ── 3. nebula: domain-warped noise, drifting ────────────────────────────────────────────
  // Idea: Inigo Quilez, "Domain warping" (https://iquilezles.org/articles/warp/): fbm whose input
  // is pushed around by more fbm, f(p + f(p + f(p))). Our own value noise and code.
  function vnoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
    const a = rnd(seed, xi, yi), b = rnd(seed, xi + 1, yi), c = rnd(seed, xi, yi + 1), d = rnd(seed, xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  const fbm = (x, y, seed) => { let s = 0, a = 0.5; for (let k = 0; k < 4; k++) { s += a * vnoise(x, y, seed + k * 17); x = x * 2.03 + 3.1; y = y * 2.01 + 1.7; a *= 0.5 } return s / 0.9375 }
  const RAMP_N = ' .:-=+*#%'
  function nebula(t, cols, rows, o) {
    const g = grid(cols, rows), seed = (o.seed | 0) + 5
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c / cols) * 2.3 * (cols * ASPECT / rows), y = (r / rows) * 2.3
      const qx = fbm(x + t * 0.11, y, seed), qy = fbm(x + 5.2, y + 1.3 - t * 0.07, seed)
      const f = fbm(x + 3.2 * qx, y + 3.2 * qy, seed + 3)
      // a soft oval vignette, so the cloud sits in the middle and never touches the frame
      const dx = (c / cols - 0.5) * 2, dy = (r / rows - 0.5) * 2, vig = clamp(1.25 - Math.hypot(dx, dy * 0.9))
      const v = smooth(0.3, 0.95, f) * vig
      const k = Math.floor(v * (RAMP_N.length - 0.001))
      g[r * cols + c] = RAMP_N[k]
    }
    return out(g, cols)
  }

  // ── 4. life: Conway's Game of Life, with an afterglow where cells die ────────────────────
  // Idea: John Conway's 1970 rules (https://conwaylife.com/wiki/); the afterglow ("stars going
  // out") is finds.md #15. Small glyphs, 7 generations a second, a soup in the middle only.
  const lifeCache = new Map()
  function lifeGens(cols, rows, seed, upto) {
    const key = cols + 'x' + rows + ':' + seed
    let gens = lifeCache.get(key)
    if (!gens) {
      const g0 = new Uint8Array(cols * rows)
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const dx = (c / cols - 0.5) * 2, dy = (r / rows - 0.5) * 2
        if (Math.hypot(dx * 1.1, dy) < 0.72 && rnd(seed, c, r) < 0.22) g0[r * cols + c] = 1
      }
      gens = [g0]
      if (lifeCache.size > 8) lifeCache.clear()
      lifeCache.set(key, gens)
    }
    while (gens.length <= upto) {
      const a = gens[gens.length - 1], b = new Uint8Array(cols * rows)
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        let n = 0
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue
          const rr = (r + dr + rows) % rows, cc = (c + dc + cols) % cols
          n += a[rr * cols + cc]
        }
        const i = r * cols + c
        b[i] = n === 3 || (n === 2 && a[i]) ? 1 : 0
      }
      gens.push(b)
    }
    return gens
  }
  function life(t, cols, rows, o) {
    const gen = Math.floor(t * 7), gens = lifeGens(cols, rows, (o.seed | 0) + 9, gen)
    const g = grid(cols, rows), now = gens[gen], p1 = gens[gen - 1], p2 = gens[gen - 2]
    for (let i = 0; i < g.length; i++) g[i] = now[i] ? 'o' : p1 && p1[i] ? '·' : p2 && p2[i] ? '.' : ' '
    return out(g, cols)
  }

  // ── 5. resolve: noise that settles into the word ────────────────────────────────────────
  // The same decode as decode.js, at the size of the screen: random glyphs thin out, and the ones
  // inside the letters resolve, each at its own moment. The 5×5 letters are our own.
  const FONT = {
    l: ['#    ', '#    ', '#    ', '#    ', '#####'],
    a: [' ### ', '#   #', '#####', '#   #', '#   #'],
    b: ['#### ', '#   #', '#### ', '#   #', '#### '],
  }
  const NOISE = '01#%&*+=<>?/|[]{}~^:;$'
  function resolve(t, cols, rows, o) {
    const g = grid(cols, rows), seed = (o.seed | 0) + 13, word = 'lab'
    const pw = word.length * 5 + (word.length - 1) * 2
    const sy = Math.max(1, Math.floor(Math.min((rows * 0.46) / 5, (cols * 0.62 * ASPECT) / pw))), sx = Math.max(1, Math.round(sy / ASPECT))
    const W = pw * sx, H = 5 * sy, x0 = Math.floor((cols - W) / 2), y0 = Math.floor((rows - H) / 2)
    const inLetter = (c, r) => {
      const px = Math.floor((c - x0) / sx), py = Math.floor((r - y0) / sy)
      if (c < x0 || r < y0 || px >= pw || py >= 5) return false
      const li = Math.floor(px / 7), lx = px % 7
      return lx < 5 && FONT[word[li]][py][lx] === '#'
    }
    const tick = Math.floor(t * 8), density = 0.3 * clamp(1 - t / 1.9)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, at = 0.35 + rnd(seed, c, r) * 1.3
      if (inLetter(c, r)) g[i] = t >= at ? '#' : t >= at - 0.5 ? NOISE[hash(seed, i, tick) % NOISE.length] : ' '
      else if (rnd(seed + 1, c, r) < density) g[i] = NOISE[hash(seed, i, tick) % NOISE.length]
    }
    return out(g, cols)
  }

  // ── 6. moonrise: tonight's moon, dithered, coming up over a dotted horizon ───────────────
  // The moon is moon.js (Floyd–Steinberg, after Surma's "Ditherpunk"), packed two pixels to a
  // cell with half blocks (▀ ▄ █), so its pixels stay square in a 1:2 cell.
  const moonCache = new Map()
  function moonrise(t, cols, rows, o) {
    const g = grid(cols, rows)
    const n = Math.max(8, Math.floor(rows * 0.56) * 2) // pixels across = cells across
    // a moon too thin to see would be an empty screen: then it rises full
    const lit = (ph) => (1 - Math.cos(ph * 2 * Math.PI)) / 2
    const phase = o.phase != null && lit(o.phase) > 0.3 ? o.phase : 0.5
    const key = n + ':' + phase.toFixed(3)
    let bits = moonCache.get(key)
    if (!bits) { bits = NIGHT.moonBits ? NIGHT.moonBits(n, phase) : new Uint8Array(n * n); if (moonCache.size > 4) moonCache.clear(); moonCache.set(key, bits) }
    const horizon = Math.floor(rows * 0.8), k = 1 - Math.pow(1 - clamp(t / 2.5), 3)
    const top = Math.round(horizon + 1 - k * (horizon - Math.floor(rows * 0.08)) ), left = Math.floor((cols - n) / 2)
    for (let r = 0; r < horizon; r++) {
      const py = (r - top) * 2
      if (py < -1 || py >= n) continue
      for (let c = 0; c < n; c++) {
        const a = py >= 0 && py < n ? bits[py * n + c] : 0, b = py + 1 >= 0 && py + 1 < n ? bits[(py + 1) * n + c] : 0
        const cc = left + c
        if (cc >= 0 && cc < cols) g[r * cols + cc] = a && b ? '█' : a ? '▀' : b ? '▄' : ' '
      }
    }
    for (let c = 0; c < cols; c += 2) g[horizon * cols + c] = '.'
    // its light on the water: a few dashes under it, more as it climbs
    for (let r = horizon + 2; r < rows; r += 2) for (let c = left; c < left + n; c++) {
      if (c >= 0 && c < cols && rnd(31, c, r) < 0.18 * k * (1 - (r - horizon) / (rows - horizon + 1))) g[r * cols + c] = '-'
    }
    return out(g, cols)
  }

  const FX = {
    torus: { name: 'torus', credit: 'after Andy Sloane, donut.c', run: torus },
    warp: { name: 'warp', credit: 'the classic starfield', run: warp },
    nebula: { name: 'nebula', credit: 'after Inigo Quilez, domain warping', run: nebula },
    life: { name: 'life', credit: "Conway's Game of Life", run: life },
    resolve: { name: 'resolve', credit: 'decode.js, full screen', run: resolve },
    moonrise: { name: 'moonrise', credit: "moon.js, after Surma's Ditherpunk", run: moonrise },
  }
  const ids = Object.keys(FX)
  NIGHT.fx = {
    DURATION, STILL, ids,
    list: ids.map((id) => ({ id, name: FX[id].name, credit: FX[id].credit })),
    frame: (id, t, cols, rows, o = {}) => (FX[id] ? FX[id].run(Math.max(0, t), Math.max(1, cols | 0), Math.max(1, rows | 0), o) : ''),
    // in 0.35 s, out over the last 0.6 s: one slow breath, never a cut
    alpha: (t) => smooth(0, 0.35, t) * (1 - smooth(DURATION - 0.6, DURATION, t)),
    pick: (last, r = Math.random) => { const pool = ids.filter((id) => id !== last); return pool[Math.floor(r() * pool.length) % pool.length] },
  }
})()
