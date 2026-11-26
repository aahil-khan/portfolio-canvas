/* eslint-disable @typescript-eslint/no-unused-vars -- src/*.js are concatenated into one scope by build.mjs, so names are used across files */
/* Hover previews: a canvas window showing the linked note (internal links) or a small card made from
   metadata captured at build time (external links). Fine pointers only: 200ms delay, 180ms fade plus
   a 4px rise; keyboard focus after 600ms; Esc closes. Never fetches anything. */

const preview = (() => {
  let el = null
  let timer = 0
  let hideTimer = 0
  let forLink = null

  function htmlFor(link) {
    if (link.dataset.ext) {
      const e = DATA.external[link.dataset.ext]
      return `<div class="win preview ext" role="tooltip"><div class="win-bar"><span class="win-label">${esc(e.site)}</span></div>
        <div class="pv"><p class="pv-t">${esc(e.title)}</p><p class="pv-x">${esc(e.line)}</p></div></div>`
    }
    const it = item(link.dataset.preview)
    if (!it) return ''
    const where = it.seriesShort || it.sectionTitle || UI.lab
    return `<div class="win preview" role="tooltip"><div class="win-bar">${numLabel(it) ? `<span class="win-id" data-id>${esc(numLabel(it))}</span>` : ''}<span class="win-label">${esc(where)} · ${esc(kindWord(it))}</span></div>
      <div class="pv"><p class="pv-t">${esc(it.title)}</p><p class="pv-m">${dateTag(it.updated, it.updatedLabel)}</p><p class="pv-x">${esc(it.preview)}</p></div></div>`
  }
  function show(link) {
    hide(true)
    const html = htmlFor(link)
    if (!html) return
    const host = document.createElement('div')
    host.innerHTML = html.trim()
    el = host.firstElementChild
    el.classList.add('float')
    el.addEventListener('mouseenter', () => clearTimeout(hideTimer))
    el.addEventListener('mouseleave', () => scheduleHide())
    document.body.appendChild(el)
    const r = link.getBoundingClientRect()
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = document.documentElement.clientWidth
    const left = Math.max(16, Math.min(r.left, vw - w - 16))
    const below = r.bottom + 10 + h < innerHeight - 8
    el.style.left = `${Math.round(left)}px`
    el.style.top = `${Math.round(below ? r.bottom + 10 : Math.max(8, r.top - h - 10))}px`
    motion.animate(el, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], 180)
    forLink = link
    link.setAttribute('aria-describedby', 'lab-preview')
    el.id = 'lab-preview'
    sound.cue('hover')
  }
  function hide(now = false) {
    clearTimeout(timer)
    clearTimeout(hideTimer)
    if (!el) return
    const gone = el
    el = null
    forLink?.removeAttribute('aria-describedby')
    forLink = null
    if (now) { gone.remove(); return }
    const a = motion.animate(gone, [{ opacity: 1 }, { opacity: 0 }], 120)
    if (a) a.onfinish = () => gone.remove()
    else gone.remove()
  }
  function scheduleHide() { clearTimeout(hideTimer); hideTimer = setTimeout(() => hide(), 140) }
  const target = (e) => e.target.closest?.('[data-preview], [data-ext]')

  document.addEventListener('mouseover', (e) => {
    if (!finePointer.matches) return
    const link = target(e)
    if (!link) return
    if (link === forLink) { clearTimeout(hideTimer); return }
    clearTimeout(timer)
    timer = setTimeout(() => show(link), 200)
  })
  document.addEventListener('mouseout', (e) => {
    const link = target(e)
    if (!link || (e.relatedTarget && link.contains(e.relatedTarget))) return
    clearTimeout(timer)
    scheduleHide()
  })
  document.addEventListener('focusin', (e) => {
    const link = target(e)
    if (!link || !finePointer.matches) return
    clearTimeout(timer)
    timer = setTimeout(() => show(link), 600)
  })
  document.addEventListener('focusout', (e) => { if (target(e)) { clearTimeout(timer); scheduleHide() } })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide() })
  document.addEventListener('pointerdown', () => hide(true))
  addEventListener('scroll', () => { if (el) hide() }, { passive: true })
  return { hide, show }
})()
