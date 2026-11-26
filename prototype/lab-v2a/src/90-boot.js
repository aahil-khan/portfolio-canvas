/* Router: hash routes with the build's real paths, so the move to /lab is mechanical. */

const router = (() => {
  let current = null
  const OUTSIDE = { '/site': 'site', '/canvas': 'canvas', '/agents': 'agents', '/colophon': 'colophon' }
  function render() {
    const { path, query } = parseHash()
    closeAllFloating()
    preview.hide(true)
    listen.stop({ silent: true })
    const app = $('#app')
    let it = null
    let main
    if (path === '/lab') main = homeHtml()
    else if (OUTSIDE[path]) main = outsideHtml(OUTSIDE[path])
    else {
      it = byPath(path)
      main = !it ? outsideHtml('site') : it.built ? noteHtml(it) : stubHtml(it)
    }
    current = it
    app.innerHTML = barHtml(it, { listen: !!(it && it.built && it.listen) }) + main + footHtml()
    document.title = it ? `${it.short || it.title} · ${UI.home.title}` : UI.home.title
    const svg = $('[data-map] svg')
    if (svg && getComputedStyle(svg.closest('[data-map]')).display !== 'none') drawMap(svg)
    afterRender(query)
  }
  let observers = []
  function afterRender(query) {
    observers.forEach((o) => o.disconnect())
    observers = []
    // the bar gets its hairline once the page scrolls (no scroll listener: a sentinel)
    const bar = $('.bar')
    let sentinel = document.getElementById('top-sentinel')
    if (!sentinel) {
      sentinel = document.createElement('div')
      sentinel.id = 'top-sentinel'
      sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px'
      document.body.prepend(sentinel)
    }
    const barIo = new IntersectionObserver(([en]) => bar.classList.toggle('scrolled', !en.isIntersecting))
    barIo.observe(sentinel)
    observers.push(barIo)
    // contents: mark the section in view (IntersectionObserver, -50% root margin)
    const tocLinks = $$('.toc a[data-at]')
    if (tocLinks.length) {
      const io = new IntersectionObserver((ens) => ens.forEach((en) => {
        if (!en.isIntersecting) return
        tocLinks.forEach((a) => a.setAttribute('aria-current', String(a.dataset.at === en.target.id)))
      }), { rootMargin: '-45% 0px -50% 0px' })
      $$('[data-body] h2[id]').forEach((h) => io.observe(h))
      // the margin rail (≥ 1200px) shows once the title has scrolled out of view
      const toc = $('.toc')
      const headIo = new IntersectionObserver(([en]) => toc.classList.toggle('shown', !en.isIntersecting))
      headIo.observe($('[data-note-head] h1'))
      observers.push(io, headIo)
    }
    if (query.at && document.getElementById(query.at)) document.getElementById(query.at).scrollIntoView()
    else scrollTo(0, 0)
  }
  return { render, currentItem: () => current }
})()

// in-page contents links scroll without changing the route
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-at]')
  if (!a) return
  const h = document.getElementById(a.dataset.at)
  if (!h) return
  e.preventDefault()
  sheet.close({ focus: false })
  history.replaceState(null, '', a.getAttribute('href'))
  h.scrollIntoView({ behavior: motion.reduced ? 'auto' : 'smooth' })
})
// a press (never a hover) on a link or a folder item gets the click cue
document.addEventListener('pointerdown', (e) => { if (e.target.closest('a[href], .theme-opt, .station')) sound.cue('click') })

theme.apply()
addEventListener('hashchange', () => { theme.apply(); router.render() })
router.render()
clock.start()
