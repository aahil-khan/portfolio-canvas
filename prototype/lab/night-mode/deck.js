/*
 * prototype/lab/night-mode/deck.js: THE DECK (research ★3A). The desk's dock, at night, is no longer
 * navigation: it is one status line of controls, htop / tmux / Midnight Commander style.
 *
 *   LAB │ ◂◂ ▸ ▸▸ 1.0× 0:12/0:53 ¶01/15 ▁▂▃▅▇▅▃ │ voice:synth▾ ≈ │ snd:off pal:w radial:off │ toy:[n]ext │ ?ask /cmd ?keys │ ← canvas
 *   mode    transport, dim until a narrated section is loaded   the voice   flags (tmux-style)        the toy     MC-style keys    the exit
 *
 * Phone (and any screen under 1180 px): LAB │ ▸ │ ⋯ │ ←, and ⋯ opens the rest as a sheet.
 * The cells live inside the desk's dock panel (night.js morphs the panel into this line on the
 * way in). Above the deck, one popover at a time: the voice picker, the synth knobs, ?ask, the /
 * command line, the keys, the phone's sheet. Esc closes it and focus goes back where it was.
 *
 * NO NAVIGATION. No cell opens a category, an entry or a post: act() below is the only thing a
 * cell calls, and check.mjs holds it to that. The two exceptions are named: ← canvas (the exit),
 * and the / command line, which is a search (its `open <slug>` runs through runCommand()).
 *
 *   NIGHT.deck.mount()                    after the reader and the home exist
 *   .key(e) → bool                        the deck's keys (space , . [ ] v n / ? esc), from anywhere
 *   .loadPost(target) / .unloadPost()     the reader's narrated section, loaded (never played)
 *   .listen()                             a [▸ listen] press: load it and play
 *   .open(kind) / .close()                voice · knobs · ask · cmd · help · more
 *   .mode()                               LAB · NARRATE · ASK · CMD · RADIAL
 */
;(() => {
  const NIGHT = (window.NIGHT = window.NIGHT || {})
  const C = () => NIGHT.copy
  const V = () => NIGHT.voice
  const G = () => NIGHT.logic
  const cue = (n, i) => NIGHT.sound && NIGHT.sound.cue(n, i)
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  const R = () => LAB.sky.reduced
  const PALS = ['white', 'green', 'amber']
  const D = (NIGHT.deck = {})
  const st = { pop: null, opener: null, post: null, answer: null, seen: {}, cmdSel: 0, radial: false }
  let el = {}

  // ── the cells: fixed widths in characters (ch on a wide screen, chp on a narrow one) ──────
  const cell = (cls, inner, { ch = 0, chp = 0, tag = 'span', attrs = '' } = {}) =>
    `<${tag} class="ldock ${cls}" data-ch="${ch}" data-chp="${chp}" ${attrs}>${inner}</${tag}>`
  const b = (doo, label, aria, extra = '') => `<button type="button" class="dk-b" data-do="${doo}"${aria ? ` aria-label="${esc(aria)}"` : ''}${extra}>${label}</button>`
  function cellsHtml() {
    const K = C().deck
    return [
      cell('dk-mode', `<span class="dk-m">${esc(K.modes.lab)}</span>`, { ch: 9, chp: 9, attrs: 'role="status"' }),
      cell('dk-tr', b('back', '◂◂', K.prev) + ' ' + b('play', '▸', K.play) + ' ' + b('fwd', '▸▸', K.next) + ' ' + b('rate', '1.0×', K.rateLabel('1.0')) +
        ` <span class="dk-time">0:00/0:00</span> <span class="dk-sec">¶--/--</span> <span class="dk-wave" aria-hidden="true">${G().wave(null, 20, 0, 12)}</span>`, { ch: 45 }),
      cell('dk-pplay dk-btn', '▸', { chp: 3, tag: 'button', attrs: `type="button" data-do="play" aria-label="${esc(K.play)}"` }),
      cell('dk-voice', b('voice', `${esc(K.voice)}:<span class="dk-v">ai</span>▾`, K.voiceLabel('ai'), ' aria-haspopup="dialog"') + ' ' + b('knobs', '≈', K.knobsLabel, ' aria-haspopup="dialog"'), { ch: 15 }),
      cell('dk-flags', b('snd', `${esc(K.snd)}:<span class="dk-f">${esc(K.off)}</span>`, K.sndLabel(false), ' aria-pressed="false"') + ' ' +
        b('pal', `${esc(K.pal)}:<span class="dk-f">w</span>`, K.palLabel('white')) + ' ' +
        b('radial', `${esc(K.radial)}:<span class="dk-f">${esc(K.off)}</span>`, K.radialLabel(false), ' aria-pressed="false"'), { ch: 24 }),
      cell('dk-toy', b('toy', `${esc(K.toy)}:[<span class="dk-key">n</span>]${esc(K.toyNext.slice(1))}`, C().toy.nextLabel), { ch: 10 }),
      cell('dk-keys', b('ask', `?${esc(K.ask)}`, K.askLabel, ' aria-haspopup="dialog"') + ' ' + b('cmd', `/${esc(K.cmd)}`, K.cmdLabel, ' aria-haspopup="dialog"') + ' ' + b('help', `?${esc(K.help)}`, K.helpLabel, ' aria-haspopup="dialog"'), { ch: 15 }),
      cell('dk-more dk-btn', '⋯', { chp: 3, tag: 'button', attrs: `type="button" data-do="more" aria-label="${esc(K.more)}" aria-haspopup="dialog"` }),
    ]
  }

  // ── what a cell does: controls only, never navigation ────────────────────────────────────
  function act(doo, from) {
    const v = V()
    switch (doo) {
      case 'play': if (v.state().loaded) { v.toggle(); cue('select') } return
      case 'back': return v.seek(-15)
      case 'fwd': return v.seek(15)
      case 'rate': return v.cycleRate()
      case 'voice': case 'knobs': case 'ask': case 'cmd': case 'help': case 'more': return toggle(doo, from)
      case 'snd': return NIGHT.sound.toggle()
      case 'pal': { const cur = document.documentElement.dataset.palette || 'white'; NIGHT.setPalette(PALS[(PALS.indexOf(cur) + 1) % PALS.length]); return paint() }
      case 'radial': return setRadial(!st.radial)
      case 'toy': NIGHT.toy.next(); return paint()
    }
  }
  function setRadial(on) {
    st.radial = !!on
    NIGHT.home.setRadialFlag(st.radial)
    paint()
  }
  D.setRadial = setRadial

  // ── painting the line from the one owner of each fact ────────────────────────────────────
  const $ = (sel) => el.panel.querySelectorAll(sel)
  D.mode = () => {
    const s = V().state(), K = C().deck.modes
    if (st.pop === 'cmd') return K.cmd
    if (st.pop === 'ask' || s.kind === 'answer') return K.ask
    if (s.playing) return K.narrate
    if (NIGHT.home.home && NIGHT.home.home() === 'radial') return K.radial
    return K.lab
  }
  let last = -1
  function paint() {
    const s = V().state(), K = C().deck, loaded = s.loaded
    const mode = D.mode()
    for (const n of $('.dk-m')) n.textContent = mode
    for (const n of $('.dk-mode')) { n.dataset.mode = mode.toLowerCase(); n.setAttribute('aria-label', K.modeLabel(mode)) }
    el.panel.dataset.loaded = loaded
    for (const n of [...$('[data-do="play"]'), ...el.pop.querySelectorAll('[data-do="play"]')]) { n.textContent = s.playing ? '❚❚' : '▸'; n.setAttribute('aria-label', s.playing ? K.pause : K.play); n.disabled = !loaded }
    for (const n of [...$('[data-do="back"], [data-do="fwd"], [data-do="rate"]'), ...el.pop.querySelectorAll('[data-do="back"], [data-do="fwd"], [data-do="rate"]')]) n.disabled = !loaded
    const rate = s.rate.toFixed(s.rate % 1 && (s.rate * 10) % 1 ? 2 : 1) + '×'
    for (const n of [...$('[data-do="rate"]'), ...el.pop.querySelectorAll('[data-do="rate"]')]) { n.textContent = rate.padEnd(5, ' ').slice(0, 5); n.setAttribute('aria-label', K.rateLabel(rate)) }
    const time = loaded ? `${G().clock(s.t)}/${G().clock(s.dur)}` : '0:00/0:00'
    const sec = loaded && s.kind !== 'answer' ? K.section(s.index, s.of) : '¶--/--'
    const wave = G().wave(s.peaks, s.perSec, s.t, 12, R())
    for (const n of [...$('.dk-time'), ...el.pop.querySelectorAll('.dk-time')]) n.textContent = time
    for (const n of [...$('.dk-sec'), ...el.pop.querySelectorAll('.dk-sec')]) n.textContent = sec
    for (const n of [...$('.dk-wave'), ...el.pop.querySelectorAll('.dk-wave')]) n.textContent = wave
    for (const n of $('.dk-v')) n.textContent = s.voice
    for (const n of $('[data-do="voice"]')) n.setAttribute('aria-label', K.voiceLabel(s.voice))
    const muted = NIGHT.sound.muted, pal = document.documentElement.dataset.palette || 'white'
    for (const n of [...$('[data-do="snd"]'), ...el.pop.querySelectorAll('[data-do="snd"]')]) { n.querySelector('.dk-f').textContent = muted ? K.off : K.on; n.setAttribute('aria-pressed', String(!muted)); n.setAttribute('aria-label', K.sndLabel(!muted)) }
    for (const n of [...$('[data-do="pal"]'), ...el.pop.querySelectorAll('[data-do="pal"]')]) { n.querySelector('.dk-f').textContent = C().palShort[pal]; n.setAttribute('aria-label', K.palLabel(pal)) }
    for (const n of [...$('[data-do="radial"]'), ...el.pop.querySelectorAll('[data-do="radial"]')]) { n.querySelector('.dk-f').textContent = st.radial ? K.on : K.off; n.setAttribute('aria-pressed', String(st.radial)) }
    if (st.pop === 'voice') paintVoices()
    if (st.pop === 'ask' && st.answer) typeAnswer(s)
    // the reader lights the spoken word; only when it changes
    const w = s.kind === 'answer' || !s.loaded ? -1 : s.word
    if (w !== last && NIGHT.reader.light) { last = w; NIGHT.reader.light(w) }
    for (const n of el.pop.querySelectorAll('.pop__note[data-note]')) n.textContent = s.note || ''
  }

  // ── popovers: one at a time, above the deck ──────────────────────────────────────────────
  const POP = {
    voice: () => `<p class="pop__h">${esc(C().deck.voice)}</p><ul class="pop__ls" role="radiogroup" aria-label="${esc(C().deck.voice)}">` +
      V().IDS.map((id) => `<li><button type="button" class="pop__opt" role="radio" data-voice="${id}"><span class="pop__dot" aria-hidden="true"></span><span class="pop__on">${esc(C().voices[id].name)}</span><span class="pop__why"></span></button></li>`).join('') +
      `</ul><p class="pop__note" data-note></p>`,
    knobs: () => `<p class="pop__h">${esc(C().deck.knobs)} <span class="pop__sub">· ${esc(C().voices.synth.name)}</span></p><div class="knobs">` +
      Object.entries(V().KNOB_RANGE).map(([k, [a, z, step]]) => `<label class="knob"><span class="knob__l">${esc(C().knobs[k][0])}</span>` +
        `<input type="range" min="${a}" max="${z}" step="${step}" value="${V().knobs[k]}" data-knob="${k}" aria-label="${esc(C().knobs[k][0] + ', ' + C().knobs[k][1])}">` +
        `<span class="knob__v" data-kv="${k}"></span><span class="knob__h">${esc(C().knobs[k][1])}</span></label>`).join('') +
      `</div><p class="pop__act"><button type="button" class="act" data-knob-reset>${esc(C().knobs.reset)}</button></p><p class="pop__note" data-note></p>`,
    ask: () => `<p class="pop__h">?${esc(C().ask.title)}</p><ul class="pop__ls">` +
      C().ask.prompts.map((p, i) => `<li><button type="button" class="pop__opt pop__q" data-ask="${p.id}"><span class="pop__k" aria-hidden="true">${i + 1}</span><span class="pop__on">${esc(p.q)}</span></button></li>`).join('') +
      `</ul><div class="ans" hidden><p class="ans__q"></p><p class="ans__t" aria-live="polite"></p><p class="ans__mark"></p>` +
      `<p class="pop__act"><button type="button" class="act" data-ask-again>${esc(C().ask.again)}</button> <button type="button" class="act" data-ask-close aria-label="${esc(C().ask.closeLabel)}">${esc(C().ask.close)}</button></p><p class="pop__note" data-note></p></div>`,
    cmd: () => `<form class="cmd" autocomplete="off"><label class="cmd__p" for="dk-cmd">${esc(C().cmd.prompt)}</label><input id="dk-cmd" class="cmd__in" type="text" spellcheck="false" aria-label="${esc(C().cmd.label)}" aria-controls="dk-cmdl" aria-autocomplete="list"></form>` +
      `<ul class="cmd__ls" id="dk-cmdl" role="listbox" aria-label="${esc(C().cmd.label)}"></ul><p class="pop__hint">${esc(C().cmd.hint)}</p>`,
    help: () => `<p class="pop__h">?${esc(C().help.title)}</p><dl class="help">${C().help.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`,
    more: () => `<p class="pop__h">${esc(C().deck.label)}</p><div class="sheet">` +
      `<p class="sheet__r">${b('back', '◂◂', C().deck.prev)} ${b('play', '▸', C().deck.play)} ${b('fwd', '▸▸', C().deck.next)} ${b('rate', '1.0×', C().deck.rate)} <span class="dk-time">0:00/0:00</span> <span class="dk-sec">¶--/--</span></p>` +
      `<p class="sheet__r"><span class="dk-wave" aria-hidden="true"></span></p>` +
      `<p class="sheet__r">${b('voice', `${esc(C().deck.voice)}:<span class="dk-v">${esc(V().state().voice)}</span>▾`, C().deck.voiceLabel(V().state().voice))} ${b('knobs', '≈ ' + esc(C().deck.knobs), C().deck.knobsLabel)}</p>` +
      `<p class="sheet__r">${b('snd', `${esc(C().deck.snd)}:<span class="dk-f"></span>`, '')} ${b('pal', `${esc(C().deck.pal)}:<span class="dk-f"></span>`, '')} ${b('radial', `${esc(C().deck.radial)}:<span class="dk-f"></span>`, '')}</p>` +
      `<p class="sheet__r">${b('toy', `${esc(C().deck.toy)}:${esc(C().deck.toyNext)}`, C().toy.nextLabel)} ${b('ask', '?' + esc(C().deck.ask), C().deck.askLabel)} ${b('cmd', '/' + esc(C().deck.cmd), C().deck.cmdLabel)} ${b('help', '?' + esc(C().deck.help), C().deck.helpLabel)}</p></div>`,
  }
  function toggle(kind, from) { if (st.pop === kind) D.close(); else D.open(kind, from) }
  D.open = (kind, from) => {
    if (!POP[kind]) return
    const back = st.pop ? st.opener : from || document.activeElement
    if (st.pop) closeNow()
    st.pop = kind
    st.opener = back
    el.pop.innerHTML = `<div class="pop pop--${kind}" role="dialog" aria-label="${esc(kind)}">${POP[kind]()}</div>`
    el.pop.hidden = false
    place()
    cue('chirp-open')
    if (kind === 'knobs') knobVals()
    if (kind === 'voice') paintVoices()
    if (kind === 'cmd') { const i = el.pop.querySelector('.cmd__in'); cmdList(''); i.focus({ preventScroll: true }) }
    else { const f = el.pop.querySelector('[aria-checked="true"]') || el.pop.querySelector('button:not([disabled]), input'); if (f) f.focus({ preventScroll: true }) }
    if (!R()) el.pop.firstChild.animate([{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0' }], { duration: 140, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
    paint()
  }
  function closeNow() {
    if (st.pop === 'ask' && st.answer) endAnswer()
    st.pop = null
    el.pop.hidden = true
    el.pop.innerHTML = ''
  }
  D.close = () => {
    if (!st.pop) return false
    const back = st.opener
    closeNow()
    cue('chirp-close')
    if (back && back.isConnected && back.getClientRects().length) back.focus({ preventScroll: true })
    paint()
    return true
  }
  // above the deck, its left edge on the deck's (inside the screen on a phone)
  function place() {
    const r = el.panel.getBoundingClientRect(), p = el.pop.firstChild
    const w = Math.min(innerWidth - 16, p.offsetWidth)
    el.pop.style.setProperty('--pop-x', Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px')
    el.pop.style.setProperty('--pop-y', Math.round(innerHeight - r.top + 8) + 'px')
  }
  D.popOpen = () => st.pop

  function paintVoices() {
    const s = V().state()
    for (const n of el.pop.querySelectorAll('[data-voice]')) {
      const id = n.dataset.voice, ok = V().status(id)
      n.disabled = ok !== 'ok'
      n.setAttribute('aria-checked', String(s.voice === id))
      n.querySelector('.pop__on').textContent = ok === 'soon' ? C().voiceSoon(id) : ok === 'pending' ? C().voicePending(id) : C().voices[id].name
      n.querySelector('.pop__why').textContent = C().voices[id].note
    }
  }
  function knobVals() { for (const n of el.pop.querySelectorAll('[data-kv]')) { const k = n.dataset.kv, v = V().knobs[k]; n.textContent = k === 'tape' ? v.toFixed(2) + '×' : k === 'mono' ? Math.round(v * 100) + '%' : k === 'pitch' ? (v > 0 ? '+' : '') + v : String(v) } }

  // ── ?ask: an answer types out, in time with the voice reading it ─────────────────────────
  function ask(id) {
    const A = C().ask, P = A.prompts.find((p) => p.id === id)
    let text, mark
    if (id === 'now') { text = A.now.text; mark = A.now.mark }
    else { const r = G().pick(A[id], st.seen[id] || []); st.seen[id] = r.seen; text = A[id][r.i]; mark = A.authored }
    const words = G().tokens(text).map((t) => t.w)
    st.answer = { id, text, words }
    const box = el.pop.querySelector('.ans')
    box.hidden = false
    box.querySelector('.ans__q').textContent = '?> ' + P.q
    box.querySelector('.ans__mark').textContent = mark
    box.querySelector('.ans__t').textContent = ''
    V().load({ id: 'ask:' + id, kind: 'answer', title: P.q, words, index: 0, of: 0 })
    V().play() // a press on the prompt is the press that plays it
    cue('enter')
  }
  // words up to the one being spoken are out; the current one types letter by letter
  function typeAnswer(s) {
    const a = st.answer, t = el.pop.querySelector('.ans__t')
    if (!a || !t) return
    if (R() || (!s.playing && s.t >= s.dur && s.dur)) { t.textContent = a.text; return }
    const w = s.word, tm = V().timingsOf ? V().timingsOf() : null
    let out = a.words.slice(0, Math.max(0, w)).join(' ')
    if (w >= 0) {
      const cur = a.words[w], span = tm && tm[w] ? Math.max(0.05, tm[w].e - tm[w].s) : 0.3, f = tm && tm[w] ? Math.min(1, (s.t - tm[w].s) / span) : 1
      out += (w ? ' ' : '') + cur.slice(0, Math.max(1, Math.ceil(cur.length * f)))
    }
    if (t.textContent !== out + '▌') { t.textContent = out + '▌'; cue('key') }
  }
  function endAnswer() {
    V().unload(st.answer && 'ask:' + st.answer.id)
    st.answer = null
    if (st.post) V().load(st.post)
  }

  // ── / the command line (a search: the one place in the deck that can open an entry) ─────
  function commandsAll() {
    const L = C().cmd.list, W = C().cmd.what, out = []
    for (const s of NIGHT.home.sections()) {
      for (const e of s.entries) {
        if (s.id === 'research') { out.push({ cmd: L.open(e.slug), label: e.title, what: W.open, run: ['read', e.slug, 'research'] }); for (const c of e.chapters) out.push({ cmd: L.open(c.slug), label: c.title, what: W.open, run: ['read', c.slug, 'research'] }) }
        else if (s.id !== 'work' && e.read) out.push({ cmd: L.open(e.slug), label: e.title, what: W.open, run: ['read', e.slug, s.id] })
        else if (s.id === 'work') out.push({ cmd: L.open(e.slug), label: e.title, what: W.open, run: ['row', `work/${e.slug}`] })
      }
    }
    for (const v of V().IDS) if (V().status(v) === 'ok') out.push({ cmd: L.voice(v), label: C().voices[v].note, what: W.voice, run: ['voice', v] })
    for (const p of PALS) out.push({ cmd: L.pal(p), label: p, what: W.pal, run: ['pal', p] })
    for (const t of NIGHT.fx.ids) out.push({ cmd: L.toy(t), label: t, what: W.toy, run: ['toy', t] })
    for (const p of C().ask.prompts) out.push({ cmd: L.ask(p.id), label: p.q, what: W.ask, run: ['ask', p.id] })
    for (const k of ['snd', 'radial', 'play', 'keys', 'canvas']) out.push({ cmd: L[k], label: W[k], what: W[k], run: [k] })
    return out
  }
  function cmdList(q) {
    const ul = el.pop.querySelector('.cmd__ls'), hits = G().commands(commandsAll(), q).slice(0, 8)
    st.cmdHits = hits
    st.cmdSel = 0
    ul.innerHTML = hits.length ? hits.map((c, i) => `<li role="option" id="dk-c${i}" class="cmd__o" data-i="${i}" aria-selected="${i === 0}"><span class="cmd__c">${esc(c.cmd)}</span><span class="cmd__l">${esc(c.label)}</span><span class="cmd__w">${esc(c.what)}</span></li>`).join('')
      : `<li class="cmd__none">${esc(C().cmd.empty)}</li>`
    el.pop.querySelector('.cmd__in').setAttribute('aria-activedescendant', hits.length ? 'dk-c0' : '')
  }
  function cmdMove(d) {
    const os = el.pop.querySelectorAll('.cmd__o')
    if (!os.length) return
    st.cmdSel = (st.cmdSel + d + os.length) % os.length
    os.forEach((o, i) => o.setAttribute('aria-selected', String(i === st.cmdSel)))
    el.pop.querySelector('.cmd__in').setAttribute('aria-activedescendant', 'dk-c' + st.cmdSel)
    cue('cursor', st.cmdSel)
  }
  function runCommand(c) {
    if (!c) return
    const [k, a, b2] = c.run
    D.close()
    cue('enter')
    if (k === 'read') NIGHT.reader.go(a, b2)
    else if (k === 'row') NIGHT.home.select(a)
    else if (k === 'voice') V().use(a)
    else if (k === 'pal') NIGHT.setPalette(a)
    else if (k === 'toy') NIGHT.toy.set(a)
    else if (k === 'ask') D.open('ask')
    else if (k === 'snd') NIGHT.sound.toggle()
    else if (k === 'radial') setRadial(!st.radial)
    else if (k === 'play') act('play')
    else if (k === 'keys') D.open('help')
    else if (k === 'canvas') NIGHT.leave()
    if (k === 'ask') ask(a)
    paint()
  }

  // ── the reader's narrated section ────────────────────────────────────────────────────────
  D.loadPost = (t) => { st.post = t; if (!st.answer) V().load(t) }
  D.unloadPost = () => { if (st.post) V().unload(st.post.id); st.post = null; paint() }
  // [▸ listen] is play / pause for its own section (space on the focused button presses it)
  D.listen = () => { if (!st.post) return; const s = V().state(); if (s.id === st.post.id && s.playing) { V().pause(); return } if (s.id !== st.post.id) V().load(st.post); V().play() }

  // ── keys: from anywhere in the Lab (night.js), and over a post (reader.js) ───────────────
  D.key = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return false
    const tgt = e.target, typing = tgt && tgt.closest && tgt.closest('input, textarea, select')
    if (e.key === 'Escape' && st.pop) { e.preventDefault(); D.close(); return true }
    if (typing) return false
    const onButton = tgt && tgt.closest && tgt.closest('button, a[href]')
    const k = e.key, s = V().state()
    if (k === ' ' && !onButton && s.loaded) { e.preventDefault(); act('play'); return true }
    if ((k === ',' || k === '.') && s.loaded) { e.preventDefault(); act(k === ',' ? 'back' : 'fwd'); return true }
    if ((k === '[' || k === ']') && s.loaded) { e.preventDefault(); V().cycleRate(k === ']' ? 1 : -1); return true }
    if (k === 'v') { e.preventDefault(); toggle('voice'); return true }
    if (k === 'n' && !NIGHT.reader.isOpen()) { e.preventDefault(); act('toy'); return true }
    if (k === '/') { e.preventDefault(); D.open('cmd'); return true }
    if (k === '?') { e.preventDefault(); toggle('help'); return true }
    if (st.pop === 'ask' && /^[1-3]$/.test(k)) { e.preventDefault(); ask(C().ask.prompts[+k - 1].id); return true }
    return false
  }

  D.mount = () => {
    const lab = document.querySelector('.desk-dock__item[data-id="lab"]')
    // a rule before every cell but the first, shown when its cell is (same data-ch / data-chp)
    const sep = (c) => { const m = /data-ch="(\d+)" data-chp="(\d+)"/.exec(c); return `<span class="ldock-sep" aria-hidden="true" data-ch="${+m[1] ? 1 : 0}" data-chp="${+m[2] ? 1 : 0}"></span>` }
    const frag = document.createRange().createContextualFragment(cellsHtml().map((c, i) => (i ? sep(c) : '') + c).join('') + '<span class="ldock-sep" aria-hidden="true" data-ch="1" data-chp="1"></span>')
    lab.before(frag)
    el.panel = DESK.dock.querySelector('.desk-dock__panel')
    el.panel.setAttribute('aria-label', C().deck.label)
    el.pop = h('div', 'deckpop')
    el.pop.hidden = true
    document.body.appendChild(el.pop)
    // the cells: one listener for the line, one for the popovers
    el.panel.addEventListener('click', (e) => {
      const n = e.target.closest('[data-do]')
      if (n && NIGHT.state.t === 1) act(n.dataset.do, n)
    })
    el.pop.addEventListener('click', (e) => {
      const n = e.target.closest('[data-do]')
      if (n) return act(n.dataset.do, st.opener)
      const v = e.target.closest('[data-voice]')
      if (v) { V().use(v.dataset.voice); cue('select'); paint(); return }
      const q = e.target.closest('[data-ask]')
      if (q) return ask(q.dataset.ask)
      if (e.target.closest('[data-ask-again]') && st.answer) return ask(st.answer.id)
      if (e.target.closest('[data-ask-close]')) return D.close()
      if (e.target.closest('[data-knob-reset]')) { V().resetKnobs(); el.pop.querySelectorAll('[data-knob]').forEach((i) => { i.value = V().knobs[i.dataset.knob] }); knobVals(); return }
      const o = e.target.closest('.cmd__o')
      if (o) return runCommand(st.cmdHits[+o.dataset.i])
    })
    el.pop.addEventListener('input', (e) => {
      if (e.target.dataset.knob) { V().setKnob(e.target.dataset.knob, e.target.value); knobVals() }
      if (e.target.classList.contains('cmd__in')) { cmdList(e.target.value); cue('key') }
    })
    el.pop.addEventListener('submit', (e) => { e.preventDefault(); runCommand(st.cmdHits && st.cmdHits[st.cmdSel]) })
    el.pop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); D.close(); return }
      if (st.pop === 'cmd' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); cmdMove(e.key === 'ArrowDown' ? 1 : -1); return }
      if (st.pop === 'voice' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        const os = [...el.pop.querySelectorAll('[data-voice]:not([disabled])')], i = os.indexOf(document.activeElement)
        e.preventDefault(); os[(i + (e.key === 'ArrowDown' ? 1 : -1) + os.length) % os.length].focus()
        return
      }
      if (e.key === 'Tab') { // stay inside the popover
        const f = [...el.pop.querySelectorAll('button:not([disabled]), input')]
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      }
      e.stopPropagation()
    })
    addEventListener('resize', () => { if (st.pop) place() })
    V().on(paint)
    NIGHT.sound.on(paint)
    // a click outside the popover (and outside the deck) closes it
    document.addEventListener('pointerdown', (e) => { if (st.pop && !el.pop.contains(e.target) && !el.panel.contains(e.target)) D.close() }, true)
    paint()
  }
  D.paint = () => paint()
})()
