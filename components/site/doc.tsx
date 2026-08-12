import Link from 'next/link'

import { Cursor } from '@/components/desktop/cursor'
import { profile, site } from '@/content'

import { ThemeToggle } from './theme-toggle'

/**
 * Chrome for the sub-pages under `/work`.
 *
 * They used to borrow `resume.css` wholesale, which made them look like the plain résumé rather
 * than like the site — and their back link said "← the interactive version" while pointing at
 * `/`. That was true when `/` was the canvas; after the move it sent people to the front page
 * under a label promising the desk. Every link here is explicit about where it actually goes.
 *
 * The bar is a trimmed version of the front page's: no section anchors, because there are no
 * sections to anchor to, and the back link is a real element rather than the `nav` the front
 * page hides below 820px — on a sub-page, "back" is the one control that must never disappear.
 */
export function DocBar({ back }: { back: { href: string; label: string } }) {
  return (
    <>
      {/*
       * The dot has to be rendered wherever `.site` is, not just on `/`. app/site.css hides the
       * native cursor for everything inside `.site`, so a page carrying that class without the
       * dot has no visible pointer at all — which is exactly what these pages shipped with.
       */}
      <Cursor />

      <header className="bar" data-site-bar>
      <Link className="mark" href="/" aria-label={site.workPage.home}>
        {profile.initials}
      </Link>

      <Link className="bar__back" href={back.href}>
        <span aria-hidden>←</span>
        {/* wrapped so the narrow-screen rule can drop the words and keep the arrow */}
        <span className="bar__backlabel">{back.label}</span>
      </Link>

      <ThemeToggle />

      {profile.resumePdf ? (
        <a className="bar__cta" href={profile.resumePdf} download>
          <span>{site.resume.short}</span>
          <span className="long">{site.resume.long}</span>
        </a>
      ) : null}
      </header>
    </>
  )
}

/** Foot of a sub-page. Deliberately the same three destinations as the front page's closer. */
export function DocFoot({ back }: { back: { href: string; label: string } }) {
  return (
    <footer className="doc__foot">
      <Link className="doc__footlink" href={back.href}>
        <span aria-hidden>←</span> {back.label}
      </Link>
      <a href={`mailto:${profile.email}`}>{profile.email}</a>
    </footer>
  )
}
