import Link from 'next/link'

import { Band } from '@/components/lab/lists/band'
import { Arrow } from '@/components/lab/lists/head'
import { EntryRow } from '@/components/lab/lists/row'
import { ColumnTransition } from '@/components/lab/motion/column-transition'
import { Name } from '@/components/lab/name'
import { profile } from '@/content'
import { getLab, homeBands, latest, routes } from '@/lib/lab/content'
import { labMetadata } from '@/lib/lab/seo'
import { bareillyToday, fill } from '@/lib/lab/view'

import '@/components/lab/lists/lists.css'

export const metadata = labMetadata({ path: '/lab' })

/**
 * The Lab's home (plan PR 9; README, "The home is evergreen"). It names no entry in its own
 * furniture, so it reads the same after a month with nothing new: the intro, with his name in the
 * Name slot (API.md §6); New here?; one framed band per section with its first five top-level
 * entries (decision 1); the six newest entries of any kind (decision 2); and "All N entries".
 * No Now line, nothing pinned, nothing counting progress, no relative dates (H1–H3).
 *
 * With demo off and nothing written (API.md, "The empty Lab"), it is the intro and a short note.
 */
export default function LabHome() {
  const { copy, entries } = getLab()
  const bands = homeBands()
  const newest = latest(6)
  const today = bareillyToday()
  const all = routes().filter((r) => r.kind === 'entry').length
  const [before, after = ''] = copy.homeIntro.split('{name}')
  return (
    <ColumnTransition className="lab-list lab-home">
      <div data-lists="home">
      <section className="lab-intro">
        <p className="lab-eyebrow">{copy.homeEyebrow}</p>
        <h1 className="lab-home-title">{copy.homeTitle}</h1>
        <p className="lab-intro-text lab-home-intro">
          {before}
          <Name name={profile.name} />
          {after} {copy.homeBrand}
        </p>
      </section>

      {bands.length && entries.length ? (
        <>
          <section className="lab-lblock lab-new" aria-labelledby="lab-new-title">
            <h2 id="lab-new-title" className="lab-lblock-title">
              {copy.newTitle}
            </h2>
            <div className="lab-new-grid">
              {(['What', 'Read', 'Start'] as const).map((k) => (
                <div key={k}>
                  <h3 className="lab-new-h">{copy[`new${k}H`]}</h3>
                  <p>{copy[`new${k}`]}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="lab-lblock" aria-labelledby="lab-sections-title">
            <h2 id="lab-sections-title" className="lab-lblock-title">
              {copy.homeSections}
            </h2>
            <div className="lab-bands">
              {bands.map(({ section, entries: rows, total }) => (
                <Band key={section.id} section={section} entries={rows} total={total} today={today} copy={copy} />
              ))}
            </div>
          </section>

          <section className="lab-lblock" aria-labelledby="lab-latest-title">
            <h2 id="lab-latest-title" className="lab-lblock-title">
              {copy.homeLatest}
            </h2>
            <ul className="lab-lrows lab-lrows-latest" data-latest="">
              {newest.map((e) => (
                <EntryRow key={e.id} entry={e} today={today} />
              ))}
            </ul>
            <p className="lab-all">
              <Link href="/lab/index">
                {fill(copy.homeAll, { n: all })}
                <Arrow />
              </Link>
            </p>
          </section>
        </>
      ) : (
        <p className="lab-note box" data-box>
          {copy.homeEmpty}
        </p>
      )}
      </div>
    </ColumnTransition>
  )
}
