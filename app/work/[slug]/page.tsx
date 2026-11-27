import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { DocBar, DocFoot } from '@/components/site/doc'
import { Shots } from '@/components/site/shots'
import { rich } from '@/lib/rich'
import { profile, projects, site } from '@/content'
import { jsonLd, projectLd } from '@/lib/seo/json-ld'
import { pageMeta } from '@/lib/seo/meta'
import { SITE_URL } from '@/lib/site'

import '../../site.css'

/*
 * One project, as its own page.
 *
 * The canvas is one URL, so a project inside it could not be linked to, could not carry its own
 * social preview, and could not be indexed. This is the flat, linkable version — no JavaScript
 * required to read it.
 *
 * It used to borrow `resume.css`, which made it look like the plain résumé rather than part of
 * the site, and it carried an "Open it on the canvas →" link built on `/?card=<slug>`. That
 * deep link died when the canvas moved to `/canvas` — `/` is the front page now, so it dropped
 * people onto a scrolling page with a query string nothing reads. Removed rather than repointed:
 * the canvas is reachable from the front page, and a project page's job is to explain the
 * project.
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

  return pageMeta({
    path: `/work/${project.slug}`,
    title: `${project.name} — ${project.tagline}`,
    description: project.lede,
    type: 'article',
    // its own card, from opengraph-image.tsx and twitter-image.tsx beside this file
    ownImage: true,
  })
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = find(slug)
  // dynamicParams is false, so this is only reachable in dev — but a 404 beats a crash
  if (!project) notFound()

  const back = { href: '/work', label: site.workPage.allWork }

  const work = projectLd({
    name: project.name,
    tagline: project.tagline,
    lede: project.lede,
    year: project.year,
    stack: project.stack,
    award: project.award,
    url: `${SITE_URL}/work/${project.slug}`,
    images: project.images?.map((src) => `${SITE_URL}${src}`),
    author: { name: profile.name, origin: SITE_URL },
  })

  return (
    <main data-scroll-page className="site">
      {/*
        * Generated from content, which is edited at /edit: jsonLd() escapes <, so a field holding
        * </script> cannot end the script early.
        */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(work) }} />

      <DocBar back={back} />

      <article className="doc">
        <p className="doc__meta">
          {project.year} · {project.kind}
        </p>
        <h1>{project.name}</h1>
        <p className="doc__tag">{project.tagline}</p>
        {project.award ? <p className="case__award">🏆 {project.award}</p> : null}
        <p className="doc__lede">{project.lede}</p>

        {project.images?.length ? (
          <Shots images={project.images} alt={`${project.name} screenshot`} />
        ) : null}

        <div className="doc__body">
          <section>
            <h2>{site.workPage.whatItDoes}</h2>
            <ul className="doc__points">
              {project.highlights.map((h, i) => (
                <li key={i}>{rich(h)}</li>
              ))}
            </ul>
          </section>

          <aside className="doc__side">
            <h2>{site.workPage.builtWith}</h2>
            <div className="s-chips">
              {project.stack.map((n) => (
                <span className="s-chip" key={n}>
                  {n}
                </span>
              ))}
            </div>

            {project.links?.length ? (
              <div className="doc__links">
                {project.links.map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
                    {l.label} <span aria-hidden>↗</span>
                  </a>
                ))}
              </div>
            ) : null}
          </aside>
        </div>

        <DocFoot back={{ href: '/work', label: site.workPage.backToWork }} />
      </article>
    </main>
  )
}
