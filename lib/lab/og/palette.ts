/**
 * A share card's colours: one theme's tokens resolved to plain colours, because `next/og` draws
 * with satori, which knows no custom properties and no `color-mix()`.
 *
 * The values are the Lab's own (design/DIRECTION.md, "The Lab"): the frame is `--border`, the hard
 * offset `--shadow-ink`, and the title bar the accent tinted into the box (16% / 9% into `--raised`
 * for Lab Light / Dark, 25% / 12% into `--surface` for a light / dark site theme). A dark palette's
 * ink tiers are lifted exactly as the Lab lifts them for reading (`lib/lab/ink.ts`), so a card
 * reads like the page it shares. A site theme keeps the canvas's grid on its ground, as PR 3's
 * approved Paper card does; the Lab's two palettes have none.
 *
 * Plain TypeScript with relative imports, so `npm test` loads it (ink.ts needs the `@/` hook).
 */
import { allThemes, type Theme } from '../../../content/themes.ts'
import { labInks, solid } from '../ink.ts'

/** The theme every live card is drawn in. A card can't follow a visitor's theme, so it takes the Lab's default. */
export const OG_THEME = 'lab-dark'

export interface Palette {
  id: string
  dark: boolean
  canvas: string
  /** The canvas's grid lines, or null for a ground without one. */
  grid: string | null
  surface: string
  titlebar: string
  ink: string
  inkMuted: string
  inkSubtle: string
  accent: string
  accentInk: string
  border: string
  shadow: string
}

type RGB = [number, number, number]
const toHex = (c: RGB) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

export function themeById(id: string): Theme {
  const t = allThemes.find((x) => x.id === id)
  if (!t) throw new Error(`lib/lab/og/palette.ts: no theme "${id}"`)
  return t
}

export function palette(id: string = OG_THEME): Palette {
  const t = themeById(id)
  const k = t.tokens
  const canvas = solid(k.canvas, [0, 0, 0])
  const surface = solid(k.surface, canvas)
  const raised = solid(k.raised, canvas)
  const accent = solid(k.accent, canvas)
  // the title bar: DIRECTION, "The Lab → Themes" (the Lab's --tb-tint) and "A site theme's title bar"
  const titlebar = t.labOnly ? mix(raised, accent, t.dark ? 0.09 : 0.16) : mix(surface, accent, t.dark ? 0.12 : 0.25)
  const inks = t.dark ? labInks(t) : { ink: k.ink, inkMuted: k.inkMuted, inkSubtle: k.inkSubtle }
  // text on a card sits on the box (`--surface`): composite the translucent tiers over it
  const on = (c: string) => toHex(solid(c, surface))
  return {
    id: t.id,
    dark: t.dark,
    canvas: toHex(canvas),
    grid: k.grid === 'transparent' ? null : k.grid,
    surface: toHex(surface),
    titlebar: toHex(titlebar),
    ink: on(inks.ink),
    inkMuted: on(inks.inkMuted),
    inkSubtle: on(inks.inkSubtle),
    accent: toHex(accent),
    accentInk: toHex(solid(k.accentInk, accent)),
    border: toHex(solid(k.border, canvas)),
    shadow: toHex(solid(k.shadowInk, canvas)),
  }
}
