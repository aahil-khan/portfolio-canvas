/*
 * prototype/lab/notebook/voice.js: narration. ONE owner for what is loaded, what is playing, in
 * which voice, at what speed, through which knobs. The deck shows it, the reader highlights its
 * words, the ask list types in time with it. None of them keeps a copy.
 *
 *   NIGHT.voice.IDS                 ai · me · synth · sam (the deck's picker, in that order)
 *   .status(id)                     'ok' | 'soon' (me) | 'pending' (sam.js not loaded)
 *   .use(id)                        choose a voice (refused unless 'ok'); stops what is playing
 *   .load(target)                   { id, title, words: [..], index, of, sample? } — loads, never plays
 *   .play() .pause() .toggle() .stop() .seek(±s) .setRate(r) .cycleRate()
 *   .setKnob(k, v) .resetKnobs() .knobs
 *   .state()                        { voice, loaded, playing, t, dur, word, rate, peaks, perSec, title, index, of, note }
 *   .on(fn)                         fn(state) on every change, and every frame while playing
 *
 * NOTHING AUTOPLAYS. play() is only ever called from a press (▸, space, a [listen], an ask prompt).
 *
 * THE VOICES
 *   ai     the browser's speechSynthesis, for now. The real build pre-renders a free-tier TTS
 *          (Google Chirp 3 HD or similar, with WhisperX for timings) at publish time; no
 *          ElevenLabs. speechSynthesis cannot be routed into Web Audio, so it gets no knobs and no
 *          waveform; words light from its boundary events. A device with no voice gets the text on
 *          an estimated clock, silently, and says so.
 *   me     a clone of Aahil's voice: shown, disabled ("me — soon"). The route is not decided.
 *   synth  research Tier 1: Web Audio effects on a live SAM render, one paragraph at a time (the
 *          notebook dropped #21's 0.8 MB pre-rendered sample: a paragraph renders in milliseconds). Knobs: tape (speed and
 *          pitch together), pitch (a dual-delay shifter, speed unchanged), robot (ring modulation),
 *          monotone (a 12-band channel vocoder with a fixed carrier), crush (bit depth).
 *   sam    SAM itself, live (sam.js; no licence, approved by Aahil: see its header), dry.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const G = () => NIGHT.logic
  const S = () => NIGHT.sound
  const IDS = ['ai', 'me', 'synth', 'sam']
  const RATES = [1, 1.25, 1.5, 2, 0.75]
  const KNOBS = { tape: 1, pitch: 0, robot: 0, mono: 0, crush: 16 }
  const V = (NIGHT.voice = { IDS, RATES, KNOB_RANGE: { tape: [0.5, 1.6, 0.05], pitch: [-12, 12, 1], robot: [0, 150, 5], mono: [0, 1, 0.05], crush: [2, 16, 1] } })
  const st = { voice: 'ai', rate: 1, knobs: { ...KNOBS }, target: null, playing: false, t: 0, dur: 0, word: -1, peaks: null, perSec: 20, note: '', timings: null }
  const subs = new Set()
  let src = null // the running source: { kind: 'buffer' | 'speech' | 'clock', ... }
  let raf = 0

  V.status = (id) => (id === 'me' ? 'soon' : id === 'sam' || id === 'synth' ? (window.SamJs ? 'ok' : 'pending') : 'ok')
  V.knobs = st.knobs
  V.state = () => ({
    voice: st.voice, loaded: !!st.target, playing: st.playing, t: st.t, dur: st.dur, word: st.word, rate: st.rate, peaks: st.peaks, perSec: st.perSec,
    title: st.target ? st.target.title : '', index: st.target ? st.target.index : 0, of: st.target ? st.target.of : 0, note: st.note, kind: st.target ? st.target.kind || 'section' : null,
    id: st.target ? st.target.id : null,
  })
  const emit = () => { const s = V.state(); for (const f of subs) f(s) }
  V.timingsOf = () => (st.timings ? st.timings.words : null)
  V.on = (fn) => { subs.add(fn); return () => subs.delete(fn) }

  // ── the effects chain (synth), built once on the one AudioContext ─────────────────────────
  let chain = null
  function buildChain(ac, out) {
    const gain = (v) => { const g = ac.createGain(); g.gain.value = v; return g }
    const input = gain(1)
    // pitch: two delays swept by opposed sawtooth LFOs, crossfaded where each one jumps back
    const pDry = gain(1), pWet = gain(0), pSum = gain(1), W = 0.1
    const lanes = [0, 1].map(() => {
      const d = ac.createDelay(1), lfo = ac.createOscillator(), depth = gain(0), fade = ac.createWaveShaper(), fg = gain(0)
      d.delayTime.value = W / 2
      lfo.type = 'sawtooth'; lfo.frequency.value = 0.0001
      fade.curve = Float32Array.from({ length: 256 }, (_, i) => Math.cos(((i / 255) * 2 - 1) * Math.PI / 2))
      lfo.connect(depth); depth.connect(d.delayTime); lfo.connect(fade); fade.connect(fg.gain)
      input.connect(d); d.connect(fg); fg.connect(pWet)
      return { lfo, depth }
    })
    lanes[0].lfo.start()
    input.connect(pDry); pDry.connect(pSum); pWet.connect(pSum)
    // robot: ring modulation, the signal times a sine
    const rDry = gain(1), rWet = gain(0), ring = gain(0), rOsc = ac.createOscillator(), rSum = gain(1)
    rOsc.frequency.value = 60; rOsc.connect(ring.gain); rOsc.start()
    pSum.connect(rDry); pSum.connect(ring); ring.connect(rWet); rDry.connect(rSum); rWet.connect(rSum)
    // monotone: a channel vocoder; the voice's band envelopes shape a fixed-pitch sawtooth
    const vDry = gain(1), vWet = gain(0), vSum = gain(1), carrier = ac.createOscillator()
    carrier.type = 'sawtooth'; carrier.frequency.value = 110; carrier.start()
    rSum.connect(vDry); vDry.connect(vSum)
    const abs = Float32Array.from({ length: 1024 }, (_, i) => Math.abs((i / 1023) * 2 - 1))
    for (let k = 0; k < 12; k++) {
      const f = 200 * Math.pow(3600 / 200, k / 11)
      const mb = ac.createBiquadFilter(); mb.type = 'bandpass'; mb.frequency.value = f; mb.Q.value = 6
      const rect = ac.createWaveShaper(); rect.curve = abs
      const env = ac.createBiquadFilter(); env.type = 'lowpass'; env.frequency.value = 30
      const cb = ac.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = f; cb.Q.value = 6
      const amp = gain(0), boost = gain(6)
      rSum.connect(mb); mb.connect(rect); rect.connect(env); env.connect(boost); boost.connect(amp.gain)
      carrier.connect(cb); cb.connect(amp); amp.connect(vWet)
    }
    vWet.connect(vSum)
    // crush: the signal quantised to 2^bits levels
    const crush = ac.createWaveShaper()
    vSum.connect(crush); crush.connect(out)
    const set = (k) => {
      const t = ac.currentTime, r = Math.pow(2, k.pitch / 12), on = k.pitch !== 0
      pDry.gain.setTargetAtTime(on ? 0 : 1, t, 0.02); pWet.gain.setTargetAtTime(on ? 1 : 0, t, 0.02)
      const f = on ? Math.abs(1 - r) / W : 0.0001, sign = r > 1 ? -1 : 1
      lanes.forEach((l) => { l.lfo.frequency.setValueAtTime(f, t); l.depth.gain.setValueAtTime(sign * (W / 2), t) })
      // the second lane starts half a sweep behind the first, so one is always mid-sweep when the other jumps
      if (on && !lanes.started) { lanes.started = true; lanes[1].lfo.start(t + 0.5 / f) }
      rDry.gain.setTargetAtTime(k.robot > 0 ? 0 : 1, t, 0.02); rWet.gain.setTargetAtTime(k.robot > 0 ? 1 : 0, t, 0.02); rOsc.frequency.setValueAtTime(Math.max(1, k.robot), t)
      vDry.gain.setTargetAtTime(1 - k.mono, t, 0.02); vWet.gain.setTargetAtTime(k.mono * 2.2, t, 0.02)
      const steps = Math.pow(2, k.crush)
      crush.curve = k.crush >= 16 ? null : Float32Array.from({ length: 4096 }, (_, i) => Math.round(((i / 4095) * 2 - 1) * (steps / 2)) / (steps / 2))
    }
    return { input, set }
  }

  // ── sources ──────────────────────────────────────────────────────────────────────────────
  async function bufferFor(ac) {
    const t = st.target
    // a live render: SAM, a word at a time (the same code as the sample's)
    const r = G().samWords(window.SamJs, t.words)
    const buf = ac.createBuffer(1, r.samples.length, r.sr)
    buf.copyToChannel(r.samples, 0)
    return { buf, words: r.words, peaks: G().peaks(r.samples, r.sr, 20), perSec: 20, dur: r.dur }
  }
  const eff = () => st.rate * (st.voice === 'synth' ? st.knobs.tape : 1)

  function startBuffer(ac, at) {
    const out = S().voiceBus()
    const node = ac.createBufferSource()
    node.buffer = src.buf
    node.playbackRate.value = eff()
    if (st.voice === 'synth') {
      if (!chain) chain = buildChain(ac, out)
      chain.set(st.knobs)
      node.connect(chain.input)
    } else node.connect(out)
    node.start(0, Math.min(at, src.buf.duration))
    src.node = node; src.t0 = ac.currentTime; src.off = at
  }
  const posOf = () => {
    if (!src) return st.t
    if (src.kind === 'buffer') return src.node ? src.off + (S().ctx().currentTime - src.t0) * eff() : src.off
    if (src.kind === 'clock') return src.running ? src.off + ((performance.now() - src.t0) / 1000) * st.rate : src.off
    return st.t
  }
  // ai: one utterance from a word on; boundary events light the words
  const speechOk = () => 'speechSynthesis' in window && speechSynthesis.getVoices().length > 0
  function speak(from) {
    const w = st.target.words, text = w.slice(from).join(' ')
    const offs = []
    let o = 0
    for (let i = from; i < w.length; i++) { offs.push([o, i]); o += w[i].length + 1 }
    const u = new SpeechSynthesisUtterance(text)
    u.rate = st.rate
    u.onboundary = (e) => { if (e.name && e.name !== 'word') return; let k = from; for (const [c, i] of offs) if (c <= e.charIndex) k = i; st.word = k; st.t = st.timings.words[k] ? st.timings.words[k].s : st.t; emit() }
    u.onend = () => { if (src && src.u === u) finish() }
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
    src.u = u; src.from = from
  }

  function tick() {
    raf = 0
    if (!st.playing) return
    if (src.kind !== 'speech') {
      st.t = posOf()
      st.word = G().wordAt(st.timings.words, st.t)
      if (st.t >= st.dur) return finish()
    }
    emit()
    raf = requestAnimationFrame(tick)
  }
  function finish() {
    halt()
    st.playing = false; st.t = st.dur; st.word = st.timings ? st.timings.words.length - 1 : -1
    S().duck(false)
    emit()
    if (V.onend) V.onend(V.state())
  }
  function halt() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    if (!src) return
    if (src.kind === 'buffer' && src.node) { src.off = posOf(); try { src.node.stop() } catch { /* stopped */ } src.node.disconnect(); src.node = null }
    if (src.kind === 'clock' && src.running) { src.off = posOf(); src.running = false }
    if (src.kind === 'speech') speechSynthesis.cancel()
  }

  // ── the API ──────────────────────────────────────────────────────────────────────────────
  V.load = (target) => {
    V.stop()
    st.target = target
    st.timings = G().estimate(target.words)
    st.dur = st.timings.dur
    st.t = 0; st.word = -1; st.peaks = null; st.note = ''
    src = null
    emit()
  }
  V.unload = (id) => { if (st.target && (!id || st.target.id === id)) { V.stop(); st.target = null; st.timings = null; src = null; st.t = 0; st.dur = 0; st.word = -1; st.peaks = null; emit() } }
  V.use = (id) => {
    if (!IDS.includes(id) || V.status(id) !== 'ok') return false
    if (id === st.voice) return true
    const t = st.target
    V.stop()
    st.voice = id
    if (t) V.load(t)
    else emit()
    return true
  }
  V.play = async () => {
    if (!st.target || st.playing) return
    if (st.t >= st.dur) st.t = 0
    const ac = S().ctx()
    st.playing = true
    S().duck(true)
    if (st.voice === 'ai') {
      if (!src) src = speechOk() ? { kind: 'speech' } : { kind: 'clock', off: 0 }
      st.note = src.kind === 'clock' ? NIGHT.copy.voiceNone : ''
      if (src.kind === 'speech') speak(Math.max(0, st.word))
      else { src.off = st.t; src.t0 = performance.now(); src.running = true }
    } else {
      if (!ac) { st.playing = false; return }
      if (!src) {
        const b = await bufferFor(ac)
        if (!st.playing) return
        src = { kind: 'buffer', buf: b.buf, off: st.t }
        st.timings = { words: b.words, dur: b.dur }
        st.dur = b.dur; st.peaks = b.peaks; st.perSec = b.perSec
        st.note = ''
      }
      startBuffer(ac, st.t)
    }
    emit()
    if (!raf) raf = requestAnimationFrame(tick)
  }
  V.pause = () => { if (!st.playing) return; st.t = posOf(); halt(); st.playing = false; S().duck(false); emit() }
  V.toggle = () => (st.playing ? V.pause() : V.play())
  V.stop = () => { if (st.playing || src) { halt(); st.playing = false; S().duck(false) } st.t = 0; st.word = -1; if (src && src.kind !== 'buffer') src = null; else if (src) src.off = 0 }
  V.seek = (d) => {
    if (!st.target) return
    const was = st.playing, t = Math.max(0, Math.min(st.dur, posOf() + d))
    if (was) halt()
    st.t = t
    st.word = G().wordAt(st.timings.words, t)
    if (src && src.kind === 'buffer') src.off = t
    if (src && src.kind === 'clock') src.off = t
    if (was) {
      if (src.kind === 'buffer') startBuffer(S().ctx(), t)
      else if (src.kind === 'clock') { src.t0 = performance.now(); src.running = true }
      else speak(Math.max(0, st.word))
      if (!raf) raf = requestAnimationFrame(tick)
    }
    emit()
  }
  const reanchor = () => {
    if (!src || !st.playing) return
    if (src.kind === 'buffer' && src.node) { src.off = posOf(); src.t0 = S().ctx().currentTime; src.node.playbackRate.value = eff() }
    if (src.kind === 'clock') { src.off = posOf(); src.t0 = performance.now() }
    if (src.kind === 'speech') speak(Math.max(0, st.word))
  }
  V.setRate = (r) => { st.t = posOf(); st.rate = r; reanchor(); emit() }
  V.cycleRate = (d = 1) => V.setRate(RATES[(RATES.indexOf(st.rate) + d + RATES.length) % RATES.length])
  V.setKnob = (k, v) => {
    if (!(k in st.knobs)) return
    st.t = posOf()
    st.knobs[k] = +v
    if (k === 'tape') reanchor()
    if (chain) chain.set(st.knobs)
    try { localStorage.setItem('lab.knobs', JSON.stringify(st.knobs)) } catch { /* private window */ }
    emit()
  }
  V.resetKnobs = () => { for (const k of Object.keys(KNOBS)) V.setKnob(k, KNOBS[k]) }
  // the listener's knobs and voice come back on the next visit (a convenience: try/catch)
  try { Object.assign(st.knobs, JSON.parse(localStorage.getItem('lab.knobs') || '{}')) } catch { /* none */ }
})()
