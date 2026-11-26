/* eslint-disable @typescript-eslint/no-unused-vars -- src/*.js are concatenated into one scope by build.mjs, so names are used across files */
/* Sound: mirrors lib/audio.ts (voices → master → 1.85kHz low-pass → out, with a short tape echo,
   cue gains 0.012–0.05, make-up gain 2.5). Muted on arrival. One owner: `sound`. */

const sound = (() => {
  let ctx = null
  let bus = null
  let on = false
  const listeners = new Set()
  const masterVolume = () => Math.min(1, Math.max(0, Number(store.get('canvas.masterVolume', '0.8')) || 0))
  const UI_MAKEUP = 2.5
  const P = { c3: 130.81, g3: 196, c4: 261.63, d4: 293.66, e4: 329.63, f4: 349.23, g4: 392, a4: 440, b4: 493.88, c5: 523.25 }
  const SCALE = [P.c4, P.d4, P.e4, P.f4, P.g4, P.a4, P.b4, P.c5]

  function ensure() {
    if (ctx) return ctx
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    bus = ctx.createGain()
    bus.gain.value = masterVolume() * UI_MAKEUP
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 1850
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.13
    const feedback = ctx.createGain()
    feedback.gain.value = 0.3
    const damp = ctx.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = 1100
    const wet = ctx.createGain()
    wet.gain.value = 0.22
    bus.connect(tone)
    tone.connect(ctx.destination)
    tone.connect(delay)
    delay.connect(damp)
    damp.connect(feedback)
    feedback.connect(delay)
    damp.connect(wet)
    wet.connect(ctx.destination)
    return ctx
  }
  const vary = (f, cents = 30) => f * Math.pow(2, ((Math.random() * 2 - 1) * cents) / 1200)
  function voice({ f, to, dur, gain, type = 'sine', at = 0 }) {
    const t = ctx.currentTime + at
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f, t)
    if (to && to !== f) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.035)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(bus)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }
  const cues = {
    open: () => { voice({ f: vary(P.c4), dur: 0.5, gain: 0.05, type: 'triangle' }); voice({ f: vary(P.g4), dur: 0.55, gain: 0.03, at: 0.07 }) },
    close: () => { voice({ f: vary(P.g4), dur: 0.4, gain: 0.04, type: 'triangle' }); voice({ f: vary(P.c4), dur: 0.5, gain: 0.028, at: 0.06 }) },
    hover: () => voice({ f: vary(P.a4, 55), dur: 0.09, gain: 0.012 }),
    click: () => { voice({ f: vary(P.e4), dur: 0.3, gain: 0.045, type: 'triangle' }); voice({ f: vary(P.e4 * 2), dur: 0.12, gain: 0.012 }) },
    /** a tour's next stop: up one scale degree per stop (Task 2 uses it) */
    step: (n = 0) => voice({ f: SCALE[Math.min(SCALE.length - 1, n)], dur: 0.3, gain: 0.04, type: 'triangle' }),
  }
  return {
    get on() { return on },
    set(v) {
      on = !!v
      if (on) { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume() }
      listeners.forEach((fn) => fn(on))
    },
    toggle() { this.set(!on) },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    /** Play a cue if sound is on. Never creates an AudioContext while muted. */
    cue(name, arg) {
      if (!on || !ensure()) return
      if (ctx.state === 'suspended') ctx.resume()
      try { cues[name](arg) } catch { /* a cue must never break the page */ }
    },
    setMaster(v) { store.set('canvas.masterVolume', String(v)); if (bus) bus.gain.value = v * UI_MAKEUP },
    masterVolume,
  }
})()

/* The device voice: a labelled stand-in for the pre-rendered Kokoro narration and name clip. */
const voiceOut = (() => {
  const synth = window.speechSynthesis || null
  const hasVoice = () => !!(synth && synth.getVoices?.().length)
  function speak(text, { rate = 1, onend } = {}) {
    if (!hasVoice()) { const t = setTimeout(() => onend?.(), Math.max(700, text.split(' ').length * (60000 / 170) / rate)); return () => clearTimeout(t) }
    const u = new SpeechSynthesisUtterance(text)
    u.rate = rate
    u.lang = 'en-GB'
    let done = false
    const finish = () => { if (!done) { done = true; onend?.() } }
    u.onend = finish
    u.onerror = finish
    synth.speak(u)
    return () => { done = true; synth.cancel() }
  }
  return { speak, hasVoice, cancel: () => synth && synth.cancel() }
})()
