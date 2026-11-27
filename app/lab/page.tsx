/*
 * PLACEHOLDER, replaced outright by PR 9 (plan `plan-the-real-lab`, "9 · Home, section pages,
 * index, tags, glossary"). PR 6 ships it so `/lab` answers while the shell and the entry pages are
 * reviewed: the intro, the empty Lab's note (API.md, "The empty Lab"), and otherwise a plain list
 * of every top-level entry by section.
 */
import Link from 'next/link'

import { Name } from '@/components/lab/name'
import { profile } from '@/content'
import { getLab, homeBands, pathOf } from '@/lib/lab/content'
import { labMetadata } from '@/lib/lab/seo'
import { bareillyToday, formatDay } from '@/lib/lab/view'

export const metadata = labMetadata({ path: '/lab' })

export default function LabHome() {
  const { copy } = getLab()
  const bands = homeBands()
  const today = bareillyToday()
  const [before, after = ''] = copy.homeIntro.split('{name}')
  return (
    <div className="lab-page">
      <section className="lab-intro">
        <p className="lab-eyebrow">{copy.homeEyebrow}</p>
        <h1 className="lab-home-title">{copy.homeTitle}</h1>
        <p className="lab-intro-text">
          {before}
          <Name name={profile.name} />
          {after}
        </p>
        <p className="lab-intro-text">{copy.homeBrand}</p>
      </section>
      {bands.length ? (
        <div className="lab-sections">
          {bands.map(({ section, entries }) => (
            <section key={section.id}>
              <h2>{section.title}</h2>
              <p className="meta">{section.thesis}</p>
              <ul className="lab-rows">
                {entries.map((e) => (
                  <li key={e.id}>
                    <Link className="lab-row-title" href={pathOf(e)} data-preview={`entry:${e.id}`}>
                      {e.title}
                    </Link>
                    {e.published ? <time dateTime={e.published}>{formatDay(e.published, today)}</time> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="lab-note box" data-box>
          {copy.homeEmpty}
        </p>
      )}
    </div>
  )
}
