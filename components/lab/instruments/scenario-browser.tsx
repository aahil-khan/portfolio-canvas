'use client'

import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useId, useRef, useState, type KeyboardEvent } from 'react'

import { listMove } from '@/lib/lab/instruments/scenarios'

import { at } from './draw'
import { useEnter, useLeadUse, useReady } from './live'

export interface Scenario {
  g: string
  id: string
  who: string
  wants: string
  pays?: string
  expected: 'SALE' | 'NO_SALE' | 'SALE_OK'
  checks?: string
  note?: string
  v0?: boolean
}
export interface ScenarioGroup {
  id: string
  name: string
}
export type ScenarioCopy = Record<string, string>

const outcome = (copy: ScenarioCopy, x: Scenario) => copy[x.expected.replace('_', '')] ?? x.expected

/** One scenario in full: who, what they want and will pay, what is checked. The same words with JavaScript on or off. */
function Card({ x, copy }: { x: Scenario; copy: ScenarioCopy }) {
  return (
    <>
      <p className="lab-scn-head">
        <span className="lab-scn-id" data-num>
          {x.id}
        </span>
        <span className="lab-scn-out" data-expected={x.expected}>
          {outcome(copy, x)}
        </span>
      </p>
      <p className="lab-scn-who">{x.who}</p>
      <dl className="lab-scn-facts">
        <div>
          <dt>{copy.wants}</dt>
          <dd>{x.wants}</dd>
        </div>
        {x.pays ? (
          <div>
            <dt>{copy.pays}</dt>
            <dd>{x.pays}</dd>
          </div>
        ) : null}
        {x.checks ? (
          <div>
            <dt>{copy.checked}</dt>
            <dd>{x.checks}</dd>
          </div>
        ) : null}
      </dl>
      {x.note ? <p className="lab-scn-note meta">{x.note}</p> : null}
      {!x.v0 && copy.deferred ? <p className="lab-scn-later meta">{copy.deferred}</p> : null}
    </>
  )
}

/**
 * Chapter 07's lead: the spec's 35 scenarios, browsed. Three group buttons (with how many each
 * holds), the group's one line, then a list of its customers beside the one picked, opened in
 * full: who they are, what they want, what they will pay, and what the run is checked for. The
 * list is **one tab stop**: the arrow keys (and Home, End) move the pick, which the card follows;
 * the list scrolls on its own when the group is long. On a phone the card sits above the list.
 *
 * With JavaScript off every group is printed in full instead, card after card, so nothing in the
 * browser is out of reach; the buttons and the list, which need JavaScript, are not shown.
 */
export function ScenarioBrowser({ groups, items, copy }: { groups: ScenarioGroup[]; items: Scenario[]; copy: ScenarioCopy }) {
  const [group, setGroup] = useState(groups[0]?.id ?? '')
  const [picked, setPicked] = useState(() => items.find((x) => x.g === groups[0]?.id)?.id ?? '')
  const [touched, setTouched] = useState(false)
  const ready = useReady()
  const uid = useId()
  const enter = useEnter()
  const used = useLeadUse('scenarios')
  const card = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const inGroup = items.filter((x) => x.g === group)
  const current = inGroup.find((x) => x.id === picked) ?? inGroup[0]
  const optId = (id: string) => `${uid}-${id}`

  const pick = (id: string, from: 'key' | 'pointer') => {
    setTouched(true)
    used()
    setPicked(id)
    const opt = document.getElementById(optId(id))
    opt?.scrollIntoView({ block: 'nearest' })
    // on a phone the card is above the list: bring it into view when a tap picks a new one
    if (from === 'pointer' && card.current) {
      const r = card.current.getBoundingClientRect()
      if (r.top < 64 || r.bottom > innerHeight) card.current.scrollIntoView({ block: 'nearest' })
    }
  }
  const onKey = (e: KeyboardEvent) => {
    const next = listMove(
      inGroup.map((x) => x.id),
      current?.id ?? '',
      e.key,
    )
    if (next === null) return
    e.preventDefault()
    pick(next, 'key')
  }
  const showGroup = (id: string) => {
    if (id === group) return
    setTouched(true)
    used()
    setGroup(id)
    setPicked(items.find((x) => x.g === id)?.id ?? '')
    list.current?.scrollTo({ top: 0 })
  }
  const line = (g: string) => copy[`line${g}`]

  return (
    <div className="lab-scn">
      <div className="lab-scn-live" data-needs-js>
        <div className="lab-seg lab-scn-groups" role="group" aria-label={copy.groups}>
          {groups.map((g) => (
            <button key={g.id} type="button" aria-pressed={g.id === group} onClick={() => showGroup(g.id)}>
              <span>{g.name}</span>
              <span className="lab-scn-n" data-num>
                {items.filter((x) => x.g === g.id).length}
              </span>
            </button>
          ))}
        </div>
        {line(group) ? (
          <p className="lab-scn-line" aria-live="polite">
            {line(group)}
          </p>
        ) : null}
        <div className="lab-scn-panes">
          <ul
            ref={list}
            className="lab-scn-list lab-scroll"
            role="listbox"
            aria-label={copy.list}
            tabIndex={ready ? 0 : undefined}
            aria-activedescendant={ready && current ? optId(current.id) : undefined}
            onKeyDown={onKey}
            data-lenis-prevent
          >
            {inGroup.map((x, i) => (
              <li
                key={x.id}
                id={optId(x.id)}
                role="option"
                aria-selected={x.id === current?.id}
                className="lab-scn-opt"
                data-draw={touched ? undefined : 'in'}
                style={at(Math.min(i, 10))}
                onClick={() => pick(x.id, 'pointer')}
              >
                <span className="lab-scn-id" data-num>
                  {x.id}
                </span>
                <span className="lab-scn-opt-who">{x.who}</span>
              </li>
            ))}
          </ul>
          <div ref={card} className="lab-scn-card">
            <AnimatePresence initial={false} mode="wait">
              {current ? (
                <m.div key={current.id} className="lab-scn-card-in" initial={touched ? enter.initial : false} animate={enter.animate} exit={enter.exit}>
                  <Card x={current} copy={copy} />
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="lab-scn-all" data-no-js>
        {groups.map((g) => (
          <div key={g.id} className="lab-scn-group">
            <p className="end-h">{g.name}</p>
            {line(g.id) ? <p className="lab-scn-line">{line(g.id)}</p> : null}
            <ul className="lab-scn-cards">
              {items
                .filter((x) => x.g === g.id)
                .map((x) => (
                  <li key={x.id} className="lab-scn-card-in">
                    <Card x={x} copy={copy} />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      {copy.foot ? <p className="lab-scn-foot meta">{copy.foot}</p> : null}
    </div>
  )
}
