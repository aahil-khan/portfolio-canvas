'use client'

import { audioContext, isMuted, subscribeSound } from '@/lib/audio'
import { FADE, startNoise, type NoiseHandle, type NoiseId } from '@/lib/noise'

/**
 * Background ambience: two sources, a station (continuous chill/lofi radio) and, in the Lab, a
 * noise (`lib/noise.ts`, synthesised). Either can play alone, or both together.
 *
 * Played through a plain `<audio>` element rather than Web Audio. That is deliberate: an
 * `<audio>` element can play a cross-origin stream with no CORS headers at all, whereas routing
 * one through an AudioContext requires `crossOrigin` and CORS on the server, which these
 * stations do not send. The trade is that ambience can't share the synth's filter bus — fine,
 * since it is already mastered music.
 *
 * Station choice is not arbitrary. SomaFM was the obvious pick and had to be dropped: it returns
 * 403 to any request carrying a `Referer`, which is deliberate hotlink protection, and every
 * browser page sends one. `referrerpolicy="no-referrer"` would defeat it, but that is evading a
 * restriction they set on purpose. Every station below was verified twice: 200/206 audio/mpeg with a
 * real browser Referer, and then actually loaded in Chrome (`readyState > 0`, no media error).
 * `stream.laut.fm` passed the first check and failed the second — curl is not enough here. The playing station is always named in the UI.
 */

export interface Station {
  id: string
  label: string
  blurb: string
  url: string
}

export const STATIONS: readonly Station[] = [
  { id: 'lofi', label: 'Lo-Fi', blurb: 'the classic study beat', url: 'https://stream.0nlineradio.com/lo-fi' },
  { id: 'chillhop', label: 'Chillhop', blurb: 'jazzy hip-hop instrumentals', url: 'https://ilm.stream35.radiohost.de/ilm_ilovechillhop_mp3-192' },
  { id: 'reyfm', label: 'REYFM Lofi', blurb: 'mellow, beat-driven', url: 'https://listen.reyfm.de/lofi_128kbps.mp3' },
  { id: 'plaza', label: 'Nightwave Plaza', blurb: 'vaporwave, late-night mall', url: 'https://radio.plaza.one/mp3' },
  { id: 'isekoi', label: 'Chill Zone', blurb: 'anime-adjacent chill', url: 'https://public.isekoi-radio.com/listen/chill/radio.mp3' },
  { id: 'lounge', label: 'Workday Lounge', blurb: 'downtempo, background', url: 'https://stream.epic-lounge.com/workday-lounge' },
]

const KEY_ON = 'canvas.ambience'
const KEY_STATION = 'canvas.station'
const KEY_VOL = 'canvas.ambienceVolume'

export type AmbienceState = {
  /** The station, not the noise: `playing` and `loading` are the radio's. */
  playing: boolean
  loading: boolean
  station: Station
  volume: number
  error: string | null
  /** The noise playing, if any. */
  noise: NoiseId | null
  /** The noise's own level, 0–1, under Master. */
  noiseVolume: number
}

let el: HTMLAudioElement | null = null
let state: AmbienceState = {
  playing: false,
  loading: false,
  station: STATIONS[0],
  volume: 0.5,
  error: null,
  noise: null,
  noiseVolume: 0.5,
}
let loaded = false
const listeners = new Set<() => void>()

const emit = () => {
  for (const l of listeners) l()
}
const set = (patch: Partial<AmbienceState>) => {
  state = { ...state, ...patch }
  emit()
}

function element(): HTMLAudioElement {
  if (el) return el
  el = new Audio()
  el.preload = 'none'
  /*
   * Kept in the document rather than floating as a detached object. A detached element plays
   * fine, but nothing — devtools, the browser's media controls, or a test — can observe it,
   * which is how a master-volume bug went unnoticed. `hidden` keeps it out of layout and off
   * the accessibility tree.
   */
  el.hidden = true
  el.setAttribute('aria-hidden', 'true')
  document.body.appendChild(el)
  el.volume = state.volume * master
  el.muted = isMuted()
  followMute()
  el.addEventListener('playing', () => set({ playing: true, loading: false, error: null }))
  el.addEventListener('waiting', () => set({ loading: true }))
  el.addEventListener('error', () =>
    set({ playing: false, loading: false, error: 'Station unavailable' }),
  )
  return el
}

export function subscribeAmbience(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function getAmbienceSnapshot(): AmbienceState {
  if (!loaded) {
    loaded = true
    try {
      const id = localStorage.getItem(KEY_STATION)
      const vol = Number(localStorage.getItem(KEY_VOL))
      state = {
        ...state,
        station: STATIONS.find((s) => s.id === id) ?? STATIONS[0],
        volume: Number.isFinite(vol) && vol > 0 ? vol : 0.5,
      }
    } catch {
      /* private mode */
    }
  }
  return state
}

const SERVER: AmbienceState = {
  playing: false,
  loading: false,
  station: STATIONS[0],
  volume: 0.5,
  error: null,
  noise: null,
  noiseVolume: 0.5,
}
export const getAmbienceServerSnapshot = (): AmbienceState => SERVER

export function stopAmbience(): void {
  element().pause()
  set({ playing: false, loading: false })
  try {
    localStorage.setItem(KEY_ON, 'off')
  } catch {}
}

export async function playAmbience(station = state.station): Promise<void> {
  const a = element()
  set({ station, loading: true, error: null })
  try {
    localStorage.setItem(KEY_STATION, station.id)
    localStorage.setItem(KEY_ON, 'on')
  } catch {}
  // reassigning src is what actually switches station; a stream never "ends" on its own
  a.src = station.url
  a.volume = state.volume * master
  try {
    await a.play()
  } catch {
    // autoplay policy, or the station is down — either way, say so rather than failing silently
    set({ playing: false, loading: false, error: 'Could not start playback' })
  }
}

/**
 * Resume the last session's ambience.
 *
 * `play()` cannot be called on load: browsers require a user gesture, and calling it anyway
 * just produces a rejected promise and a spurious error in the UI. So the intent is honoured on
 * the *first* interaction of the visit instead — click, key or touch, whichever comes first.
 */
export function resumeAmbienceOnFirstGesture(): () => void {
  let wanted = false
  try {
    wanted = localStorage.getItem(KEY_ON) === 'on'
  } catch {
    return () => {}
  }
  if (!wanted) return () => {}

  const go = () => {
    off()
    void playAmbience(getAmbienceSnapshot().station)
  }
  const off = () => {
    window.removeEventListener('pointerdown', go)
    window.removeEventListener('keydown', go)
  }
  window.addEventListener('pointerdown', go, { once: true })
  window.addEventListener('keydown', go, { once: true })
  return off
}

/** A different station from the current one, so "shuffle" always changes something. */
export function shuffleStation(): Station {
  const others = STATIONS.filter((s) => s.id !== state.station.id)
  return others[Math.floor(Math.random() * others.length)] ?? STATIONS[0]
}

/** Master multiplier, owned by lib/audio so one control can scale both buses. */
let master = 1
export function setAmbienceMaster(m: number): void {
  master = Math.min(1, Math.max(0, m))
  if (el) el.volume = state.volume * master
  applyNoiseLevels()
  emit()
}

/*
 * Mute is lib/audio's (the one owner). Ambience follows it: the element is muted, and the noise
 * bus's output drops to zero, while both keep their place, so unmuting picks up where it was.
 */
let following = false
function followMute(): void {
  if (following) return
  following = true
  subscribeSound(() => {
    if (el) el.muted = isMuted()
    applyNoiseLevels()
  })
}

/*
 * The noise bus, on the site's one AudioContext and apart from the interface cue bus:
 *
 *   texture → fade → level (the Noise fader) → limiter (−12 dB, 8:1) → trim → out (Master, Mute) → speakers
 *
 * Built the first time a noise is picked, never on load. The limiter keeps a texture from ever
 * leaving the ceiling, whatever the fader says; the fade is the same 0.8s for every texture.
 */
let bus: { level: GainNode; limiter: DynamicsCompressorNode; out: GainNode } | null = null

/*
 * A DynamicsCompressorNode adds make-up gain of its own (Web Audio spec: (1 / gain at 0 dBFS)^0.6).
 * At −12 dB and 8:1 a full-scale input comes out at −10.5 dB, so it lifts everything by
 * 0.6 × 10.5 = 6.3 dB, and a texture voiced at 0.22 reached the speakers at 0.45. This trim takes
 * exactly that back off, so the limiter only ever limits.
 */
const LIMITER = { threshold: -12, ratio: 8 }
const MAKEUP_TRIM = 10 ** (-(0.6 * (-LIMITER.threshold - -LIMITER.threshold / LIMITER.ratio)) / 20)
let voice: { id: NoiseId; fade: GainNode; handle: NoiseHandle } | null = null

function noiseBus(): NonNullable<typeof bus> {
  if (bus) return bus
  const c = audioContext()
  const level = c.createGain()
  const limiter = c.createDynamicsCompressor()
  limiter.threshold.value = LIMITER.threshold
  limiter.ratio.value = LIMITER.ratio
  limiter.knee.value = 0
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  const trim = c.createGain()
  trim.gain.value = MAKEUP_TRIM
  const out = c.createGain()
  level.connect(limiter).connect(trim).connect(out).connect(c.destination)
  bus = { level, limiter, out }
  followMute()
  applyNoiseLevels()
  return bus
}

function applyNoiseLevels(): void {
  if (!bus) return
  bus.level.gain.value = state.noiseVolume
  bus.out.gain.value = isMuted() ? 0 : master
}

function fadeOut(v: NonNullable<typeof voice>): void {
  const c = audioContext()
  const t = c.currentTime
  v.fade.gain.cancelScheduledValues(t)
  v.fade.gain.setValueAtTime(v.fade.gain.value, t)
  v.fade.gain.linearRampToValueAtTime(0, t + FADE)
  setTimeout(() => {
    v.handle.stop()
    v.fade.disconnect()
  }, FADE * 1000 + 60)
}

/** Plays a noise, fading in, in place of any other noise. A station, if one plays, carries on. */
export function playNoise(id: NoiseId): void {
  if (voice?.id === id) return
  const { level } = noiseBus()
  const c = audioContext()
  if (voice) fadeOut(voice)
  const fade = c.createGain()
  const t = c.currentTime
  fade.gain.setValueAtTime(0, t)
  fade.gain.linearRampToValueAtTime(1, t + FADE)
  fade.connect(level)
  voice = { id, fade, handle: startNoise(c, id, fade) }
  set({ noise: id })
}

/** Fades the noise out. */
export function stopNoise(): void {
  if (!voice) return
  fadeOut(voice)
  voice = null
  set({ noise: null })
}

/** The Noise fader. Held for the visit only (no storage key holds it: API.md §10). */
export function setNoiseVolume(v: number): void {
  const noiseVolume = Math.min(1, Math.max(0, v))
  set({ noiseVolume })
  applyNoiseLevels()
}

export function setAmbienceVolume(v: number): void {
  const volume = Math.min(1, Math.max(0, v))
  if (el) el.volume = volume * master
  set({ volume })
  try {
    localStorage.setItem(KEY_VOL, String(volume))
  } catch {}
}
