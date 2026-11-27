import type { MetadataRoute } from 'next'

import { profile } from '@/content'
import { DEFAULT_THEME, themes } from '@/content/themes'

/*
 * `/manifest.webmanifest`. What a phone shows when the site is added to a home screen.
 *
 * Its colours are the default theme's canvas, read from `content/themes.ts` rather than written
 * here, so the splash screen matches the page it opens onto. The icons are `app/icon.svg`
 * rasterised: 192 and 512 are the two sizes an install needs; the SVG covers every other size.
 * `app/apple-icon.png` (180, square, opaque, because iOS rounds it itself) is linked by Next from
 * the file's name, not from here.
 */
export default function manifest(): MetadataRoute.Manifest {
  const base = themes.find((t) => t.id === DEFAULT_THEME)!.tokens.canvas
  return {
    name: profile.name,
    short_name: profile.name,
    description: profile.intro,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: base,
    theme_color: base,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
