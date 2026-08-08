import { ImageResponse } from 'next/og'

import { profile, projects } from '@/content'

/*
 * A social card per project, generated from content so it can never drift from the page.
 *
 * Same rule as the site-wide card: no webfont fetch. The previous build's OG image broke
 * because the versioned gstatic URL it fetched at build time 404'd, and a build that depends
 * on Google being reachable is not worth the nicer letterforms.
 */

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }))
}

export const alt = 'Project'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = projects.find((p) => p.slug === slug)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#F7F5EE',
          color: '#161616',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(22,22,22,0.45)',
              marginBottom: 22,
            }}
          >
            {project ? `${project.year} · ${project.tag ?? project.kind}` : 'Work'}
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.02,
              marginBottom: 20,
            }}
          >
            {project?.name ?? 'Work'}
          </div>
          <div style={{ fontSize: 34, color: 'rgba(22,22,22,0.62)', lineHeight: 1.3 }}>
            {project?.tagline ?? ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 62,
              height: 62,
              borderRadius: 999,
              background: '#FACC00',
              border: '3px solid #161616',
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {profile.initials}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{profile.name}</div>
            <div style={{ fontSize: 22, color: 'rgba(22,22,22,0.45)' }}>
              {project ? project.stack.slice(0, 4).join(' · ') : profile.location}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
