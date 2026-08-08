import type { Metadata } from 'next'
import Link from 'next/link'

import { ResumeDoc } from '@/components/resume/resume-doc'
import { education, profile, toolGroups } from '@/content'

import { SITE_URL } from '@/lib/site'

/*
 * The plain version.
 *
 * An infinite canvas is a bad place to put a recruiter, and a bad place to put a crawler. This
 * page is the opposite of the canvas on purpose: one column, top to bottom, no JavaScript
 * required, prints to paper cleanly. It is the SEO surface for the whole site.
 *
 * The document itself lives in `ResumeDoc`, because a phone gets the same thing on `/`. Only the
 * structured data and the navigation are particular to this route — the structured data
 * especially, which must appear once, here, where the canonical URL points.
 */

export const metadata: Metadata = {
  title: `${profile.name} — résumé`,
  description: profile.intro,
  alternates: { canonical: '/resume' },
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
    <main>
      <ResumeDoc
        top={
          <>
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
          </>
        }
      />
    </main>
  )
}
