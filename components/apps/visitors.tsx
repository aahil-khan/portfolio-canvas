'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { useMeasuring } from '@/components/desktop/measuring-context'
import { visitors as copy } from '@/content/visitors'
import { parseVisits, visitsSnapshot } from '@/lib/visits'

/**
 * Who else has been here.
 *
 * Two things shape this card. Its height is measured exactly once, from the skeleton, before any
 * data exists — so every part of it is a fixed shape: the chart is always `DAYS` bars whatever
 * the numbers, and the countries row scrolls sideways instead of wrapping to a second line. A
 * card that grew when the fetch landed would leave every layout downstream (collision
 * avoidance, fit-all, tidy) working from a stale box.
 *
 * And the numbers are deliberately shallow. The server counts distinct people into a
 * HyperLogLog and can't answer anything finer than "how many" — so the personal line at the
 * bottom is counted in localStorage instead, and says so.
 */

/** Kept in step with `VISITOR_DAYS` in lib/store.ts, which is server-only and can't be imported. */
const DAYS = 14

interface Stats {
  unique: number
  views: number
  online: number
  daily: number[]
  days: string[]
  countries: { code: string; n: number }[]
  countryCount: number
  since: number | null
  live: boolean
}

const ORDINAL = new Intl.PluralRules('en', { type: 'ordinal' })

function nth(n: number): string {
  const rules = copy.ordinals as Record<string, string>
  return `${n}${rules[ORDINAL.select(n)] ?? rules.other}`
}

/**
 * `IN` → `India`, via the browser's own region table rather than a shipped list of 250 names.
 * Undefined until first use, then either the formatter or null if the engine lacks it.
 */
let regions: Intl.DisplayNames | null | undefined
function countryName(code: string): string {
  if (regions === undefined) {
    try {
      regions = new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      regions = null
    }
  }
  try {
    return regions?.of(code) ?? code
  } catch {
    // `of` throws on anything that isn't a well-formed region code
    return code
  }
}

/** Day-granularity relative time for the "you" line, which never needs to say "3 minutes ago". */
function agoLabel(at: number): string {
  const days = Math.floor((Date.now() - at) / 86_400_000)
  if (days <= 0) return copy.ago.today
  if (days === 1) return copy.ago.yesterday
  if (days < 14) return copy.ago.days.replace('{n}', String(days))
  if (days < 60) return copy.ago.weeks.replace('{n}', String(Math.round(days / 7)))
  return copy.ago.months.replace('{n}', String(Math.round(days / 30)))
}

function Empty() {
  return (
    <div className="vis__empty">
      {copy.empty}
      <small>{copy.emptyHint}</small>
    </div>
  )
}

/** The chart, sized against its own tallest day so a quiet fortnight still reads as a shape. */
function Chart({ daily, days }: { daily: number[]; days: string[] }) {
  const peak = Math.max(1, ...daily)
  return (
    <div className="vis__chart">
      <div className="vis__bars">
        {daily.map((n, i) => (
          <i
            key={days[i] ?? i}
            className={`vis__bar${n === 0 ? ' vis__bar--zero' : ''}${
              i === daily.length - 1 ? ' vis__bar--today' : ''
            }`}
            style={{ height: n === 0 ? undefined : `${Math.max(4, (n / peak) * 100)}%` }}
            title={days[i] ? `${n} on ${days[i]}` : undefined}
          />
        ))}
      </div>
      <div className="vis__axis">
        <span>{copy.chartStart.replace('{n}', String(daily.length))}</span>
        <span>{copy.chartEnd}</span>
      </div>
    </div>
  )
}

export function Visitors({ configured }: { configured: boolean }) {
  const measuring = useMeasuring()
  const [stats, setStats] = useState<Stats | null>(null)

  /*
   * Read through useSyncExternalStore rather than copied into state in an effect, which would
   * cascade a render on every mount. `<VisitPing/>` is the only thing that ever writes this key
   * and it does so once, before this card can be opened, so the subscribe is a no-op.
   */
  const raw = useSyncExternalStore(
    () => () => {},
    visitsSnapshot,
    () => null,
  )
  const own = useMemo(() => parseVisits(raw), [raw])

  /*
   * Skipped while measuring, or every page load would issue this request twice — once from the
   * hidden rig, for a card nobody opened.
   */
  useEffect(() => {
    if (measuring || !configured) return
    let alive = true
    fetch('/api/visitors')
      .then((r) => r.json())
      .then((d: Stats) => alive && setStats(d))
      .catch(() => {
        /* leave the skeleton up rather than claiming zero visitors */
      })
    return () => {
      alive = false
    }
  }, [measuring, configured])

  if (!configured || stats?.live === false) {
    return (
      <div className="vis">
        <Empty />
      </div>
    )
  }

  const loading = !stats
  const daily = stats?.daily ?? Array<number>(DAYS).fill(0)
  const days = stats?.days ?? []
  const today = daily[daily.length - 1] ?? 0
  const unique = stats?.unique ?? 0
  const views = stats?.views ?? 0

  /*
   * Split rather than replaced, so the count itself carries the emphasis — the same treatment
   * the contributions card gives its yearly total.
   */
  const [ledeHead, ledeTail] = copy.lede.split('{n}')
  const lede =
    loading || unique === 0 || unique === 1 ? null : (
      <>
        {ledeHead}
        <strong>{unique.toLocaleString()}</strong>
        {ledeTail}
      </>
    )
  const ledeText = loading
    ? copy.loading
    : unique === 0
      ? copy.ledeNone
      : unique === 1
        ? copy.ledeOne
        : null

  const online = stats?.online ?? 0
  const onlineLabel =
    online <= 1 ? copy.onlineOne : copy.online.replace('{n}', online.toLocaleString())

  const youLine =
    own && own.n > 1
      ? copy.you.replace('{nth}', nth(own.n)).replace('{ago}', agoLabel(own.first))
      : copy.youFirst

  const countries = stats?.countries ?? []
  const hidden = Math.max(0, (stats?.countryCount ?? 0) - countries.length)

  return (
    <>
      <div className="vis">
        <div className="vis__head">
          <p className="lede">{lede ?? ledeText}</p>
          {/*
           * Rendered even while loading, just hidden. The pill is taller than the line of lede
           * beside it, so it — not the text — sets this row's height; dropping it from the
           * skeleton made the card grow by 3px the moment the fetch landed.
           */}
          <span className={`vis__live${loading ? ' vis__ghost' : ''}`} aria-hidden={loading}>
            <span className="vis__dot" />
            {loading ? '—' : onlineLabel}
          </span>
        </div>

        <Chart daily={daily} days={days} />

        {/*
         * Scrolls sideways rather than wrapping. Country names are wildly different lengths, so a
         * wrapping row is one or two lines depending on who happened to visit — and this card's
         * height was measured before any of them had.
         */}
        <div className="vis__geo">
          {countries.length === 0 ? (
            /*
             * Holds the row open at exactly one chip's height while the fetch is in flight, and
             * on a host that sends no geo header at all. A hidden real chip rather than a pixel
             * value on the row: the height then follows the chip's own metrics instead of a
             * constant that goes stale the first time the type scale moves.
             */
            <span className="chip vis__ghost" aria-hidden>
              &nbsp;
            </span>
          ) : (
            countries.map((c) => (
              <span className="chip" key={c.code}>
                {countryName(c.code)}
                <i>{c.n.toLocaleString()}</i>
              </span>
            ))
          )}
          {hidden > 0 ? (
            <span className="chip">{copy.moreCountries.replace('{n}', String(hidden))}</span>
          ) : null}
        </div>
      </div>

      <div className="stats">
        <span className="stat">
          <b>{loading ? '—' : today.toLocaleString()}</b>
          <span>{copy.stats.today}</span>
        </span>
        <span className="stat">
          <b>{loading ? '—' : views.toLocaleString()}</b>
          <span>{copy.stats.views}</span>
        </span>
        <span className="stat">
          <b>{loading || unique === 0 ? '—' : (views / unique).toFixed(1)}</b>
          <span>{copy.stats.perVisitor}</span>
        </span>
        <span className="stat">
          <b>{loading ? '—' : (stats?.countryCount ?? 0).toLocaleString()}</b>
          <span>{copy.stats.countries}</span>
        </span>
      </div>

      <p className="vis__you">{youLine}</p>
    </>
  )
}
