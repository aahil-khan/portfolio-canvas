import { fill, formatDay } from '@/lib/lab/view'

/** "written 26 Nov · updated 27 Nov · 4 min read": the date in Caveat, on one line (rule D). */
export function Meta({ published, updated, minutes, today, copy }: { published: string; updated?: string; minutes: number; today: string; copy: Record<string, string> }) {
  return (
    <p className="lab-entry-meta meta">
      <span>{copy.written}</span>
      <time dateTime={published}>{formatDay(published, today)}</time>
      {updated && updated !== published ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{copy.updated}</span>
          <time dateTime={updated}>{formatDay(updated, today)}</time>
        </>
      ) : null}
      <span aria-hidden="true">·</span>
      <span>{fill(copy.readTime, { n: minutes })}</span>
    </p>
  )
}
