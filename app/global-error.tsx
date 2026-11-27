'use client'

import { errors } from '@/content/errors'

/*
 * The last resort: the root layout itself threw, so this replaces it, `<html>` and all. None of
 * the layout's work is here: no theme CSS, no font, no boot scripts, no bar. It is deliberately
 * the smallest page that still looks like the site, in the default `cream` theme, with the values
 * from design/DIRECTION.md written out, because the theme tokens are what failed to load.
 *
 * No imports beyond its copy: this file is part of every page's client bundle, so anything it
 * pulled in, every page would pay for.
 */

const CSS = `
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem;
    background: #F7F5EE; color: #161616; font: 400 1.0625rem/1.6 system-ui, sans-serif; }
  main { max-width: 34rem; }
  h1 { font-size: clamp(2rem, 7vw, 3.25rem); line-height: 1.05; letter-spacing: -0.03em; margin: 0; }
  p { color: rgba(22,22,22,0.62); margin: 1rem 0 0; }
  .row { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.75rem; }
  button, a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 1rem; font: inherit;
    font-weight: 500; color: #161616; text-decoration: none; border: 2px solid #161616; border-radius: 8px;
    background: #FFFFFF; box-shadow: 4px 4px 0 0 #161616; cursor: pointer; }
  button { background: #FACC00; }
  :focus-visible { outline: 3px solid #FACC00; outline-offset: 3px; }
`

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const c = errors.global
  return (
    <html lang="en">
      <head>
        <title>{c.tabTitle}</title>
        <meta name="robots" content="noindex" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <main data-error-page="global">
          <h1>{c.title}</h1>
          <p>{c.lede}</p>
          <div className="row">
            <button type="button" onClick={() => retry()}>
              {c.retry}
            </button>
            {/* a full load, not a client navigation: the app that would do one is what broke */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see the line above */}
            <a href="/">{c.home}</a>
          </div>
        </main>
      </body>
    </html>
  )
}
