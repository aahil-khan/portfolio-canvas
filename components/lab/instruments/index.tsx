import type { ReactNode } from 'react'

import { getLab, pathOf } from '@/lib/lab/content'
import { ITEMS, type Item } from '@/lib/lab/haggle'
import type { Entry, Figure as FigureData, LeadName, StudyData } from '@/lib/lab/types'
import { bareillyToday, fill, formatDay } from '@/lib/lab/view'

import { BeforeAfter } from './before-after'
import { Board } from './board'
import { Chart, type ChartRow } from './chart'
import { Demo } from './demo'
import { Haggle, type LogWords } from './haggle'
import { Install } from './install'
import { Keyline, Logline } from './keyline'
import { Drawn } from './live'
import { Cover, Opening } from './opening'
import { Passk, type PasskCopy } from './passk'
import { SeriesProgress } from './progress'
import { Result } from './result'
import { ScenarioBrowser, type Scenario, type ScenarioGroup } from './scenario-browser'
import { Screens } from './screens'
import { Steps, type StepsCopy } from './steps'
import { Table } from './table'

import './instruments.css'

/**
 * The instruments slot (API.md §6), PR 11: the real registry behind `Lead` and `Figure`.
 *
 * Every instrument is server-rendered in its opening state, so it is complete with JavaScript off
 * and the client island (where it has one) hydrates the same markup. The interactive ones are the
 * board, the haggle, the scenario browser, pass@k, the screens carousel, the demo's pause and the
 * install line's copy; the rest are figures that only draw. Controls that need JavaScript carry
 * `data-needs-js` (hidden under `scripting: none`); what stands in for them without it carries
 * `data-no-js`. Each lead draws once, on first view (`live.tsx`, `instruments.css`).
 *
 * Words come from the data (an entry's fields, a figure's `caption` and `data.copy`) or from the
 * Lab's copy (`lab.json`, the `instr*` block and the keys PR 2 wrote), passed in; nothing here is a
 * sentence of its own. The shapes each instrument reads are `lib/lab/instruments/schemas.ts`.
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

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const words = (v: unknown): Copy => Object.fromEntries(Object.entries(obj(v)).filter(([, x]) => typeof x === 'string')) as Copy

/** The priced item a figure names (`data.item`), else its first, else the spec's charger. */
function itemOf(d: Record<string, unknown>): Item {
  const items = obj(d.items) as Record<string, Item>
  const id = typeof d.item === 'string' ? d.item : Object.keys(items)[0]
  const it = items[id] ?? ITEMS['CHG-20W']
  return { id: it.id ?? id, name: it.name, list: it.list, floor: it.floor }
}

/** The Lab's words for the haggle's log, from the `instrLog*` copy. */
const logWords = (c: Copy): LogWords => ({
  context: c.instrLogContext,
  system: c.instrLogSystem,
  item: c.instrLogItem,
  tools: c.instrLogTools,
  returns: c.instrLogReturns,
  blind: c.instrLogBlind,
  told: c.instrLogTold,
  shop: c.instrLogShopName,
  itemLine: c.instrLogItemLine,
  floor: c.instrLogFloor,
  call: c.instrLogCall,
  offer: c.instrLogOffer,
  accept: c.instrLogAccept,
  agreed: c.instrLogAgreed,
  counter: c.instrLogCounter,
  toolsB: c.instrLogToolsB,
  toolsA: c.instrLogToolsA,
  transcript: c.instrTranscript,
})

/** A figure's caption: its own, else its data's. */
const captionOf = (f: FigureData) => f.caption ?? (typeof obj(f.data.copy).caption === 'string' ? (obj(f.data.copy).caption as string) : undefined)

/** The words under a figure: its caption, and anything the instrument adds beneath (the haggle's "how it decides"). */
function Under({ f, as: Tag = 'p' }: { f: FigureData; as?: 'p' | 'figcaption' }) {
  const caption = captionOf(f)
  const c = words(f.data.copy)
  const how = f.instrument === 'haggle' && c.schedule ? [c.note, c.schedule].filter(Boolean).join(' ') : ''
  if (!caption && !how) return null
  return (
    <Tag className="lab-caption">
      {caption ? <span className="lab-caption-line">{caption}</span> : null}
      {how ? <span className="lab-caption-line lab-caption-more">{how}</span> : null}
    </Tag>
  )
}

/** The instrument's insides, by its registered name (`INSTRUMENT_SCHEMAS`). `null` for a name with nothing to draw. */
function draw(f: FigureData, copy: Copy): ReactNode {
  const d = f.data
  const c = words(d.copy)
  switch (f.instrument) {
    case 'compare':
      return <Table kind="compare" head={d.head as string[]} rows={d.rows as string[][]} chosen={typeof d.chosen === 'number' ? d.chosen : undefined} />
    case 'spec-table':
      return <Table kind="spec-table" head={d.head as string[]} rows={d.rows as string[][]} num={Array.isArray(d.num) ? (d.num as number[]) : []} />
    case 'chart':
      return <Chart rows={d.rows as ChartRow[]} max={Number(d.max) || 1} />
    case 'schedule':
      return <Steps item={itemOf(d)} copy={c as unknown as StepsCopy} />
    case 'haggle':
      return <Haggle item={itemOf(d)} copy={c} words={logWords(copy)} />
    case 'scenarios':
      return <ScenarioBrowser groups={d.groups as ScenarioGroup[]} items={d.items as Scenario[]} copy={c} />
    case 'passk':
      return <Passk copy={c as unknown as PasskCopy} ks={Array.isArray(d.ks) ? (d.ks as number[]) : undefined} p0={typeof d.p === 'number' ? d.p : undefined} />
    case 'before-after':
      return <BeforeAfter before={c.before} after={c.after} labels={{ before: copy.instrBefore, after: copy.instrAfter }} />
    default:
      return null
  }
}

/** A figure in its frame: a box that draws on first view, then the words under it. */
function Framed({ f, copy, body }: { f: FigureData; copy: Copy; body: boolean }) {
  const inner = draw(f, copy)
  if (!inner) return null
  return (
    <>
      <Drawn className="lab-instr box" data-box="" data-instrument={f.instrument}>
        {inner}
      </Drawn>
      <Under f={f} as={body ? 'figcaption' : 'p'} />
    </>
  )
}

/** `::figure{of}` in a body: the figure, framed, with its caption as the `<figcaption>`. */
export function Figure({ of, figure }: { of: string; figure?: FigureData }) {
  const lab = getLab()
  if (!figure) return <figure data-figure={of} />
  return (
    <figure data-figure={of} className="lab-figure" data-wide={figure.instrument === 'compare' || figure.instrument === 'spec-table' ? '' : undefined}>
      <Framed f={figure} copy={lab.copy} body />
    </figure>
  )
}

/** Which note writes up each of a study's topics: topic id → its page. */
function topicNotes(studyId: string): Record<string, { href: string; id: string }> {
  const out: Record<string, { href: string; id: string }> = {}
  for (const e of getLab().entries)
    if (e.kind === 'note' && e.parent === studyId && e.topic && !e.draft && e.published) out[e.topic] = { href: pathOf(e), id: e.id }
  return out
}

/** A study's status words, by status, from the copy (`statusDone` …). */
const statusWords = (c: Copy) => Object.fromEntries(['done', 'doing', 'todo', 'parked', 'later'].map((s) => [s, c[`status${s[0].toUpperCase()}${s.slice(1)}`] ?? s]))

export function Lead({ entry: e, name, copy, figures, study, chapters, rendered }: LeadProps) {
  const today = bareillyToday()
  switch (name) {
    case 'board':
      return study ? (
        <Drawn className="lab-instr box" data-box="" data-instrument="board">
          <Board
            study={study}
            notes={topicNotes(e.id)}
            today={today}
            labels={{ label: copy.boardLabel, key: copy.boardKey, track: copy.topicTrack, hours: copy.instrHours, note: copy.topicNote, status: statusWords(copy) }}
          />
        </Drawn>
      ) : null
    case 'logline': {
      const last = e.kind === 'study' ? e.log?.[e.log.length - 1] : undefined
      return last ? <Logline did={last.did} date={<time dateTime={last.date}>{formatDay(last.date, today)}</time>} /> : null
    }
    case 'progress':
      return chapters?.length ? (
        <Drawn className="lab-instr box" data-box="" data-instrument="progress">
          <SeriesProgress chapters={chapters} label={copy.progressSeries} />
        </Drawn>
      ) : e.kind === 'series' && e.premise ? (
        <Logline did={e.premise} />
      ) : null
    case 'instrument': {
      const fig = figures[e.lead?.of ?? e.id]
      if (fig) {
        const intro = !e.leadIntro ? words(fig.data.copy).intro : undefined
        return (
          <>
            {intro ? <p className="lab-lead-intro">{intro}</p> : null}
            <Framed f={fig} copy={copy} body={false} />
          </>
        )
      }
      return rendered.keyLine ? <Keyline>{rendered.keyLine}</Keyline> : null
    }
    case 'keyline':
      return <Keyline>{rendered.keyLine}</Keyline>
    case 'demo':
      return e.lead?.demo ? <Demo demo={e.lead.demo} labels={{ pause: copy.instrPause, play: copy.instrPlay }} /> : null
    case 'screens':
      return e.lead?.images?.length ? (
        <Screens images={e.lead.images} labels={{ label: fill(copy.carLabel, { title: e.title }), prev: copy.carPrev, next: copy.carNext, pos: copy.carPos }} />
      ) : null
    case 'figure': {
      const fig = e.lead?.figure ? figures[e.lead.of ?? e.id] ?? figures[e.lead.figure] : undefined
      return fig ? <Framed f={fig} copy={copy} body={false} /> : null
    }
    case 'install':
      return e.kind === 'build' && e.install ? (
        <Drawn className="lab-instr box" data-box="" data-instrument="install">
          <Install command={e.install} labels={{ copy: copy.instrCopy, copied: copy.instrCopied }} />
        </Drawn>
      ) : null
    case 'result':
      return e.kind === 'experiment' ? (
        <Drawn className="lab-instr box" data-box="" data-instrument="result">
          <Result result={e.result} against={copy.instrAgainst} />
        </Drawn>
      ) : null
    case 'cover':
      return e.lead?.cover ? <Cover image={e.lead.cover} /> : null
    case 'opening':
      return <Opening>{rendered.opening}</Opening>
    default:
      return null
  }
}
