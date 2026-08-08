import type { ReactNode } from 'react'

import type { CardDef } from '@/components/desktop/card'
import { DetailRow } from '@/components/apps/interactive'
import { ArchiveFeed } from '@/components/apps/archive-feed'
import { Shots } from '@/components/apps/shots'
import { ArchiveFull } from '@/components/apps/archive-full'
import { ThemePicker } from '@/components/apps/theme-picker'
import {
  ARCHIVE_KINDS,
  apps,
  archive,
  detailPalette,
  education,
  headlineStats,
  jobs,
  posts,
  profile,
  projects,
  toolGroups,
  toolsByName,
} from '@/content'

/**
 * Turns content into the full set of cards, rendered on the server.
 *
 * Every card that can ever exist is built here — dock apps, project details, job details and
 * screenshot cards — so opening one mounts an already-described node rather than running a
 * second, divergent render path.
 */

/** Renders `**bold**` in content strings. Content authors shouldn't have to write JSX. */
function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>
    if (part.startsWith('*') && part.endsWith('*')) return <i key={i}>{part.slice(1, -1)}</i>
    return part
  })
}

const app = (id: string) => apps.find((a) => a.id === id)!

function StackShelf() {
  return (
    <>
      {toolGroups.map((group) => (
        <div className="grp" key={group.label}>
          <b>{group.label}</b>
          <div className="grp__row">
            {group.tools.map((tool) => (
              <span className="tool" key={tool.name}>
                {tool.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size logo
                  <img className={tool.invert ? 'inv' : undefined} src={tool.logo} alt="" loading="lazy" />
                ) : (
                  // no asset shipped: an initial is honest, borrowing a near-enough logo is not
                  <span className="fallback">{tool.name[0]}</span>
                )}
                {tool.name}
              </span>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function StackChips({ names }: { names: readonly string[] }) {
  return (
    <div>
      {names.map((n) => (
        <span className="chip" key={n}>
          {toolsByName.get(n)?.name ?? n}
        </span>
      ))}
    </div>
  )
}

export function buildCards(): CardDef[] {
  const cards: CardDef[] = []
  const push = (id: string, body: ReactNode, over?: Partial<CardDef>) => {
    const a = app(id)
    cards.push({
      id,
      label: a.label,
      icon: a.icon,
      colour: a.colour,
      tint: a.tint,
      width: a.width,
      rotate: a.rotate,
      body,
      ...over,
    })
  }

  push(
    'about',
    <>
      <p className="lede">{profile.intro}</p>
      {profile.notes?.map((n, i) => <p key={i}>{n}</p>)}
      <p>
        <a className="link" href={`mailto:${profile.email}`}>
          {profile.email}
        </a>
      </p>
      <div>
        {profile.links.map((l) => (
          <a className="chip" key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
            {l.label}
          </a>
        ))}
      </div>
    </>,
  )

  push(
    'work',
    <>
      {[...projects]
        .sort((a, b) => b.year - a.year)
        .map((p) => (
          <DetailRow
            key={p.slug}
            cardId={`project:${p.slug}`}
            year={String(p.year)}
            title={p.name}
            sub={p.tagline}
            tag={p.tag ?? p.kind}
          />
        ))}
      <div className="stats">
        {headlineStats.map((s) => (
          <span className="stat" key={s.label}>
            <b>{s.value}</b>
            <span>{s.label}</span>
          </span>
        ))}
      </div>
    </>,
  )

  push(
    'experience',
    <>
      {[...jobs]
        .sort((a, b) => b.year - a.year)
        .map((j) => (
          <DetailRow
            key={j.slug}
            cardId={`job:${j.slug}`}
            year={String(j.year)}
            title={j.role}
            sub={`${j.company} · ${j.period}`}
          />
        ))}
      {education.map((e) => (
        <div className="item" key={e.institution}>
          <span className="yr">edu</span>
          <span>
            <span className="ttl">{e.degree}</span>
            <span className="sub">
              {e.institution} · {e.detail}
            </span>
          </span>
        </div>
      ))}
    </>,
  )

  push('stack', <StackShelf />)

  push(
    'writing',
    <>
      {[...posts]
        .sort((a, b) => b.year - a.year)
        .map((p) => (
          <a className="item" key={p.slug} href={p.href} target="_blank" rel="noopener noreferrer">
            <span className="yr">{p.year}</span>
            <span>
              <span className="ttl">{p.title}</span>
              <span className="sub">{p.blurb}</span>
            </span>
            <span className="tag">{p.readingTime}</span>
          </a>
        ))}
    </>,
  )

  push(
    'resume',
    <>
      <p className="lede">The whole thing, as a page you can scroll and print.</p>
      <p>
        <a className="link" href="/resume">
          Open résumé →
        </a>
        {profile.resumePdf ? (
          <>
            {' '}
            <a className="link" href={profile.resumePdf} download>
              Download PDF ↓
            </a>
          </>
        ) : null}
      </p>
      <p style={{ fontSize: '.8125rem', color: 'var(--ink-subtle)' }}>
        Server-rendered, and works with JavaScript disabled.
      </p>
    </>,
  )

  push('archive', <ArchiveFeed />)

  push('themes', <ThemePicker />)

  push(
    'contact',
    <>
      <p className="lede">One message away.</p>
      <p>
        <a className="link" href={`mailto:${profile.email}`}>
          {profile.email}
        </a>
      </p>
      <div>
        {profile.links.map((l) => (
          <a className="chip" key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
            {l.label}
          </a>
        ))}
      </div>
    </>,
  )

  /* --- an archive entry's image, opened on its own --- */
  for (const a of archive) {
    if (!a.image) continue
    cards.push({
      id: `archive:${a.id}`,
      label: a.title,
      icon: 'shot',
      colour: ARCHIVE_KINDS[a.kind].colour,
      tint: '#FFF0DC',
      width: 520,
      rotate: -0.7,
      body: <ArchiveFull src={a.image} alt={a.title} />,
    })
  }

  /* --- project details, plus a screenshot card for each --- */
  for (const p of projects) {
    const id = `project:${p.slug}`
    cards.push({
      id,
      label: p.name,
      icon: 'project',
      colour: detailPalette.project.colour,
      tint: detailPalette.project.tint,
      width: 560,
      rotate: 0.8,
      body: (
        <>
          {p.meta ? <p className="detail-meta">{p.meta}</p> : null}
          {p.award ? <div className="award">🏆 {p.award}</div> : null}
          <p className="lede">{p.lede}</p>
          <Shots images={p.images} cardId={`shot:${p.slug}`} alt={`${p.name} screenshot`} />
          <ul className="bullets">
            {p.highlights.map((h, i) => (
              <li key={i}>{rich(h)}</li>
            ))}
          </ul>
          <StackChips names={p.stack} />
          {p.links?.length ? (
            <div className="links">
              {p.links.map((l) => (
                <a
                  className="link"
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l.label} →
                </a>
              ))}
            </div>
          ) : null}
        </>
      ),
    })
    cards.push({
      id: `shot:${p.slug}`,
      label: `${p.name} — shot`,
      icon: 'shot',
      colour: detailPalette.project.colour,
      tint: detailPalette.project.tint,
      width: 520,
      rotate: -0.9,
      body: <Shots images={p.images} alt={`${p.name} screenshot`} full />,
    })
  }

  /* --- job details, same treatment --- */
  for (const j of jobs) {
    const id = `job:${j.slug}`
    cards.push({
      id,
      label: j.role,
      icon: 'experience',
      colour: detailPalette.job.colour,
      tint: detailPalette.job.tint,
      width: 580,
      rotate: -1.0,
      body: (
        <>
          {j.meta ? <p className="detail-meta">{j.meta}</p> : null}
          <p className="lede">{rich(j.lede)}</p>
          <Shots images={j.images} cardId={`shot:${j.slug}`} alt={`${j.company} screenshot`} />
          <ul className="bullets">
            {j.highlights.map((h, i) => (
              <li key={i}>{rich(h)}</li>
            ))}
          </ul>
          <StackChips names={j.stack} />
        </>
      ),
    })
    cards.push({
      id: `shot:${j.slug}`,
      label: `${j.company} — shot`,
      icon: 'shot',
      colour: detailPalette.job.colour,
      tint: detailPalette.job.tint,
      width: 520,
      rotate: 0.9,
      body: <Shots images={j.images} alt={`${j.company} screenshot`} full />,
    })
  }

  return cards
}
