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
  getMasterVolume,
  getSoundServerSnapshot,
  getSoundSnapshot,
  getUiVolume,
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
export function SoundMenu() {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  const ui = useSyncExternalStore(subscribeSound, getSoundSnapshot, getSoundServerSnapshot)
  const amb = useSyncExternalStore(
    subscribeAmbience,
    getAmbienceSnapshot,
    getAmbienceServerSnapshot,
  )

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
        className={active ? 'on' : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <SpeakerIcon on={active} />
        Sound <span aria-hidden>▾</span>
      </button>

      {open ? (
        <div className="arrange__menu sound__menu" role="menu">
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
              {amb.error
                ? amb.error
                : amb.loading
                  ? 'connecting…'
                  : amb.playing
                    ? `playing · ${amb.station.label}`
                    : 'chill beats in the background'}
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
                    {live ? (
                      <span className="eq" aria-label="now playing">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : selected && amb.loading ? (
                      <span className="arrange__hint">connecting…</span>
                    ) : null}
                  </span>
                  <span className="arrange__hint">{s.blurb}</span>
                </button>
              )
            })}
          </div>

          {/*
            * Three levels, master first and visually heavier: it scales the other two, so it
            * reads as the parent rather than a third peer.
            */}
          <div className="mix">
            <Fader
              label="Master"
              primary
              value={getMasterVolume()}
              onChange={setMasterVolume}
            />
            <Fader label="Music" value={amb.volume} onChange={setAmbienceVolume} />
            <Fader label="Interface" value={getUiVolume()} onChange={(v) => {
              setUiVolume(v)
              if (ui) play('hover')
            }} />
          </div>

          <p className="sound__credit">Ambience is public internet radio · streams may vary</p>
        </div>
      ) : null}
    </div>
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
