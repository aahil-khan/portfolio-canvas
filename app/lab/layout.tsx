import localFont from 'next/font/local'
import type { ReactNode } from 'react'

import { VisitPing } from '@/components/desktop/visit-ping'
import { Bar } from '@/components/lab/bar'
import { Footer } from '@/components/lab/footer'
import { LookBoot } from '@/components/lab/look-boot'
import { MotionProvider } from '@/components/lab/motion/provider'
import { SmoothScroll } from '@/components/lab/motion/smooth-scroll'
import { SoftNav } from '@/components/lab/motion/soft-nav'
import { PreviewRoot } from '@/components/lab/preview'
import { Progress } from '@/components/lab/progress'
import { getLab } from '@/lib/lab/content'
import { labFallbackCss, labInkCss } from '@/lib/lab/ink'
import { labMetadata } from '@/lib/lab/seo'

import './lab.css'

/*
 * The Lab's other two families (DIRECTION, "The Lab → Type"): Space Mono for code and numbers,
 * Caveat for dates and annotations. Only Space Grotesk (the root layout's) is preloaded; these
 * two are `display: optional`, so they never hold up the first paint.
 */
const mono = localFont({
  src: './fonts/space-mono-400-latin.woff2',
  weight: '400',
  style: 'normal',
  variable: '--font-lab-mono',
  display: 'optional',
  preload: false,
  // no Arial-shaped stand-in: phones have no Arial; the Lab's CSS falls back to Space Grotesk or the system mono
  adjustFontFallback: false,
})
const hand = localFont({
  src: './fonts/caveat-500-latin.woff2',
  weight: '500',
  style: 'normal',
  variable: '--font-lab-hand',
  display: 'optional',
  preload: false,
  // no Arial-shaped stand-in: phones have no Arial; the Lab's CSS falls back to Space Grotesk or the system mono
  adjustFontFallback: false,
})

/*
 * The reading serif, one of Aa's three fonts (DIRECTION, "The Lab → Type"). Declared here but
 * never preloaded, and only the reading text under `html[data-aa-font="serif"]` names it, so a
 * browser fetches it once a reader chooses it, and never otherwise (the check holds that).
 */
// the const's name is the family name next/font gives it
const literata = localFont({
  src: [
    { path: './fonts/literata-latin-wght-normal.woff2', weight: '200 900', style: 'normal' },
    { path: './fonts/literata-latin-wght-italic.woff2', weight: '200 900', style: 'italic' },
  ],
  variable: '--font-lab-serif',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
})

export const metadata = labMetadata()

/**
 * Every Lab page: the theme and reader settings' boot script before anything paints (after the root
 * layout's theme boot script), the Lab's contrast CSS, the bar and its reading progress, the page, the footer, and the slots
 * (API.md §6). `<VisitPing/>` counts Lab visits through the site's one admission gate.
 */
export default function LabLayout({ children }: { children: ReactNode }) {
  const { copy } = getLab()
  return (
    <div className={`lab ${mono.variable} ${hand.variable} ${literata.variable}`} data-lab data-scroll-page>
      <LookBoot />
      {/* dark palettes' ink lifted for reading, and Lab Dark for a reader without JavaScript (lib/lab/ink.ts) */}
      <style dangerouslySetInnerHTML={{ __html: `${labInkCss()}\n${labFallbackCss()}` }} />
      <MotionProvider>
        <SmoothScroll />
        <SoftNav />
        <Bar copy={copy} />
        <Progress />
        <main className="lab-main" id="lab-main" data-lab-main tabIndex={-1}>
          {children}
        </main>
        <Footer copy={copy} />
        <PreviewRoot />
      </MotionProvider>
      <VisitPing />
    </div>
  )
}
