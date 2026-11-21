/*
 * prototype/lab/night-mode/decode.js: the "decode" effect, as a pure function of progress.
 *
 *   NIGHT.decode(text, p, seed) → string
 *     p = 0: blank (every character a no-break space; real spaces stay spaces)
 *     p = 1: `text`, exactly
 *     between: characters resolve left to right, each passing through a few random glyphs first.
 *
 * Pure of p and seed, so a frozen transition (?freeze=) shows the same frame every time and
 * night.js can run it backwards to re-encode on the way back. The output is always as long as
 * the input and keeps every space where it was, so in a monospace face nothing reflows while it
 * plays: same widths, same break opportunities, same lines.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  // ASCII only, so every glyph is in the face and has the cell's width. No quote or backslash:
  // the dock writes these into a CSS string.
  const GLYPHS = '01#%&*+=<>?/|[]{}~^:;$'
  const NBSP = ' '
  // a small integer hash (mulberry-style), stable across engines
  const hash = (a, b, c) => {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return (h ^ (h >>> 16)) >>> 0
  }
  const FRAMES = 24 // glyph changes over the whole segment: slow enough to read as scramble, not noise
  NIGHT.decode = (text, p, seed = 0) => {
    if (p >= 1) return text
    const s = String(text), n = s.length
    if (p <= 0) return s.replace(/\S/g, NBSP)
    const tick = Math.floor(p * FRAMES)
    let out = ''
    for (let i = 0; i < n; i++) {
      const ch = s[i]
      if (/\s/.test(ch)) { out += ch; continue }
      const start = (i / Math.max(1, n)) * 0.55, end = start + 0.45
      if (p >= end) out += ch
      else if (p < start) out += NBSP
      else out += GLYPHS[hash(seed, i, tick) % GLYPHS.length]
    }
    return out
  }
})()
