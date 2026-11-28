import Link from 'next/link'

import { rowKind } from '@/components/lab/lists/row'
import { Lead } from '@/components/lab/instruments'
import { children, getLab, pathOf } from '@/lib/lab/content'
import { renderBody } from '@/lib/lab/markdown/pipeline'
import type { Entry, Section } from '@/lib/lab/types'
import { plainInline } from '@/lib/lab/text'
import { fill, formatDay, resolveLead } from '@/lib/lab/view'

const isOut = (e: Entry) => !e.draft && e.published !== null

/** Inline Markdown (a key line, an opening) rendered the way bodies are, for a lead that shows one. */
async function inline(md: string, e: Entry) {
  const lab = getLab()
  const byId = new Map(lab.entries.map((x) => [x.id, x]))
  return renderBody(md, {
    entryHref: (id) => {
      const x = byId.get(id)
      return x && isOut(x) ? pathOf(x) : null
    },
    termHref: (id) => (lab.terms.some((x) => x.id === id) ? `/lab/glossary#t-${id}` : null),
    tagHref: (id) => (lab.tags.some((x) => x.id === id) ? `/lab/tags/${id}` : null),
    refs: e.refs ?? {},
  })
}

/** The date a card or hero carries: when it was written, as every list on the page dates it. */
const dayOf = (e: Entry) => e.published ?? ''

/**
 * A section page's hero, from data (README, "Section pages are evergreen too"): the section's own
 * pick (`section.hero`), led by its lead exactly as its page leads with it, through the
 * instruments slot (API.md §6), so PR 11's instruments arrive here with no change.
 */
export async function Hero({ section, entry: e, today }: { section: Section; entry: Entry; today: string }) {
  const lab = getLab()
  const { copy } = lab
  const kids = children(e.id)
  const name = resolveLead(e, { studies: lab.studies, chapters: e.kind === 'series' ? kids.length : 0 })
  const keyLine = 'keyLine' in e && e.keyLine ? await inline(e.keyLine, e) : undefined
  const opening = e.kind === 'essay' ? await inline(e.opening, e) : undefined
  const day = dayOf(e)
  return (
    <section className="lab-hero" data-hero="pick" aria-label={fill(copy.listsHeroLabel, { section: section.title })}>
      <div className="lab-hero-head">
        <h2 className="lab-hero-title">
          <Link href={pathOf(e)} data-preview={`entry:${e.id}`} data-hero-entry={e.id}>
            {e.title}
          </Link>
        </h2>
        <p className="lab-hero-meta meta">
          <span>{rowKind(e, { holds: true })}</span>
          {day ? <time dateTime={day}>{formatDay(day, today)}</time> : null}
        </p>
      </div>
      {e.lede ? <p className="lab-hero-lede">{plainInline(e.lede)}</p> : null}
      {name ? (
        <div className="lab-hero-lead">
          <Lead
            entry={e}
            name={name}
            copy={copy}
            figures={lab.figures}
            study={lab.studies[e.id]}
            chapters={e.kind === 'series' ? kids.map((x) => ({ order: x.kind === 'chapter' ? x.order : 0, title: x.title, out: isOut(x) })) : undefined}
            rendered={{ keyLine, opening }}
          />
        </div>
      ) : null}
    </section>
  )
}

/** The picture a card can show: a demo's still, a build's first screen, an essay's cover. */
function pictureOf(e: Entry) {
  const lead = e.lead ?? {}
  if (lead.demo) return { src: lead.demo.poster, w: lead.demo.w, h: lead.demo.h, alt: lead.demo.alt }
  if (lead.images?.length) return lead.images[0]
  if (lead.cover) return lead.cover
  return null
}

/**
 * With no pick of its own, a section page leads with its three newest top-level entries as a strip
 * of cards, each the window frame of the theme: its picture where it has one, else its own first
 * line set large, then the kind, the date and the title. The whole card is the title's link.
 */
export function Strip({ section, entries, today }: { section: Section; entries: Entry[]; today: string }) {
  const { copy } = getLab()
  return (
    <section className="lab-strip" data-hero="strip" aria-label={fill(copy.listsStripLabel, { section: section.title })}>
      <ul className="lab-strip-list" data-count={entries.length}>
        {entries.map((e) => {
          const pic = pictureOf(e)
          const words = plainInline(e.lede ?? ('opening' in e ? e.opening : '') ?? '')
          const day = dayOf(e)
          return (
            <li key={e.id}>
              <article className="lab-card box" data-box data-hero-entry={e.id}>
                <div className="lab-card-media" data-picture={pic ? '' : undefined}>
                  {pic ? (
                    // eslint-disable-next-line @next/next/no-img-element -- sizes are declared; next/image would add a loader for three stills
                    <img src={pic.src} width={pic.w} height={pic.h} alt={pic.alt} decoding="async" />
                  ) : (
                    <p className="lab-card-words">{words}</p>
                  )}
                </div>
                <div className="lab-card-body">
                  <p className="lab-card-meta meta">
                    <span>{rowKind(e)}</span>
                    {day ? <time dateTime={day}>{formatDay(day, today)}</time> : null}
                  </p>
                  <h3 className="lab-card-title">
                    <Link className="lab-card-link" href={pathOf(e)}>
                      {e.title}
                    </Link>
                  </h3>
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
