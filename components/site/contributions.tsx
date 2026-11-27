import type { CSSProperties } from 'react'

import { contributions } from '@/content/contributions'
import { calendarLayout, CELL, fill, RADIUS } from '@/lib/contrib-grid'
import { fetchContributions } from '@/lib/github'

/*
 * The GitHub contribution calendar, at the end of Work on the front page.
 *
 * An async server component, and nothing else: the calendar is one SVG drawn on the server, so it
 * is complete with JavaScript off and adds nothing to the page's client bundle. The data is the
 * canvas card's (`lib/github.ts`), fetched once an hour; without a token it is null and the block
 * is left out entirely, so `/` still prerenders and nothing on the page apologises.
 *
 * The squares are an ink ramp, not a colour: `/` has no card colour, and a yellow ramp would spend
 * the page's accent budget on one calendar. On a narrow screen the strip scrolls sideways inside
 * its frame and opens on the newest weeks, with no script (see `.contrib__scroll` in site.css).
 */

const LEVELS = [0, 1, 2, 3, 4] as const

export async function Contributions() {
  const data = await fetchContributions(contributions.login)
  if (!data) return null

  const grid = calendarLayout(data)
  const total = data.total.toLocaleString('en-GB')
  const [head, tail] = contributions.lede.split('{total}')
  const home = contributions.home

  return (
    <div className="contrib reveal" data-contrib style={{ '--weeks': grid.weeks } as CSSProperties}>
      <div className="contrib__head">
        <h3>{home.title}</h3>
        <p>
          {head}
          <strong>{total}</strong>
          {tail}
        </p>
      </div>

      {/*
       * A keyboard stop, because on a phone this strip scrolls and a region that scrolls must be
       * reachable without a pointer. The months and the squares share it, so they scroll together.
       */}
      <div className="contrib__scroll" tabIndex={0} role="group" aria-label={home.scroll}>
        <div className="contrib__in">
          <div className="contrib__months" aria-hidden>
            {grid.months.map((m) => (
              // grid columns are 1-indexed
              <span key={`${m.label}-${m.week}`} style={{ gridColumnStart: m.week + 1 }}>
                {m.label}
              </span>
            ))}
          </div>

          <svg
            className="contrib__svg"
            viewBox={`0 0 ${grid.width} ${grid.height}`}
            role="img"
            aria-label={fill(home.label, { total })}
          >
            {grid.cells.map((c) => (
              <rect key={c.date} x={c.x} y={c.y} width={CELL} height={CELL} rx={RADIUS} data-l={c.level}>
                <title>{fill(home.day, { count: c.count, date: c.date })}</title>
              </rect>
            ))}
          </svg>
        </div>
      </div>

      <div className="contrib__foot">
        <a href={`https://github.com/${contributions.login}`}>{contributions.login}</a>
        {/* a key, not data: the ramp means nothing to a screen reader, and the total says it */}
        <span className="contrib__key" aria-hidden>
          {contributions.less}
          {LEVELS.map((l) => (
            <i key={l} data-l={l} />
          ))}
          {contributions.more}
        </span>
      </div>
    </div>
  )
}
