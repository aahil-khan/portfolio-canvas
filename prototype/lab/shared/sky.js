/*
 * prototype/lab/shared/sky.js: what both Lab directions share at runtime, on top of desk.js.
 * Load it in <head>, after pieces.js, so the shadow variant is on <html> before first paint.
 *
 *   LAB.sky.reduced          prefers-reduced-motion, read here and nowhere else in JS. jet.css
 *                            keys its own animations off the same media query.
 *   LAB.sky.starfield(el, { seed })  fills a `.lab-starfield` with seeded dots in three depth
 *                            layers, and returns move(camX, camY) for parallax. Dots are CSS
 *                            radial-gradients, never DOM nodes; move() writes one
 *                            background-position per layer (the canvas grid's technique).
 *                            Hook it to the desk: DESK.onFrame((c) => field.move(c.x, c.y)).
 *   LAB.sky.mark(shelf, r)   SVG path for a star: ✦ for notes, ● for playground. Shape, not
 *                            colour alone, tells the shelves apart.
 *   LAB.params               { work: 'a'|'b', p, focus, shelf, shadow } from the URL.
 *   LAB.shadow               'a'|'b'|'c': how cards read on jet (jet.css). ?shadow= wins, then
 *                            the hub's last choice, then 'b'.
 *   LAB.visited              has(slug) / add(slug) / all(); localStorage, harmless when absent.
 *   LAB.opens(piece)         where a star leads: { card } for a piece with `card` (the Arcade
 *                            games open the real arcade card), else { piece: slug }.
 *   LAB.indexPieces(work)    the index's pieces: (a) without projects, (b) all of them.
 *   LAB.shelfName(id, work)  "Notes & write-ups", or its altName under (b).
 *   LAB.rand(seed), LAB.hash(str)   the seeded random layout.js uses, for directions' own needs.
 *
 * Pan and zoom are deliberately not here: each direction proves its own feel.
 */
;(() => {
  const LAB = (window.LAB = window.LAB || {})

  const hash = (s) => {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
  }
  const rand = (seed) => {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  LAB.hash = hash
  LAB.rand = rand

  const store = {
    get(k) { try { return localStorage.getItem(k) } catch { return null } },
    set(k, v) { try { localStorage.setItem(k, v) } catch {} },
  }

  const q = new URLSearchParams(location.search)
  LAB.params = {
    work: q.get('work') === 'b' ? 'b' : 'a',
    p: q.get('p'),
    focus: q.get('focus'),
    shelf: ['notes', 'playground'].includes(q.get('shelf')) ? q.get('shelf') : null,
    shadow: q.get('shadow'),
  }
  const valid = (v) => ['a', 'b', 'c'].includes(v)
  LAB.shadow = valid(LAB.params.shadow) ? LAB.params.shadow : valid(store.get('lab.shadow')) ? store.get('lab.shadow') : 'b'
  LAB.setShadow = (v) => {
    if (!valid(v)) return
    LAB.shadow = v
    document.documentElement.dataset.shadow = v
    store.set('lab.shadow', v)
  }
  document.documentElement.dataset.shadow = LAB.shadow

  const seen = () => { try { return JSON.parse(store.get('lab.visited') || '[]') } catch { return [] } }
  LAB.visited = {
    all: seen,
    has: (slug) => seen().includes(slug),
    add: (slug) => { const v = seen(); if (!v.includes(slug)) store.set('lab.visited', JSON.stringify([...v, slug])) },
  }

  LAB.opens = (p) => (p.card ? { card: p.card } : { piece: p.slug })
  LAB.indexPieces = (work = LAB.params.work) => (LAB.pieces || []).filter((p) => work === 'b' || !p.isProject)
  LAB.shelfName = (id, work = LAB.params.work) => {
    const s = (LAB.shelves || []).find((x) => x.id === id) || { name: id }
    return work === 'b' && s.altName ? s.altName : s.name
  }

  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false }
  const sky = { reduced: mq.matches }
  if (mq.addEventListener) mq.addEventListener('change', (e) => (sky.reduced = e.matches))

  // far → near: bigger tiles hold fewer, fainter dots and move least
  const DEPTHS = [
    { tile: 620, n: 34, size: 0.8, alpha: 0.14, factor: 0.08 },
    { tile: 460, n: 18, size: 1.1, alpha: 0.2, factor: 0.18 },
    { tile: 340, n: 7, size: 1.5, alpha: 0.26, factor: 0.32 },
  ]
  sky.starfield = (el, { seed = 7 } = {}) => {
    const r = rand(seed)
    el.textContent = ''
    const layers = DEPTHS.map((d) => {
      const layer = document.createElement('div')
      layer.className = 'lab-starfield__layer'
      const dots = []
      for (let i = 0; i < d.n; i++) {
        const x = (2 + r() * (d.tile - 4)).toFixed(1), y = (2 + r() * (d.tile - 4)).toFixed(1)
        const a = (d.alpha * (0.6 + r() * 0.4)).toFixed(3)
        dots.push(`radial-gradient(circle at ${x}px ${y}px, rgba(var(--star-dust), ${a}) 0 ${d.size}px, transparent ${d.size + 0.6}px)`)
      }
      layer.style.backgroundImage = dots.join(',')
      layer.style.backgroundSize = `${d.tile}px ${d.tile}px`
      el.appendChild(layer)
      return { layer, d }
    })
    el.dataset.seeded = ''
    return {
      move(camX, camY) {
        for (const { layer, d } of layers) layer.style.backgroundPosition = `${(camX * d.factor) % d.tile}px ${(camY * d.factor) % d.tile}px`
      },
    }
  }

  // ✦: four points, waist at 28% of r. ●: a circle the same visual weight (slightly smaller).
  sky.mark = (shelf, r) => {
    if (shelf === 'playground') {
      const c = r * 0.78
      return `M ${-c} 0 a ${c} ${c} 0 1 0 ${2 * c} 0 a ${c} ${c} 0 1 0 ${-2 * c} 0 Z`
    }
    const w = r * 0.28
    return `M 0 ${-r} L ${w} ${-w} L ${r} 0 L ${w} ${w} L 0 ${r} L ${-w} ${w} L ${-r} 0 L ${-w} ${-w} Z`
  }

  LAB.sky = sky
})()
