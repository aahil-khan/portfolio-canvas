import type { Metadata } from 'next'
import Link from 'next/link'

import { profile, projects } from '@/content'
import { SITE_URL } from '@/lib/site'

import '../resume/resume.css'
import './work.css'

/*
 * The index for the per-project pages.
 *
 * Mostly here so the project pages are reachable by a crawler from somewhere other than the
 * sitemap, and so `/work/konta` has a parent to go back up to. A person who wants to browse the
 * work should be on the canvas; this is the flat mirror of it.
 */

export const metadata: Metadata = {
  title: `Work — ${profile.name}`,
  description: `Selected projects by ${profile.name}.`,
  alternates: { canonical: '/work' },
}

export default function WorkIndex() {
  const sorted = [...projects].sort((a, b) => b.year - a.year)

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
    <main data-scroll-page className="resume work">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="resume__nav">
        <Link className="resume__back" href="/">
          ← the interactive version
        </Link>
      </nav>

      <header className="resume__head">
        <h1>Work</h1>
        <p className="resume__intro">
          {projects.length} projects. Each one also lives on the canvas — the links below open the
          flat version, which reads and prints anywhere.
        </p>
      </header>

      <ul className="work__index">
        {sorted.map((p) => (
          <li key={p.slug}>
            <Link href={`/work/${p.slug}`}>
              <span className="work__index-yr">{p.year}</span>
              <span>
                <span className="work__index-name">{p.name}</span>
                <span className="work__index-sub">{p.tagline}</span>
              </span>
              <span className="work__index-tag">{p.tag ?? p.kind}</span>
            </Link>
          </li>
        ))}
      </ul>

      <footer className="resume__foot work__foot">
        <p>
          <Link className="resume__back" href="/resume">
            the résumé →
          </Link>
        </p>
        <p>
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </p>
      </footer>
    </main>
  )
}
