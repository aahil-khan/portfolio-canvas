/* eslint-disable @typescript-eslint/no-unused-vars -- src/*.js are concatenated into one scope by build.mjs, so names are used across files */
/* Themes and the clock. The Lab keeps its own theme choice (`lab.theme`), separate from the desk and
   `/`, and opens in lab-dark whatever the OS says. `#…?theme=<id>` forces one without saving it. */

const theme = (() => {
  const ids = DATA.themes.map((t) => t.id)
  const forced = () => { const q = parseHash().query.theme; return q && ids.includes(q) ? q : null }
  const current = () => forced() || (ids.includes(store.get('lab.theme')) ? store.get('lab.theme') : 'lab-dark')
  function set(id, { save = true } = {}) {
    if (!ids.includes(id)) return
    if (save) store.set('lab.theme', id)
    document.documentElement.setAttribute('data-theme', id)
    emit('theme', id)
  }
  const meta = (id) => DATA.themes.find((t) => t.id === id)
  function listHtml(asSheet) {
    const cur = document.documentElement.getAttribute('data-theme')
    const opt = (t) => `<button type="button" class="theme-opt" data-set-theme="${t.id}" aria-pressed="${t.id === cur}">` +
      `<span class="sw" aria-hidden="true">${t.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span>${esc(t.label)}</button>`
    const body = `<div class="list"><p class="grp">${esc(UI.footer.labThemes)}</p>${DATA.themes.filter((t) => t.lab).map(opt).join('')}` +
      `<p class="grp">${esc(UI.footer.siteThemes)}</p>${DATA.themes.filter((t) => !t.lab).map(opt).join('')}</div>`
    return asSheet ? body : `<div class="win theme-win"><div class="win-bar"><span class="win-label">${esc(UI.footer.theme)}</span><button class="x" type="button" data-close>${esc(UI.close)}</button></div>${body}</div>`
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-list]')
    if (b) {
      if (phone.matches) sheet.open({ trigger: b, label: UI.footer.theme, html: listHtml(true) })
      else floats.open({ trigger: b, where: 'up', label: UI.footer.theme, html: listHtml(false) })
      return
    }
    const o = e.target.closest('[data-set-theme]')
    if (o) {
      set(o.dataset.setTheme)
      $$('[data-set-theme]').forEach((x) => x.setAttribute('aria-pressed', String(x === o)))
      return
    }
    if (e.target.closest('[data-lightdark]')) set(meta(document.documentElement.getAttribute('data-theme')).dark ? 'lab-light' : 'lab-dark')
  })
  on('theme', (id) => {
    const t = meta(id)
    $$('[data-theme-list] b').forEach((x) => { x.textContent = t.label })
    $$('[data-lightdark]').forEach((x) => { x.textContent = t.dark ? UI.footer.light : UI.footer.dark })
  })
  return { current, set, apply: () => set(current(), { save: false }) }
})()

const clock = (() => {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const now = () => fmt.format(new Date())
  // replaced on mount and on each minute boundary, so it is never a stale render
  function tick() {
    $$('[data-clock]').forEach((x) => { x.textContent = now() })
    setTimeout(tick, 60000 - (Date.now() % 60000) + 50)
  }
  return { now, start: tick }
})()

document.addEventListener('click', (e) => { if (e.target.closest('[data-sound]')) sound.toggle() })
sound.subscribe((v) => $$('[data-sound]').forEach((b) => { b.setAttribute('aria-pressed', String(v)); b.querySelector('b').textContent = v ? UI.footer.on : UI.footer.off }))
