import type { Metadata } from 'next'

import { SiteMotion } from '@/components/site/motion'
import {
  About,
  Bar,
  Closer,
  Credentials,
  Experience,
  Foot,
  Hero,
  Skills,
  Work,
} from '@/components/site/sections'
import { Cursor } from '@/components/desktop/cursor'
import { VisitPing } from '@/components/desktop/visit-ping'
import { profile } from '@/content'
import { validateContent } from '@/content/validate'
import { consoleHelloScript } from '@/lib/console-hello'
import { jsonLd, personLd } from '@/lib/seo/json-ld'
import { pageMeta } from '@/lib/seo/meta'
import { SITE_URL } from '@/lib/site'

import './site.css'

/*
 * The front page.
 *
 * Two flavours of one portfolio: this scrolling page, and the canvas at `/canvas`. Everyone
 * lands here — a pannable desktop with no scrollbar gives no affordance to someone expecting a
 * page, and the phone had been getting the plain résumé as a fallback rather than a designed
 * surface. The canvas is now a deliberate side alley, linked from the hero and the closer.
 *
 * Content is checked at module scope, exactly as it was on the canvas page this replaced: this
 * runs while `next build` prerenders, so bad content fails the build instead of shipping a blank
 * section, and in dev it re-runs on every recompile.
 */
validateContent()

/*
 * The name alone in the tab. The role belongs in the share card, where there is room for it; in a
 * tab strip it is truncated to noise long before the interesting half is reached.
 */
export const metadata: Metadata = pageMeta({
  path: '/',
  title: profile.name,
  shareTitle: `${profile.name} — ${profile.role.prefix} ${profile.role.emphasis}`,
  description: profile.intro,
  type: 'profile',
})

/* Who the site is about, for search engines: the owner, their role and where else they are. */
const person = personLd({
  name: profile.name,
  url: SITE_URL,
  jobTitle: `${profile.role.prefix} ${profile.role.emphasis}`,
  description: profile.intro,
  image: profile.portrait ? `${SITE_URL}${profile.portrait}` : undefined,
  location: profile.location,
  sameAs: profile.links.map((l) => l.href),
})

export default function Page() {
  return (
    /* id="top" is the mark's target in the bar; without it the anchor resolves to nothing */
    <main id="top">
      {/* a hello for whoever opens devtools; the copy is content/console.ts */}
      <script dangerouslySetInnerHTML={{ __html: consoleHelloScript }} />
      {/* jsonLd() escapes <, so no field can close the script */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(person) }} />
      {/* counts the visit, on first input — it moved here with the landing page */}
      <VisitPing />
      {/*
       * The same dot the canvas uses, from components/desktop/cursor.tsx. One pointer across
       * both flavours; app/site.css only adds the `cursor: none` hand-off, since desktop.css
       * already styles every state of it and is loaded globally.
       */}
      <Cursor />

      <SiteMotion>
        <Bar />
        <Hero />
        <About />
        <Skills />
        <Experience />
        <Work />
        <Credentials />
        <Closer />
        <Foot />
      </SiteMotion>
    </main>
  )
}
