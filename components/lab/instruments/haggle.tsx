'use client'

import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { createShop, evaluate, gap, LEAK_GAP, parseOffer, type Decision, type Item, type Shop } from '@/lib/lab/haggle'
import { fill } from '@/lib/lab/view'
import { prefersReducedMotion } from '@/lib/motion/reduced'

import { at } from './draw'
import { cue, useEnter, useLeadUse } from './live'
import { rupees } from './text'

/** The figure's own words (`lab-figures.json` → `data.copy`); schemas.ts lists the ones it must have. */
export type HaggleCopy = Record<string, string>

/** The Lab's words for the agent's log (lab.json `copy`, `instrLog*`). */
export interface LogWords {
  context: string
  system: string
  item: string
  tools: string
  returns: string
  blind: string
  told: string
  shop: string
  itemLine: string
  floor: string
  call: string
  offer: string
  accept: string
  agreed: string
  counter: string
  toolsB: string
  toolsA: string
  transcript: string
}

type Mode = 'B' | 'A'
type Said = { who: 'shop' | 'you'; text: string } | { who: 'end'; deal: string; more: string }
type Line = Said & { id: number }

/** One round as the agent's log prints it, in the mode the reader picked. */
function logRound(d: Decision, item: Item, mode: Mode, w: LogWords, decides: string) {
  const res = d.action === 'accept' ? w.accept : d.action === 'agreed' ? fill(w.agreed, { price: rupees(d.price) }) : fill(w.counter, { price: rupees(d.price) })
  return mode === 'B'
    ? { head: fill(w.call, { id: item.id, offer: rupees(d.offer), round: d.round }), key: w.returns, res }
    : { head: fill(w.offer, { offer: rupees(d.offer), round: d.round }), key: decides, res }
}

/**
 * Chapter 05's lead: haggle for the 20W charger against the Shopkeeper spec's pricing logic, and
 * watch what the agent sees. Every reply comes from `lib/lab/haggle.ts`, the spec's rules as one
 * pure module, running in the browser: no model, no network, and the caption says so. Shop lines are
 * the figure's illustrative words; the prices are the rules'.
 *
 * Left, the call: the shop's opening line, your offers and its answers, and the offer box. Right,
 * the agent's log: its context and one `evaluate_offer` round per offer, with a switch between the
 * spec's two architectures (B, the chosen one, where the agent never sees the floor; A, where it is
 * in the prompt). A counter fires `lab:cue` `counter`, a deal `deal` (API.md §7); the sound lane
 * plays them. Each list scrolls on its own and keeps its newest line in view.
 *
 * Server-rendered in its opening state, so with JavaScript off it reads as the opening line, the
 * agent's context and how the toy decides, with the offer box and the switch hidden.
 */
export function Haggle({ item, copy, words }: { item: Item; copy: HaggleCopy; words: LogWords }) {
  const [shop, setShop] = useState<Shop>(() => createShop(item))
  const [rounds, setRounds] = useState<Decision[]>([])
  const [lines, setLines] = useState<Line[]>(() => [{ id: 0, who: 'shop', text: copy.open }])
  const [mode, setMode] = useState<Mode>('B')
  const [value, setValue] = useState('')
  const [scrolls, setScrolls] = useState({ talk: false, log: false })
  const nextId = useRef(1)
  const talk = useRef<HTMLOListElement>(null)
  const log = useRef<HTMLPreElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const uid = useId()
  const enter = useEnter()
  const used = useLeadUse('haggle')

  // keep the newest line in view, in both lists; a list that scrolls becomes a tab stop (it must
  // be reachable by keyboard to be scrolled)
  useLayoutEffect(() => {
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
    for (const el of [talk.current, log.current]) if (el && el.scrollHeight > el.clientHeight) el.scrollTo({ top: el.scrollHeight, behavior })
  }, [lines, rounds, mode])
  useEffect(() => {
    const measure = () => {
      const over = (el: HTMLElement | null) => !!el && el.scrollHeight > el.clientHeight + 1
      setScrolls((s) => {
        const n = { talk: over(talk.current), log: over(log.current) }
        return n.talk === s.talk && n.log === s.log ? s : n
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    for (const el of [talk.current, log.current]) if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [lines, rounds, mode])

  const add = (...ls: Said[]) => setLines((prev) => [...prev, ...ls.map((l) => ({ ...l, id: nextId.current++ }))])

  const reset = () => {
    setShop(createShop(item))
    setRounds([])
    setLines([{ id: nextId.current++, who: 'shop', text: copy.open }])
    setValue('')
    input.current?.focus()
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const o = parseOffer(value)
    if (o === null) {
      add({ who: 'shop', text: copy.bad })
      return
    }
    used()
    setValue('')
    const { shop: next, decision: d } = evaluate(shop, o)
    const firstDeal = d.action === 'accept' && shop.agreed === null
    setShop(next)
    setRounds((r) => [...r, d])
    const said: Said[] = [{ who: 'you', text: rupees(o) }]
    if (d.action === 'accept') {
      said.push({ who: 'shop', text: fill(copy.accept, { p: d.price }) })
      cue('deal')
    } else if (d.action === 'agreed') {
      said.push({ who: 'shop', text: fill(copy.agreed, { p: d.price }) })
    } else {
      said.push({ who: 'shop', text: d.action === 'hold' ? fill(copy.hold, { c: d.price }) : fill(copy[`counter${Math.min(3, d.concession ?? 0)}`], { c: d.price }) })
      cue('counter')
    }
    if (firstDeal) {
      const g = gap(next)
      const found = g !== null && g <= LEAK_GAP && copy.found ? fill(copy.found, { r: d.price - g, g }) : ''
      said.push({ who: 'end', deal: fill(copy.deal, { p: d.price }), more: [found, copy.b13 ?? ''].filter(Boolean).join(' ') })
    }
    add(...said)
  }

  const shown = rounds.map((d) => logRound(d, item, mode, words, copy.decides ?? words.returns))
  const ctx: [string, ReactNode][] = [
    [words.system, fill(mode === 'B' ? words.blind : words.told, { shop: words.shop })],
    [
      words.item,
      <>
        {fill(words.itemLine, { id: item.id, name: item.name, list: rupees(item.list) })}
        {mode === 'A' ? (
          <>
            {' · '}
            <mark className="lab-hg-floor" data-floor="">{fill(words.floor, { floor: rupees(item.floor) })}</mark>
          </>
        ) : null}
      </>,
    ],
    [words.tools, mode === 'B' ? words.toolsB : words.toolsA],
  ]

  return (
    <div className="lab-hg">
      <div className="lab-hg-shop">
        <p className="lab-instr-q" data-draw="in" style={at(0)}>
          {copy.q}
        </p>
        <ol ref={talk} className="lab-hg-talk lab-scroll" aria-label={words.transcript} aria-live="polite" tabIndex={scrolls.talk ? 0 : undefined} data-scrolls={scrolls.talk ? '' : undefined} data-lenis-prevent>
          <AnimatePresence initial={false}>
            {lines.map((l) =>
              l.who === 'end' ? (
                <m.li key={l.id} className="lab-hg-end" data-who="end" {...enter} exit={undefined}>
                  <p>
                    <strong>{l.deal}</strong> {l.more}
                  </p>
                  <button type="button" className="lab-chip" onClick={reset}>
                    {copy.again}
                  </button>
                </m.li>
              ) : (
                <m.li key={l.id} data-who={l.who} {...enter} exit={undefined}>
                  <span className="lab-hg-who">{l.who === 'you' ? copy.you : copy.shop}</span>
                  <span className="lab-hg-said">{l.text}</span>
                </m.li>
              ),
            )}
          </AnimatePresence>
        </ol>
        <form className="lab-hg-form" onSubmit={onSubmit} noValidate data-needs-js data-draw="in" style={at(3)}>
          <label className="lab-hg-field" htmlFor={uid}>
            <span aria-hidden="true">₹</span>
            <input
              ref={input}
              id={uid}
              name="offer"
              aria-label={copy.label}
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="send"
              maxLength={9}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <button type="submit" className="lab-chip lab-chip-solid">
            {copy.offer}
          </button>
        </form>
        {copy.illus ? (
          <p className="meta" data-draw="in" style={at(4)}>
            {copy.illus}
          </p>
        ) : null}
      </div>

      <div className="lab-hg-agent">
        <div className="lab-hg-agent-head" data-draw="in" style={at(2)}>
          <p className="lab-hg-sees">{copy.sees}</p>
          <div className="lab-seg lab-hg-ab" role="group" aria-label={copy.abLabel} data-needs-js>
            {(['B', 'A'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={mode === k} onClick={() => {
                  used()
                  setMode(k)
                }}>
                {k === 'B' ? copy.abB : copy.abA}
              </button>
            ))}
          </div>
        </div>
        <pre ref={log} style={at(4)} data-draw="in" className="lab-hg-log lab-scroll" data-tool-log data-mode={mode} tabIndex={scrolls.log ? 0 : undefined} data-lenis-prevent>
          <span className="lab-hg-line">
            <span className="lab-hg-k">{words.context}</span>
          </span>
          {ctx.map(([k, v]) => (
            <span key={k} className="lab-hg-line" data-in="">
              <span className="lab-hg-k">{k.padEnd(7)}</span> {v}
              {'\n'}
            </span>
          ))}
          {shown.map((r, i) => (
            <span key={i} className="lab-hg-round" data-round={rounds[i].round} data-action={rounds[i].action} data-price={rounds[i].price} data-fresh={i === shown.length - 1 ? '' : undefined}>
              <span className="lab-hg-line">
                {r.head}
                {'\n'}
              </span>
              <span className="lab-hg-line" data-in="">
                <span className="lab-hg-k">{r.key}</span> {r.res}
                {'\n'}
              </span>
            </span>
          ))}
        </pre>
      </div>
    </div>
  )
}
