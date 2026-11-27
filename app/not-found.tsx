import type { Metadata } from 'next'
import Link from 'next/link'

import { DocBar, DocFoot } from '@/components/site/doc'
import { profile } from '@/content'
import { errors } from '@/content/errors'

import './site.css'
import './errors.css'

/*
 * The 404, for any URL nothing serves and for every `notFound()`.
 *
 * Built on the sub-pages' layout (`components/site/doc.tsx`), an approved surface, so it reads as
 * part of the site rather than Next's default. It is a server component: complete with JavaScript
 * off, like `/`. Next answers it with a 404 status and adds `noindex` itself, and it carries no
 * canonical, because there is no page for one to name.
 *
 * The links are the places that do exist, from `content/errors.ts`. Never `/lab` while the Lab is
 * hidden: nothing links into it (check-lab rule I).
 */

export const metadata: Metadata = {
  title: `${errors.notFound.tabTitle} — ${profile.name}`,
}

export default function NotFound() {
  const c = errors.notFound
  const home = c.links[0]

  return (
    <main data-scroll-page className="site" data-error-page="404">
      <DocBar back={home} />

      <div className="doc errpage">
        <p className="doc__meta">{c.meta}</p>
        <h1>{c.title}</h1>
        <p className="doc__lede">{c.lede}</p>

        <nav className="doc__links errpage__links" aria-label={c.meta}>
          {c.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label} <span aria-hidden>→</span>
            </Link>
          ))}
        </nav>

        <DocFoot back={home} />
      </div>
    </main>
  )
}
