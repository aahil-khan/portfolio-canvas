'use client'

import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { useBarPanel } from '@/components/lab/bar-panel'
import {
  STATIONS,
  type Station,
  getAmbienceServerSnapshot,
  getAmbienceSnapshot,
  playAmbience,
  playNoise,
  setAmbienceMaster,
  setAmbienceVolume,
  setNoiseVolume,
  shuffleStation,
  stopAmbience,
  stopNoise,
  subscribeAmbience,
} from '@/lib/ambience'
import {
  LAB_CUES,
  type LabCue,
  getMixServerSnapshot,
  getMixSnapshot,
  getVolumes,
  getVolumesServerSnapshot,
  onMaster,
  play,
  setMasterVolume,
  setMuted,
  setSoundOn,
  setUiVolume,
  subscribeSound,
} from '@/lib/audio'
import { track } from '@/lib/events'
import { useReducedMotion } from '@/lib/motion/reduced'
import { EASE_BEZIER, LAB, REDUCED, sec } from '@/lib/motion/tokens'
import { NOISE_IDS, type NoiseId } from '@/lib/noise'

export interface SoundLabels {
  label: string
  title: string
  ui: string
  uiHint: string
  ambience: string
  ambienceOff: string
  connecting: string
  playing: string
  error: string
  source: string
  radio: string
  noise: string
  shuffle: string
  now: string
  noises: Record<NoiseId, { label: string; hint: string }>
  master: string
  music: string
  noiseLevel: string
  interface: string
  masterVolume: string
  musicVolume: string
  noiseVolume: string
  interfaceVolume: string
  mute: string
  mixShow: string
  mixHide: string
  credit: string
}

/** The Sound menu's sources. Tracks joins them once Aahil approves a list (plan, open question 3). */
const SOURCES = ['radio', 'noise'] as const
type Source = (typeof SOURCES)[number]

/** At or under this width the menu closes itself on a pick and on a scroll (check:lab rule 24). */
const PHONE = '(max-width: 760px)'
/** How far a phone may scroll under the open menu before it closes. */
const SCROLL_CLOSE = 24

/**
 * The Lab's Sound menu: the canvas's own (`components/desktop/sound-menu.tsx`) row for row, at its
 * size (292 × 417, rule S), in the Lab's window frame. Interface sounds, Ambience, then the sources
 * behind a small segmented row (Radio, the canvas's six stations, with shuffle and the playing
 * meter; Noise, five textures made in the browser), the mixer (Master with Mute, then Music, Noise
 * and Interface folded away), and a credit.
 *
 * It owns no sound. Every state is `lib/audio.ts`'s or `lib/ambience.ts`'s, stored under the
 * canvas's keys, so a choice made here holds on the desk and back. Nothing plays until the reader
 * presses something: a stored "on" is never resumed (rule 23). The menu lives in the bar, outside
 * the routed page, so a station and a noise play on across soft navigations (rule 25).
 *
 * It is also where the Lab's interface cues are heard: `lab:cue` events, and `peek` for a preview
 * opened by a tap, a click or focus, never a hover (API.md §7). No hover sounds, anywhere.
 *
 * A drop-down under its pill at every width, never a sheet, so it keeps the canvas's footprint;
 * opening it reflows nothing. Esc and a press outside close it; on a phone, so do a pick and a
 * scroll.
 */
export function SoundMenu({ labels }: { labels: SoundLabels }) {
  const { open, setOpen, button, panel } = useBarPanel()
  const [source, setSource] = useState<Source>('radio')
  const [mixOpen, setMixOpen] = useState(false)
  /** Opened from the keyboard: focus moves into the menu, as it does in the canvas's. */
  const [byKeyboard, setByKeyboard] = useState(false)
  const reduced = useReducedMotion()

  const mix = useSyncExternalStore(subscribeSound, getMixSnapshot, getMixServerSnapshot)
  const vol = useSyncExternalStore(subscribeSound, getVolumes, getVolumesServerSnapshot)
  const amb = useSyncExternalStore(subscribeAmbience, getAmbienceSnapshot, getAmbienceServerSnapshot)

  // master lives in lib/audio but scales the ambience bus too, which it doesn't own
  useEffect(() => onMaster(setAmbienceMaster), [])

  // the Lab's cues, by event, so no lane imports another (API.md §7)
  useEffect(() => {
    const onCue = (e: Event) => {
      const name = (e as CustomEvent<{ name?: string }>).detail?.name
      if ((LAB_CUES as readonly string[]).includes(name ?? '')) play(name as LabCue)
    }
    const onPreview = (e: Event) => {
      if ((e as CustomEvent<{ via?: string }>).detail?.via !== 'hover') play('peek')
    }
    document.addEventListener('lab:cue', onCue)
    document.addEventListener('lab:preview-open', onPreview)
    return () => {
      document.removeEventListener('lab:cue', onCue)
      document.removeEventListener('lab:preview-open', onPreview)
    }
  }, [])

  useEffect(() => {
    if (open && byKeyboard) panel.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  }, [open, byKeyboard, panel])

  // a phone's open menu closes once the page scrolls under it
  useEffect(() => {
    if (!open || !matchMedia(PHONE).matches) return
    const from = scrollY
    const onScroll = () => {
      if (Math.abs(scrollY - from) > SCROLL_CLOSE) setOpen(false)
    }
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [open, setOpen])

  const closeOnPhone = () => {
    if (matchMedia(PHONE).matches) setOpen(false)
  }
  const pickStation = (s: Station) => {
    void playAmbience(s)
    track('player_start', { source: 'station' })
    closeOnPhone()
  }
  const pickNoise = (id: NoiseId) => {
    if (amb.noise === id) stopNoise()
    else {
      playNoise(id)
      track('player_start', { source: 'noise' })
    }
    closeOnPhone()
  }

  const radioOn = amb.playing || amb.loading
  const ambienceOn = radioOn || !!amb.noise
  const active = mix.enabled || ambienceOn
  const playingNames = [amb.playing ? amb.station.label : null, amb.noise ? labels.noises[amb.noise].label : null].filter(Boolean)
  const status = amb.error
    ? labels.error
    : amb.loading
      ? labels.connecting
      : playingNames.length
        ? [labels.playing, ...playingNames].join(' · ')
        : labels.ambienceOff

  const rise = reduced ? 0 : LAB.windowIn.rise
  const drop = reduced ? 0 : LAB.windowOut.drop

  return (
    <div className="lab-sound" data-needs-js>
      <button
        ref={button}
        type="button"
        className={`lab-ctl lab-sound-btn${active ? ' is-on' : ''}`}
        data-sound
        aria-expanded={open}
        aria-controls="lab-sound"
        aria-label={labels.label}
        onClick={(e) => {
          setByKeyboard(e.detail === 0)
          setOpen((o) => !o)
        }}
      >
        <Speaker on={active} />
        <span className="lab-sound-word" aria-hidden="true">
          {labels.label}
        </span>
        {amb.playing || amb.noise ? <Meter /> : null}
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            ref={panel}
            id="lab-sound"
            className="lab-sound-menu"
            data-sound-menu
            role="dialog"
            aria-label={labels.title}
            data-lenis-prevent
            initial={{ opacity: 0, y: rise }}
            animate={{
              opacity: 1,
              y: 0,
              transition: reduced
                ? { duration: sec(REDUCED.maxDuration) }
                : { duration: sec(LAB.windowIn.duration), ease: EASE_BEZIER, opacity: { duration: sec(LAB.windowIn.opacity), ease: EASE_BEZIER } },
            }}
            exit={{ opacity: 0, y: drop, transition: { duration: sec(reduced ? REDUCED.maxDuration : LAB.windowOut.duration), ease: EASE_BEZIER } }}
          >
            <button
              type="button"
              className="lab-sound-item"
              role="switch"
              aria-checked={mix.enabled}
              data-sound-ui
              onClick={() => {
                const next = !mix.enabled
                setSoundOn(next)
                if (next) play('peek')
              }}
            >
              <span className="lab-sound-row">
                <span className="lab-sound-label">{labels.ui}</span>
                <span className="lab-sw" aria-hidden="true" />
              </span>
              <span className="lab-sound-hint">{labels.uiHint}</span>
            </button>

            <button
              type="button"
              className="lab-sound-item"
              role="switch"
              aria-checked={ambienceOn}
              data-sound-ambience
              onClick={() => {
                if (ambienceOn) {
                  if (radioOn) stopAmbience()
                  stopNoise()
                } else pickStation(amb.station)
              }}
            >
              <span className="lab-sound-row">
                <span className="lab-sound-label">{labels.ambience}</span>
                <span className="lab-sw" aria-hidden="true" />
              </span>
              <span className="lab-sound-hint" aria-live="polite" data-sound-status>
                {amb.loading ? <span className="lab-spin" aria-hidden="true" /> : null}
                {status}
              </span>
            </button>

            <div className="lab-sound-sources">
              <div className="lab-sound-head">
                <div className="lab-sound-seg" role="tablist" aria-label={labels.source}>
                  {SOURCES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="tab"
                      id={`lab-sound-tab-${s}`}
                      aria-controls={`lab-sound-${s}`}
                      aria-selected={source === s}
                      tabIndex={source === s ? 0 : -1}
                      data-sound-tab={s}
                      onClick={() => setSource(s)}
                      onKeyDown={(e) => {
                        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                        const next = SOURCES[(SOURCES.indexOf(s) + (e.key === 'ArrowRight' ? 1 : SOURCES.length - 1)) % SOURCES.length]
                        setSource(next)
                        document.getElementById(`lab-sound-tab-${next}`)?.focus()
                      }}
                    >
                      {labels[s]}
                    </button>
                  ))}
                </div>
                {source === 'radio' ? (
                  <button type="button" className="lab-sound-shuffle" data-sound-shuffle onClick={() => pickStation(shuffleStation())}>
                    {labels.shuffle}
                  </button>
                ) : null}
              </div>

              <div className="lab-sound-list" role="tabpanel" id="lab-sound-radio" aria-labelledby="lab-sound-tab-radio" hidden={source !== 'radio'}>
                {STATIONS.map((s) => {
                  const selected = amb.station.id === s.id
                  const live = selected && amb.playing
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="lab-sound-pick"
                      data-station={s.id}
                      aria-pressed={selected && radioOn}
                      data-selected={selected || undefined}
                      data-live={live || undefined}
                      onClick={() => pickStation(s)}
                    >
                      <span className="lab-sound-label">{s.label}</span>
                      <span className="lab-sound-hint">{s.blurb}</span>
                      {live ? <Meter label={labels.now} /> : selected && amb.loading ? <span className="lab-spin" aria-hidden="true" /> : null}
                    </button>
                  )
                })}
              </div>

              <div className="lab-sound-list" role="tabpanel" id="lab-sound-noise" aria-labelledby="lab-sound-tab-noise" hidden={source !== 'noise'}>
                {NOISE_IDS.map((id) => {
                  const live = amb.noise === id
                  return (
                    <button
                      key={id}
                      type="button"
                      className="lab-sound-pick"
                      data-noise={id}
                      aria-pressed={live}
                      data-selected={live || undefined}
                      data-live={live || undefined}
                      onClick={() => pickNoise(id)}
                    >
                      <span className="lab-sound-label">{labels.noises[id].label}</span>
                      <span className="lab-sound-hint">{labels.noises[id].hint}</span>
                      {live ? <Meter label={labels.now} /> : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="lab-mix">
              <div className="lab-mix-master">
                <Fader name={labels.master} label={labels.masterVolume} primary value={vol.master} onChange={setMasterVolume} />
                <button
                  type="button"
                  className="lab-mix-btn"
                  data-sound-mute
                  aria-pressed={mix.muted}
                  aria-label={labels.mute}
                  title={labels.mute}
                  onClick={() => setMuted(!mix.muted)}
                >
                  <MuteIcon muted={mix.muted} />
                </button>
                <button
                  type="button"
                  className="lab-mix-btn"
                  aria-expanded={mixOpen}
                  aria-controls="lab-mix-detail"
                  aria-label={mixOpen ? labels.mixHide : labels.mixShow}
                  onClick={() => setMixOpen((o) => !o)}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </div>
              <div className="lab-mix-detail" id="lab-mix-detail" data-open={mixOpen || undefined} inert={!mixOpen}>
                <div className="lab-mix-detail-in">
                  <Fader name={labels.music} label={labels.musicVolume} value={amb.volume} onChange={setAmbienceVolume} />
                  <Fader name={labels.noiseLevel} label={labels.noiseVolume} value={amb.noiseVolume} onChange={setNoiseVolume} />
                  <Fader
                    name={labels.interface}
                    label={labels.interfaceVolume}
                    value={vol.ui}
                    onChange={(v) => {
                      setUiVolume(v)
                      play('peek')
                    }}
                  />
                </div>
              </div>
            </div>

            <p className="lab-sound-credit">{labels.credit}</p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Fader({ name, label, value, onChange, primary }: { name: string; label: string; value: number; onChange: (v: number) => void; primary?: boolean }) {
  const pct = Math.round(value * 100)
  return (
    <label className={primary ? 'lab-fader is-primary' : 'lab-fader'}>
      <span className="lab-fader-name">{name}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        aria-label={label}
        style={{ ['--fill' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="lab-fader-pct">{pct}</span>
    </label>
  )
}

/** The canvas's playing meter: three bars. Still under reduced motion, where it still reads. */
function Meter({ label }: { label?: string }) {
  return (
    <span className="lab-eq" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <i />
      <i />
      <i />
    </span>
  )
}

function Speaker({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      {on ? (
        <>
          <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
          <path d="M18 7a7 7 0 0 1 0 10" />
        </>
      ) : (
        <path d="m16 10 4 4m0-4-4 4" />
      )}
    </svg>
  )
}

function MuteIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      {muted ? <path d="m16 10 4 4m0-4-4 4" /> : <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />}
    </svg>
  )
}
