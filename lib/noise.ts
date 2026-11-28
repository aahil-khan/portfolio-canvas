/**
 * Five noise textures for the Lab's Sound menu, synthesised in the browser: zero files.
 *
 * Each is built from one shared two-second buffer per colour (white, pink, brown), looped with its
 * seam crossfaded, normalised so a voice's gain is its peak. A texture is handed the node to play
 * into (`lib/ambience.ts`'s noise bus: a level, a limiter, then master), never the interface cue
 * bus, and returns a handle that stops it. Fading in and out is the bus's job, so every texture
 * fades the same way.
 *
 * Levels: every texture is voiced to peak at or under `PEAK` at full level. The bus's limiter
 * (−12 dB, 8:1) is the backstop, not the plan.
 *
 * Words for each texture (its label and its one-line description) are copy, in
 * `content/data/lab.json` under `soundNoise<Id>` and `soundNoise<Id>Hint`.
 */

export const NOISE_IDS = ['brown', 'pink', 'rain', 'fan', 'waves'] as const
export type NoiseId = (typeof NOISE_IDS)[number]

export const isNoiseId = (v: unknown): v is NoiseId => typeof v === 'string' && (NOISE_IDS as readonly string[]).includes(v)

/** A texture's ceiling at full level, under check:lab rule 26's 0.25. */
export const PEAK = 0.22
/** Fade in and out, seconds: long enough that nothing ever clicks on or off (rule 26: ≥ 0.5). */
export const FADE = 0.8

type Colour = 'white' | 'pink' | 'brown'
const buffers = new WeakMap<BaseAudioContext, Partial<Record<Colour, AudioBuffer>>>()

function buffer(c: BaseAudioContext, colour: Colour): AudioBuffer {
  const cache = buffers.get(c) ?? {}
  buffers.set(c, cache)
  const hit = cache[colour]
  if (hit) return hit
  const len = c.sampleRate * 2
  const b = c.createBuffer(1, len, c.sampleRate)
  const d = b.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, max = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (colour === 'pink') {
      // Paul Kellet's refined filter: −3 dB an octave
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
      b6 = w * 0.115926
    } else if (colour === 'brown') {
      last = (last + 0.02 * w) / 1.02
      d[i] = last
    } else d[i] = w
    max = Math.max(max, Math.abs(d[i]))
  }
  for (let i = 0; i < len; i++) d[i] /= max || 1
  // crossfade the loop's seam over 50ms, so the loop has no tick at its join
  const x = Math.floor(c.sampleRate * 0.05)
  for (let i = 0; i < x; i++) {
    const k = i / x
    d[i] = d[i] * k + d[len - x + i] * (1 - k)
  }
  cache[colour] = b
  return b
}

function loop(c: BaseAudioContext, colour: Colour): AudioBufferSourceNode {
  const s = c.createBufferSource()
  s.buffer = buffer(c, colour)
  s.loop = true
  return s
}

function filter(c: BaseAudioContext, type: BiquadFilterType, f: number, q?: number): BiquadFilterNode {
  const n = c.createBiquadFilter()
  n.type = type
  n.frequency.value = f
  if (q) n.Q.value = q
  return n
}

function gain(c: BaseAudioContext, v: number): GainNode {
  const g = c.createGain()
  g.gain.value = v
  return g
}

export interface NoiseHandle {
  stop(): void
}

type Build = (c: BaseAudioContext, out: AudioNode) => NoiseHandle

/** Starts sources and returns one handle that stops all of them, and any timer. */
function handle(sources: AudioScheduledSourceNode[], timers: { clear: () => void }[] = []): NoiseHandle {
  for (const s of sources) s.start()
  return {
    stop() {
      for (const t of timers) t.clear()
      for (const s of sources) {
        try {
          s.stop()
        } catch {
          /* already stopped */
        }
        s.disconnect()
      }
    },
  }
}

/** A self-rescheduling timer that a handle can cancel. */
function every(next: () => number, fn: () => void): { clear: () => void } {
  let alive = true
  let t: ReturnType<typeof setTimeout> | undefined
  const tick = () => {
    if (!alive) return
    fn()
    t = setTimeout(tick, next())
  }
  tick()
  return {
    clear() {
      alive = false
      clearTimeout(t)
    },
  }
}

const TEXTURES: Record<NoiseId, Build> = {
  // deep and even: brown noise alone
  brown: (c, out) => {
    const s = loop(c, 'brown')
    s.connect(gain(c, PEAK)).connect(out)
    return handle([s])
  },
  // softer than white: pink, its top rolled off
  pink: (c, out) => {
    const s = loop(c, 'pink')
    s.connect(filter(c, 'lowpass', 6000)).connect(gain(c, PEAK)).connect(out)
    return handle([s])
  },
  // band-passed hiss, with sparse drops on top of it
  rain: (c, out) => {
    const s = loop(c, 'pink')
    s.connect(filter(c, 'bandpass', 2400, 0.6)).connect(gain(c, PEAK * 0.8)).connect(out)
    const drops = every(
      () => 60 + Math.random() * 220,
      () => {
        const t = c.currentTime + 0.02
        const d = loop(c, 'white')
        const g = c.createGain()
        const peak = PEAK * (0.08 + Math.random() * 0.12)
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(peak, t + 0.004)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
        d.connect(filter(c, 'bandpass', 3000 + Math.random() * 2500, 4)).connect(g).connect(out)
        d.start(t, Math.random())
        d.stop(t + 0.07)
        d.onended = () => g.disconnect()
      },
    )
    return handle([s], [drops])
  },
  // a room fan: low-passed air over a mains hum and its octave
  fan: (c, out) => {
    const s = loop(c, 'brown')
    s.connect(filter(c, 'lowpass', 520)).connect(gain(c, PEAK * 0.8)).connect(out)
    const hum = c.createOscillator()
    hum.frequency.value = 58
    hum.connect(gain(c, PEAK * 0.12)).connect(out)
    const hum2 = c.createOscillator()
    hum2.frequency.value = 116
    hum2.connect(gain(c, PEAK * 0.05)).connect(out)
    return handle([s, hum, hum2])
  },
  // brown noise that swells and falls back every 7 to 11 seconds
  waves: (c, out) => {
    const s = loop(c, 'brown')
    const swell = gain(c, 0.35)
    s.connect(filter(c, 'lowpass', 900)).connect(swell).connect(gain(c, PEAK)).connect(out)
    let len = 9
    const waves = every(
      () => len * 1000,
      () => {
        const t = c.currentTime
        len = 7 + Math.random() * 4
        swell.gain.cancelScheduledValues(t)
        swell.gain.setValueAtTime(swell.gain.value, t)
        swell.gain.linearRampToValueAtTime(1, t + len * 0.45)
        swell.gain.linearRampToValueAtTime(0.3, t + len)
      },
    )
    return handle([s], [waves])
  },
}

/** Starts one texture into `out`. The caller owns the fade and the routing. */
export function startNoise(c: BaseAudioContext, id: NoiseId, out: AudioNode): NoiseHandle {
  return TEXTURES[id](c, out)
}
