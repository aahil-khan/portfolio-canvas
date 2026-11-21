/*
 * prototype/lab/notebook/switcher.js: the quick switcher (/ or Ctrl+K), Obsidian's Ctrl+O.
 *
 *   NB.switcher.open(from)   a modal list over every note; Esc closes it and focus goes back
 *
 * It matches ID, title, path, tags and aliases (vault.match: an exact ID first, `#tag` filters).
 * A leading `>` runs a command instead (#21's flags live here now): > graph, > voice sam,
 * > palette amber, > sound on, > canvas, > help. The command list matches through #21's
 * logic.commands. While the full graph is open, the matches light up in it.
 */
;(() => {
  const NB = (window.NB = window.NB || {})
  const C = NB.copy, esc = NB.md.escape, W = C.switcher
  const S = () => NB.shell
  let box = null, input = null, list = null, foot = null, items = [], sel = 0
  const X = (NB.switcher = {})

  function build() {
    box = document.createElement('div')
    box.className = 'nb-layer nb-switcher'
    box.hidden = true
    box.innerHTML = `<div class="nb-dialog" role="dialog" aria-modal="true" aria-label="${esc(W.label)}">
      <input class="nb-dialog__in" type="text" role="combobox" aria-expanded="true" aria-controls="nbSwList" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${esc(W.placeholder)}" aria-label="${esc(W.label)}">
      <ul class="nb-dialog__list" id="nbSwList" role="listbox"></ul>
      <p class="nb-dialog__foot">${esc(W.hint)}</p></div>`
    document.body.appendChild(box)
    input = box.querySelector('input'); list = box.querySelector('ul'); foot = box.querySelector('.nb-dialog__foot')
    box.addEventListener('click', (e) => { if (e.target === box) S().closeLayer(box) })
    list.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) { sel = +li.dataset.i; run() } })
    list.addEventListener('mousemove', (e) => { const li = e.target.closest('li'); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; mark() } })
    input.addEventListener('input', () => { sel = 0; draw() })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); mark(); if (NIGHT.sound) NIGHT.sound.cue('cursor') }
      else if (e.key === 'Enter') { e.preventDefault(); run() }
      else if (NIGHT.sound && e.key.length === 1) NIGHT.sound.cue('key')
    })
  }
  function draw() {
    const v = NB.vault, q = input.value
    const cmd = NB.model.command(q, W.commands)
    if (cmd) {
      items = NIGHT.logic.commands(W.commands, cmd.cmd).map((c) => ({ cmd: c }))
      if (!items.length) items = [{ cmd: { cmd: cmd.cmd, label: W.unknown(cmd.cmd) }, unknown: true }]
      list.innerHTML = items.map((it, i) => `<li role="option" data-i="${i}" id="nbSw${i}"><span>›</span><span>${esc(it.cmd.cmd)}</span><span class="p">${esc(it.cmd.label)}</span></li>`).join('')
      S().highlight(null)
    } else {
      const res = v.match(q).slice(0, 60)
      items = res.map((n) => ({ note: n }))
      list.innerHTML = items.length ? items.map((it, i) => {
        const n = it.note, g = C.status[n.status] || C.status.planned
        return `<li role="option" data-i="${i}" id="nbSw${i}" data-route="${esc(n.route)}"><span aria-label="${esc(g[1])}">${esc(g[0])}</span><span>${esc(n.id || (n.isHub ? '00' : /^\d\d$/.test(n.num) ? n.num : ''))}</span><span>${esc(n.title)}</span><span class="p">${esc('lab/' + n.route)}</span></li>`
      }).join('') : `<li aria-disabled="true"><span></span><span></span><span>${esc(W.none)}</span></li>`
      S().highlight(q.trim() ? res : null)
    }
    mark()
  }
  function mark() {
    for (const li of list.querySelectorAll('li[data-i]')) li.setAttribute('aria-selected', String(+li.dataset.i === sel))
    const cur = list.querySelector(`li[data-i="${sel}"]`)
    input.setAttribute('aria-activedescendant', cur ? cur.id : '')
    if (cur) cur.scrollIntoView({ block: 'nearest' })
  }
  function run() {
    const it = items[sel]
    if (!it) return
    if (it.note) { S().closeLayer(box); S().go(it.note.route); setTimeout(() => { const t = document.querySelector('.nb-title'); if (t) t.focus({ preventScroll: true }) }, 0); return }
    if (it.unknown) return
    const [head, arg] = [it.cmd.cmd.split(' ')[0], it.cmd.cmd.split(' ').slice(1).join(' ')]
    S().closeLayer(box)
    if (head === 'graph') S().go('graph')
    else if (head === 'voice') { NIGHT.voice.use(arg); if (NB.narrator) NB.narrator.strip() }
    else if (head === 'palette') S().setPalette(arg)
    else if (head === 'sound') S().toggleSound(arg === 'on')
    else if (head === 'canvas') NB.trip.leave()
    else if (head === 'help') S().help()
    if (NIGHT.sound) NIGHT.sound.cue('enter')
  }
  X.open = (from) => {
    if (!box) build()
    if (!box.hidden) return
    box.hidden = false
    input.value = ''
    sel = 0
    draw()
    S().layer(box, from && from !== document.body ? from : null, () => S().highlight(null))
    input.focus()
    if (NIGHT.sound) NIGHT.sound.cue('chirp-open')
  }
  X.isOpen = () => !!box && !box.hidden
})()
