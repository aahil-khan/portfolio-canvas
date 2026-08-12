import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { apps, externalApps } from '@/content/apps'
import { projects } from '@/content'
import { getOpens, getVisitors, storeIsLive } from '@/lib/store'

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

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const expected = process.env.STATS_TOKEN
  const { t } = await searchParams
  // no token configured means no way in, rather than a page that is open by default
  if (!expected || t !== expected) notFound()

  const [visitors, opens] = await Promise.all([getVisitors(), getOpens()])
  const peak = Math.max(1, ...opens.cards.map((c) => c.n))

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
