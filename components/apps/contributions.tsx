import { contributions } from '@/content/contributions'
import type { Contributions } from '@/lib/github'

/**
 * The GitHub contribution calendar.
 *
 * Deliberately NOT a client component. The data is fetched on the server in `buildCards()`, so
 * this renders to plain HTML — which keeps it out of the client bundle, gives it a height that
 * is already correct when MeasureRig measures it, and satisfies the "every window is real,
 * server-rendered DOM" rule in DIRECTION.md.
 */

const WEEK_COLS = 53

export function ContributionGraph({ data }: { data: Contributions | null }) {
  if (!data) {
    return (
      <div className="gh__empty">
        {contributions.empty}
        <small>{contributions.emptyHint}</small>
      </div>
    )
  }

  const [head, tail] = contributions.lede.split('{total}')

  return (
    <>
      <p className="lede">
        {head}
        <strong>{data.total.toLocaleString()}</strong>
        {tail}
      </p>

      <div className="gh">
        <div className="gh__months" style={{ gridTemplateColumns: `repeat(${WEEK_COLS}, 9px)` }}>
          {data.months.map((m) => (
            // grid columns are 1-indexed
            <span key={`${m.label}-${m.week}`} style={{ gridColumnStart: m.week + 1 }}>
              {m.label}
            </span>
          ))}
        </div>

        <div className="gh__grid">
          {data.weeks.map((week, wi) =>
            week.map((day, di) =>
              day ? (
                <i
                  key={day.date}
                  className="gh__d"
                  data-l={day.level || undefined}
                  title={`${day.count} on ${day.date}`}
                />
              ) : (
                <i key={`pad-${wi}-${di}`} className="gh__d gh__d--pad" />
              ),
            ),
          )}
        </div>

        <div className="gh__foot">
          <span>{contributions.login}</span>
          <span className="gh__key">
            {contributions.less}
            <i className="gh__d" />
            <i className="gh__d" data-l={1} />
            <i className="gh__d" data-l={2} />
            <i className="gh__d" data-l={3} />
            <i className="gh__d" data-l={4} />
            {contributions.more}
          </span>
        </div>
      </div>
    </>
  )
}
