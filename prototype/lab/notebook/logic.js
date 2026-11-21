/*
 * prototype/lab/night-mode/logic.js: the deck's, the compass's and the narration's arithmetic.
 * Pure: no DOM, no audio, no clock. check.mjs and render-sample.mjs run all of it in Node.
 *
 *   NIGHT.logic.tokens(text)                 words with their character offsets: [{ w, o }]
 *   .align(page, spoken)                     page tokens → spoken-word index (tags split words)
 *   .wordAt(words, t)                        which word is being spoken at media time t (−1: none)
 *   .wave(peaks, perSec, t, n, still)        the deck's ASCII waveform: n of ▁▂▃▄▅▆▇ around t
 *   .clock(s)                                1:05
 *   .wedge(dx, dy, prev, opt)                the compass: which of 4 wedges the pointer is in
 *   .commands(list, input)                   the / command line: what matches, best first
 *   .bar(done, of)                           ▓▓▓░░░
 *   .pick(pool, seen, rnd)                   an answer, no repeat until the pool is used up
 *   .estimate(words)                         timings at ~150 wpm (the ai voice's clock)
 *   .samWords(SamJs, words, opt)             SAM a word at a time: samples plus exact word timings
 *   .peaks(samples, sr, perSec), .wav8(samples, sr), .b64(bytes)
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})

  // ── words ────────────────────────────────────────────────────────────────────────────────
  const tokens = (text) => [...String(text).matchAll(/\S+/g)].map((m) => ({ w: m[0], o: m.index }))
  // words: [{ s, e }] in seconds, in order. Between two words, the last one stays lit.
  const wordAt = (words, t) => {
    if (!words.length || t < words[0].s) return -1
    let lo = 0, hi = words.length - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (words[mid].s <= t) lo = mid; else hi = mid - 1 }
    return lo
  }
  // the page's words (split by tags: "**“Why", "not?**") against the timings file's words: each
  // page token gets the index of the spoken word it belongs to. Letters only, case folded.
  const letters = (w) => String(w).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
  const align = (page, spoken) => {
    const out = []
    let j = 0, have = ''
    for (const w of page) {
      const l = letters(w)
      // punctuation on its own: a spoken token of its own, or the tail of the word before it
      if (!l) { if (!have && j < spoken.length && !letters(spoken[j])) { out.push(j++); } else out.push(have ? j : Math.max(0, j - 1)); continue }
      while (!have && j < spoken.length && !letters(spoken[j])) j++
      if (j >= spoken.length) { out.push(-1); continue }
      out.push(j)
      have += l
      if (have.length >= letters(spoken[j]).length) { j++; have = '' }
    }
    return out
  }
  const clock = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

  // ── the waveform: build-time peaks (0..1, perSec a second), centred on t ────────────────
  const GLYPHS = '▁▂▃▄▅▆▇'
  const glyph = (v) => GLYPHS[Math.max(0, Math.min(GLYPHS.length - 1, Math.round(v * (GLYPHS.length - 1))))]
  const wave = (peaks, perSec, t, n = 12, still = false) => {
    if (!peaks || !peaks.length) return GLYPHS[0].repeat(n)
    // reduced motion: the whole clip, squeezed into n cells, never scrolling
    if (still) return Array.from({ length: n }, (_, i) => { const a = Math.floor((i * peaks.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * peaks.length) / n)); return glyph(Math.max(...peaks.slice(a, b))) }).join('')
    const c = Math.round(t * perSec)
    return Array.from({ length: n }, (_, i) => { const k = c - Math.floor(n / 2) + i; return k < 0 || k >= peaks.length ? GLYPHS[0] : glyph(peaks[k]) }).join('')
  }

  // ── the compass ──────────────────────────────────────────────────────────────────────────
  // 4 wedges centred on N, E, S, W (0 1 2 3). Inside the dead zone nothing changes. Hysteresis:
  // the wedge held keeps the pointer until it is `hyst` degrees past the boundary.
  const wedge = (dx, dy, prev = null, { dead = 14, hyst = 5 } = {}) => {
    if (Math.hypot(dx, dy) < dead) return prev
    const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360 // 0 = up, clockwise
    const raw = Math.round(deg / 90) % 4
    if (prev == null || raw === prev) return raw
    const off = Math.abs((((deg - prev * 90) % 360) + 540) % 360 - 180) // distance from prev's centre
    return off > 45 + hyst ? raw : prev
  }

  // ── the command line: prefix of the command beats a word inside the label ──────────────
  const commands = (list, input) => {
    const q = String(input || '').trim().toLowerCase()
    if (!q) return list.slice()
    const score = (c) => {
      const k = c.cmd.toLowerCase(), l = (c.label || '').toLowerCase()
      if (k === q) return 0
      if (k.startsWith(q)) return 1
      if (q.split(/\s+/).every((w) => k.includes(w))) return 2
      if (q.split(/\s+/).every((w) => l.includes(w))) return 3
      return 9
    }
    return list.map((c, i) => [score(c), i, c]).filter((x) => x[0] < 9).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2])
  }

  const bar = (done, of) => '▓'.repeat(Math.max(0, Math.min(of, done))) + '░'.repeat(Math.max(0, of - done))

  const pick = (pool, seen = [], rnd = Math.random) => {
    const left = pool.map((_, i) => i).filter((i) => !seen.includes(i))
    const from = left.length ? left : pool.map((_, i) => i).filter((i) => i !== seen[seen.length - 1])
    const i = from[Math.floor(rnd() * from.length) % from.length]
    return { i, seen: left.length ? [...seen, i] : [i] }
  }

  // ── timings ────────────────────────────────────────────────────────────────────────────
  // How long a word is held after it: a sentence end, a comma or dash, or just the next word.
  const gapAfter = (w) => (/[.!?]["”’)]*$/.test(w) ? 0.38 : /[,;:—–-]["”’)]*$/.test(w) ? 0.16 : 0.05)
  // an estimate at ~150 words a minute, by syllables: the ai voice's clock, and the one used when
  // a device has no voice at all (the text still types out, in time with nothing)
  const syllables = (w) => Math.max(1, (String(w).toLowerCase().replace(/[^a-z]/g, '').match(/[aeiouy]+/g) || []).length)
  const estimate = (words, { wpm = 150 } = {}) => {
    const per = 60 / wpm / 1.4
    let t = 0.2
    const out = words.map((w) => { const s = t; t += syllables(w) * per; const r = { w, s: +s.toFixed(3), e: +t.toFixed(3) }; t += gapAfter(w); return r })
    return { words: out, dur: +(t + 0.2).toFixed(3) }
  }
  // SAM, a word at a time: each word is rendered on its own, trimmed of SAM's own silence, and laid
  // end to end with the gaps above, so every word's start and end is exact. The same function makes
  // the pre-rendered sample (render-sample.mjs, in Node) and the live sam voice (voice.js).
  const SAM_SR = 22050
  const samSay = (w) => String(w).replace(/[–—]/g, ' ').replace(/[^A-Za-z0-9' ]/g, '').trim()
  function samWords(SamJs, words, { speed = 72, pitch = 64, mouth = 128, throat = 128 } = {}) {
    const sam = new SamJs({ speed, pitch, mouth, throat }), parts = [], out = []
    let t = 0.15, n = Math.round(0.15 * SAM_SR)
    for (const w of words) {
      const say = samSay(w)
      let buf = null
      try { buf = say ? sam.buf8(say) : null } catch { buf = null }
      let a = 0, b = buf ? buf.length : 0
      if (buf) { while (a < b && Math.abs(buf[a] - 128) < 3) a++; while (b > a && Math.abs(buf[b - 1] - 128) < 3) b-- }
      const len = b - a
      if (len > 0) parts.push([n, buf.subarray(a, b)])
      out.push({ w, s: +t.toFixed(3), e: +((n + len) / SAM_SR).toFixed(3) })
      n += len + Math.round(gapAfter(w) * SAM_SR)
      t = n / SAM_SR
    }
    n += Math.round(0.2 * SAM_SR)
    const samples = new Float32Array(n)
    for (const [at, buf] of parts) for (let i = 0; i < buf.length; i++) samples[at + i] = (buf[i] - 128) / 128
    return { samples, sr: SAM_SR, words: out, dur: +(n / SAM_SR).toFixed(3) }
  }
  // halve the rate (SAM has little above 5 kHz): a smaller sample file
  const half = (samples) => { const o = new Float32Array(samples.length >> 1); for (let i = 0; i < o.length; i++) o[i] = (samples[2 * i] + samples[2 * i + 1]) / 2; return o }
  const peaks = (samples, sr, perSec = 20) => {
    const step = Math.floor(sr / perSec), out = []
    for (let i = 0; i < samples.length; i += step) { let m = 0; for (let j = i; j < Math.min(samples.length, i + step); j++) m = Math.max(m, Math.abs(samples[j])); out.push(m) }
    const top = Math.max(...out) || 1
    return out.map((v) => +(v / top).toFixed(2))
  }
  // 8-bit unsigned PCM mono WAV
  const wav8 = (samples, sr) => {
    const n = samples.length, b = new Uint8Array(44 + n), d = new DataView(b.buffer)
    const str = (o, s) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)))
    str(0, 'RIFF'); d.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ')
    d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, sr, true)
    d.setUint32(28, sr, true); d.setUint16(32, 1, true); d.setUint16(34, 8, true); str(36, 'data'); d.setUint32(40, n, true)
    for (let i = 0; i < n; i++) b[44 + i] = Math.max(0, Math.min(255, Math.round(128 + 127 * samples[i])))
    return b
  }
  const b64 = (bytes) => (typeof Buffer !== 'undefined' ? Buffer.from(bytes).toString('base64') : btoa(String.fromCharCode(...bytes)))

  NIGHT.logic = { tokens, align, letters, wordAt, clock, wave, GLYPHS, wedge, commands, bar, pick, syllables, gapAfter, estimate, samSay, samWords, SAM_SR, half, peaks, wav8, b64 }
})()
