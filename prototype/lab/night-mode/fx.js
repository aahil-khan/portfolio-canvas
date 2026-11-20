/*
 * prototype/lab/night-mode/fx.js: the Lab's toys, as pure renderers. toy.js owns the state, the
 * input and the clock; everything here is a function of its arguments, so check.mjs can run every
 * toy in Node and ?fx=<id> draws the same frame every time.
 *
 *   NIGHT.fx.list                         [{ id, name, credit, hint }], the pool (five)
 *   NIGHT.fx.ids                          ['donut', 'warp', 'life', 'nebula', 'moon']
 *   NIGHT.fx.init(id, cols, rows, seed)   → a fresh state for that toy
 *   NIGHT.fx.step(id, s, dt, input)       → the next state, dt in seconds (input: what the pointer
 *                                         or keys did since the last step, toy.js's shape)
 *   NIGHT.fx.draw(id, s, cols, rows)      → string: `rows` lines of `cols` characters, joined by \n
 *   NIGHT.fx.pick(last, rnd)              a random id, never the one shown last
 *
 * Calm on purpose: nothing strobes, nothing fills the box with full-ink cells, and every toy left
 * alone settles into slow drift (the donut coasts down to an idle spin, the warp to a cruise).
 * check.mjs measures each one's ink frame to frame at 30 fps, idle and under input.
 *
 * Ideas, all reimplemented here from the technique (no code copied), credited per toy below.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  // a cell is about half as wide as it is tall in a mono face at this line height
  const ASPECT = 0.5

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
  const decay = (v, rate, dt) => v * Math.exp(-rate * dt)

  // ── donut: drag to spin it, and it coasts ───────────────────────────────────────────────
  // Idea: Andy Sloane's donut.c and "Donut math" (https://www.a1k0n.net/2011/07/20/donut-math.html):
  // a torus swept by two angles, z-buffered, lit by a fixed light, drawn with a 12-step ramp.
  // The two angles are the state; a drag sets their velocity, friction brings it back to idle.
  const RAMP_T = '.,-~:;=!*#$@'
  const IDLE = { a: 0.5, b: 0.22 } // rad/s, left alone
  function torus(A, B, cols, rows) {
    const g = grid(cols, rows), z = new Float32Array(cols * rows)
    const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B)
    const R1 = 1, R2 = 2, K2 = 5, K1y = Math.min(rows * K2 * 0.34, cols * ASPECT * K2 * 0.34) / (R1 + R2), K1x = K1y / ASPECT
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
  const donut = {
    init: () => ({ A: 0.9, B: 0.4, va: IDLE.a, vb: IDLE.b }),
    // a drag is cells moved since the last step; while held, the angles follow the pointer exactly
    step: (s, dt, i = {}) => {
      if (i.held) {
        const da = (i.dy || 0) * 0.09, db = (i.dx || 0) * 0.045
        const k = dt > 0 ? 1 / Math.max(dt, 1 / 60) : 0
        return { A: s.A + da, B: s.B + db, va: da * k * 0.6 + s.va * 0.4, vb: db * k * 0.6 + s.vb * 0.4 }
      }
      // inertia: velocity relaxes towards the idle spin; capped so a flick never blurs into noise
      const cap = (v) => clamp(v, -6, 6)
      const va = cap(IDLE.a + decay(s.va - IDLE.a, 1.6, dt)), vb = cap(IDLE.b + decay(s.vb - IDLE.b, 1.6, dt))
      return { A: s.A + va * dt, B: s.B + vb * dt, va, vb }
    },
    draw: (s, cols, rows) => torus(s.A, s.B, cols, rows),
  }

  // ── warp: a starfield you steer ─────────────────────────────────────────────────────────
  // Idea: the classic 3D starfield (The Coding Train, "Starfield", challenge #1, credits it as a
  // classic). The pointer's offset from the middle of the box is where you are heading: the stars
  // stream away from that point instead of from the centre.
  const warp = {
    init: (cols, rows, seed = 3) => {
      const n = Math.max(24, Math.round((cols * rows) / 10)), stars = []
      for (let k = 0; k < n; k++) stars.push({ x: rnd(seed, k, 1) * 2 - 1, y: rnd(seed, k, 2) * 2 - 1, z: 0.06 + rnd(seed, k, 3) * 0.94 })
      return { stars, hx: 0, hy: 0, v: 0.3, seed, k: n }
    },
    // input.aim: { x, y } in −1…1 (the pointer over the box), or null; it eases there
    step: (s, dt, i = {}) => {
      const aim = i.aim || { x: 0, y: 0 }, f = 1 - Math.exp(-3 * dt)
      const hx = s.hx + (aim.x - s.hx) * f, hy = s.hy + (aim.y - s.hy) * f
      const vt = i.aim ? 0.55 : 0.3, v = s.v + (vt - s.v) * f
      let k = s.k
      const stars = s.stars.map((p) => {
        // flying towards (hx, hy): everything drifts the other way, more the nearer it is
        let z = p.z - v * dt, x = p.x - hx * v * dt * 1.6, y = p.y - hy * v * dt * 1.6
        if (z < 0.06 || Math.abs(x / z) > 9 || Math.abs(y / z) > 9) { k++; return { x: rnd(s.seed, k, 1) * 2 - 1, y: rnd(s.seed, k, 2) * 2 - 1, z: 0.7 + rnd(s.seed, k, 3) * 0.3 } }
        return { x, y, z }
      })
      return { stars, hx, hy, v, seed: s.seed, k }
    },
    draw: (s, cols, rows) => {
      const g = grid(cols, rows)
      const cx = cols / 2 + s.hx * cols * 0.3, cy = rows / 2 + s.hy * rows * 0.3
      const put = (c, r, ch) => { if (c >= 0 && c < cols && r >= 0 && r < rows && g[r * cols + c] === ' ') g[r * cols + c] = ch }
      for (const p of s.stars) {
        const px = cx + (p.x / p.z) * cols * 0.16, py = cy + (p.y / p.z) * rows * 0.16
        const c = Math.round(px), r = Math.round(py)
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue
        // a short trail, pointing back at the vanishing point, while there is speed
        const len = Math.min(2, Math.floor((s.v / p.z) * 0.9))
        if (len > 0) {
          const dx = px - cx, dy = (py - cy) / ASPECT, m = Math.hypot(dx, dy) || 1
          const ch = Math.abs(dx / m) > 0.92 ? '-' : Math.abs(dy / m) > 0.92 ? '|' : (dx > 0) === (dy > 0) ? '\\' : '/'
          for (let j = 1; j <= len; j++) put(Math.round(px - (dx / m) * j * 1.2), Math.round(py - (dy / m) * j * 1.2 * ASPECT), ch)
        }
        g[r * cols + c] = p.z < 0.3 ? '*' : p.z < 0.55 ? '+' : p.z < 0.8 ? ':' : '.'
      }
      return out(g, cols)
    },
  }

  // ── life: Conway's Game of Life; click a cell to flip it, r to reseed ───────────────────
  // Idea: John Conway's 1970 rules (https://conwaylife.com/wiki/), on a torus; the afterglow where
  // cells die ("stars going out") is finds.md #15. Six generations a second.
  const GEN = 1 / 6
  const soup = (cols, rows, seed) => {
    const a = new Uint8Array(cols * rows)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const dx = (c / cols - 0.5) * 2, dy = (r / rows - 0.5) * 2
      if (Math.hypot(dx * 1.1, dy) < 0.8 && rnd(seed, c, r) < 0.2) a[r * cols + c] = 1
    }
    return a
  }
  const gen = (a, cols, rows) => {
    const b = new Uint8Array(cols * rows)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let n = 0
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue
        n += a[((r + dr + rows) % rows) * cols + ((c + dc + cols) % cols)]
      }
      const i = r * cols + c
      b[i] = n === 3 || (n === 2 && a[i]) ? 1 : 0
    }
    return b
  }
  const life = {
    init: (cols, rows, seed = 9) => { const a = soup(cols, rows, seed); return { a, p1: null, p2: null, acc: 0, n: 0, seed, cols, rows } },
    // input.flip: [[col, row], ...] cells to toggle; input.reseed: true; input.paused: no generations
    step: (s, dt, i = {}) => {
      let { a, p1, p2, acc, n, seed } = s
      const { cols, rows } = s
      if (i.reseed) { seed = (seed * 31 + 7) % 100003; a = soup(cols, rows, seed); p1 = p2 = null; acc = 0 }
      if (i.flip && i.flip.length) { a = a.slice(); for (const [c, r] of i.flip) if (c >= 0 && c < cols && r >= 0 && r < rows) a[r * cols + c] ^= 1 }
      if (!i.paused) {
        acc += dt
        while (acc >= GEN) { acc -= GEN; p2 = p1; p1 = a; a = gen(a, cols, rows); n++ }
        // a soup that has died out reseeds itself after a beat, so the box is never empty for long
        if (n > 0 && !a.some(Boolean) && !(p1 && p1.some(Boolean))) { seed = (seed * 31 + 7) % 100003; a = soup(cols, rows, seed) }
      }
      return { a, p1, p2, acc, n, seed, cols, rows }
    },
    draw: (s, cols, rows) => {
      const g = grid(cols, rows)
      if (s.cols !== cols || s.rows !== rows) return out(g, cols)
      for (let k = 0; k < g.length; k++) g[k] = s.a[k] ? 'o' : s.p1 && s.p1[k] ? '·' : s.p2 && s.p2[k] ? '.' : ' '
      return out(g, cols)
    },
  }

  // ── nebula: domain-warped noise; the pointer stirs it ───────────────────────────────────
  // Idea: Inigo Quilez, "Domain warping" (https://iquilezles.org/articles/warp/): fbm whose input
  // is pushed around by more fbm, f(p + f(p + f(p))). Our own value noise and code. The stir is a
  // swirl around the pointer that fades out by itself.
  function vnoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
    const a = rnd(seed, xi, yi), b = rnd(seed, xi + 1, yi), c = rnd(seed, xi, yi + 1), d = rnd(seed, xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  const fbm = (x, y, seed) => { let s = 0, a = 0.5; for (let k = 0; k < 4; k++) { s += a * vnoise(x, y, seed + k * 17); x = x * 2.03 + 3.1; y = y * 2.01 + 1.7; a *= 0.5 } return s / 0.9375 }
  const RAMP_N = ' .:-=+*#%'
  const nebula = {
    init: (cols, rows, seed = 3) => ({ t: 0, sx: 0.5, sy: 0.5, sa: 0, seed: seed + 5 }),
    // input.stir: { x, y } in 0…1 over the box, and how far it moved (m, in box widths)
    step: (s, dt, i = {}) => {
      const st = i.stir
      const sa = clamp(decay(s.sa, 0.9, dt) + (st ? Math.min(0.5, (st.m || 0) * 3) : 0), 0, 1.6)
      return { t: s.t + dt, sx: st ? st.x : s.sx, sy: st ? st.y : s.sy, sa, seed: s.seed }
    },
    draw: (s, cols, rows) => {
      const g = grid(cols, rows), wide = cols * ASPECT / rows
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const u = c / cols, w = r / rows
        let x = u * 2.3 * wide, y = w * 2.3
        // the stir: rotate the sample point around the pointer, strongest at it
        const ddx = (u - s.sx) * wide, ddy = w - s.sy, d2 = ddx * ddx + ddy * ddy
        if (s.sa > 0.001) { const ang = s.sa * 2.2 * Math.exp(-d2 * 9), ca = Math.cos(ang), sn = Math.sin(ang); x = s.sx * 2.3 * wide + (ddx * ca - ddy * sn) * 2.3; y = s.sy * 2.3 + (ddx * sn + ddy * ca) * 2.3 }
        const qx = fbm(x + s.t * 0.11, y, s.seed), qy = fbm(x + 5.2, y + 1.3 - s.t * 0.07, s.seed)
        const f = fbm(x + 3.2 * qx, y + 3.2 * qy, s.seed + 3)
        const dx = (u - 0.5) * 2, dy = (w - 0.5) * 2, vig = clamp(1.25 - Math.hypot(dx, dy * 0.9))
        g[r * cols + c] = RAMP_N[Math.floor(smooth(0.24, 0.88, f) * vig * (RAMP_N.length - 0.001))]
      }
      return out(g, cols)
    },
  }

  // ── moon: drag sideways to change the phase ─────────────────────────────────────────────
  // The moon is moon.js (Floyd–Steinberg, after Surma's "Ditherpunk"), packed two pixels to a cell
  // with half blocks (▀ ▄ █), so its pixels stay square in a 1:2 cell. It starts on tonight's phase.
  const moonCache = new Map()
  const moon = {
    init: (cols, rows, seed, phase = 0.5) => ({ phase: ((phase % 1) + 1) % 1 }),
    // input.dx: cells dragged; a box width is one lunar month
    step: (s, dt, i = {}) => ({ phase: (((s.phase + (i.dx || 0) / 56) % 1) + 1) % 1 }),
    draw: (s, cols, rows) => {
      const g = grid(cols, rows), n = Math.max(8, Math.min(cols - 2, (rows - 2) * 2) & ~1)
      const key = n + ':' + s.phase.toFixed(3)
      let bits = moonCache.get(key)
      if (!bits) { bits = NIGHT.moonBits ? NIGHT.moonBits(n, s.phase) : new Uint8Array(n * n); if (moonCache.size > 64) moonCache.clear(); moonCache.set(key, bits) }
      const top = Math.floor((rows - n / 2) / 2), left = Math.floor((cols - n) / 2)
      for (let r = 0; r < n / 2; r++) for (let c = 0; c < n; c++) {
        const a = bits[2 * r * n + c], b = bits[(2 * r + 1) * n + c], rr = top + r, cc = left + c
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) g[rr * cols + cc] = a && b ? '█' : a ? '▀' : b ? '▄' : ' '
      }
      // the dark limb, faintly, so a new moon is still a moon: a dotted circle where the disc is
      for (let k = 0; k < 64; k++) {
        const ang = (k / 64) * Math.PI * 2, c = Math.round(left + n / 2 - 0.5 + Math.cos(ang) * (n / 2)), r = Math.round(top + n / 4 - 0.5 + Math.sin(ang) * (n / 4))
        if (r >= 0 && r < rows && c >= 0 && c < cols && g[r * cols + c] === ' ') g[r * cols + c] = '·'
      }
      return out(g, cols)
    },
  }

  const FX = {
    donut: { name: 'donut', credit: 'after Andy Sloane, donut.c', run: donut },
    warp: { name: 'warp', credit: 'the classic starfield', run: warp },
    life: { name: 'life', credit: "Conway's Game of Life", run: life },
    nebula: { name: 'nebula', credit: 'after Inigo Quilez, domain warping', run: nebula },
    moon: { name: 'moon', credit: "moon.js, after Surma's Ditherpunk", run: moon },
  }
  const ids = Object.keys(FX)
  NIGHT.fx = {
    ids, GEN,
    list: ids.map((id) => ({ id, name: FX[id].name, credit: FX[id].credit })),
    init: (id, cols, rows, seed, extra) => FX[id].run.init(Math.max(1, cols | 0), Math.max(1, rows | 0), seed, extra),
    step: (id, s, dt, input) => FX[id].run.step(s, Math.max(0, Math.min(0.1, dt)), input || {}),
    draw: (id, s, cols, rows) => FX[id].run.draw(s, Math.max(1, cols | 0), Math.max(1, rows | 0)),
    pick: (last, r = Math.random) => { const pool = ids.filter((id) => id !== last); return pool[Math.floor(r() * pool.length) % pool.length] },
  }
})()
