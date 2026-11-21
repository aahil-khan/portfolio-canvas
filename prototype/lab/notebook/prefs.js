/*
 * prototype/lab/notebook/prefs.js: the reader's preferences, ONE owner. Loaded in <head> (the
 * bundle inlines it), so NB.prefs.apply() runs before the first paint and the page never shows
 * night and then paper, or 17 px and then 21. In the React build this is lib/lab/prefs.ts, applied
 * the same way. Everything here is an attribute on <html>; CSS reads it, nothing else does.
 *
 *   NB.prefs.apply()                 before first paint: html[data-lab-theme], [data-lab-size],
 *                                    [data-lab-width], [data-focus]
 *   NB.prefs.theme()                 the theme on screen: night | paper | green | amber
 *   NB.prefs.mode()                  what the reader chose: auto | night | paper | green | amber
 *   NB.prefs.setMode(m)              the Aa panel: auto (nothing stored, follows the OS) or a theme
 *   NB.prefs.setTheme(id, store?)    switch (stored unless store === false)
 *   NB.prefs.trip()                  the trip lands in night, whatever was chosen (not stored)
 *   NB.prefs.size() / .setSize(i)    the text size step, 0–4: 15 / 17 / 19 / 21 / 23 px for the body
 *   NB.prefs.bump(±1)                + and −: one step, clamped
 *   NB.prefs.width() / .setWidth(w)  the line: narrow 32em (the default) / medium 36em / wide 44em
 *   NB.prefs.onChange(f)             f(kind) after any change: 'theme' | 'size' | 'width'
 *   NB.prefs.get(k) / .set(k, v)     localStorage as JSON, harmless in a private window
 *
 * WHICH THEME. A stored choice wins. Without one ("auto"), a direct link follows
 * prefers-color-scheme (light → paper, otherwise night), live, and the canvas trip (#desk, ?freeze,
 * ?roundtrip) is night: the trip IS the night falling. ?palette= or ?theme= holds a theme for one
 * visit (not stored).
 *
 * The attribute is data-lab-theme, not data-theme: the desk under the Lab already owns
 * html[data-theme] (cream / jet) and keeps it.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NB = (root_.NB = root_.NB || {})
  const THEMES = ['night', 'paper', 'green', 'amber']
  const MODES = ['auto', 'night', 'paper']
  // the body's px at each step; the whole reading scale is a multiple of it (notebook.css)
  const SIZES = [15, 17, 19, 21, 23]
  const SIZE0 = 1
  const WIDTHS = { narrow: 32, medium: 36, wide: 44 }
  const WIDTH0 = 'narrow'
  const KEY = { theme: 'nb-theme', focus: 'nb-focus', size: 'nb-size', width: 'nb-width' }
  const get = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private window */ } }
  const del = (k) => { try { localStorage.removeItem(k) } catch { /* private window */ } }
  const html = () => document.documentElement
  const listeners = [], changes = []
  const changed = (kind) => { for (const f of changes) f(kind) }

  // pure: what to show, from what is known at load. Exported for check.mjs.
  const resolve = ({ stored, asked, trip, light }) =>
    THEMES.includes(asked) ? asked : THEMES.includes(stored) ? stored : trip ? 'night' : light ? 'paper' : 'night'
  const clampSize = (i) => (Number.isInteger(i) ? Math.max(0, Math.min(SIZES.length - 1, i)) : SIZE0)
  const widthOf = (w) => (w in WIDTHS ? w : WIDTH0)
  const light = () => { try { return matchMedia('(prefers-color-scheme: light)').matches } catch { return false } }

  const P = (NB.prefs = {
    THEMES, MODES, SIZES, SIZE0, WIDTHS, WIDTH0, KEY, get, set, resolve, clampSize, widthOf,
    theme: () => html().getAttribute('data-lab-theme') || 'night',
    stored: () => (THEMES.includes(get(KEY.theme)) ? get(KEY.theme) : null),
    mode: () => P.stored() || 'auto',
    onTheme: (f) => listeners.push(f),
    onChange: (f) => changes.push(f),
    setTheme(id, store = true) {
      if (!THEMES.includes(id)) return false
      html().setAttribute('data-lab-theme', id)
      if (store) set(KEY.theme, id)
      for (const f of listeners) f(id)
      changed('theme')
      return true
    },
    // auto stores nothing: the OS decides, now and whenever it changes
    setMode(m) {
      if (m !== 'auto') return P.setTheme(m)
      del(KEY.theme)
      P.tripped = false
      return P.setTheme(light() ? 'paper' : 'night', false)
    },
    trip: () => { P.tripped = true; return P.setTheme('night', false) },
    tripped: false,
    size: () => clampSize(+html().getAttribute('data-lab-size')),
    setSize(i) {
      const s = clampSize(i)
      html().setAttribute('data-lab-size', String(s))
      set(KEY.size, s)
      changed('size')
      return s
    },
    bump: (d) => P.setSize(P.size() + d),
    width: () => widthOf(html().getAttribute('data-lab-width')),
    setWidth(w) {
      html().setAttribute('data-lab-width', widthOf(w))
      set(KEY.width, widthOf(w))
      changed('width')
      return widthOf(w)
    },
    apply() {
      const q = new URLSearchParams(location.search)
      const trip = location.hash === '#desk' || q.has('freeze') || q.has('roundtrip')
      html().setAttribute('data-lab-theme', resolve({ stored: P.stored(), asked: q.get('theme') || q.get('palette'), trip, light: light() }))
      html().setAttribute('data-lab-size', String(clampSize(get(KEY.size))))
      html().setAttribute('data-lab-width', widthOf(get(KEY.width)))
      if (get(KEY.focus)) html().setAttribute('data-focus', '')
      // auto follows the OS live, but never pulls a reader off the night the trip gave them
      try {
        matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
          if (P.stored() || q.get('theme') || q.get('palette') || trip || P.tripped) return
          P.setTheme(e.matches ? 'paper' : 'night', false)
        })
      } catch { /* no matchMedia */ }
    },
  })
  if (typeof document !== 'undefined') P.apply()
})()
