import { ImageResponse } from 'next/og'

import { profile } from '@/content'

/*
 * The social card, generated from content so it can never drift from the site.
 *
 * Deliberately no webfont fetch: the previous build's OG card broke because the versioned
 * gstatic URL it fetched at build time 404'd. System fonts always resolve, and at this size
 * the difference is not worth a build that depends on Google being reachable.
 */

export const alt = `${profile.name} — ${profile.role.prefix} ${profile.role.emphasis}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#F7F5EE',
          color: '#161616',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 96,
            height: 96,
            borderRadius: 999,
            background: '#FACC00',
            border: '4px solid #161616',
            boxShadow: '8px 8px 0 0 #161616',
            fontSize: 40,
            fontWeight: 700,
            marginBottom: 44,
          }}
        >
          {profile.initials}
        </div>
        <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
          {profile.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 24, fontSize: 36 }}>
          <span style={{ color: 'rgba(22,22,22,0.62)' }}>{profile.role.prefix}</span>
          <span
            style={{
              background: '#FACC00',
              border: '3px solid #161616',
              borderRadius: 10,
              padding: '2px 16px',
              fontWeight: 500,
            }}
          >
            {profile.role.emphasis}
          </span>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 24,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(22,22,22,0.45)',
          }}
        >
          {profile.location}
        </div>
      </div>
    ),
    size,
  )
}
