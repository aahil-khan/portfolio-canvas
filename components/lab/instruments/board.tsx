'use client'

import * as m from 'motion/react-m'
import Link from 'next/link'
import { useId, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'

import { boardMove, boardRows, defaultTopic, topicFill } from '@/lib/lab/instruments/board'
import type { StudyData } from '@/lib/lab/types'
import { fill, formatDay } from '@/lib/lab/view'

import { at } from './draw'
import { useEnter, useLeadUse, useReady } from './live'

export interface BoardLabels {
  label: string
  key: string
  track: string
  hours: string
  note: string
  /** status words, by status */
  status: Record<string, string>
}

/**
 * A study's board (`board`): one square per topic, a row per track. A done square is solid, one
 * under way is filled by its hours over the estimate with a dashed edge, the rest are outlines.
 * Hovering or tapping a square shows that topic underneath: its track and phase, where it stands,
 * the hours, what it taught, and its note when there is one. The board is **one tab stop**; the
 * arrow keys move across and between the rows (Home and End to a row's ends), and the readout
 * follows. It opens on the topic under way, so the board says something with JavaScript off too,
 * where it is the same picture without the keys.
 */
export function Board({ study, notes, today, labels }: { study: StudyData; notes: Record<string, { href: string; id: string }>; today: string; labels: BoardLabels }) {
  const rows = useMemo(() => boardRows(study), [study])
  const [active, setActive] = useState(() => defaultTopic(study))
  const [focused, setFocused] = useState(false)
  const ready = useReady()
  const uid = useId()
  const used = useLeadUse('board')
  const enter = useEnter()
  // the readout's first topic renders as served; later ones enter
  const [touched, setTouched] = useState(false)

  const topic = study.topics.find((t) => t.id === active)
  const sqId = (id: string) => `${uid}-${id}`
  const pick = (id: string) => {
    if (id === active) return
    setTouched(true)
    used()
    setActive(id)
  }
  const onKey = (e: KeyboardEvent) => {
    const next = boardMove(rows, active, e.key, e.ctrlKey || e.metaKey)
    if (next === null) return
    e.preventDefault()
    pick(next)
  }
  const counts = { done: 0, doing: 0 }
  for (const t of study.topics) if (t.status === 'done' || t.status === 'doing') counts[t.status] += 1

  return (
    <div className="lab-board-wrap">
      <div
        className="lab-board"
        role="grid"
        aria-label={labels.label}
        tabIndex={ready ? 0 : undefined}
        aria-activedescendant={ready && topic ? sqId(topic.id) : undefined}
        data-focus={focused ? '' : undefined}
        onKeyDown={onKey}
        onFocus={(e) => setFocused(e.currentTarget.matches(':focus-visible'))}
        onBlur={() => setFocused(false)}
      >
        {rows.map((row, r) => (
          <div className="lab-board-row" role="row" key={row.track}>
            <span className="lab-board-track meta" role="rowheader">
              {row.track}
            </span>
            <span className="lab-squares">
              {row.topics.map((t, col) => (
                <span
                  key={t.id}
                  id={sqId(t.id)}
                  role="gridcell"
                  className="lab-sq"
                  data-status={t.status}
                  data-active={t.id === active ? '' : undefined}
                  aria-label={`${t.topic}, ${labels.status[t.status] ?? t.status}`}
                  aria-selected={t.id === active}
                  data-draw="pop"
                  style={{ ...at(r + col), '--fill': `${topicFill(t)}%` } as CSSProperties}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && pick(t.id)}
                  onClick={() => pick(t.id)}
                />
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="lab-board-card" aria-live="polite">
        {topic ? (
          <m.div key={topic.id} className="lab-board-card-in" initial={touched ? enter.initial : false} animate={enter.animate}>
            <p className="lab-board-topic">{topic.topic}</p>
            <p className="meta">{fill(labels.track, { track: topic.track, phase: topic.phase })}</p>
            <p className="lab-board-stand">
              <span className="lab-board-status" data-status={topic.status}>
                {labels.status[topic.status] ?? topic.status}
              </span>
              <span className="meta">{fill(labels.hours, { spent: topic.spent, est: topic.est })}</span>
              {topic.finished ? <time dateTime={topic.finished}>{formatDay(topic.finished, today)}</time> : null}
            </p>
            {topic.learn ? <p className="lab-board-learn">{topic.learn}</p> : null}
            {notes[topic.id] ? (
              <p>
                <Link href={notes[topic.id].href} data-preview={`entry:${notes[topic.id].id}`} className="lab-board-note">
                  {labels.note}
                </Link>
              </p>
            ) : null}
          </m.div>
        ) : null}
      </div>

      <p className="meta lab-board-key">{fill(labels.key, { done: counts.done, doing: counts.doing, rest: study.topics.length - counts.done - counts.doing })}</p>
    </div>
  )
}
