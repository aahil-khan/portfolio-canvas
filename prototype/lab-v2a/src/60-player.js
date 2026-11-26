/* The side player: the canvas's Sound menu, in the bar. Collapsed it is one Music button; open, a
   340px window under the bar (desktop) or a bottom sheet (phone). Stations come from lib/ambience.ts
   and stream only after a tap. Tracks and noise arrive in Task 4. The <audio> element lives outside
   #app, so playback survives every hash navigation. */

const STATIONS = [
  { id: 'lofi', label: 'Lo-Fi', blurb: 'the classic study beat', url: 'https://stream.0nlineradio.com/lo-fi' },
  { id: 'chillhop', label: 'Chillhop', blurb: 'jazzy hip-hop instrumentals', url: 'https://ilm.stream35.radiohost.de/ilm_ilovechillhop_mp3-192' },
  { id: 'reyfm', label: 'REYFM Lofi', blurb: 'mellow, beat-driven', url: 'https://listen.reyfm.de/lofi_128kbps.mp3' },
  { id: 'plaza', label: 'Nightwave Plaza', blurb: 'vaporwave, late-night mall', url: 'https://radio.plaza.one/mp3' },
  { id: 'isekoi', label: 'Chill Zone', blurb: 'anime-adjacent chill', url: 'https://public.isekoi-radio.com/listen/chill/radio.mp3' },
  { id: 'lounge', label: 'Workday Lounge', blurb: 'downtempo, background', url: 'https://stream.epic-lounge.com/workday-lounge' },
]

const player = (() => {
  let audio = null
  let playing = null
  const vol = (k, d) => Math.min(1, Math.max(0, Number(store.get(k, d)) || 0))
  const apply = () => { if (audio) audio.volume = vol('canvas.ambienceVolume', '0.5') * vol('canvas.masterVolume', '0.8') }
  function play(id) {
    const st = STATIONS.find((s) => s.id === id)
    if (!st) return
    if (!audio) { audio = new Audio(); audio.preload = 'none'; document.body.appendChild(audio) }
    audio.src = st.url
    apply()
    audio.play().catch(() => { /* a blocked or dead stream stays named but silent */ })
    playing = st
    store.set('canvas.station', st.id)
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: st.label, artist: st.blurb, album: UI.home.title })
    refresh()
  }
  function stop() { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load() } playing = null; refresh() }
  function refresh() {
    $$('[data-player]').forEach((b) => { b.innerHTML = playerButtonInner() })
    const panel = floats.current || sheet.current
    if (panel && panel.querySelector('[data-stations]')) panel.querySelector('[data-stations]').innerHTML = stationRows()
  }
  const stationRows = () => {
    const pre = playing ? playing.id : store.get('canvas.station', 'lofi')
    return STATIONS.map((s) => `<button type="button" class="station${playing && playing.id === s.id ? ' cur' : ''}" data-station="${s.id}" aria-pressed="${!!(playing && playing.id === s.id)}">` +
      `<span><span class="n">${esc(s.label)}</span><span class="b">${esc(s.blurb)}</span></span>` +
      `<span class="p">${playing && playing.id === s.id ? esc(UI.player.playing) : (!playing && pre === s.id ? '' : '')}</span></button>`).join('') +
      `<button type="button" class="station" data-station="shuffle"><span><span class="n">${esc(UI.player.shuffle)}</span></span><span class="p"></span></button>` +
      (playing ? `<button type="button" class="station" data-station="stop"><span><span class="n">${esc(UI.player.stop)}</span></span><span class="p"></span></button>` : '')
  }
  function panelHtml(asSheet) {
    const body = `<div class="sect"><p class="grp">${esc(UI.player.stations)}</p><div data-stations>${stationRows()}</div></div>
      <div class="sect"><p class="grp">${esc(UI.player.mixer)}</p>
        <label class="fader">${esc(UI.player.master)}<input type="range" min="0" max="100" value="${Math.round(vol('canvas.masterVolume', '0.8') * 100)}" data-fader="canvas.masterVolume"></label>
        <label class="fader">${esc(UI.player.music)}<input type="range" min="0" max="100" value="${Math.round(vol('canvas.ambienceVolume', '0.5') * 100)}" data-fader="canvas.ambienceVolume"></label>
        <button type="button" class="switch" role="switch" aria-checked="${sound.on}" data-ui-sound>${esc(UI.player.interface)}<span class="track" aria-hidden="true"></span></button>
        <p class="later">${esc(UI.player.later)}</p></div>`
    return asSheet ? body : `<div class="win player-win"><div class="win-bar"><span class="win-label">${esc(UI.player.title)}</span><button class="x" type="button" data-close>${esc(UI.close)}</button></div>${body}</div>`
  }
  function paint(el) { $$('input[type=range]', el).forEach((r) => r.style.setProperty('--v', `${r.value}%`)) }
  function open(trigger) {
    if (phone.matches) sheet.open({ trigger, label: UI.player.title, html: panelHtml(true), onOpen: paint })
    else floats.open({ trigger, where: 'right', label: UI.player.title, html: panelHtml(false), onOpen: paint })
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-player]')
    if (b) { open(b); return }
    const s = e.target.closest('[data-station]')
    if (s) {
      const id = s.dataset.station
      if (id === 'stop') stop()
      else if (id === 'shuffle') play(STATIONS.filter((x) => x.id !== playing?.id)[Math.floor(Math.random() * (STATIONS.length - 1))].id)
      else if (playing && playing.id === id) stop()
      else play(id)
      return
    }
    const u = e.target.closest('[data-ui-sound]')
    if (u) sound.toggle()
  })
  document.addEventListener('input', (e) => {
    const r = e.target.closest('[data-fader]')
    if (!r) return
    r.style.setProperty('--v', `${r.value}%`)
    const v = Number(r.value) / 100
    if (r.dataset.fader === 'canvas.masterVolume') sound.setMaster(v)
    else store.set(r.dataset.fader, String(v))
    apply()
  })
  sound.subscribe((on) => $$('[data-ui-sound]').forEach((x) => x.setAttribute('aria-checked', String(on))))
  return { get playing() { return playing }, stop }
})()

function playerButtonInner() {
  const p = typeof player !== 'undefined' && player.playing
  return p ? `${esc(UI.bar.music)}<span class="now">${esc(p.label)}</span><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>` : esc(UI.bar.music)
}
