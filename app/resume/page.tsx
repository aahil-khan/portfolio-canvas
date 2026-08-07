import type { Metadata } from 'next'
import Link from 'next/link'

import {
  awards,
  education,
  headlineStats,
  jobs,
  posts,
  profile,
  projects,
  toolGroups,
} from '@/content'

import { SITE_URL } from '@/lib/site'

import './resume.css'

/*
 * The plain version.
 *
 * An infinite canvas is a bad place to put a recruiter, and a bad place to put a crawler. This
 * page is the opposite of the canvas on purpose: one column, top to bottom, no JavaScript
 * required, prints to paper cleanly. It is the SEO surface for the whole site.
 */

export const metadata: Metadata = {
  title: `${profile.name} — résumé`,
  description: profile.intro,
  alternates: { canonical: '/resume' },
}

/** Renders `**bold**` / `*italic*` from content strings. */
function rich(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

export default function ResumePage() {
  /* Machine-readable identity, so search engines get the facts rather than inferring them. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    email: `mailto:${profile.email}`,
    jobTitle: `${profile.role.prefix} ${profile.role.emphasis}`.replace(/&\s*/, ''),
    description: profile.intro,
    address: { '@type': 'PostalAddress', addressLocality: profile.location },
    url: SITE_URL,
    sameAs: profile.links.filter((l) => l.href.startsWith('http')).map((l) => l.href),
    alumniOf: education.map((e) => ({ '@type': 'EducationalOrganization', name: e.institution })),
    knowsAbout: toolGroups.flatMap((g) => g.tools.map((t) => t.name)),
  }

  return (
    <main data-scroll-page className="resume">
      {/* static, locally generated from content — no user input reaches this */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="resume__nav">
        <Link className="resume__back" href="/">
          ← the interactive version
        </Link>
        {profile.resumePdf ? (
          <a className="resume__back" href={profile.resumePdf} download>
            download PDF ↓
          </a>
        ) : null}
      </nav>

      <header className="resume__head">
        <h1>{profile.name}</h1>
        <p className="resume__role">
          {profile.role.prefix} {profile.role.emphasis}
        </p>
        <p className="resume__contact">
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
          <span aria-hidden> · </span>
          {profile.location}
          {profile.links
            .filter((l) => l.href.startsWith('http'))
            .map((l) => (
              <span key={l.label}>
                <span aria-hidden> · </span>
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              </span>
            ))}
        </p>
        <p className="resume__intro">{profile.intro}</p>
        <ul className="resume__stats">
          {headlineStats.map((s) => (
            <li key={s.label}>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      </header>

      <section aria-labelledby="experience">
        <h2 id="experience">Experience</h2>
        {jobs.map((j) => (
          <article key={j.slug} className="entry">
            <div className="entry__head">
              <h3>
                {j.role} <span className="entry__at">— {j.company}</span>
              </h3>
              <span className="entry__period">{j.period}</span>
            </div>
            <p className="entry__lede">{rich(j.lede)}</p>
            <ul>
              {j.highlights.map((h, i) => (
                <li key={i}>{rich(h)}</li>
              ))}
            </ul>
            <p className="entry__stack">{j.stack.join(' · ')}</p>
          </article>
        ))}
      </section>

      <section aria-labelledby="projects">
        <h2 id="projects">Selected projects</h2>
        {[...projects]
          .sort((a, b) => b.year - a.year)
          .map((p) => (
            <article key={p.slug} className="entry">
              <div className="entry__head">
                <h3>
                  {p.name} <span className="entry__at">— {p.tagline}</span>
                </h3>
                <span className="entry__period">
                  {p.year} · {p.kind}
                </span>
              </div>
              {p.award ? <p className="entry__award">🏆 {p.award}</p> : null}
              <ul>
                {p.highlights.map((h, i) => (
                  <li key={i}>{rich(h)}</li>
                ))}
              </ul>
              <p className="entry__stack">{p.stack.join(' · ')}</p>
            </article>
          ))}
      </section>

      <section aria-labelledby="education">
        <h2 id="education">Education</h2>
        {education.map((e) => (
          <article key={e.institution} className="entry entry--tight">
            <div className="entry__head">
              <h3>
                {e.degree} <span className="entry__at">— {e.institution}</span>
              </h3>
              <span className="entry__period">{e.detail}</span>
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="skills">
        <h2 id="skills">Skills</h2>
        <dl className="resume__skills">
          {toolGroups.map((g) => (
            <div key={g.label}>
              <dt>{g.label}</dt>
              <dd>{g.tools.map((t) => t.name).join(' · ')}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="awards">
        <h2 id="awards">Awards</h2>
        <ul className="resume__list">
          {awards.map((a) => (
            <li key={a.event}>
              <strong>{a.title}</strong> — {a.event}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="writing">
        <h2 id="writing">Writing</h2>
        <ul className="resume__list">
          {[...posts]
            .sort((a, b) => b.year - a.year)
            .map((p) => (
              <li key={p.slug}>
                <a href={p.href} target="_blank" rel="noopener noreferrer">
                  {p.title}
                </a>{' '}
                — {p.blurb} <span className="entry__period">{p.year}</span>
              </li>
            ))}
        </ul>
      </section>

      <footer className="resume__foot">
        <p>
          {profile.name} · {profile.location} ·{' '}
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </p>
      </footer>
    </main>
  )
}
