/**
 * The study board's logic (components/lab/instruments/board.tsx), apart from the DOM so the test
 * can hold it: the rows by track, the topic the board opens on, a square's fill, and where an
 * arrow key goes on a board whose rows are not all the same length.
 *
 * Plain TypeScript with type imports only, so Node runs it with `--experimental-strip-types`.
 */
import type { StudyData, Topic } from '../types.ts'

export interface BoardRow {
  track: string
  topics: Topic[]
}

/** One row per track, in the study's track order; a topic on a track the list misses gets a row at the end. */
export function boardRows(study: StudyData): BoardRow[] {
  const tracks = [...study.tracks, ...study.topics.map((t) => t.track).filter((t, i, all) => !study.tracks.includes(t) && all.indexOf(t) === i)]
  return tracks
    .map((track) => ({ track, topics: study.topics.filter((t) => t.track === track) }))
    .filter((r) => r.topics.length)
}

/** The board opens on the first topic under way; failing that, the newest done; failing that, the first. */
export function defaultTopic(study: StudyData): string {
  const doing = study.topics.find((t) => t.status === 'doing')
  if (doing) return doing.id
  const done = study.topics.filter((t) => t.status === 'done' && t.finished).sort((a, b) => (a.finished! < b.finished! ? 1 : -1))[0]
  return (done ?? study.topics[0])?.id ?? ''
}

/** How full a square is, 0–100: done is full, under way is hours over the estimate (never full), the rest empty. */
export function topicFill(t: Pick<Topic, 'status' | 'spent' | 'est'>): number {
  if (t.status === 'done') return 100
  if (t.status !== 'doing' || !t.est) return 0
  return Math.max(4, Math.min(96, Math.round((t.spent / t.est) * 100)))
}

/**
 * Where a key moves the board's active square, or `null` for a key the board does not take.
 * Left and Right step through the board in reading order (across a row's end to the next row);
 * Up and Down keep the column, clamped to a shorter row's last square; Home and End go to the
 * row's ends, and with Ctrl (or Cmd) to the board's.
 */
export function boardMove(rows: BoardRow[], active: string, key: string, ctrl = false): string | null {
  const flat = rows.flatMap((r) => r.topics)
  if (!flat.length) return null
  const r = Math.max(0, rows.findIndex((x) => x.topics.some((t) => t.id === active)))
  const c = Math.max(0, rows[r].topics.findIndex((t) => t.id === active))
  const i = flat.findIndex((t) => t.id === active)
  const row = (k: number) => rows[Math.max(0, Math.min(rows.length - 1, k))]
  switch (key) {
    case 'ArrowRight':
      return flat[Math.min(flat.length - 1, i + 1)].id
    case 'ArrowLeft':
      return flat[Math.max(0, i - 1)].id
    case 'ArrowDown': {
      const t = row(r + 1).topics
      return t[Math.min(c, t.length - 1)].id
    }
    case 'ArrowUp': {
      const t = row(r - 1).topics
      return t[Math.min(c, t.length - 1)].id
    }
    case 'Home':
      return ctrl ? flat[0].id : rows[r].topics[0].id
    case 'End':
      return ctrl ? flat[flat.length - 1].id : rows[r].topics[rows[r].topics.length - 1].id
    default:
      return null
  }
}
