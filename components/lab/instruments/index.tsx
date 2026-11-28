import type { CSSProperties, ReactNode } from 'react'

import type { Entry, Figure as FigureData, LeadName, StudyData } from '@/lib/lab/types'
import { fill } from '@/lib/lab/view'

/**
 * The instruments slot (API.md §6). PR 6 ships the static, server-rendered fallback of every lead
 * and figure, readable with JavaScript off; PR 11 replaces the module's insides with the real
 * registry (each instrument a static fallback plus a client island) and keeps `Lead` and `Figure`.
 *
 * Words come from the data (an entry's fields, a figure's `caption` and `data.copy`) or from the
 * Lab's copy, passed in; nothing here is a sentence of its own.
 */

type Copy = Record<string, string>

export interface LeadProps {
  entry: Entry
  /** The step of the kind's lead chain this entry reaches (`resolveLead`, lib/lab/view.ts). */
  name: LeadName
  copy: Copy
  figures: Readonly<Record<string, FigureData>>
  study?: StudyData
  /** A series' chapters, in order, with whether each is out. */
  chapters?: { order: number; title: string; out: boolean }[]
  /** Inline Markdown already rendered: the key line, the opening. */
  rendered: { keyLine?: ReactNode; opening?: ReactNode }
}

const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : [])

/** A table from `{ head, rows }` figure data (compare, spec tables). */
function Table({ data }: { data: Record<string, unknown> }) {
  const head = Array.isArray(data.head) ? (data.head as string[]) : null
  const rows = Array.isArray(data.rows) ? (data.rows as unknown[][]) : []
  return (
    <div className="lab-instr-scroll">
      <table>
        {head ? (
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {(Array.isArray(r) ? r : [r]).map((c, j) => (
                <td key={j}>{String(c ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Ranges on a 0–max scale (the chart instrument), as bars. */
function Bars({ data }: { data: Record<string, unknown> }) {
  const max = typeof data.max === 'number' ? data.max : 1
  const rows = (Array.isArray(data.rows) ? data.rows : []) as { label: string; lo: number; hi?: number; base?: boolean }[]
  return (
    <div className="lab-bars">
      {rows.map((r) => (
        <div className="lab-bar-row" key={r.label} data-base={r.base ? '' : undefined}>
          <span>{r.label}</span>
          <span className="lab-bar-track" aria-hidden="true">
            <span className="lab-bar-fill" style={{ width: `${Math.max(0, Math.min(1, (r.hi ?? r.lo) / max)) * 100}%` }} />
          </span>
          <span data-num>{r.hi !== undefined ? `${r.lo}–${r.hi}` : r.lo}</span>
        </div>
      ))}
    </div>
  )
}

/** A figure's static fallback: its data as a table or bars where it has that shape, else its words. */
function StaticFigure({ figure }: { figure: FigureData }) {
  const d = figure.data
  const copy = (d.copy && typeof d.copy === 'object' ? d.copy : {}) as Record<string, unknown>
  let inner: ReactNode
  if (Array.isArray(d.rows) && d.rows.every((r) => Array.isArray(r))) inner = <Table data={d} />
  else if (Array.isArray(d.rows)) inner = <Bars data={d} />
  else {
    const lines = [...strings(copy.q), ...strings(copy.before), ...strings(copy.after), ...strings(copy.p)]
    const note = strings(copy.illus)
    inner = lines.length ? (
      <>
        {lines.map((l, i) => (
          <p key={i} className={i ? undefined : 'lab-instr-q'}>
            {l}
          </p>
        ))}
        {note.map((l) => (
          <p key={l} className="meta">
            {l}
          </p>
        ))}
      </>
    ) : null
  }
  const caption = figure.caption ?? (typeof copy.caption === 'string' ? copy.caption : undefined)
  return (
    <>
      {inner ? (
        <div className="lab-instr box" data-box data-instrument={figure.instrument}>
          <div className="lab-instr-body">{inner}</div>
        </div>
      ) : null}
      {caption ? <p className="lab-caption">{caption}</p> : null}
    </>
  )
}

/** `::figure{of}` in a body. */
export function Figure({ of, figure }: { of: string; figure?: FigureData }) {
  if (!figure) return <figure data-figure={of} />
  return (
    <figure data-figure={of}>
      <StaticFigure figure={figure} />
    </figure>
  )
}

/** A study's board: one square per topic, in rows by track. */
function Board({ study, copy }: { study: StudyData; copy: Copy }) {
  const count = (s: string) => study.topics.filter((t) => t.status === s).length
  return (
    <div className="lab-instr box" data-box>
      <div className="lab-instr-body">
        <div className="lab-board" role="list" aria-label={copy.boardLabel}>
          {study.tracks.map((track) => (
            <div className="lab-board-row" role="listitem" key={track}>
              <span className="meta">{track}</span>
              <span className="lab-squares">
                {study.topics
                  .filter((t) => t.track === track)
                  .map((t) => (
                    <i
                      key={t.id}
                      className="lab-sq"
                      data-status={t.status}
                      title={`${t.topic} · ${copy[`status${t.status[0].toUpperCase()}${t.status.slice(1)}`] ?? t.status}`}
                      style={t.status === 'doing' && t.est ? ({ '--fill': `${Math.round((t.spent / t.est) * 100)}%` } as CSSProperties) : undefined}
                    />
                  ))}
              </span>
            </div>
          ))}
        </div>
        <p className="meta">{fill(copy.boardKey, { done: count('done'), doing: count('doing'), rest: study.topics.length - count('done') - count('doing') })}</p>
      </div>
    </div>
  )
}

export function Lead({ entry: e, name, copy, figures, study, chapters, rendered }: LeadProps) {
  switch (name) {
    case 'board':
      return study ? <Board study={study} copy={copy} /> : null
    case 'logline': {
      const last = e.kind === 'study' ? e.log?.[e.log.length - 1] : undefined
      return last ? <p className="lab-keyline box" data-box>{last.did}</p> : null
    }
    case 'progress':
      return chapters?.length ? (
        <div className="lab-instr box" data-box>
          <div className="lab-instr-body">
            <div className="lab-progress" aria-hidden="true">
              {chapters.map((c) => (
                <i key={c.order} data-on={c.out ? '' : undefined} />
              ))}
            </div>
            <p className="meta">
              {fill(copy.progressSeries, { done: chapters.filter((c) => c.out).length, total: chapters.length })}
            </p>
          </div>
        </div>
      ) : e.kind === 'series' && e.premise ? (
        <p className="lab-keyline box" data-box>{e.premise}</p>
      ) : null
    case 'instrument': {
      const id = e.lead?.of ?? e.id
      const fig = figures[id]
      if (fig) return <StaticFigure figure={fig} />
      return rendered.keyLine ? <div className="lab-keyline box" data-box>{rendered.keyLine}</div> : null
    }
    case 'keyline':
      return <div className="lab-keyline box" data-box>{rendered.keyLine}</div>
    case 'demo': {
      const d = e.lead?.demo
      return d ? (
        <figure className="lab-shot">
          {/* the still poster: the animated demo is PR 11's, behind reduced motion */}
          <img src={d.poster} width={d.w} height={d.h} alt={d.alt} fetchPriority="high" decoding="async" />
        </figure>
      ) : null
    }
    case 'screens': {
      const imgs = e.lead?.images ?? []
      const [first, ...rest] = imgs
      if (!first) return null
      const img = (i: (typeof imgs)[number], priority: boolean) => (
        <figure className="lab-shot" key={i.src}>
          <img src={i.src} width={i.w} height={i.h} alt={i.alt} loading={priority ? undefined : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" />
        </figure>
      )
      return rest.length ? (
        <div className="lab-shots">
          {img(first, true)}
          <div>{rest.slice(0, 2).map((i) => img(i, false))}</div>
        </div>
      ) : (
        img(first, true)
      )
    }
    case 'figure': {
      const fig = e.lead?.figure ? figures[e.lead.figure] : undefined
      return fig ? <StaticFigure figure={fig} /> : null
    }
    case 'install':
      return e.kind === 'build' && e.install ? (
        <div className="lab-instr box" data-box>
          <div className="lab-instr-body">
            <pre>
              <code>{e.install}</code>
            </pre>
          </div>
        </div>
      ) : null
    case 'result':
      return e.kind === 'experiment' ? (
        <div className="lab-instr box" data-box>
          <div className="lab-instr-body">
            <p className="meta">{e.result.question}</p>
            <p className="lab-result">
              <strong>{e.result.value}</strong>
              {e.result.baseline ? <span className="meta">{e.result.baseline}</span> : null}
            </p>
            <p className="meta">{e.result.setup}</p>
          </div>
        </div>
      ) : null
    case 'cover': {
      const c = e.lead?.cover
      return c ? (
        <figure className="lab-shot">
          <img src={c.src} width={c.w} height={c.h} alt={c.alt} fetchPriority="high" decoding="async" />
        </figure>
      ) : null
    }
    case 'opening':
      return <div className="lab-opening">{rendered.opening}</div>
    default:
      return null
  }
}
