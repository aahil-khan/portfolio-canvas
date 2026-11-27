import { allThemes, DEFAULT_THEME, labThemes, themes } from '@/content/themes'
import { prefersReducedMotion } from '@/lib/motion/reduced'
import { LAB } from '@/lib/motion/tokens'
import { setTheme } from '@/lib/theme'

/**
 * The one owner of the Lab's look, Premium's mode and Aa. Contract: `content/lab/API.md` §8 and
 * §10.
 *
 *   Paper    the site's own theme: whatever `canvas.theme` holds, set by the root layout's theme
 *            boot script. The Lab never keeps a theme of its own.
 *   Premium  one of the two `labOnly` palettes in `content/themes.ts`, Day or Night. While it is
 *            on, `data-theme` names that palette and `canvas.theme` is left alone, so going back
 *            to Paper (or to the canvas) restores the reader's own theme.
 *   Aa       the measure (wide 96ch, or comfortable 72ch) and the body size (16, 17 or 19px).
 *
 * The live state is attributes on <html>, written by `lookBootScript` before first paint and by
 * the setters below afterwards:
 *
 *   data-look         paper | premium
 *   data-mode         day | night       Premium's mode; kept while in Paper, for the next switch
 *   data-theme        the palette in force (a site theme in Paper, a Premium palette in Premium)
 *   data-paper-theme  the site theme Paper shows
 *   data-dark         1 | 0             whether the palette in force is dark
 *   data-aa-measure   wide | comfortable
 *   data-aa-size      16 | 17 | 19
 *
 * React reads them through `useSyncExternalStore` (`subscribeLook`, `getLookSnapshot`, and a fixed
 * `getLookServerSnapshot`), never `useState` plus an effect, which is how the last build produced
 * React #418. No component reads localStorage or `matchMedia` for any of this.
 *
 * No 'use client' directive: the Lab layout imports `lookBootScript` on the server. Everything
 * else touches `document` only when called.
 */

export type Look = 'paper' | 'premium'
export type PremiumMode = 'day' | 'night'
export type AaMeasure = 'wide' | 'comfortable'
export const AA_SIZES = [16, 17, 19] as const
export type AaSize = (typeof AA_SIZES)[number]
export interface Aa {
  measure: AaMeasure
  size: AaSize
}

export interface LookState {
  look: Look
  mode: PremiumMode
  /** The palette in force: `data-theme`. */
  theme: string
  /** The site theme Paper shows. */
  paperTheme: string
  dark: boolean
  aa: Aa
}

/** localStorage keys (API.md §10). Paper has none: it is `canvas.theme`, owned by `lib/theme.ts`. */
export const LOOK_KEYS = {
  look: 'lab.look',
  premiumMode: 'lab.premiumMode',
  aa: 'lab.aa',
} as const

export const PREMIUM_THEME: Record<PremiumMode, string> = {
  day: 'lab-premium-day',
  night: 'lab-premium-night',
}

const DEFAULT_AA: Aa = { measure: 'wide', size: 17 }
const DARK = Object.fromEntries(allThemes.map((t) => [t.id, t.dark]))
const SITE_IDS = themes.map((t) => t.id)
const LIGHT_PAPER = DEFAULT_THEME
const DARK_PAPER = 'tokyo-night'

if (labThemes.some((t) => !Object.values(PREMIUM_THEME).includes(t.id)))
  throw new Error('lib/lab/look.ts: content/themes.ts has a Lab palette this file does not map')

/**
 * Runs before first paint, after the root layout's theme boot script (so `data-theme` already
 * holds the reader's site theme). Kept as a string because it must run before React exists.
 *
 * Query parameters override the stored look for one visit and are never saved, which is how the
 * check opens a page in a given look: `?look=paper|premium`, `?mode=light|dark` (Premium's mode,
 * or cream / tokyo-night in Paper), `?theme=<site theme id>` (Paper).
 *
 * Premium's first mode is Night unless the system prefers light (NEXT.md decision; research §6).
 */
export const lookBootScript = `
(function(){try{
var d=document.documentElement,q=new URLSearchParams(location.search);
var g=function(k){try{return localStorage.getItem(k)}catch(e){return null}};
var SITE=${JSON.stringify(SITE_IDS)},DARK=${JSON.stringify(DARK)},PREM=${JSON.stringify(PREMIUM_THEME)};
var look=g(${JSON.stringify(LOOK_KEYS.look)})==='premium'?'premium':'paper';
var ql=q.get('look');if(ql==='paper'||ql==='premium')look=ql;
var mode=g(${JSON.stringify(LOOK_KEYS.premiumMode)});
if(mode!=='day'&&mode!=='night')mode=window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'day':'night';
var paper=SITE.indexOf(d.dataset.theme)>-1?d.dataset.theme:${JSON.stringify(DEFAULT_THEME)};
var qm=q.get('mode'),qt=q.get('theme');
if(qm==='light'||qm==='dark'){if(look==='premium')mode=qm==='dark'?'night':'day';else if(!qt)paper=qm==='dark'?${JSON.stringify(DARK_PAPER)}:${JSON.stringify(LIGHT_PAPER)};}
if(qt&&SITE.indexOf(qt)>-1)paper=qt;
var theme=look==='premium'?PREM[mode]:paper;
var aa={};try{aa=JSON.parse(g(${JSON.stringify(LOOK_KEYS.aa)}))||{}}catch(e){}
d.dataset.look=look;d.dataset.mode=mode;d.dataset.paperTheme=paper;d.dataset.theme=theme;
d.dataset.dark=DARK[theme]?'1':'0';
d.dataset.aaMeasure=aa.measure==='comfortable'?'comfortable':'wide';
d.dataset.aaSize=${JSON.stringify(AA_SIZES.map(String))}.indexOf(String(aa.size))>-1?String(aa.size):'${DEFAULT_AA.size}';
}catch(e){}})();
`

// ---------- the store ----------

const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}

export function subscribeLook(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const SERVER_SNAPSHOT: LookState = Object.freeze({
  look: 'paper',
  mode: 'night',
  theme: DEFAULT_THEME,
  paperTheme: DEFAULT_THEME,
  dark: false,
  aa: Object.freeze({ ...DEFAULT_AA }),
}) as LookState

/** What the server rendered with. Fixed, so hydration always agrees with the HTML. */
export function getLookServerSnapshot(): LookState {
  return SERVER_SNAPSHOT
}

let cachedKey = ''
let cached: LookState = SERVER_SNAPSHOT

/** The live state, read from <html>. Referentially stable until something changes. */
export function getLookSnapshot(): LookState {
  const d = document.documentElement.dataset
  const key = [d.look, d.mode, d.theme, d.paperTheme, d.dark, d.aaMeasure, d.aaSize].join('|')
  if (key === cachedKey) return cached
  const size = Number(d.aaSize)
  cachedKey = key
  cached = {
    look: d.look === 'premium' ? 'premium' : 'paper',
    mode: d.mode === 'day' ? 'day' : 'night',
    theme: d.theme ?? DEFAULT_THEME,
    paperTheme: d.paperTheme && SITE_IDS.includes(d.paperTheme) ? d.paperTheme : DEFAULT_THEME,
    dark: d.dark === '1',
    aa: {
      measure: d.aaMeasure === 'comfortable' ? 'comfortable' : 'wide',
      size: (AA_SIZES as readonly number[]).includes(size) ? (size as AaSize) : DEFAULT_AA.size,
    },
  }
  return cached
}

// ---------- the setters ----------

const store = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode: the choice just won't persist */
  }
}

let fadeTimer: ReturnType<typeof setTimeout> | undefined
/** Colours crossfade on a switch (`html.look-fade`, styled by the Lab's CSS), unless reduced. */
function fade() {
  if (prefersReducedMotion()) return
  const root = document.documentElement
  root.classList.add('look-fade')
  clearTimeout(fadeTimer)
  fadeTimer = setTimeout(() => root.classList.remove('look-fade'), LAB.look + 40)
}

/** Writes the palette for the current look and mode. */
function apply(look: Look, mode: PremiumMode, paperTheme: string) {
  const d = document.documentElement.dataset
  const theme = look === 'premium' ? PREMIUM_THEME[mode] : paperTheme
  d.look = look
  d.mode = mode
  d.paperTheme = paperTheme
  d.theme = theme
  d.dark = DARK[theme] ? '1' : '0'
}

export function setLook(look: Look): void {
  const s = getLookSnapshot()
  if (look === s.look) return
  fade()
  store(LOOK_KEYS.look, look)
  store(LOOK_KEYS.premiumMode, s.mode)
  apply(look, s.mode, s.paperTheme)
  emit()
}

export function setPremiumMode(mode: PremiumMode): void {
  const s = getLookSnapshot()
  if (mode === s.mode) return
  if (s.look === 'premium') fade()
  store(LOOK_KEYS.premiumMode, mode)
  apply(s.look, mode, s.paperTheme)
  emit()
}

/**
 * Paper's theme. Goes through `lib/theme.ts`, which owns `canvas.theme`, so a theme picked in the
 * Lab is the one the canvas and `/` open with too.
 */
export function setPaperTheme(id: string): void {
  if (!SITE_IDS.includes(id)) return
  const s = getLookSnapshot()
  if (s.look === 'paper') fade()
  setTheme(id) // writes canvas.theme and data-theme; apply() puts Premium's palette back if it is on
  apply(s.look, s.mode, id)
  emit()
}

/** The bar's one light/dark button: Day ⇄ Night in Premium, cream ⇄ tokyo-night in Paper. */
export function toggleDark(): void {
  const s = getLookSnapshot()
  if (s.look === 'premium') setPremiumMode(s.mode === 'night' ? 'day' : 'night')
  else setPaperTheme(s.dark ? LIGHT_PAPER : DARK_PAPER)
}

export function setAa(patch: Partial<Aa>): void {
  const s = getLookSnapshot()
  const aa: Aa = { ...s.aa, ...patch }
  if (!(AA_SIZES as readonly number[]).includes(aa.size)) return
  store(LOOK_KEYS.aa, JSON.stringify(aa))
  const d = document.documentElement.dataset
  d.aaMeasure = aa.measure
  d.aaSize = String(aa.size)
  emit()
}
