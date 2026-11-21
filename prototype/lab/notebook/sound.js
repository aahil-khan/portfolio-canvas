/*
 * prototype/lab/night-mode/sound.js: the Lab's ears. ONE AudioContext and ONE mute, both owned here.
 *
 * Self-contained for the mockup (lib/audio.ts is not touched). In the React build this becomes a
 * "terminal" patch on lib/audio.ts's existing chain (research ★7A): a per-cue flag, LP ~3 kHz,
 * no wobble, drier, and narration as a voice bus on the same context.
 *
 *   NIGHT.sound.muted               true on arrival: nothing makes a sound until snd:on is pressed
 *   NIGHT.sound.setMuted(on), .toggle()   the ONLY place the cue mute changes (the deck calls it)
 *   NIGHT.sound.cue(name, i)        key · cursor · enter · chirp-open · chirp-close · select · boot
 *   NIGHT.sound.ctx()               the one AudioContext, created on the first gesture that needs it
 *   NIGHT.sound.voiceBus()          where narration plays (voice.js). It does not follow the cue mute:
 *                                   narration plays only on an explicit ▸, and that press is the consent
 *   NIGHT.sound.duck(on)            narration ducks the cues to 25 % and silences key / cursor
 *   NIGHT.sound.on(fn)              told when the mute changes
 *
 * The cues are pentatonic (C D E G A), at gains 0.003–0.03 before a make-up gain of 2.5, as in
 * DIRECTION.md: the numbers encode the balance between cues; the make-up sets the level.
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]
  // name → [notes as indices into PENTA (or Hz), each note's ms, gain, wave]
  const CUES = {
    key: { notes: [7], ms: 14, gain: 0.004, wave: 'square', rate: 32 },
    cursor: { notes: [0], ms: 26, gain: 0.006, wave: 'triangle', rate: 45 },
    enter: { notes: [2, 5], ms: 55, gain: 0.018, wave: 'triangle' },
    'chirp-open': { sweep: [523.25, 1046.5], ms: 80, gain: 0.012, wave: 'sine' },
    'chirp-close': { sweep: [1046.5, 523.25], ms: 80, gain: 0.012, wave: 'sine' },
    select: { notes: [3, 6], ms: 70, gain: 0.02, wave: 'sine', chord: true },
    boot: { notes: [0, 2, 3, 5], ms: 60, gain: 0.03, wave: 'triangle' },
  }
  const MAKEUP = 2.5, DUCK = 0.25
  const S = (NIGHT.sound = { muted: true, CUES: Object.keys(CUES) })
  let ac = null, master, cueBus, lp, voice, ducked = false
  const last = {}
  const subs = new Set()

  S.ctx = () => {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      ac = new AC()
      master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination)
      // the terminal patch: low-passed and dry
      lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = 0.5
      cueBus = ac.createGain(); cueBus.gain.value = S.muted ? 0 : MAKEUP
      cueBus.connect(lp); lp.connect(master)
      voice = ac.createGain(); voice.gain.value = 1; voice.connect(master)
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {})
    return ac
  }
  S.voiceBus = () => (S.ctx() ? voice : null)
  const level = () => (S.muted ? 0 : MAKEUP * (ducked ? DUCK : 1))
  const setLevel = () => { if (cueBus) cueBus.gain.setTargetAtTime(level(), ac.currentTime, 0.03) }

  S.setMuted = (on) => {
    S.muted = !!on
    if (!S.muted) S.ctx() // the unmute press is the gesture that unlocks the context
    setLevel()
    for (const f of subs) f(S.muted)
  }
  S.toggle = () => S.setMuted(!S.muted)
  S.on = (fn) => { subs.add(fn); return () => subs.delete(fn) }
  S.duck = (on) => { ducked = !!on; setLevel() }

  S.cue = (name, i = 0) => {
    const c = CUES[name]
    if (!c || S.muted) return false
    // key and cursor: rate-limited, and never under narration
    if ((name === 'key' || name === 'cursor') && ducked) return false
    const now = performance.now()
    if (c.rate && now - (last[name] || 0) < c.rate) return false
    last[name] = now
    if (!S.ctx()) return false
    const t0 = ac.currentTime + 0.005
    const voiceAt = (f, at, ms, f1) => {
      const o = ac.createOscillator(), g = ac.createGain()
      o.type = c.wave
      o.frequency.setValueAtTime(f, at)
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, at + ms / 1000)
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(c.gain, at + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000)
      o.connect(g); g.connect(cueBus)
      o.start(at); o.stop(at + ms / 1000 + 0.02)
    }
    if (c.sweep) voiceAt(c.sweep[0], t0, c.ms, c.sweep[1])
    else c.notes.forEach((n, k) => voiceAt(PENTA[(n + (name === 'cursor' ? i : 0)) % PENTA.length], c.chord ? t0 : t0 + (k * c.ms) / 1000, c.ms))
    return true
  }
})()
