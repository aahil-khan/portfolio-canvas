/*
 * prototype/lab/night-mode/moon.js: a one-bit dithered moon, showing tonight's real phase.
 *
 * The idea is from the research gallery (~/projects/scratch/lab-finds, find #4, "one-bit
 * dithering"), which credits Surma's "Ditherpunk" (https://surma.dev/things/ditherpunk/) for the
 * explanation; Floyd–Steinberg error diffusion is 1976 public knowledge. This code is our own.
 * Floyd–Steinberg rather than Bayer because the moon is a still: research.md notes FS "crawls"
 * when animated, and nothing here animates. It is drawn once per page load. No flashing, nothing
 * to switch off for reduced motion beyond the fade night.js already gives it.
 *
 *   NIGHT.moonPhase(date)       0 = new, 0.5 = full, from the mean synodic month and a
 *                               reference new moon (2000-01-06 18:14 UTC). Good to a day or so.
 *   NIGHT.moonBits(n, phase)    Uint8Array of n×n on/off pixels. Pure, so check.mjs can run it.
 *   NIGHT.paintMoon(canvas, { size, phase, ink })   draws it; size is in canvas pixels.
 */
;(() => {
  const root = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root.NIGHT = root.NIGHT || {})
  const SYNODIC = 29.530588853, NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)

  NIGHT.moonPhase = (date = new Date()) => {
    const days = (date.getTime() - NEW_MOON) / 864e5
    return (((days / SYNODIC) % 1) + 1) % 1
  }

  // Maria: the dark seas, as soft dents in the albedo. Positions are in disc units (−1…1) and
  // only roughly where the real ones are, which is plenty at 64 pixels.
  const MARIA = [[-0.28, -0.32, 0.3, 0.38], [0.18, -0.38, 0.22, 0.3], [0.32, -0.02, 0.26, 0.34], [-0.12, 0.12, 0.34, 0.28], [0.05, 0.42, 0.18, 0.22], [-0.45, 0.28, 0.16, 0.2]]

  NIGHT.moonBits = (n, phase) => {
    // Light direction from the phase: behind the moon at new, behind us at full. Waxing lights
    // the right-hand limb, as seen from the northern hemisphere.
    const a = phase * Math.PI * 2, lx = Math.sin(a), lz = -Math.cos(a)
    const L = new Float32Array(n * n), R = n / 2 - 1
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = (x + 0.5 - n / 2) / R, dy = (y + 0.5 - n / 2) / R, d2 = dx * dx + dy * dy
      if (d2 > 1) continue
      const nz = Math.sqrt(1 - d2)
      let albedo = 0.95
      for (const [mx, my, sx, depth] of MARIA) albedo -= depth * Math.exp(-((dx - mx) ** 2 + (dy - my) ** 2) / (sx * sx))
      const lit = Math.max(0, dx * lx + nz * lz)
      // a sliver of earthshine keeps the dark limb faintly there, as it is on a real night
      L[y * n + x] = Math.min(1, 0.07 + Math.pow(lit, 0.8) * albedo)
    }
    // serpentine Floyd–Steinberg: alternate rows run right-to-left, which breaks up the
    // regular stripes plain left-to-right diffusion leaves on a smooth gradient
    const on = new Uint8Array(n * n)
    for (let y = 0; y < n; y++) {
      const rtl = y % 2 === 1, f = rtl ? -1 : 1
      for (let j = 0; j < n; j++) {
        const x = rtl ? n - 1 - j : j, i = y * n + x, v = L[i], bit = v > 0.5 ? 1 : 0, e = v - bit
        on[i] = bit
        if (x + f >= 0 && x + f < n) L[i + f] += (e * 7) / 16
        if (y + 1 < n) {
          if (x - f >= 0 && x - f < n) L[i + n - f] += (e * 3) / 16
          L[i + n] += (e * 5) / 16
          if (x + f >= 0 && x + f < n) L[i + n + f] += e / 16
        }
      }
    }
    return on
  }

  NIGHT.paintMoon = (canvas, { size = 64, phase = NIGHT.moonPhase(), ink = [237, 234, 224] } = {}) => {
    canvas.width = canvas.height = size
    const g = canvas.getContext('2d'), img = g.createImageData(size, size), bits = NIGHT.moonBits(size, phase)
    for (let i = 0; i < bits.length; i++) {
      const k = i * 4
      img.data[k] = ink[0]; img.data[k + 1] = ink[1]; img.data[k + 2] = ink[2]
      img.data[k + 3] = bits[i] ? 255 : 0
    }
    g.putImageData(img, 0, 0)
    canvas.dataset.phase = phase.toFixed(3)
    return canvas
  }
})()
