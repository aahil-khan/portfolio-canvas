import type { CSSProperties } from 'react'

import { ContribHover } from '@/components/site/contrib-hover'
import { contributions } from '@/content/contributions'
import { themes } from '@/content/themes'
import { calendarLayout, CELL, daySentence, fill, RADIUS, scaleCss } from '@/lib/contrib-grid'
import { fetchContributions } from '@/lib/github'

/*
 * The GitHub contribution calendar, at the end of Work on the front page.
 *
 * An async server component: the calendar is one SVG drawn on the server, so it is complete with
 * JavaScript off, and each square's `<title>` gives it the same sentence the styled tooltip shows.
 * The data is the canvas card's (`lib/github.ts`), fetched once an hour; without a token, or when
 * GitHub is slow, it is null and the block is left out entirely, so `/` still renders and nothing
 * on the page apologises.
 *
 * The look is GitHub's profile calendar: its greens, picked by the theme's `dark` flag, its
 * squares (scaled to fill the block, never under 10px) and its labels (design/DIRECTION.md). On a narrow screen the strip scrolls sideways and
 * opens on the newest weeks, with no script (see `.contrib__scroll` in site.css). The only client
 * code is the hover layer, `contrib-hover.tsx`.
 */

const LEVELS = [0, 1, 2, 3, 4] as const
/** Half the outline: each square is drawn inset by it, so its 1px line sits inside the 10px. */
const HALF = 0.5

export async function Contributions() {
  const data = await fetchContributions(contributions.login)
  if (!data) return null

  const grid = calendarLayout(data)
  const total = data.total.toLocaleString('en-GB')
  const home = contributions.home

  return (
    <div className="contrib reveal" data-contrib style={{ '--weeks': grid.weeks } as CSSProperties}>
      {/* React hoists this into <head> once; it holds the greens for each theme's light or dark */}
      <style href="contrib-scale" precedence="default">
        {scaleCss(themes)}
      </style>

      <h3 className="contrib__title">{fill(home.title, { total })}</h3>

      <ContribHover weeks={grid.weeks}>
        <div className="contrib__cal">
          <div className="contrib__days" aria-hidden>
            {home.weekdays.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          {/*
           * A keyboard stop, because on a phone this strip scrolls and a region that scrolls must
           * be reachable without a pointer. It announces the summary: one stop, not one a day.
           */}
          <div className="contrib__scroll" tabIndex={0} role="group" aria-label={fill(home.label, { total })}>
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
                width={grid.width}
                height={grid.height}
                viewBox={`0 0 ${grid.width} ${grid.height}`}
                aria-hidden
              >
                {grid.cells.map((c) => (
                  <rect
                    key={c.date}
                    x={c.x + HALF}
                    y={c.y + HALF}
                    width={CELL - 2 * HALF}
                    height={CELL - 2 * HALF}
                    rx={RADIUS - HALF}
                    data-l={c.level}
                  >
                    <title>{daySentence(c.count, c.date, home.day)}</title>
                  </rect>
                ))}
              </svg>
            </div>
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
      </ContribHover>
    </div>
  )
}
