import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'

import { profile } from '@/content'
import { DEFAULT_THEME, themeCss } from '@/content/themes'
import { themeBootScript } from '@/lib/theme'
import { SITE_URL } from '@/lib/site'

import './globals.css'
import './desktop.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${profile.name} — ${profile.role.prefix} ${profile.role.emphasis}`,
  description: profile.intro,
  openGraph: {
    title: `${profile.name} — ${profile.role.prefix} ${profile.role.emphasis}`,
    description: profile.intro,
    type: 'profile',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME} className={spaceGrotesk.variable}>
      <head>
        {/* themes are data in content/themes.ts; this is the only place they become CSS */}
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        {/* runs before first paint, so a remembered theme never flashes the default first */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
