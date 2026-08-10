'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import {
  STATIONS,
  type Station,
  getAmbienceServerSnapshot,
  getAmbienceSnapshot,
  playAmbience,
  setAmbienceMaster,
  setAmbienceVolume,
  shuffleStation,
  stopAmbience,
  subscribeAmbience,
} from '@/lib/ambience'
import {
  getSoundServerSnapshot,
  getSoundSnapshot,
  getVolumes,
  getVolumesServerSnapshot,
  onMaster,
  play,
  setMasterVolume,
  setSoundOn,
  setUiVolume,
  subscribeSound,
} from '@/lib/audio'

/**
 * Sound controls: interface cues and background ambience are separate things, so they get
 * separate switches. Ambience is a live radio stream, hence the loading and error states —
 * a station can be down, and silently doing nothing would look like a broken button.
 */
export function SoundMenu({ tip }: { tip?: string }) {
  const [open, setOpen] = useState(false)
  /** Master is enough most of the time; the other two levels stay folded away. */
  const [mixOpen, setMixOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  const ui = useSyncExternalStore(subscribeSound, getSoundSnapshot, getSoundServerSnapshot)
  const amb = useSyncExternalStore(
    subscribeAmbience,
    getAmbienceSnapshot,
    getAmbienceServerSnapshot,
  )
  // levels ride the same store as the on/off flag, so moving a fader re-renders the menu
  const vol = useSyncExternalStore(subscribeSound, getVolumes, getVolumesServerSnapshot)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', away)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  // master lives in lib/audio but has to scale the ambience element too, which it doesn't own
  useEffect(() => onMaster(setAmbienceMaster), [])

  const active = ui || amb.playing
  const pick = (s: Station) => void playAmbience(s)

  return (
    <div className="arrange sound" ref={wrap}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Sound"
        className={active ? 'on' : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <SpeakerIcon on={active} />
        Sound <span aria-hidden>▾</span>
      </button>
      {tip ? <span className="pill__tip">{tip}</span> : null}

      <div className="arrange__menu sound__menu" role="menu" data-open={open || undefined}>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={ui}
            onClick={() => {
              const next = !ui
              setSoundOn(next)
              if (next) play('open')
            }}
          >
            <span className="sound__row">
              <span className="arrange__label">Interface sounds</span>
              <span className={ui ? 'sw sw--on' : 'sw'} aria-hidden />
            </span>
            <span className="arrange__hint">soft lofi cues on click and hover</span>
          </button>

          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={amb.playing}
            onClick={() => (amb.playing ? stopAmbience() : void playAmbience(amb.station))}
          >
            <span className="sound__row">
              <span className="arrange__label">Ambience</span>
              <span className={amb.playing ? 'sw sw--on' : 'sw'} aria-hidden />
            </span>
            <span className="arrange__hint">
              {amb.error ? (
                amb.error
              ) : amb.loading ? (
                <>
                  <Spinner label="Connecting" inline /> connecting
                </>
              ) : amb.playing ? (
                `playing · ${amb.station.label}`
              ) : (
                'chill beats in the background'
              )}
            </span>
          </button>

          <div className="sound__stations">
            <div className="sound__head">
              <span>Station</span>
              <button type="button" className="sound__shuffle" onClick={() => pick(shuffleStation())}>
                shuffle
              </button>
            </div>
            {STATIONS.map((s) => {
              const selected = amb.station.id === s.id
              const live = selected && amb.playing
              return (
                <button
                  key={s.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  aria-current={live ? 'true' : undefined}
                  className={live ? 'is-active is-playing' : selected ? 'is-active' : undefined}
                  onClick={() => pick(s)}
                >
                  <span className="sound__row">
                    <span className="arrange__label">{s.label}</span>
                    <span className="arrange__hint station__blurb">{s.blurb}</span>
                    {live ? (
                      <span className="eq" aria-label="now playing">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : selected && amb.loading ? (
                      <Spinner label="Connecting" />
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>

          {/*
            * Three levels, master first and visually heavier: it scales the other two, so it
            * reads as the parent rather than a third peer.
            */}
          <div className="mix">
            <div className="mix__master">
              <Fader label="Master" primary value={vol.master} onChange={setMasterVolume} />
              <button
                type="button"
                className="mix__toggle"
                aria-expanded={mixOpen}
                aria-controls="mix-detail"
                onClick={() => setMixOpen((o) => !o)}
              >
                {/* a chevron that rotates reads as "there is more below", and animates for free */}
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
                <span className="sr-only">
                  {mixOpen ? 'Hide music and interface levels' : 'Show music and interface levels'}
                </span>
              </button>
            </div>
            {/*
              * Always mounted, collapsed with grid-template-rows: 0fr. That is the only way to
              * transition to an unknown content height — max-height guessing either clips the
              * content or eases against a wrong value and stutters.
              */}
            <div className="mix__detail" id="mix-detail" data-open={mixOpen || undefined}>
              <div className="mix__detail-inner">
                <Fader label="Music" value={amb.volume} onChange={setAmbienceVolume} />
                <Fader
                  label="Interface"
                  value={vol.ui}
                  onChange={(v) => {
                    setUiVolume(v)
                    if (ui) play('hover')
                  }}
                />
              </div>
            </div>
          </div>

        <p className="sound__credit">Ambience is public internet radio · streams may vary</p>
      </div>
    </div>
  )
}

/**
 * Connection spinner. A ring with a gap, rotated — no text that has to be re-measured, and it
 * occupies the same slot the equaliser will, so the row doesn't jump when the stream starts.
 */
function Spinner({ label, inline }: { label: string; inline?: boolean }) {
  return (
    <span className={inline ? 'spinner spinner--inline' : 'spinner'} role="status" aria-label={label} />
  )
}

function Fader({
  label,
  value,
  onChange,
  primary,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  primary?: boolean
}) {
  const pct = Math.round(value * 100)
  return (
    <label className={primary ? 'fader fader--primary' : 'fader'}>
      <span className="fader__name">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        aria-label={`${label} volume`}
        style={{ ['--fill' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="fader__pct">{pct}</span>
    </label>
  )
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
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
