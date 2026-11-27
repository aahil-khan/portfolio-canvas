/**
 * Where each square of the front page's contribution calendar sits.
 *
 * Pure geometry over the calendar `lib/github.ts` already builds for the canvas card (padded
 * weeks, ramp levels, month labels), so the two surfaces cannot disagree about the data. Kept out
 * of the component so a recorded GraphQL response can be checked by `node --test`.
 *
 * Units are the SVG's own. CSS sizes the SVG, so a phone draws the same grid smaller.
 */
import type { Contributions } from './github.ts'

/** A square's side. */
export const CELL = 15
/** Square plus gap, from one square's left edge to the next. */
export const STEP = 18
/** The squares' corner radius. */
export const RADIUS = 3
/** Days in a week: the rows. */
export const ROWS = 7
/**
 * The fewest weeks a month label may have to itself. A label is about three squares wide, so a
 * month that starts closer than this to the next one (the partial first month, usually) or to the
 * calendar's right edge is left unlabelled rather than overprinted.
 */
export const LABEL_WEEKS = 3

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

/** `{key}` → value, for the content file's templates. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all))
}
