import type { Metadata } from 'next'
import Link from 'next/link'

import { DocBar, DocFoot } from '@/components/site/doc'
import { profile, projects, site } from '@/content'
import { SITE_URL } from '@/lib/site'

import '../site.css'

/*
 * The index for the per-project pages.
 *
 * Here so the project pages are reachable by a crawler from somewhere other than the sitemap,
 * and so `/work/konta` has a parent to go up to.
 *
 * Its back link used to read "← the interactive version" and point at `/`. That was accurate
 * when `/` was the canvas; once the canvas moved to `/canvas` the label promised the desk and
 * delivered the front page. Both this page and the project pages now name their destination.
 */

export const metadata: Metadata = {
  title: `${site.workPage.indexTitle} — ${profile.name}`,
  description: site.workPage.indexLede,
  alternates: { canonical: '/work' },
}

export default function WorkIndex() {
  const sorted = [...projects].sort((a, b) => b.year - a.year)
  const back = { href: '/#work', label: site.nav.work }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: sorted.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/work/${p.slug}`,
      name: p.name,
    })),
  }

  return (
    <main data-scroll-page className="site">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <DocBar back={back} />

      <div className="doc">
        <p className="doc__meta">
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
        </p>
        <h1>{site.workPage.indexTitle}</h1>
        <p className="doc__lede">{site.workPage.indexLede}</p>

        <div className="doc__list">
          {sorted.map((p, i) => (
            <Link className="doc__row" href={`/work/${p.slug}`} key={p.slug}>
              <span className="doc__rowno">
                {String(i + 1).padStart(2, '0')} / {p.year}
              </span>
              <span>
                <h2>{p.name}</h2>
                <p>{p.tagline}</p>
              </span>
              <span className="doc__rowgo" aria-hidden>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </Link>
          ))}
        </div>

        <DocFoot back={{ href: '/', label: site.workPage.home }} />
      </div>
    </main>
  )
}
