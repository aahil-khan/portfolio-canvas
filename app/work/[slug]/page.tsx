import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { profile, projects, toolsByName } from '@/content'
import { imageSize } from '@/lib/image-size'
import { SITE_URL } from '@/lib/site'

import '../../resume/resume.css'
import '../work.css'

/*
 * One project, as a plain page.
 *
 * The canvas is the site, but it is one URL: every project lived inside it, which meant a
 * project could not be linked to, could not carry its own social preview, and could not be
 * indexed separately. A recruiter asking "what's the safety thing you built" had to be sent to
 * the front door and told where to pan.
 *
 * So this is the same bargain `/resume` makes — one column, top to bottom, no JavaScript
 * required — applied per project. It borrows resume.css wholesale rather than growing a second
 * plain-document look, and links back into the canvas with `?card=`.
 */

export const dynamicParams = false

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }))
}

const find = (slug: string) => projects.find((p) => p.slug === slug)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const project = find(slug)
  if (!project) return {}

  const title = `${project.name} — ${project.tagline}`
  return {
    title,
    description: project.lede,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      type: 'article',
      title,
      description: project.lede,
      url: `${SITE_URL}/work/${project.slug}`,
    },
    twitter: { card: 'summary_large_image', title, description: project.lede },
  }
}

/** Renders `**bold**` / `*italic*` from content strings, same as the résumé does. */
function rich(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = find(slug)
  // dynamicParams is false, so this is only reachable in dev — but a 404 beats a crash
  if (!project) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.name,
    headline: project.tagline,
    description: project.lede,
    dateCreated: String(project.year),
    url: `${SITE_URL}/work/${project.slug}`,
    author: { '@type': 'Person', name: profile.name, url: SITE_URL },
    keywords: project.stack.join(', '),
    ...(project.award ? { award: project.award } : {}),
  }

  return (
    <main data-scroll-page className="resume work">
      {/* static, generated from content — no user input reaches this */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="resume__nav">
        <Link className="resume__back" href="/work">
          ← all work
        </Link>
      </nav>

      <header className="resume__head">
        {project.meta ? <p className="work__meta">{project.meta}</p> : null}
        <h1>{project.name}</h1>
        <p className="resume__role">{project.tagline}</p>
        {project.award ? <p className="entry__award">🏆 {project.award}</p> : null}
        <p className="resume__intro">{project.lede}</p>

        {/*
         * The whole point of these pages: a link that drops you into the canvas with this exact
         * card already open and centred, rather than at the front door.
         */}
        <p className="work__open">
          <Link href={`/?card=project:${project.slug}`}>Open it on the canvas →</Link>
        </p>
      </header>

      {project.images?.length ? (
        <div className="work__shots">
          {project.images.map((src) => {
            const size = imageSize(src)
            return (
              // eslint-disable-next-line @next/next/no-img-element -- static asset, sized at build
              <img
                key={src}
                src={src}
                alt={`${project.name} screenshot`}
                width={size?.width}
                height={size?.height}
                loading="lazy"
                decoding="async"
              />
            )
          })}
        </div>
      ) : null}

      <section className="entry">
        <h2>What it does</h2>
        <ul>
          {project.highlights.map((h, i) => (
            <li key={i}>{rich(h)}</li>
          ))}
        </ul>

        <p className="entry__stack">
          {project.stack.map((n) => toolsByName.get(n)?.name ?? n).join(' · ')}
        </p>

        {/* separated exactly as the résumé does it — one convention for both plain pages */}
        {project.links?.length ? (
          <p className="entry__links">
            {project.links.map((l, i) => (
              <span key={l.label}>
                {i ? <span aria-hidden> · </span> : null}
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              </span>
            ))}
          </p>
        ) : null}
      </section>

      <footer className="resume__foot work__foot">
        <p>
          <Link className="resume__back" href="/">
            ← the interactive version
          </Link>
        </p>
        <p>
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </p>
      </footer>
    </main>
  )
}
