/* eslint-disable @typescript-eslint/no-unused-vars -- src/*.js are concatenated into one scope by build.mjs, so names are used across files */
/* Floating windows (folder list, theme list, side player) and the phone sheet. One open at a time.
   Windows FLIP from the control that opened them, measured in screen space (DIRECTION: canvas windows
   open from the dock the same way). */

const floats = (() => {
  let cur = null
  function place(el, trigger, where) {
    const r = trigger.getBoundingClientRect()
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = document.documentElement.clientWidth
    const vh = innerHeight
    let left = where === 'right' ? r.right - w : r.left
    left = Math.max(16, Math.min(left, vw - w - 16))
    let top = where === 'up' ? r.top - h - 10 : r.bottom + 10
    if (where !== 'up' && top + h > vh - 12 && r.top - h - 10 > 12) top = r.top - h - 10
    if (where === 'up' && top < 12) top = Math.min(r.bottom + 10, vh - h - 12)
    el.style.left = `${Math.round(left)}px`
    el.style.top = `${Math.round(Math.max(12, top))}px`
  }
  function flipFrom(el, trigger) {
    const a = trigger.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    const sx = Math.max(0.05, a.width / b.width)
    const sy = Math.max(0.05, a.height / b.height)
    el.style.transformOrigin = 'top left'
    return motion.animate(el, [
      { opacity: 0, transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${sx}, ${sy})` },
      { opacity: 1, transform: 'none' },
    ], 320)
  }
  function close({ silent = false, focus = true } = {}) {
    if (!cur) return
    const { el, trigger, onClose } = cur
    cur = null
    trigger?.setAttribute('aria-expanded', 'false')
    const a = motion.animate(el, [{ opacity: 1 }, { opacity: 0 }], 180)
    const done = () => el.remove()
    if (a) a.onfinish = done
    else done()
    if (!silent) sound.cue('close')
    if (focus && trigger && document.contains(trigger)) trigger.focus({ preventScroll: true })
    onClose?.()
  }
  function open({ html, trigger, where = 'down', label, onOpen, onClose }) {
    if (cur && cur.trigger === trigger) { close(); return null }
    close({ silent: true, focus: false })
    const host = document.createElement('div')
    host.innerHTML = html.trim()
    const el = host.firstElementChild
    el.classList.add('float')
    el.setAttribute('role', 'dialog')
    if (label) el.setAttribute('aria-label', label)
    document.body.appendChild(el)
    place(el, trigger, where)
    flipFrom(el, trigger)
    trigger.setAttribute('aria-expanded', 'true')
    cur = { el, trigger, onClose }
    sound.cue('open')
    onOpen?.(el)
    const first = el.querySelector('[aria-current], [aria-pressed="true"], a, button:not(.x)')
    first?.focus({ preventScroll: true })
    return el
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cur) close() })
  document.addEventListener('pointerdown', (e) => {
    if (cur && !cur.el.contains(e.target) && !cur.trigger.contains(e.target)) close({ focus: false })
  })
  addEventListener('resize', () => close({ silent: true, focus: false }))
  return { open, close, get current() { return cur && cur.el } }
})()

const sheet = (() => {
  let cur = null
  function close({ focus = true } = {}) {
    if (!cur) return
    const { el, scrim, trigger } = cur
    cur = null
    trigger?.setAttribute('aria-expanded', 'false')
    const a = motion.animate(el, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(100%)', opacity: motion.reduced ? 0 : 1 }], 240)
    motion.animate(scrim, [{ opacity: 1 }, { opacity: 0 }], 240)
    const done = () => { el.remove(); scrim.remove() }
    if (a) a.onfinish = done
    else done()
    sound.cue('close')
    if (focus && trigger && document.contains(trigger)) trigger.focus({ preventScroll: true })
  }
  function open({ html, trigger, label, onOpen }) {
    close({ focus: false })
    const scrim = document.createElement('div')
    scrim.className = 'scrim'
    const el = document.createElement('div')
    el.className = 'sheet'
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    if (label) el.setAttribute('aria-label', label)
    el.innerHTML = `<button class="grab" type="button" aria-label="${esc(UI.close)}"></button>${html}`
    document.body.append(scrim, el)
    motion.animate(el, [{ transform: 'translateY(100%)', opacity: motion.reduced ? 0 : 1 }, { transform: 'none', opacity: 1 }], 320)
    motion.animate(scrim, [{ opacity: 0 }, { opacity: 1 }], 320)
    trigger?.setAttribute('aria-expanded', 'true')
    cur = { el, scrim, trigger }
    sound.cue('open')
    scrim.addEventListener('click', () => close())
    el.querySelector('.grab').addEventListener('click', () => close())
    // drag down to dismiss
    const grab = el.querySelector('.grab')
    let y0 = null
    grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; grab.setPointerCapture(e.pointerId) })
    grab.addEventListener('pointermove', (e) => { if (y0 !== null) el.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)` })
    grab.addEventListener('pointerup', (e) => {
      const dy = y0 === null ? 0 : e.clientY - y0
      y0 = null
      if (dy > 80) close()
      else el.style.transform = ''
    })
    onOpen?.(el)
    return el
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cur) close() })
  return { open, close, get current() { return cur && cur.el } }
})()

/** Close whatever is open; called on every navigation. */
function closeAllFloating() { floats.close({ silent: true, focus: false }); sheet.close({ focus: false }) }

/* ---------- folders: the path is the menu ---------- */
function folderRows(folderKey, currentKeys) {
  return DATA.folders[folderKey].map((k) => {
    const it = item(k)
    const isCur = currentKeys.includes(k)
    return `<li><a class="row${isCur ? ' cur' : ''}" href="#${esc(it.path)}"${isCur ? ' aria-current="page"' : ''}>` +
      `<span data-id>${esc(numLabel(it))}</span><span class="t">${esc(it.title)}</span><span class="r">${statusOf(it)}</span></a></li>`
  }).join('')
}
function currentChain(it) { return it ? [it.key, it.series, it.section].filter(Boolean) : [] }

function openFolder(trigger, folderKey, it) {
  const f = item(folderKey)
  floats.open({
    trigger, label: f.title || f.short,
    html: `<div class="win folder-win"><div class="win-bar"><span class="win-id" data-id>${esc(numLabel(f))}</span><span class="win-label">${esc(f.short || f.title)}</span><button class="x" type="button" data-close>${esc(UI.close)}</button></div>
      <ol class="rows">${folderRows(folderKey, currentChain(it))}</ol></div>`,
  })
}

function openPathSheet(trigger, it) {
  const chain = currentChain(it)
  let html = ''
  if (it) {
    const ups = [`<a href="#/lab">${esc(UI.lab)}</a>`]
    if (it.section && it.kind !== 'section') ups.push(`<a href="#${esc(item(it.section).path)}">${esc(it.sectionTitle)}</a>`)
    if (it.series) ups.push(`<a href="#${esc(item(it.series).path)}">${esc(item(it.series).short)}</a>`)
    html += `<div class="up">${ups.join('')}</div>`
    const folder = it.series || (it.kind === 'section' ? it.key : it.section)
    if (folder && DATA.folders[folder]) html += `<p class="grp">${esc(item(folder).short || item(folder).title)}</p><ol class="rows">${folderRows(folder, chain)}</ol>`
    if (it.toc && it.toc.length >= 3) {
      html += `<p class="grp">${esc(UI.meta.contents)}</p><ol class="rows">${it.toc.map((h) =>
        `<li><a class="row" href="#${esc(it.path)}?at=${esc(h.id)}" data-at="${esc(h.id)}"><span data-id>${h.num}</span><span class="t">${esc(h.text)}</span><span class="r"></span></a></li>`).join('')}</ol>`
    }
  } else {
    html += `<p class="grp">${esc(UI.home.sections)}</p><ol class="rows">${folderRows('lab', chain)}</ol>`
  }
  sheet.open({ trigger, label: pillLabel(it), html })
}

document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-close]')
  if (c) { floats.close(); return }
  const t = e.target.closest('[data-folder]')
  if (t) { openFolder(t, t.dataset.folder, router.currentItem()); return }
  const s = e.target.closest('[data-sheet]')
  if (s) { openPathSheet(s, router.currentItem()); return }
})
