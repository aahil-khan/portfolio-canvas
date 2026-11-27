import { allThemes, labThemes } from '@/content/themes'
import { prefersReducedMotion } from '@/lib/motion/reduced'
import { LAB } from '@/lib/motion/tokens'

/**
 * The one owner of the Lab's theme and its reader settings. Contract: `content/lab/API.md` §8 and
 * §10.
 *
 *   Theme    any of the 20 palettes: the site's 18 and the Lab's two (`labThemes`). The Lab keeps
 *            its own choice, `lab.theme`, which defaults to Lab Dark whatever the system prefers.
 *            It never writes `canvas.theme`, so picking a theme here changes nothing on `/` or the
 *            canvas, and those pickers still list only the 18.
 *   Reader   text size (14–22px), font, line spacing, line length and layout: `lab.aa`.
 *
 * The live state is attributes on <html>, written by `lookBootScript` before first paint and by
 * the setters below afterwards:
 *
 *   data-theme        the palette in force (one of the 20)
 *   data-look         paper | lab       derived: `lab` for the two Lab palettes, `paper` for a site
 *                                       theme. The Lab's CSS keys its frame constants on it
 *   data-dark         1 | 0             whether the palette in force is dark
 *   data-aa-size      14 … 22           the body size in px
 *   data-aa-font      grotesk | serif | system
 *   data-aa-leading   tight | normal | relaxed
 *   data-aa-measure   narrow | comfortable | wide
 *   data-aa-layout    side | centred
 *
 * With JavaScript off none of these is written, and the Lab's CSS reads their absence as the
 * defaults: Lab Dark (`labFallbackCss` in `lib/lab/ink.ts`), 17px, Space Grotesk, normal, wide, side.
 *
 * React reads them through `useSyncExternalStore` (`subscribeLook`, `getLookSnapshot`, and a fixed
 * `getLookServerSnapshot`), never `useState` plus an effect, which is how the last build produced
 * React #418. No component reads localStorage or `matchMedia` for any of this.
 *
 * No 'use client' directive: the Lab layout imports `lookBootScript` on the server. Everything
 * else touches `document` only when called.
 */

export type Look = 'paper' | 'lab'
export const AA_FONTS = ['grotesk', 'serif', 'system'] as const
export const AA_LEADINGS = ['tight', 'normal', 'relaxed'] as const
export const AA_MEASURES = ['narrow', 'comfortable', 'wide'] as const
export const AA_LAYOUTS = ['side', 'centred'] as const
export type AaFont = (typeof AA_FONTS)[number]
export type AaLeading = (typeof AA_LEADINGS)[number]
export type AaMeasure = (typeof AA_MEASURES)[number]
export type AaLayout = (typeof AA_LAYOUTS)[number]
/** The body size, in px, 1px a step. */
export const AA_SIZE = { min: 14, max: 22 } as const

export interface Aa {
  size: number
  font: AaFont
  leading: AaLeading
  measure: AaMeasure
  layout: AaLayout
}

export interface LookState {
  /** The palette in force: `data-theme`. */
  theme: string
  look: Look
  dark: boolean
  aa: Aa
}

/** localStorage keys (API.md §10). */
export const LOOK_KEYS = {
  theme: 'lab.theme',
  aa: 'lab.aa',
} as const

export const LAB_DEFAULT_THEME = 'lab-dark'
export const DEFAULT_AA: Readonly<Aa> = Object.freeze({ size: 17, font: 'grotesk', leading: 'normal', measure: 'wide', layout: 'side' })

const IDS = allThemes.map((t) => t.id)
const LAB_IDS = labThemes.map((t) => t.id)
const DARK = Object.fromEntries(allThemes.map((t) => [t.id, t.dark]))

if (!LAB_IDS.includes(LAB_DEFAULT_THEME)) throw new Error('lib/lab/look.ts: the default theme is not a Lab palette')

/** The settings, cleaned: anything unknown or out of range falls back to its default. */
export function cleanAa(x: unknown): Aa {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
  const one = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d)
  const size = Number(o.size)
  return {
    size: Number.isInteger(size) && size >= AA_SIZE.min && size <= AA_SIZE.max ? size : DEFAULT_AA.size,
    font: one(o.font, AA_FONTS, DEFAULT_AA.font),
    leading: one(o.leading, AA_LEADINGS, DEFAULT_AA.leading),
    measure: one(o.measure, AA_MEASURES, DEFAULT_AA.measure),
    layout: one(o.layout, AA_LAYOUTS, DEFAULT_AA.layout),
  }
}

/**
 * Runs before first paint, after the root layout's theme boot script (whose `canvas.theme` it then
 * overrides on <html> for this page only). Kept as a string because it must run before React
 * exists.
 *
 * `?theme=<id>` (any of the 20) overrides the stored theme for one visit and is never saved, which
 * is how the check opens a page in a given theme.
 */
export const lookBootScript = `
(function(){try{
var d=document.documentElement,q=new URLSearchParams(location.search);
var g=function(k){try{return localStorage.getItem(k)}catch(e){return null}};
var IDS=${JSON.stringify(IDS)},LAB=${JSON.stringify(LAB_IDS)},DARK=${JSON.stringify(DARK)};
var t=q.get('theme');if(IDS.indexOf(t)<0)t=g(${JSON.stringify(LOOK_KEYS.theme)});if(IDS.indexOf(t)<0)t=${JSON.stringify(LAB_DEFAULT_THEME)};
d.dataset.theme=t;d.dataset.look=LAB.indexOf(t)>-1?'lab':'paper';d.dataset.dark=DARK[t]?'1':'0';
var a={};try{a=JSON.parse(g(${JSON.stringify(LOOK_KEYS.aa)}))||{}}catch(e){}
var one=function(v,l,x){return l.indexOf(v)>-1?v:x};
var s=Number(a.size);d.dataset.aaSize=String(s%1===0&&s>=${AA_SIZE.min}&&s<=${AA_SIZE.max}?s:${DEFAULT_AA.size});
d.dataset.aaFont=one(a.font,${JSON.stringify(AA_FONTS)},'${DEFAULT_AA.font}');
d.dataset.aaLeading=one(a.leading,${JSON.stringify(AA_LEADINGS)},'${DEFAULT_AA.leading}');
d.dataset.aaMeasure=one(a.measure,${JSON.stringify(AA_MEASURES)},'${DEFAULT_AA.measure}');
d.dataset.aaLayout=one(a.layout,${JSON.stringify(AA_LAYOUTS)},'${DEFAULT_AA.layout}');
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
  theme: LAB_DEFAULT_THEME,
  look: 'lab',
  dark: true,
  aa: DEFAULT_AA,
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
  const key = [d.theme, d.aaSize, d.aaFont, d.aaLeading, d.aaMeasure, d.aaLayout].join('|')
  if (key === cachedKey) return cached
  const theme = d.theme && IDS.includes(d.theme) ? d.theme : LAB_DEFAULT_THEME
  cachedKey = key
  cached = {
    theme,
    look: LAB_IDS.includes(theme) ? 'lab' : 'paper',
    dark: !!DARK[theme],
    aa: cleanAa({ size: d.aaSize, font: d.aaFont, leading: d.aaLeading, measure: d.aaMeasure, layout: d.aaLayout }),
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

/** Picks the Lab's theme: any of the 20. Writes `lab.theme`, never `canvas.theme`. */
export function setLabTheme(id: string): void {
  if (!IDS.includes(id)) return
  const d = document.documentElement.dataset
  if (d.theme === id) return
  fade()
  store(LOOK_KEYS.theme, id)
  d.theme = id
  d.look = LAB_IDS.includes(id) ? 'lab' : 'paper'
  d.dark = DARK[id] ? '1' : '0'
  emit()
}

function writeAa(aa: Aa) {
  const d = document.documentElement.dataset
  d.aaSize = String(aa.size)
  d.aaFont = aa.font
  d.aaLeading = aa.leading
  d.aaMeasure = aa.measure
  d.aaLayout = aa.layout
  emit()
}

/** Changes some reader settings. A size outside 14–22 is ignored, not clamped. */
export function setAa(patch: Partial<Aa>): void {
  const next = { ...getLookSnapshot().aa, ...patch }
  const aa = cleanAa(next)
  if (aa.size !== next.size) return
  store(LOOK_KEYS.aa, JSON.stringify(aa))
  writeAa(aa)
}

/** Every reader setting back to its default; the stored choice goes too. */
export function resetAa(): void {
  try {
    localStorage.removeItem(LOOK_KEYS.aa)
  } catch {
    /* fine */
  }
  writeAa({ ...DEFAULT_AA })
}

export const isDefaultAa = (aa: Aa): boolean => (Object.keys(DEFAULT_AA) as (keyof Aa)[]).every((k) => aa[k] === DEFAULT_AA[k])
