'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import { DocBar, DocFoot } from '@/components/site/doc'
import { errors } from '@/content/errors'

import './site.css'
import './errors.css'

/*
 * A page that threw while rendering. Inside the root layout, so the theme, the font and the bar
 * are all still there; `global-error.tsx` covers the layout itself failing.
 *
 * "Try again" is `retry()`, which re-fetches and re-renders the segment: most failures here are a
 * request that timed out, and a second try works. The digest is shown because in production it is
 * the only thing that connects what the reader saw to the server's log; the message never is,
 * since Next replaces a server error's message with a generic one before it reaches the client.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const c = errors.error
  const home = { href: '/', label: c.home }
  const digest = error instanceof Error && 'digest' in error ? String((error as Error & { digest?: unknown }).digest ?? '') : ''

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main data-scroll-page className="site" data-error-page="500">
      <DocBar back={home} />

      <div className="doc errpage">
        <p className="doc__meta">{c.meta}</p>
        <h1>{c.title}</h1>
        <p className="doc__lede">{c.lede}</p>

        <div className="doc__links errpage__links">
          <button type="button" onClick={() => retry()}>
            {c.retry} <span aria-hidden>↻</span>
          </button>
          <Link href={home.href}>
            {home.label} <span aria-hidden>→</span>
          </Link>
        </div>

        {digest ? (
          <p className="errpage__ref">
            {c.ref} <code>{digest}</code>
          </p>
        ) : null}

        <DocFoot back={home} />
      </div>
    </main>
  )
}
