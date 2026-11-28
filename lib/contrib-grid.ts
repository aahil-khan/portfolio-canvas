/**
 * Where each square of the front page's contribution calendar sits, what it says, and what colour
 * it is.
 *
 * Pure geometry over the calendar `lib/github.ts` already builds for the canvas card (padded
 * weeks, ramp levels, month labels), so the two surfaces cannot disagree about the data. Kept out
 * of the component so a recorded GraphQL response can be checked by `node --test`.
 *
 * The look is GitHub's own profile calendar (design/DIRECTION.md, "The contributions calendar on
 * `/`"): 10px squares on a 13px step. Those are the SVG's units; CSS draws it 1:1 or larger.
 */
import type { Contributions } from './github.ts'

/** A square's side. */
export const CELL = 10
/** Square plus gap, from one square's left edge to the next. */
export const STEP = 13
/** The squares' corner radius. */
export const RADIUS = 2
/** Days in a week: the rows. */
export const ROWS = 7
/**
 * The fewest weeks a month label may have to itself. A 0.8125rem "Sep" is about 24px, under two
 * steps, so a month that starts closer than this to the next one (the partial first month,
 * usually) or to the calendar's right edge is left unlabelled rather than overprinted.
 */
export const LABEL_WEEKS = 2

export interface Cell {
  x: number
  y: number
  level: number
  date: string
  count: number
}

export interface CalendarLayout {
  /** Columns, one a week. */
  weeks: number
  width: number
  height: number
  /** One per real day, oldest first. Padding slots get none. */
  cells: Cell[]
  /** The labels that fit, each at its first week. */
  months: { label: string; week: number }[]
}

export function calendarLayout(data: Contributions): CalendarLayout {
  const weeks = data.weeks.length
  const cells: Cell[] = []
  data.weeks.forEach((week, wi) =>
    week.forEach((day, di) => {
      if (day) cells.push({ x: wi * STEP, y: di * STEP, level: day.level, date: day.date, count: day.count })
    }),
  )

  const months = data.months.filter((m, i) => {
    const next = data.months[i + 1]?.week ?? weeks
    return next - m.week >= LABEL_WEEKS
  })

  return {
    weeks,
    width: Math.max(0, weeks * STEP - (STEP - CELL)),
    height: ROWS * STEP - (STEP - CELL),
    cells,
    months,
  }
}

/**
 * The square under a point in the SVG's own units, or null in a gap or outside. How the hover
 * layer finds a square from one listener on the SVG, without a listener per square.
 */
export function cellAt(x: number, y: number, weeks: number): { week: number; day: number } | null {
  if (x < 0 || y < 0) return null
  const week = Math.floor(x / STEP)
  const day = Math.floor(y / STEP)
  if (week >= weeks || day >= ROWS) return null
  if (x - week * STEP >= CELL || y - day * STEP >= CELL) return null
  return { week, day }
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** 1 → 1st, 2 → 2nd, 11 → 11th, 23 → 23rd. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}

/** `2026-11-03` → `November 3rd`, as GitHub writes a day. No year: the calendar is one year. */
export function dayName(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${ordinal(d)}`
}

/** The three templates a day's sentence is chosen from (`content/contributions.ts`). */
export interface DayCopy {
  none: string
  one: string
  many: string
}

/** "5 contributions on November 3rd." — the tooltip and the square's `<title>`, one sentence. */
export function daySentence(count: number, date: string, copy: DayCopy): string {
  const template = count === 0 ? copy.none : count === 1 ? copy.one : copy.many
  return fill(template, { count: count.toLocaleString('en-GB'), date: dayName(date) })
}

/** GitHub's five greens, level 0 to 4 (DIRECTION, "The contributions calendar on `/`"). */
export const GREENS = {
  light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  dark: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
} as const

/** GitHub's tooltip ground; the text on it is white in both. */
export const TIP = { light: '#24292f', dark: '#3d444d' } as const

/** The squares' inner outline: the ink at this share, as GitHub draws it. */
export const LINE = { light: 6, dark: 10 } as const

function scale(mode: 'light' | 'dark'): string {
  return [
    ...GREENS[mode].map((c, i) => `--c${i}:${c}`),
    `--c-line:color-mix(in srgb, var(--ink) ${LINE[mode]}%, transparent)`,
    `--c-tip:${TIP[mode]}`,
  ].join(';')
}

/**
 * The calendar's colours for every site theme, picked by its `dark` flag. Light is the default on
 * `.contrib`; each dark theme is named once, so a theme added to `content/themes.ts` is covered
 * by the flag it is given there and nothing here changes.
 */
export function scaleCss(themes: readonly { id: string; dark: boolean }[]): string {
  const dark = themes.filter((t) => t.dark).map((t) => `[data-theme="${t.id}"] .site .contrib`)
  return `.site .contrib{${scale('light')}}` + (dark.length ? `${dark.join(',')}{${scale('dark')}}` : '')
}

/** `{key}` → value, for the content file's templates. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all))
}
