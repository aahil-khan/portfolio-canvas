import Link from 'next/link'

import { ListHead } from '@/components/lab/lists/head'
import { ColumnTransition } from '@/components/lab/motion/column-transition'
import { getLab, pathOf } from '@/lib/lab/content'
import { lettersOf } from '@/lib/lab/lists'
import { labMetadata } from '@/lib/lab/seo'
import { fill } from '@/lib/lab/view'

export function generateMetadata() {
  const { copy } = getLab()
  return labMetadata({ title: copy.glossTitle, description: copy.glossLede, path: '/lab/glossary' })
}

/**
 * Every term (plan PR 9; API.md §3): by first letter, each a name and its one plain line, with a
 * link on to the entry or the source it points at. `#t-<id>` is the anchor every `[[t:…]]` in a
 * body links to. From 1200px, in the Side panel layout, the letters sit in a column beside the
 * terms, sticky under the bar; below that, or Centred, the terms run alone.
 */
export default function GlossaryPage() {
  const { copy, terms, entries } = getLab()
  const letters = lettersOf(terms)
  const byId = new Map(entries.map((e) => [e.id, e]))
  const onward = (link: string | undefined) => {
    if (!link) return null
    if (/^https:\/\//.test(link))
      return (
        <a href={link} data-preview={`out:${link}`}>
          {copy.cardSource}
        </a>
      )
    const e = byId.get(link)
    if (!e || e.draft || e.published === null) return null
    return (
      <Link href={pathOf(e)} data-preview={`entry:${e.id}`}>
        {fill(copy.listsTermLink, { title: e.title })}
      </Link>
    )
  }
  return (
    <ColumnTransition className="lab-list lab-gloss">
      <div data-lists="glossary">
        <ListHead lab={copy.secEyebrow} title={copy.glossTitle} lede={letters.length ? copy.glossLede : copy.listsGlossaryEmpty} />
        {letters.length ? (
          <div className="lab-gloss-grid">
            <div className="lab-gloss-terms">
              {letters.map(({ letter, terms: list }) => (
                <section key={letter} id={`l-${letter}`} className="lab-gloss-letter" aria-labelledby={`lh-${letter}`}>
                  <h2 id={`lh-${letter}`} className="lab-gloss-h">
                    {letter}
                  </h2>
                  <dl>
                    {list.map((t) => (
                      <div key={t.id} id={`t-${t.id}`} className="lab-term" data-term={t.id}>
                        <dt>{t.name}</dt>
                        <dd>
                          <p>{t.def}</p>
                          {t.link && onward(t.link) ? <p className="lab-term-on">{onward(t.link)}</p> : null}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
            <nav className="lab-gloss-rail" data-rail="" aria-label={copy.listsLetters}>
              <div className="lab-gloss-rail-in">
                <p className="end-h">{copy.listsLetters}</p>
                <ul className="lab-gloss-letters">
                  {letters.map(({ letter }) => (
                    <li key={letter}>
                      <a href={`#l-${letter}`}>{letter}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </div>
        ) : null}
      </div>
    </ColumnTransition>
  )
}
