/*
 * prototype/lab/notebook/prefs.js: the reader's preferences, ONE owner. Loaded in <head> (the
 * bundle inlines it), so NB.prefs.apply() runs before the first paint and the page never shows
 * night and then paper. In the React build this is lib/lab/prefs.ts, applied the same way.
 *
 *   NB.prefs.apply()                 before first paint: html[data-lab-theme], html[data-focus]
 *   NB.prefs.theme()                 the theme on screen: night | paper | green | amber
 *   NB.prefs.setTheme(id, store?)    switch (stored unless store === false)
 *   NB.prefs.cycle()                 the bar's ◐: night ↔ paper (green or amber → night)
 *   NB.prefs.trip()                  the trip lands in night, whatever was chosen (not stored)
 *   NB.prefs.get(k) / .set(k, v)     localStorage as JSON, harmless in a private window
 *
 * WHICH THEME. A stored choice wins. Without one, a direct link follows prefers-color-scheme
 * (light → paper, otherwise night), and the canvas trip (#desk, ?freeze, ?roundtrip) is night:
 * the trip IS the night falling. ?palette= or ?theme= holds a theme for one visit (not stored).
 *
 * The attribute is data-lab-theme, not data-theme: the desk under the Lab already owns
 * html[data-theme] (cream / jet) and keeps it.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NB = (root_.NB = root_.NB || {})
  const THEMES = ['night', 'paper', 'green', 'amber']
  const KEY = { theme: 'nb-theme', focus: 'nb-focus' }
  const get = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private window */ } }
  const html = () => document.documentElement
  const listeners = []

  // pure: what to show, from what is known at load. Exported for check.mjs.
  const resolve = ({ stored, asked, trip, light }) =>
    THEMES.includes(asked) ? asked : THEMES.includes(stored) ? stored : trip ? 'night' : light ? 'paper' : 'night'

  const P = (NB.prefs = {
    THEMES, KEY, get, set, resolve,
    theme: () => html().getAttribute('data-lab-theme') || 'night',
    stored: () => (THEMES.includes(get(KEY.theme)) ? get(KEY.theme) : null),
    onTheme: (f) => listeners.push(f),
    setTheme(id, store = true) {
      if (!THEMES.includes(id)) return false
      html().setAttribute('data-lab-theme', id)
      if (store) set(KEY.theme, id)
      for (const f of listeners) f(id)
      return true
    },
    cycle: () => P.setTheme(P.theme() === 'night' ? 'paper' : 'night'),
    trip: () => P.setTheme('night', false),
    apply() {
      const q = new URLSearchParams(location.search)
      let light = false
      try { light = matchMedia('(prefers-color-scheme: light)').matches } catch { /* no matchMedia */ }
      const trip = location.hash === '#desk' || q.has('freeze') || q.has('roundtrip')
      html().setAttribute('data-lab-theme', resolve({ stored: P.stored(), asked: q.get('theme') || q.get('palette'), trip, light }))
      if (get(KEY.focus)) html().setAttribute('data-focus', '')
    },
  })
  if (typeof document !== 'undefined') P.apply()
})()
