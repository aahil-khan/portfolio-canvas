import type { ReactNode } from 'react'

import type { CardLink, PreviewData } from '@/lib/lab/preview/data'
import { domainOf, type Target } from '@/lib/lab/preview/target'
import { fill } from '@/lib/lab/view'

import { UnfurlCard } from './unfurl-card'

/**
 * A card's head and body for everything that is not a whole entry (decision 11: cards are 360px):
 * a glossary term, a tag, a reference, a link out. Its words come from `/lab/previews.json` and, for
 * a reference, from the References list in the same scope (the page, or the window the citation is
 * in). A link with nothing known about it (one of Aahil's own, added at `/edit` before an unfurl
 * exists) gets the quiet text card made of the link's own words and its domain, never an error.
 */

export interface CardContent {
  /** The title bar's words, and the dialog's name. */
  bar: ReactNode
  label: string
  body: ReactNode
}

/** A reference as its References line reads, found by id in the citation's own scope. */
export interface RefLine {
  n: string
  title: string
  site: string
  line: string
  url: string | null
  /** The References line's id, prefixed in a window: "See all references" jumps there. */
  id: string
}

export function readRef(scope: ParentNode, prefix: string, key: string, n: string): RefLine | null {
  const id = `${prefix}ref-${key}`
  const li = scope.querySelector<HTMLElement>(`li[id="${CSS.escape(id)}"]`)
  if (!li) return null
  const title = li.querySelector('.ref-title')
  const url = title instanceof HTMLAnchorElement ? title.href : null
  return {
    n,
    title: title?.textContent?.trim() ?? '',
    site: (li.querySelector('.meta')?.textContent ?? '').replace(/^\s*·\s*/, '').trim(),
    line: li.querySelector('.ref-line')?.textContent?.trim() ?? '',
    url,
    id,
  }
}

function More({ links }: { links: (CardLink | null | undefined | false)[] }) {
  const list = links.filter((l): l is CardLink => !!l)
  if (!list.length) return null
  return (
    <p className="lab-pv-more">
      {list.map((l) => (
        <a key={l.href + l.label} href={l.href} data-preview={l.preview}>
          {l.label}
        </a>
      ))}
    </p>
  )
}

export function cardContent({ target, trigger, data, ref, words }: { target: Target; trigger: HTMLAnchorElement; data: PreviewData | null; ref: RefLine | null; words: string }): CardContent {
  const c = data?.copy ?? {}
  if (target.kind === 'term') {
    const t = data?.terms[target.id]
    return {
      bar: <span>{c.cardTerm}</span>,
      label: t?.name ?? words,
      body: (
        <>
          <h3 className="lab-pv-title">{t?.code ? <code>{t.name}</code> : (t?.name ?? words)}</h3>
          {t ? <p className="lab-pv-text">{t.def}</p> : null}
          <More links={[t?.more, { href: trigger.href, label: c.cardGlossary }]} />
        </>
      ),
    }
  }
  if (target.kind === 'tag') {
    const g = data?.tags[target.id]
    return {
      bar: (
        <>
          <span>{c.cardTag}</span>
          {g ? <span className="lab-pv-bar-meta">{g.count}</span> : null}
        </>
      ),
      label: g?.title ?? words,
      body: (
        <>
          <h3 className="lab-pv-title">{g?.title ?? words}</h3>
          {g?.about ? <p className="lab-pv-text">{g.about}</p> : null}
          {g?.entries.length ? (
            <ul className="lab-pv-list">
              {g.entries.map((e) => (
                <li key={e.href}>
                  <a href={e.href} data-preview={e.preview}>
                    {e.title}
                  </a>
                  <span className="meta">{e.kind}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <More links={[{ href: g?.href ?? trigger.href, label: fill(c.cardTagged, { tag: g?.title ?? words }) }]} />
        </>
      ),
    }
  }
  if (target.kind === 'ref') {
    const u = ref?.url ? data?.unfurls[ref.url] : undefined
    return {
      bar: <span>{fill(c.cardRef, { n: ref?.n ?? words })}</span>,
      label: ref?.title ?? words,
      body: ref ? (
        <>
          {u ? (
            <UnfurlCard u={u} />
          ) : (
            <>
              <h3 className="lab-pv-title">{ref.title}</h3>
              <p className="lab-pv-site">{ref.site}</p>
            </>
          )}
          {ref.line ? <p className={`lab-pv-text${u ? ' lab-pv-why' : ''}`}>{ref.line}</p> : null}
          <More links={[ref.url ? { href: ref.url, label: c.cardSource, preview: `out:${ref.url}` } : null, { href: `#${ref.id}`, label: c.cardRefs }]} />
        </>
      ) : (
        <p className="lab-pv-text">{words}</p>
      ),
    }
  }
  // a link out
  const url = target.id
  const u = data?.unfurls[url]
  const domain = u?.domain ?? domainOf(url)
  return {
    bar: <span>{c.cardExt}</span>,
    label: u?.title ?? words,
    body: (
      <>
        {u ? (
          <UnfurlCard u={u} />
        ) : (
          <div className="lab-pv-unfurl" data-unfurl="none">
            <p className="lab-pv-uf-site" data-unfurl-site>
              <span>{domain}</span>
            </p>
            <h3 className="lab-pv-uf-title" data-unfurl-title>
              {words}
            </h3>
          </div>
        )}
        <More links={[{ href: url, label: fill(c.cardVisit, { site: domain }) }]} />
      </>
    ),
  }
}
