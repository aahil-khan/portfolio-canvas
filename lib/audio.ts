'use client'

/**
 * Synthesised UI sound. Zero audio files — a handful of oscillators cost nothing to ship and
 * can't 404.
 *
 * The goal is "alive, not annoying": every cue is short, low-gain and slightly randomised, and
 * everything runs through one shared chain so nothing can ever be shrill or loud.
 *
 *   voices  →  master gain  →  low-pass  →  out
 *                          ↘  short delay (feedback)  ↗
 *
 * The delay is what stops it sounding like a beep test — a little air makes repeated clicks
 * feel like they belong in a room. Muted on arrival; browsers block audio before a gesture
 * anyway, so "on by default" would be a fiction.
 */

type Cue = 'open' | 'close' | 'hover' | 'click' | 'minimise' | 'arrange' | 'theme'

const KEY = 'canvas.sound'
const KEY_UI_VOL = 'canvas.uiVolume'
const KEY_MASTER = 'canvas.masterVolume'
let enabled = false
let loaded = false
const listeners = new Set<() => void>()

let ctx: AudioContext | null = null
let bus: GainNode | null = null
let uiVolume = 0.7
let masterVolume = 0.8
let volLoaded = false
/** Shared LFO output, patched into every oscillator's detune for tape warble. */
let wobble: GainNode | null = null

/** Build the shared chain once. */
function audio(): { ctx: AudioContext; bus: GainNode } {
  if (ctx && bus) return { ctx, bus }
  ctx = new AudioContext()

  const master = ctx.createGain()
  master.gain.value = uiVolume * masterVolume

  /*
   * Lofi is mostly subtraction. Rolling the top off at ~1.8kHz is what turns a clean synth
   * beep into something that sounds like it came off tape — the brightness is the tell.
   */
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 1850
  tone.Q.value = 0.6

  // gentle saturation: rounds transients instead of letting them click
  const warm = ctx.createWaveShaper()
  const curve = new Float32Array(1024)
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1
    curve[i] = Math.tanh(x * 1.6)
  }
  warm.curve = curve
  warm.oversample = '2x'

  // a longer, dubbier delay than a UI normally wants — the space is half the character
  const delay = ctx.createDelay(1)
  delay.delayTime.value = 0.19
  const feedback = ctx.createGain()
  feedback.gain.value = 0.3
  const damp = ctx.createBiquadFilter()
  damp.type = 'lowpass'
  damp.frequency.value = 1100 // each repeat is duller than the last, like a tape echo
  const wet = ctx.createGain()
  wet.gain.value = 0.22

  master.connect(tone).connect(warm).connect(ctx.destination)
  master.connect(delay)
  delay.connect(damp).connect(feedback).connect(delay)
  delay.connect(wet).connect(tone)

  /*
   * Tape wobble. A slow LFO on every voice's detune, a few cents wide — pitch that is very
   * slightly unstable is the single most recognisable lofi cue.
   */
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.55
  const depth = ctx.createGain()
  depth.gain.value = 7
  lfo.connect(depth)
  lfo.start()
  wobble = depth

  bus = master
  return { ctx, bus }
}

interface Voice {
  /** Start frequency, Hz. */
  f: number
  /** End frequency; glides there across the note. Defaults to `f`. */
  to?: number
  dur: number
  gain: number
  type?: OscillatorType
  /** Seconds to wait before this voice starts, for arpeggios. */
  at?: number
  /** Cents of detune — two slightly detuned voices sound thicker than one. */
  detune?: number
}

function voice(v: Voice): void {
  const { ctx: c, bus: out } = audio()
  const t = c.currentTime + (v.at ?? 0)
  const osc = c.createOscillator()
  const g = c.createGain()

  osc.type = v.type ?? 'sine'
  osc.detune.value = v.detune ?? 0
  osc.frequency.setValueAtTime(v.f, t)
  if (v.to && v.to !== v.f) osc.frequency.exponentialRampToValueAtTime(v.to, t + v.dur)

  // slow, soft attack and a long tail — nothing in lofi has a hard edge
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(v.gain, t + 0.035)
  g.gain.exponentialRampToValueAtTime(0.0001, t + v.dur)

  if (wobble) wobble.connect(osc.detune)
  osc.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + v.dur + 0.03)
}

/** Filtered noise burst — gives ticks and swooshes a texture oscillators can't. */
function noise(dur: number, gain: number, from: number, to: number, at = 0): void {
  const { ctx: c, bus: out } = audio()
  const t = c.currentTime + at
  const frames = Math.ceil(c.sampleRate * dur)
  const buf = c.createBuffer(1, frames, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1

  const src = c.createBufferSource()
  src.buffer = buf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.1
  bp.frequency.setValueAtTime(from, t)
  bp.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

  src.connect(bp).connect(g).connect(out)
  src.start(t)
  src.stop(t + dur)
}

/** ±cents of wobble, so repeated hovers never sound mechanically identical. */
const vary = (hz: number, cents = 22) => hz * Math.pow(2, ((Math.random() * 2 - 1) * cents) / 1200)

/*
 * A C-major pentatonic scale. No semitones means no combination of these can clash, so cues
 * that overlap — a hover during an open, say — still sound intentional.
 */
const P = { c3: 130.8, g3: 196.0, a3: 220.0, c4: 261.6, d4: 293.7, e4: 329.6, g4: 392.0, a4: 440.0, c5: 523.3 }

const CUES: Record<Cue, () => void> = {
  // a soft two-note rise, low and rounded
  open: () => {
    voice({ f: vary(P.c4), dur: 0.5, gain: 0.05, type: 'triangle' })
    voice({ f: vary(P.g4), dur: 0.55, gain: 0.03, type: 'sine', at: 0.07 })
    noise(0.05, 0.008, 1200, 500)
  },
  close: () => {
    voice({ f: vary(P.g4), dur: 0.4, gain: 0.04, type: 'triangle' })
    voice({ f: vary(P.c4), dur: 0.5, gain: 0.028, type: 'sine', at: 0.06 })
  },
  // fires on every dock pass, so it stays under the conversation: one dull tap
  hover: () => voice({ f: vary(P.a4, 55), dur: 0.09, gain: 0.012, type: 'sine' }),
  // a felt mallet — soft transient, quick decay
  click: () => {
    voice({ f: vary(P.e4), dur: 0.3, gain: 0.045, type: 'triangle' })
    voice({ f: vary(P.e4 * 2), dur: 0.12, gain: 0.012, type: 'sine' })
    noise(0.04, 0.014, 900, 380)
  },
  // everything settling back down
  minimise: () => {
    voice({ f: P.a4, to: P.c3, dur: 0.55, gain: 0.04, type: 'sine' })
    noise(0.3, 0.012, 1400, 320)
  },
  // a brushed sweep with a pentatonic run over it
  arrange: () => {
    noise(0.4, 0.016, 500, 1600)
    ;[P.c4, P.e4, P.g4, P.c5].forEach((f, i) =>
      voice({ f, dur: 0.45, gain: 0.024, type: 'sine', at: 0.06 + i * 0.07 }),
    )
  },
  // an add9 chord, arpeggiated slowly — the one cue allowed to linger
  theme: () => {
    ;[P.c4, P.e4, P.g4, P.d4 * 2, P.a4].forEach((f, i) =>
      voice({ f, dur: 1.1, gain: 0.022, type: 'sine', at: i * 0.08, detune: i * 4 }),
    )
  },
}

/** Interface-cue level, 0–1. Multiplied by master before it reaches the bus. */
export function getUiVolume(): number {
  loadVolumes()
  return uiVolume
}
export function getMasterVolume(): number {
  loadVolumes()
  return masterVolume
}

function loadVolumes(): void {
  if (volLoaded) return
  volLoaded = true
  try {
    const u = Number(localStorage.getItem(KEY_UI_VOL))
    const m = Number(localStorage.getItem(KEY_MASTER))
    if (Number.isFinite(u) && u >= 0) uiVolume = u
    if (Number.isFinite(m) && m >= 0) masterVolume = m
  } catch {
    /* private mode */
  }
}

function applyGain(): void {
  if (bus) bus.gain.value = uiVolume * masterVolume
}

export function setUiVolume(v: number): void {
  uiVolume = Math.min(1, Math.max(0, v))
  volLoaded = true
  applyGain()
  try {
    localStorage.setItem(KEY_UI_VOL, String(uiVolume))
  } catch {}
  for (const l of listeners) l()
}

/** Master scales BOTH buses — interface cues here, and the ambience element via a callback. */
let onMasterChange: ((m: number) => void) | null = null
export function onMaster(fn: (m: number) => void): void {
  onMasterChange = fn
}

export function setMasterVolume(v: number): void {
  masterVolume = Math.min(1, Math.max(0, v))
  volLoaded = true
  applyGain()
  onMasterChange?.(masterVolume)
  try {
    localStorage.setItem(KEY_MASTER, String(masterVolume))
  } catch {}
  for (const l of listeners) l()
}

export function play(cue: Cue): void {
  if (!enabled) return
  loadVolumes()
  const { ctx: c } = audio()
  if (c.state === 'suspended') void c.resume()
  CUES[cue]()
}

export function isSoundOn(): boolean {
  return enabled
}

/*
 * Exposed as an external store rather than `useState` + an effect. Reading localStorage during
 * render would be a hydration mismatch (the server has no localStorage), and setting state
 * inside an effect causes a cascading render.
 */
export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSoundSnapshot(): boolean {
  if (!loaded) {
    loaded = true
    try {
      enabled = localStorage.getItem(KEY) === 'on'
    } catch {
      enabled = false
    }
  }
  return enabled
}

/** Always muted in the server-rendered HTML — there is no preference to read yet. */
export function getSoundServerSnapshot(): boolean {
  return false
}

export function setSoundOn(on: boolean): void {
  enabled = on
  loaded = true
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* private mode — the preference just won't persist */
  }
  for (const l of listeners) l()
}
