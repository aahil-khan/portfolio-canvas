'use client'

import { DEFAULT_THEME, themes } from '@/content/themes'

/**
 * Theme selection, as an external store.
 *
 * Same reasoning as the sound preference: reading localStorage during render is a hydration
 * mismatch, and setting state in an effect causes a cascading render. The live value is the
 * `data-theme` attribute on <html>, which an inline script in the document head sets before
 * first paint — so there is no flash of the wrong theme.
 */

const KEY = 'canvas.theme'
const VALID = new Set(themes.map((t) => t.id))
const listeners = new Set<() => void>()

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getThemeSnapshot(): string {
  const attr = document.documentElement.dataset.theme
  return attr && VALID.has(attr) ? attr : DEFAULT_THEME
}

export function getThemeServerSnapshot(): string {
  return DEFAULT_THEME
}

export function setTheme(id: string): void {
  if (!VALID.has(id)) return
  document.documentElement.dataset.theme = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* private mode — the choice just won't persist */
  }
  for (const l of listeners) l()
}

/**
 * Runs in <head> before the body paints. Kept as a string because it must execute before React
 * exists — inlined by the layout, not bundled.
 */
export const themeBootScript = `
(function(){try{
  var t=localStorage.getItem(${JSON.stringify(KEY)});
  var ok=${JSON.stringify([...VALID])};
  if(t&&ok.indexOf(t)>-1)document.documentElement.dataset.theme=t;
}catch(e){}})();
`
