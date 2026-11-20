import type { Metadata } from 'next'
import localFont from 'next/font/local'

import { profile } from '@/content'
import { DEFAULT_THEME, themeCss } from '@/content/themes'
import { themeBootScript } from '@/lib/theme'
import { mobileBootScript } from '@/lib/use-mobile'
import { SITE_URL } from '@/lib/site'

import './globals.css'
import './desktop.css'

/*
 * Self-hosted, never a CDN (design/DIRECTION.md). The file is Google Fonts' latin subset of the
 * variable font, byte for byte what next/font/google used to download. It is registered once
 * per weight, as before, so a weight in between (600) still resolves to 700 instead of the
 * variable axis rendering a new one.
 */
const spaceGrotesk = localFont({
  src: [
    { path: './fonts/space-grotesk-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/space-grotesk-latin.woff2', weight: '500', style: 'normal' },
    { path: './fonts/space-grotesk-latin.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // viewport-fit lets the dock sit above the home indicator via env(safe-area-inset-bottom)
  viewportFit: 'cover' as const,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Tab title is the name alone. The role belongs in the OG card below, where there is room for
  // it; in a tab strip it is truncated to noise long before the interesting half is reached.
  title: profile.name,
  description: profile.intro,
  openGraph: {
    title: `${profile.name} — ${profile.role.prefix} ${profile.role.emphasis}`,
    description: profile.intro,
    type: 'profile',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * suppressHydrationWarning covers this element's own attributes, nothing deeper. Both boot
     * scripts below deliberately write to <html> before React hydrates — the theme one so a
     * remembered theme never flashes the default, the mobile one so a phone never flashes the
     * canvas. React then finds attributes the server never sent and reports a mismatch it
     * cannot patch up. The writes are the point, so the warning is what has to go.
     */
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      className={spaceGrotesk.variable}
      suppressHydrationWarning
    >
      <head>
        {/* themes are data in content/themes.ts; this is the only place they become CSS */}
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        {/* runs before first paint, so a remembered theme never flashes the default first */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: mobileBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
