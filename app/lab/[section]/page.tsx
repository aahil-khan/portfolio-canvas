import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ListHead } from '@/components/lab/lists/head'
import { Hero, Strip } from '@/components/lab/lists/hero'
import { EntryRow } from '@/components/lab/lists/row'
import { ColumnTransition } from '@/components/lab/motion/column-transition'
import { getLab, newHere, pathOf, routes } from '@/lib/lab/content'
import { holdsLine, sectionGroups, splitLink, stripOf } from '@/lib/lab/lists'
import { labMetadata } from '@/lib/lab/seo'
import type { Kind } from '@/lib/lab/types'
import { bareillyToday, fill } from '@/lib/lab/view'

/** A section: `/lab/<section>` (API.md §3), one for every section with a top-level entry. */
export const dynamicParams = false

export function generateStaticParams() {
  return routes()
    .filter((r) => r.kind === 'section')
    .map((r) => ({ section: r.path.split('/')[2] }))
}

type Params = Promise<{ section: string }>

const sectionOf = (id: string) => (routes().some((r) => r.kind === 'section' && r.path === `/lab/${id}`) ? getLab().sections.find((s) => s.id === id) : undefined)

export async function generateMetadata({ params }: { params: Params }) {
  const { section } = await params
  const s = sectionOf(section)
  return s ? labMetadata({ title: s.title, description: s.thesis, path: `/lab/${s.id}` }) : labMetadata()
}

const cap = (k: Kind) => k.charAt(0).toUpperCase() + k.slice(1)

/**
 * A section page (plan PR 9; README, "Section pages are evergreen too"): its title at the Lab's one
 * hero size, its thesis, New here? (what it holds, by kind, and where to begin: the oldest entry of
 * the highest-ranked kind, so the line stays true as entries are added), the hero from data (the
 * section's pick, or a strip of its three newest), then every entry: top-level ones newest first,
 * each with its own chapters or notes under it.
 */
export default async function SectionPage({ params }: { params: Params }) {
  const { section: id } = await params
  const section = sectionOf(id)
  if (!section) notFound()
  const lab = getLab()
  const { copy } = lab
  const today = bareillyToday()
  const groups = sectionGroups(lab.entries, section.id)
  const all = groups.flatMap((g) => [g.entry, ...g.kids])
  const start = newHere(section.id)
  const begin = start ? splitLink(copy[`begin${cap(start.start.kind)}`] ?? '') : null
  const pick = section.hero ? lab.entries.find((e) => e.id === section.hero && !e.draft && e.published !== null) : undefined

  return (
    <ColumnTransition className="lab-list lab-section">
      <div data-lists="section" data-section={section.id}>
        <ListHead lab={copy.secEyebrow} title={section.title} size="hero" lede={section.thesis}>
          {start && begin ? (
            <p className="lab-lhead-new" data-new-here="">
              <strong>{copy.newTitle}</strong> {holdsLine(copy, all)} {begin.before}
              {begin.hasLink ? (
                <Link href={pathOf(start.start)} data-preview={`entry:${start.start.id}`}>
                  {start.start.title}
                </Link>
              ) : null}
              {begin.after}
            </p>
          ) : null}
        </ListHead>

        {pick ? <Hero section={section} entry={pick} today={today} /> : <Strip section={section} entries={stripOf(lab.entries, section.id)} today={today} />}

        <section className="lab-lblock" aria-labelledby="lab-all-title">
          <h2 id="lab-all-title" className="lab-lblock-title">
            {fill(copy.secAll, { title: section.title })}
          </h2>
          <ul className="lab-groups">
            {groups.map(({ entry, kids }) => (
              <li key={entry.id} className="lab-group">
                <ul className="lab-lrows">
                  <EntryRow entry={entry} today={today} lede holds />
                </ul>
                {kids.length ? (
                  <ol className="lab-lrows lab-lrows-kids">
                    {kids.map((k) => (
                      <EntryRow key={k.id} entry={k} today={today} number bare />
                    ))}
                  </ol>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ColumnTransition>
  )
}
