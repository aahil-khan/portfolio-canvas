import type { ReactNode } from 'react'

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

import '@/app/resume/resume.css'

/*
 * The résumé, as a component rather than a page.
 *
 * Two surfaces render it: `/resume`, which is the SEO and print surface, and the phone, where it
 * is what arrives first — a canvas you cannot pan is a bad landing page, and this is the same
 * facts in the shape a phone is actually good at.
 *
 * It stays a server component with no JavaScript of its own, which is the whole point of it:
 * DIRECTION.md requires `/resume` to render completely with JS disabled, and sharing the markup
 * is the only way the two surfaces can't drift.
 *
 * `top` is a slot above the header, because that is the one part the two differ on: `/resume`
 * puts its navigation and structured data there, the phone puts the offer to switch.
 *
 * The root is a plain `div`, not `<main>`: each surface supplies its own landmark, and `/` already
 * has one wrapping the shell — nesting a second `<main>` inside it is invalid.
 */

/** Renders `**bold**` / `*italic*` from content strings. */
export function rich(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

export function ResumeDoc({ top }: { top?: ReactNode }) {
  return (
    <div data-scroll-page className="resume">
      {top}

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
        {profile.notes?.map((n, i) => (
          <p className="resume__intro" key={i}>
            {n}
          </p>
        ))}
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
              {p.links?.length ? (
                <p className="entry__links">
                  {p.links.map((l, i) => (
                    <span key={l.label}>
                      {i ? <span aria-hidden> · </span> : null}
                      <a href={l.href} target="_blank" rel="noopener noreferrer">
                        {l.label}
                      </a>
                    </span>
                  ))}
                </p>
              ) : null}
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
    </div>
  )
}
