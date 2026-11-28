import Link from 'next/link'

import { entryText, withPull } from '@/components/lab/entry/body'
import { Ending } from '@/components/lab/entry/ending'
import { Meta } from '@/components/lab/entry/meta'
import { Picker } from '@/components/lab/entry/picker'
import { Pull } from '@/components/lab/entry/pull'
import { References } from '@/components/lab/entry/references'
import { Rail, RailList, Toc } from '@/components/lab/entry/rail'
import { SeriesLine } from '@/components/lab/entry/series-line'
import { Share } from '@/components/lab/entry/share'
import { Lead } from '@/components/lab/instruments'
import { ColumnTransition } from '@/components/lab/motion/column-transition'
import { backlinks, bodyOf, children, getLab, pathOf, readTime, related } from '@/lib/lab/content'
import { renderBody } from '@/lib/lab/markdown/pipeline'
import { canonicalUrl } from '@/lib/lab/seo'
import type { Entry } from '@/lib/lab/types'
import { plainInline } from '@/lib/lab/text'
import { bareillyToday, formatDay, kindWords, pad2, resolveLead } from '@/lib/lab/view'

/** Inline Markdown (a key line, an opening) rendered the way bodies are, links and all. */
async function inline(md: string, e: Entry) {
  const lab = getLab()
  const byId = new Map(lab.entries.map((x) => [x.id, x]))
  return renderBody(md, {
    entryHref: (id) => {
      const x = byId.get(id)
      return x && !x.draft && x.published ? pathOf(x) : null
    },
    termHref: (id) => (lab.terms.some((x) => x.id === id) ? `/lab/glossary#t-${id}` : null),
    tagHref: (id) => (lab.tags.some((x) => x.id === id) ? `/lab/tags/${id}` : null),
    refs: e.refs ?? {},
  })
}

const isOut = (e: Entry) => !e.draft && e.published !== null

/**
 * One entry page, any kind (API.md §5): the head (the chapter picker or the study line, the title,
 * the meta), the lead, the reading column (lede, body with its pull-quote, a study's or series'
 * own entries, "What I'd do now", the end marker, References, Share), the rail, and previous/next
 * within a series or a study. Server-rendered and complete with JavaScript off.
 */
export async function EntryPage({ entry: e }: { entry: Entry }) {
  const lab = getLab()
  const { copy } = lab
  const today = bareillyToday()
  const byId = new Map(lab.entries.map((x) => [x.id, x]))
  const path = pathOf(e)
  const url = canonicalUrl(path)
  const parent = 'parent' in e && e.parent ? byId.get(e.parent) : undefined
  const siblings = parent ? children(parent.id) : []
  const kids = children(e.id)
  const studySeries = e.kind === 'study' ? lab.entries.filter((x) => x.kind === 'series' && x.study === e.id) : []

  const leadName = resolveLead(e, { studies: lab.studies, chapters: e.kind === 'series' ? kids.length : 0 })
  // an essay's lead is its opening, and a build says what it is in one line under its title
  const ledeInBody = leadName !== 'opening' && e.kind !== 'build'
  const text = await entryText(e, bodyOf(e.id), { lede: ledeInBody })
  const buildLede = e.kind === 'build' && e.lede ? await inline(e.lede, e) : null
  const keyLine = 'keyLine' in e && e.keyLine ? await inline(e.keyLine, e) : undefined
  const opening = e.kind === 'essay' ? await inline(e.opening, e) : undefined

  const back = backlinks(e.id)
  // the rail scrolls each list on its own, so Related can hold more than a screen's worth
  const rel = related(e.id).filter((x) => !back.some((b) => b.id === x.id)).slice(0, 8)
  const kindOf = (x: Entry) => {
    const p = 'parent' in x && x.parent ? byId.get(x.parent) : undefined
    return kindWords(copy, x, p?.title)
  }
  const item = (x: Entry) => (
    <li key={x.id}>
      <Link href={pathOf(x)} data-preview={`entry:${x.id}`}>
        {x.title}
      </Link>
      <span className="meta">{kindOf(x)}</span>
    </li>
  )
  const shareLabels = {
    title: copy.shareTitle,
    native: copy.shareNative,
    copy: copy.shareCopy,
    copied: copy.shareCopied,
    x: copy.shareX,
    linkedin: copy.shareLinkedin,
  }

  const body = e.pull ? withPull(text.body, <Pull key="lab-pull" text={e.pull} />, e.pull) : text.body
  const rows = (list: Entry[], numbered: boolean) => (
    <ol className="lab-rows">
      {list.map((x) => (
        <li key={x.id}>
          <span data-num>{numbered && x.kind === 'chapter' ? pad2(x.order) : ''}</span>
          {isOut(x) ? (
            <Link className="lab-row-title" href={pathOf(x)} data-preview={`entry:${x.id}`}>
              {x.title}
            </Link>
          ) : (
            <span className="lab-row-title">{x.title}</span>
          )}
          {isOut(x) && x.published ? <time dateTime={x.published}>{formatDay(x.published, today)}</time> : <span className="meta-later">{copy.laterLabel}</span>}
          {x.lede ? <span className="lab-row-lede">{plainInline(x.lede)}</span> : null}
        </li>
      ))}
    </ol>
  )

  const idx = siblings.findIndex((x) => x.id === e.id)
  const prev = idx > 0 ? siblings.slice(0, idx).reverse().find(isOut) : undefined
  const next = idx >= 0 ? siblings.slice(idx + 1).find(isOut) : undefined
  const npLabel = (x: Entry) => (x.kind === 'chapter' ? pad2(x.order) : x.published ? formatDay(x.published, today) : '')

  return (
    <article className="lab-entry" data-entry={e.id}>
      <ColumnTransition className="lab-entry-flow">
        <div className="lab-entry-head">
          {e.kind === 'chapter' && parent ? (
            <Picker
              series={parent.title}
              of={copy.pickerOf}
              title={copy.pickerTitle}
              all={copy.pickerAll}
              seriesHref={pathOf(parent)}
              chapters={siblings.map((x) => ({
                order: x.kind === 'chapter' ? x.order : 0,
                title: x.title,
                href: isOut(x) ? pathOf(x) : null,
                current: x.id === e.id,
              }))}
            />
          ) : parent ? (
            <SeriesLine label={kindWords(copy, e)} title={parent.title} href={pathOf(parent)} id={parent.id} />
          ) : null}
          {e.kind === 'chapter' ? (
            <span className="lab-num" data-num aria-hidden="true">
              {pad2(e.order)}
            </span>
          ) : null}
          <h1 className="lab-entry-title">{e.title}</h1>
          {e.published ? <Meta published={e.published} updated={e.updated} minutes={readTime(e.id)} today={today} copy={copy} /> : null}
          {buildLede ? <div className="lab-entry-sub">{buildLede}</div> : null}
        </div>

        <div className="lab-lead" data-lead={leadName ?? ''}>
          {e.leadIntro ? <p className="lab-lead-intro">{e.leadIntro}</p> : null}
          {leadName ? (
            <Lead
              entry={e}
              name={leadName}
              copy={copy}
              figures={lab.figures}
              study={lab.studies[e.id]}
              chapters={e.kind === 'series' ? kids.map((x) => ({ order: x.kind === 'chapter' ? x.order : 0, title: x.title, out: isOut(x) })) : undefined}
              rendered={{ keyLine, opening }}
            />
          ) : null}
          {e.kind === 'build' && (e.install || e.repo || e.live) && leadName !== 'install' ? (
            <p className="lab-try">
              {e.install ? (
                <>
                  <span className="meta">{copy.tryInstall}</span>
                  <code>{e.install}</code>
                </>
              ) : null}
              {e.repo ? (
                <a href={e.repo} data-preview={`out:${e.repo}`}>
                  {copy.tryRepo}
                </a>
              ) : null}
              {e.live ? (
                <a href={e.live} data-preview={`out:${e.live}`}>
                  {copy.tryLive}
                </a>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="lab-column" data-column>
          <div className="lab-body lab-prose">
            {text.lede ? <div className="lede">{text.lede}</div> : null}
            {body}
          </div>

          {e.kind === 'series' && kids.length ? (
            <section className="lab-block">
              <h2>{copy.kidsSeries}</h2>
              {rows(kids, true)}
            </section>
          ) : null}
          {e.kind === 'study' && (kids.length || studySeries.length) ? (
            <section className="lab-block">
              <h2>{copy.kidsStudy}</h2>
              {rows([...studySeries, ...kids], false)}
            </section>
          ) : null}
          {e.kind === 'study' && e.log?.length ? (
            <section className="lab-block">
              <h2>{copy.studyChanged}</h2>
              <ol className="lab-log">
                {[...e.log].reverse().map((l, i) => (
                  <li key={i}>
                    <time dateTime={l.date}>{formatDay(l.date, today)}</time>
                    <span>{l.did}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {'ending' in e && text.ending ? (
            <Ending id={e.id} kind={e.endingKind} asOf={e.updated ?? e.published ?? today} today={today} copy={copy}>
              {text.ending}
            </Ending>
          ) : null}

          <div data-body-end="" />

          <References title={copy.refsTitle} order={text.refOrder} refs={e.refs ?? {}} />
          <Share where="end" url={url} title={e.title} path={path} labels={shareLabels} />
        </div>
      </ColumnTransition>

      <Rail label={copy.railLabel} toc={text.toc}>
        <Toc title={copy.tocTitle} toc={text.toc} />
        <Share where="rail" url={url} title={e.title} path={path} labels={shareLabels} />
        <div className="lab-rail-sec" data-backlinks data-rail-section="backlinks">
          <h2 className="end-h">{copy.backlinks.replace(/:$/, '')}</h2>
          {back.length ? (
            <RailList>
              <ul className="lab-end-list">{back.map(item)}</ul>
            </RailList>
          ) : (
            <p className="meta">{copy.backlinksNone}</p>
          )}
        </div>
        <div className="lab-rail-sec" data-related data-rail-section="related">
          <h2 className="end-h">{copy.relatedTitle}</h2>
          <RailList>
            <ul className="lab-end-list">{rel.map(item)}</ul>
          </RailList>
        </div>
        {e.tags?.length ? (
          <div className="lab-rail-sec" data-tags data-rail-section="tags">
            <h2 className="end-h">{copy.tagsTitle}</h2>
            <RailList>
              <ul className="lab-tag-list">
                {e.tags.map((g) => (
                  <li key={g}>
                    <a href={`/lab/tags/${g}`} data-preview={`tag:${g}`}>
                      {lab.tags.find((x) => x.id === g)?.title ?? g}
                    </a>
                  </li>
                ))}
              </ul>
            </RailList>
          </div>
        ) : null}
      </Rail>

      {prev || next ? (
        <nav className="lab-nextprev" aria-label={parent?.title}>
          {prev ? (
            <Link className="box" data-box href={pathOf(prev)} data-preview={`entry:${prev.id}`}>
              <span className="meta">
                {copy.prev} · {npLabel(prev)}
              </span>
              <span className="np-title">{prev.title}</span>
            </Link>
          ) : null}
          {next ? (
            <Link className="box np-next" data-box href={pathOf(next)} data-preview={`entry:${next.id}`}>
              <span className="meta">
                {copy.nextch} · {npLabel(next)}
              </span>
              <span className="np-title">{next.title}</span>
            </Link>
          ) : null}
        </nav>
      ) : null}
    </article>
  )
}
