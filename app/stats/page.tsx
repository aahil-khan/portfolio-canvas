import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { apps, externalApps } from '@/content/apps'
import { projects } from '@/content'
import { EVENT_NAMES } from '@/lib/events'
import {
  getEvents,
  getOpens,
  getOpensVsVisits,
  getPingDiag,
  getVisitors,
  storeIsLive,
  type PingDiag,
} from '@/lib/store'

import '../resume/resume.css'
import '../work/work.css'
import './stats.css'

/*
 * The private half of the analytics.
 *
 * The Visitors card says how many people came. This says what they did once they got here, which
 * is the half that changes what belongs on the site — a project nobody opens is worth knowing
 * about and not worth publishing.
 *
 * Gated by a token in the query string, compared against STATS_TOKEN. That is a deliberately
 * modest lock: it keeps the page out of a crawler and out of a shoulder-surf, and it is not
 * protecting anything worse than open counts. With no STATS_TOKEN configured the page 404s
 * rather than defaulting open, so forgetting to set it fails closed.
 */

export const dynamic = 'force-dynamic'

/* Never indexed, never in the sitemap, and told so explicitly as well. */
export const metadata: Metadata = {
  title: 'Stats',
  robots: { index: false, follow: false, nocache: true },
}

const LABELS = new Map([...apps, ...externalApps].map((a) => [a.id, a.label]))
const PROJECT_NAMES = new Map(projects.map((p) => [p.slug, p.name]))

/** `project:konta` → `Konta · project`, so the table reads without decoding ids. */
function labelFor(id: string): { name: string; kind: string } {
  const dock = LABELS.get(id)
  if (dock) return { name: dock, kind: 'card' }
  const [kind, slug] = id.split(':')
  if (!slug) return { name: id, kind: 'card' }
  return { name: PROJECT_NAMES.get(slug) ?? slug, kind }
}

function Bar({ n, peak }: { n: number; peak: number }) {
  return (
    <span className="stats__bar" aria-hidden>
      <span style={{ width: `${Math.max(2, (n / peak) * 100)}%` }} />
    </span>
  )
}

/** `lab_view.source` → `Lab views · source`, so a breakdown's heading reads without the key. */
function propTitle(key: string): string {
  const [name, prop] = key.split('.')
  return `${name.replace(/_/g, ' ')} · ${prop}`
}

/** `2026-11-28` → `28 Nov`, in UTC like the keys themselves. */
function shortDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** One of the gate's bucket tables: label, bar, count. */
function Counts({ title, rows }: { title: string; rows: PingDiag[keyof PingDiag] }) {
  const peak = Math.max(1, ...rows.map((r) => r.n))
  return (
    <div>
      <h3>{title}</h3>
      {rows.length ? (
        <table className="stats__table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <td className="stats__name">{r.k}</td>
                <td className="stats__viz">
                  <Bar n={r.n} peak={peak} />
                </td>
                <td className="stats__n">{r.n.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="stats__none">Nothing yet.</p>
      )}
    </div>
  )
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const expected = process.env.STATS_TOKEN
  const { t } = await searchParams
  // no token configured means no way in, rather than a page that is open by default
  if (!expected || t !== expected) notFound()

  const [visitors, opens, gate, tally, events] = await Promise.all([
    getVisitors(),
    getOpens(),
    getPingDiag(),
    getOpensVsVisits(),
    getEvents(EVENT_NAMES),
  ])
  const peak = Math.max(1, ...opens.cards.map((c) => c.n))
  const since = tally.gateSince
    ? new Date(tally.gateSince).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : null
  // newest first: the question is "how is it going", and today answers it
  const days = [...tally.days].reverse()
  const gated = tally.days.filter((d) => d.visits !== null)
  const gatedVisits = gated.reduce((t, d) => t + (d.visits ?? 0), 0)
  const gatedOpens = gated.reduce((t, d) => t + d.opens, 0)
  const eventPeak = Math.max(1, ...events.names.map((e) => e.days))
  const openPeak = Math.max(1, ...events.open.map((r) => r.n))

  return (
    <main data-scroll-page className="resume work stats">
      <nav className="resume__nav">
        {/* `/` is the front page now; the canvas moved to its own route */}
        <Link className="resume__back" href="/canvas">
          ← the canvas
        </Link>
      </nav>

      <header className="resume__head">
        <h1>Stats</h1>
        <p className="resume__intro">
          {storeIsLive
            ? 'Private. Not indexed, not linked from anywhere, and not in the sitemap.'
            : 'No shared store is configured, so these are all zero.'}
        </p>
      </header>

      <ul className="resume__stats">
        <li>
          <b>{visitors.unique.toLocaleString()}</b>
          <span>unique</span>
        </li>
        <li>
          <b>{visitors.views.toLocaleString()}</b>
          <span>views</span>
        </li>
        <li>
          <b>{visitors.online.toLocaleString()}</b>
          <span>here now</span>
        </li>
        <li>
          <b>{visitors.countryCount.toLocaleString()}</b>
          <span>countries</span>
        </li>
        <li>
          <b>{opens.total.toLocaleString()}</b>
          <span>card opens</span>
        </li>
      </ul>

      <section className="entry">
        <h2>What people open</h2>
        {opens.cards.length ? (
          <table className="stats__table">
            <tbody>
              {opens.cards.map((c) => {
                const { name, kind } = labelFor(c.id)
                return (
                  <tr key={c.id}>
                    <td className="stats__name">
                      {name}
                      {kind === 'card' ? null : <em> {kind}</em>}
                    </td>
                    <td className="stats__viz">
                      <Bar n={c.n} peak={peak} />
                    </td>
                    <td className="stats__n">{c.n.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="stats__none">Nothing opened yet.</p>
        )}
      </section>

      <section className="entry">
        <h2>Opens against admitted visits</h2>
        <p className="stats__note">
          Card opens and visits wait for the same gate now, so per day they count the same
          people. {since ? `The gate has counted since ${since}. ` : ''}The all-time opens above
          include the ones from before it, when every open counted, bots included. A visit is a
          page load that passed the gate, on <code>/</code> or <code>/canvas</code>; before the
          gate, only <code>/</code> counted visits. Days with no visit count predate the per-day
          counter.
        </p>
        {gated.length ? (
          <p className="stats__note">
            <b>{gatedVisits ? (gatedOpens / gatedVisits).toFixed(2) : '0'}</b> opens per admitted
            visit over the last {gated.length} {gated.length === 1 ? 'day' : 'days'} (
            {gatedOpens.toLocaleString()} {gatedOpens === 1 ? 'open' : 'opens'},{' '}
            {gatedVisits.toLocaleString()} {gatedVisits === 1 ? 'visit' : 'visits'}).
          </p>
        ) : null}
        <table className="stats__table stats__table--cols">
          <thead>
            <tr>
              <th>Day</th>
              <th>Visits</th>
              <th>Visitors</th>
              <th>Opens</th>
              <th>Per visit</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <td className="stats__name">{shortDay(d.day)}</td>
                <td className="stats__n">{d.visits === null ? '—' : d.visits.toLocaleString()}</td>
                <td className="stats__n">{d.visitors.toLocaleString()}</td>
                <td className="stats__n">{d.opens.toLocaleString()}</td>
                <td className="stats__n">{d.visits ? (d.opens / d.visits).toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="entry">
        <h2>Where they came from</h2>
        {opens.referrers.length ? (
          <table className="stats__table">
            <tbody>
              {opens.referrers.map((r) => (
                <tr key={r.host}>
                  <td className="stats__name">{r.host}</td>
                  <td className="stats__viz" />
                  <td className="stats__n">{r.n.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="stats__none">
            No referrers yet. Direct traffic and same-origin links are not counted.
          </p>
        )}
      </section>

      <section className="entry">
        <h2>The gate</h2>
        <p className="stats__note">
          What the visit ping turned away, and what the counted visits looked like, since the
          ping started reporting it. A visit counts after trusted input from a browser that does
          not say it is automated, and only if it is still open eight seconds after loading.
        </p>
        <div className="stats__grid">
          <Counts title="Turned away" rows={gate.rejected} />
          <Counts title="First input" rows={gate.via} />
          <Counts title="Time to first input" rows={gate.input} />
          <Counts title="Had focus" rows={gate.focus} />
          <Counts title="Viewport width" rows={gate.width} />
        </div>
      </section>

      <section className="entry" data-stats-events>
        <h2>Events</h2>
        <p className="stats__note">
          What readers do on the Lab, sent through the same gate as everything above: nothing
          leaves a tab before it is admitted. Counters only, from a fixed list of names and
          buckets. No cookies, no identifiers.
        </p>
        <table className="stats__table stats__table--cols">
          <thead>
            <tr>
              <th>Event</th>
              <th className="stats__viz" aria-hidden />
              <th>Today</th>
              <th>14 days</th>
              <th>All time</th>
            </tr>
          </thead>
          <tbody>
            {events.names.map((e) => (
              <tr key={e.name}>
                <td className="stats__name">
                  <code>{e.name}</code>
                </td>
                <td className="stats__viz">{e.days ? <Bar n={e.days} peak={eventPeak} /> : null}</td>
                <td className="stats__n">{e.today.toLocaleString()}</td>
                <td className="stats__n">{e.days.toLocaleString()}</td>
                <td className="stats__n">{e.all.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {events.props.length ? (
          <div className="stats__grid stats__grid--after">
            {events.props.map((p) => (
              <Counts key={p.key} title={propTitle(p.key)} rows={p.rows} />
            ))}
          </div>
        ) : null}

        <h3 className="stats__sub">Pages, last 14 days</h3>
        {events.open.length ? (
          <table className="stats__table">
            <tbody>
              {events.open.slice(0, 30).map((r) => {
                const [name, value] = r.k.split('|')
                return (
                  <tr key={r.k}>
                    <td className="stats__name">
                      {value}
                      <em> {name.replace(/_/g, ' ')}</em>
                    </td>
                    <td className="stats__viz">
                      <Bar n={r.n} peak={openPeak} />
                    </td>
                    <td className="stats__n">{r.n.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="stats__none">No events yet.</p>
        )}

        <div className="stats__grid stats__grid--after">
          <Counts title="Turned away, by reason" rows={events.rejected} />
        </div>
      </section>

      <section className="entry">
        <h2>Countries</h2>
        {visitors.countries.length ? (
          <table className="stats__table">
            <tbody>
              {visitors.countries.map((c) => (
                <tr key={c.code}>
                  <td className="stats__name">{c.code}</td>
                  <td className="stats__viz" />
                  <td className="stats__n">{c.n.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="stats__none">
            No geo data. The country header only exists on Vercel, so this stays empty locally.
          </p>
        )}
      </section>
    </main>
  )
}
