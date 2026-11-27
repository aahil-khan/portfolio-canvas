import { allThemes, labThemes, type Theme } from '@/content/themes'

/**
 * The Lab's reading contrast on dark grounds (DIRECTION, "The Lab → Contrast"). A dark theme's own
 * ink tiers are tuned for the canvas's windows, where 4.5:1 is the bar. A page of reading needs
 * more, so inside `.lab` every dark palette is lifted, by one rule, to:
 *
 *   body        `--ink`          ≥ 10:1 on the page ground (`--canvas-base`)
 *   secondary   `--ink-muted`    ≥ 7:1 on every ground text sits on (meta, captions, the rail, references)
 *   labels      `--ink-subtle`   ≥ 5.5:1 likewise (the smallest labels)
 *   highlights  `--mark`         lightened until `--accent-ink` on it reads at the body's 10:1
 *
 * Each tier keeps its theme's colour when it already passes. Otherwise ink is mixed toward white,
 * and the two lower tiers toward the lifted ink (then white), by the smallest step that passes. Light themes
 * are left alone. Only the Lab renders this CSS, so the canvas and `/` don't change.
 *
 * `labFallbackCss` is the Lab's default for a reader without JavaScript: the boot script never runs,
 * so <html> keeps the server's `data-theme` and has no `data-look`. That absence means Lab Dark.
 */

export const DARK_FLOOR = { body: 10, secondary: 7, label: 5.5, rule: 3 } as const
/** Aimed a little above each floor, so rounding and anti-aliasing never land a reading under it. */
const AIM = { body: 10.3, secondary: 7.3, label: 5.8 } as const

type RGB = [number, number, number]

const hex = (s: string): RGB => {
  const m = s.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) throw new Error(`lib/lab/ink.ts: not a #rrggbb colour: ${s}`)
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}
/** `#rrggbb`, `rgba(r,g,b,a)` composited over `ground`, or `color-mix(in srgb, #a N%, #b)`. */
export function solid(s: string, ground: RGB): RGB {
  const cm = s.match(/^color-mix\(in srgb, (#[0-9a-f]{6}) (\d+(?:\.\d+)?)%, (#[0-9a-f]{6})\)$/i)
  if (cm) return mix(hex(cm[3]), hex(cm[1]), Number(cm[2]) / 100)
  const m = s.match(/^rgba?\(([^)]+)\)$/)
  if (!m) return hex(s)
  const [r, g, b, a = 1] = m[1].split(',').map(Number)
  return [r * a + ground[0] * (1 - a), g * a + ground[1] * (1 - a), b * a + ground[2] * (1 - a)]
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const toHex = (c: RGB) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()

const lum = (c: RGB) => {
  const f = (v: number) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
export function contrast(a: RGB, b: RGB): number {
  const x = lum(a)
  const y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Every ground Lab text sits on: the page, a box, a menu, and a title bar (the accent tinted in), in that order. */
export function grounds(t: Theme): RGB[] {
  const k = t.tokens
  const canvas = hex(k.canvas)
  const surface = hex(k.surface)
  const raised = hex(k.raised)
  const accent = hex(k.accent)
  const titlebar = t.labOnly ? mix(raised, accent, 0.09) : mix(surface, accent, 0.12)
  return [canvas, surface, raised, titlebar]
}

const WHITE: RGB = [255, 255, 255]

/**
 * The smallest step along `from` → `via` → white that passes `ok`. Each lower tier heads for the
 * lifted ink first, so it keeps the theme's hue, and past it only when even ink falls short.
 */
function lift(from: RGB, via: RGB, ok: (c: RGB) => boolean): RGB {
  for (const [a, b] of [[from, via], [via, WHITE]] as const)
    for (let i = 0; i <= 100; i++) {
      const c = mix(a, b, i / 100)
      if (ok(c)) return c
    }
  return WHITE
}

export interface Inks {
  ink: string
  inkMuted: string
  inkSubtle: string
  /** `<mark>`: a highlight on body text, so `--accent-ink` on it reads at the body's 10:1. */
  mark: string
}

/** A dark theme's three ink tiers as the Lab draws them. */
export function labInks(t: Theme): Inks {
  const k = t.tokens
  const all = grounds(t)
  const canvas = all[0]
  const clears = (aim: number, on: RGB[]) => (c: RGB) => on.every((g) => contrast(c, g) >= aim)
  // Body text sits on the page. Ink is also every box's, menu's and title bar's text, so it clears
  // secondary on all four; only ink is ever set on a title bar, so the lower tiers skip it.
  const ink = lift(hex(k.ink), WHITE, (c) => contrast(c, canvas) >= AIM.body && clears(AIM.secondary, all)(c))
  const text = all.slice(0, 3)
  const muted = lift(solid(k.inkMuted, canvas), ink, clears(AIM.secondary, text))
  const subtle = lift(solid(k.inkSubtle, canvas), ink, clears(AIM.label, text))
  const accentInk = hex(k.accentInk)
  const markFrom = solid(k.mark, canvas)
  const mark = lift(markFrom, markFrom, (c) => contrast(accentInk, c) >= AIM.body)
  return { ink: toHex(ink), inkMuted: toHex(muted), inkSubtle: toHex(subtle), mark: toHex(mark) }
}

const vars = (i: Inks) => `--ink:${i.ink};--ink-muted:${i.inkMuted};--ink-subtle:${i.inkSubtle};--mark:${i.mark}`

/** The lifted tiers for every dark palette, scoped to the Lab. */
export function labInkCss(): string {
  return allThemes
    .filter((t) => t.dark)
    .map((t) => `html[data-theme="${t.id}"] .lab{${vars(labInks(t))}}`)
    .join('\n')
}

/** Lab Dark's tokens for a page whose boot script never ran (JavaScript off). */
export function labFallbackCss(): string {
  const t = labThemes.find((x) => x.id === 'lab-dark')
  if (!t) throw new Error('lib/lab/ink.ts: no lab-dark palette')
  const k = t.tokens
  const tokens = [
    `--canvas-base:${k.canvas}`,
    `--canvas-grid:${k.grid}`,
    `--surface:${k.surface}`,
    `--ink:${k.ink}`,
    `--ink-muted:${k.inkMuted}`,
    `--ink-subtle:${k.inkSubtle}`,
    `--accent:${k.accent}`,
    `--accent-ink:${k.accentInk}`,
    `--border:${k.border}`,
    `--trail:${k.trail}`,
    `--raised:${k.raised}`,
    `--shadow-ink:${k.shadowInk}`,
    `--hair:${k.hair}`,
    `--mark:${k.mark}`,
  ].join(';')
  return `html:not([data-look]):has(.lab){${tokens}}\nhtml:not([data-look]) .lab{${vars(labInks(t))}}`
}
