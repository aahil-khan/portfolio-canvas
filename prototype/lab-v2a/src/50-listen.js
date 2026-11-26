/* eslint-disable @typescript-eslint/no-unused-vars -- src/*.js are concatenated into one scope by build.mjs, so names are used across files */
/* Listen: the device voice stands in for the pre-rendered narration (labelled as such). A thin strip
   appears only while it plays; the sentence being read gets a soft highlight; the page never scrolls
   itself — if the reader scrolls away, "Back to where it's reading" appears instead. */

const listen = (() => {
  let state = null // { sentences, i, rate, paused, cancel, strip, io }

  function stripHtml() {
    return `<div class="win strip" role="region" aria-label="${esc(UI.bar.listen)}">
      <div class="win-bar"><span class="win-label" data-voice>${esc(voiceOut.hasVoice() ? UI.listen.standIn : UI.listen.silent)}</span></div>
      <div class="strip-in">
        <span class="where" aria-live="polite" data-where></span>
        <button type="button" class="speed" data-rate="1" aria-label="Speed, tap to change">1×</button>
        <button type="button" data-pause>${esc(UI.listen.pause)}</button>
        <button type="button" data-stop>${esc(UI.listen.stop)}</button>
        <button type="button" class="back" data-back hidden>${esc(UI.listen.back)}</button>
      </div></div>`
  }
  function mark() {
    const s = state
    $$('.s.reading').forEach((x) => x.classList.remove('reading'))
    const cur = s.sentences[s.i]
    if (!cur) return
    cur.classList.add('reading')
    $('[data-where]', s.strip).textContent = `${UI.listen.sentence} ${s.i + 1} ${UI.meta.of} ${s.sentences.length}`
    s.io.disconnect()
    s.io.observe(cur)
  }
  function speakFrom(i) {
    const s = state
    if (!s) return
    s.cancel?.()
    s.i = i
    if (i >= s.sentences.length) { stop(); return }
    mark()
    s.cancel = voiceOut.speak(s.sentences[i].textContent, { rate: s.rate, onend: () => { if (state === s && !s.paused) speakFrom(s.i + 1) } })
  }
  function start() {
    if (state) { stop(); return }
    const sentences = $$('[data-body] .s').filter((x) => !x.closest('[data-artifact]'))
    if (!sentences.length) return
    const host = document.createElement('div')
    host.innerHTML = stripHtml().trim()
    const strip = host.firstElementChild
    document.body.appendChild(strip)
    document.body.classList.add('listening')
    motion.animate(strip, [{ opacity: 0, transform: phone.matches ? 'translateY(12px)' : 'translate(-50%, 12px)' }, { opacity: 1, transform: phone.matches ? 'none' : 'translateX(-50%)' }], 320)
    const io = new IntersectionObserver(([en]) => { $('[data-back]', strip).hidden = !!en?.isIntersecting })
    state = { sentences, i: 0, rate: 1, paused: false, cancel: null, strip, io }
    $$('[data-listen]').forEach((b) => b.setAttribute('aria-pressed', 'true'))
    strip.addEventListener('click', (e) => {
      const b = e.target.closest('button')
      if (!b || !state) return
      if (b.dataset.rate) {
        // one button cycles 1× → 1.25× → 1.5×, so the strip stays a single row on a phone
        const RATES = [1, 1.25, 1.5]
        state.rate = RATES[(RATES.indexOf(state.rate) + 1) % RATES.length]
        b.dataset.rate = String(state.rate)
        b.textContent = `${state.rate}×`
        speakFrom(state.i)
      } else if ('pause' in b.dataset) {
        state.paused = !state.paused
        b.textContent = state.paused ? UI.listen.play : UI.listen.pause
        if (state.paused) { state.cancel?.() } else speakFrom(state.i)
      } else if ('stop' in b.dataset) stop()
      else if ('back' in b.dataset) state.sentences[state.i].scrollIntoView({ block: 'center', behavior: motion.reduced ? 'auto' : 'smooth' })
    })
    sound.cue('open')
    speakFrom(0)
  }
  function stop({ silent = false } = {}) {
    if (!state) return
    const s = state
    state = null
    s.cancel?.()
    voiceOut.cancel()
    s.io.disconnect()
    $$('.s.reading').forEach((x) => x.classList.remove('reading'))
    $$('[data-listen]').forEach((b) => b.setAttribute('aria-pressed', 'false'))
    document.body.classList.remove('listening')
    s.strip.remove()
    if (!silent) sound.cue('close')
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-listen]')) start() })
  return { start, stop, get playing() { return !!state } }
})()

/* (say it): the device voice standing in for the pre-rendered name clip. Tap or click only. */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sayit]')
  if (!b || b.classList.contains('on')) return
  b.classList.add('on')
  b.insertAdjacentHTML('beforeend', '<span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>')
  voiceOut.speak(UI.home.title.replace(/'s Lab$/, ''), {
    rate: 0.9,
    onend: () => { b.classList.remove('on'); b.querySelector('.bars')?.remove() },
  })
})
