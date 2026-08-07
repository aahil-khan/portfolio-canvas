'use client'

/**
 * Background ambience — continuous chill/lofi radio.
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
  playing: boolean
  loading: boolean
  station: Station
  volume: number
  error: string | null
}

let el: HTMLAudioElement | null = null
let state: AmbienceState = {
  playing: false,
  loading: false,
  station: STATIONS[0],
  volume: 0.5,
  error: null,
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
  el.volume = state.volume * master
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
  emit()
}

export function setAmbienceVolume(v: number): void {
  const volume = Math.min(1, Math.max(0, v))
  if (el) el.volume = volume * master
  set({ volume })
  try {
    localStorage.setItem(KEY_VOL, String(volume))
  } catch {}
}
