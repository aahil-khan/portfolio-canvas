'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useMeasuring } from '@/components/desktop/measuring-context'
import { typing } from '@/content/arcade'
import { recordBest } from '@/lib/best'
import { play } from '@/lib/audio'

interface Score {
  name: string
  wpm: number
  at: number
}

/** Reserved rows on the leaderboard, so the card's height never depends on how many exist. */
const BOARD_ROWS = 5

function pickQuote(): string {
  return typing.quotes[Math.floor(Math.random() * typing.quotes.length)]
}

/**
 * A typing test.
 *
 * The key sink is a real, visually hidden `<input>`. That is not a detail: the canvas binds bare
 * single letters as shortcuts, and its guard only lets an event past if the target is literally
 * an input or textarea. On a focusable div, typing "f" would fit the canvas and "-" would zoom
 * out. `data-keys` on the wrapper covers the same ground for anything that isn't the input.
 *
 * Every region has a fixed height — the quote box, the stats, the action row, the board — because
 * card heights are measured once and reused for collision avoidance and framing.
 */
export function TypingTest() {
  const measuring = useMeasuring()
  // explicit <string>: the content file is `as const`, so this would otherwise be a literal type
  const [quote, setQuote] = useState<string>(typing.quotes[0])
  const [typed, setTyped] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [scores, setScores] = useState<Score[] | null>(null)
  const [name, setName] = useState('')
  const [posted, setPosted] = useState(false)
  const sink = useRef<HTMLInputElement>(null)

  const words = useMemo(() => quote.split(' '), [quote])
  const typedWords = typed.split(' ')
  const finished = typed.length > 0 && typedWords.length === words.length && typedWords[words.length - 1] === words[words.length - 1]

  /*
   * The first quote is always quotes[0], and Restart randomises.
   *
   * Randomising on mount would need either an impure render (server and client disagree, and
   * hydration blows up) or a setState in an effect, which cascades a second render on every
   * open. Deterministic first, random thereafter, costs one dull repeat and no correctness.
   */

  // ticking clock, only while a run is actually in progress
  useEffect(() => {
    if (measuring || startedAt === null || finished) return
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [measuring, startedAt, finished])

  useEffect(() => {
    if (measuring) return
    let live = true
    fetch('/api/scores?game=typing')
      .then((r) => r.json())
      .then((d: { scores?: Score[] }) => live && setScores(d.scores ?? []))
      .catch(() => live && setScores([]))
    return () => {
      live = false
    }
  }, [measuring])

  /* `now` is advanced by the interval and by every keystroke; reading the clock during render
   * would be impure and would drift between renders that happen for other reasons. */
  const elapsed = startedAt === null ? 0 : Math.max(0, now - startedAt) / 1000

  /* Correct characters, counted the way every typing test does: whole words only. */
  const correctChars = useMemo(() => {
    const tw = typed.split(' ')
    let n = 0
    for (let i = 0; i < tw.length; i++) {
      if (tw[i] === words[i]) n += words[i].length + (i < tw.length - 1 ? 1 : 0)
    }
    return n
  }, [typed, words])

  const wpm = elapsed > 0.5 ? Math.round(correctChars / 5 / (elapsed / 60)) : 0
  const accuracy = typed.length ? Math.round((correctChars / typed.length) * 100) : 100

  const onType = useCallback(
    (value: string) => {
      if (finished) return
      if (startedAt === null && value.length > 0) {
        setStartedAt(Date.now())
        setNow(Date.now())
      }
      setNow(Date.now())
      setTyped(value)
    },
    [finished, startedAt],
  )

  // one-shot side effects when a run completes
  const settled = useRef(false)
  useEffect(() => {
    if (!finished || settled.current) return
    settled.current = true
    play('score')
    if (wpm > 0) recordBest('typing', wpm)
  }, [finished, wpm])

  const restart = useCallback(() => {
    settled.current = false
    setQuote(pickQuote())
    setTyped('')
    setStartedAt(null)
    setNow(0)
    setPosted(false)
    sink.current?.focus()
  }, [])

  const post = useCallback(async () => {
    if (posted || wpm <= 0) return
    setPosted(true)
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'typing', name: name.trim(), wpm }),
      })
      const data = (await res.json()) as { scores?: Score[] }
      if (data.scores) setScores(data.scores)
      play('tick')
    } catch {
      // the run still counted locally; the board just didn't take it
    }
  }, [posted, wpm, name])

  const board = scores ?? []

  return (
    <div className="game" data-keys tabIndex={-1}>
      {/* clicking the text focuses the hidden input that actually receives the keystrokes */}
      <div className="type__quote" onClick={() => sink.current?.focus()}>
        {words.map((w, i) => {
          const state =
            i < typedWords.length - 1
              ? typedWords[i] === w
                ? 'ok'
                : 'bad'
              : i === typedWords.length - 1 && !finished
                ? 'now'
                : undefined
          return (
            <span key={i} className="type__w" data-s={state}>
              {w}{' '}
            </span>
          )
        })}
      </div>

      <input
        ref={sink}
        className="type__sink"
        name="typed"
        value={typed}
        onChange={(e) => onType(e.target.value)}
        aria-label={typing.hint}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />

      <div className="stats">
        <div className="stat">
          <b>{wpm}</b>
          <span>{typing.wpm}</span>
        </div>
        <div className="stat">
          <b>{accuracy}%</b>
          <span>{typing.accuracy}</span>
        </div>
        <div className="stat">
          <b>{elapsed.toFixed(1)}s</b>
          <span>{typing.elapsed}</span>
        </div>
      </div>

      {/* one row, always present — swapping in the post controls must not change the height */}
      <div className="game__foot">
        {finished ? (
          <>
            <input
              className="type__name"
              name="player"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 24))}
              placeholder={typing.namePlaceholder}
              aria-label={typing.namePlaceholder}
            />
            <button type="button" className="btn" onClick={post} disabled={posted}>
              {posted ? typing.posted : typing.submit}
            </button>
            <button type="button" className="btn" onClick={restart}>
              {typing.done}
            </button>
          </>
        ) : (
          <>
            <span className="game__hint">{typing.hint}</span>
            <button type="button" className="btn" onClick={restart}>
              {typing.restart}
            </button>
          </>
        )}
      </div>

      <div className="lead__wrap">
        <div className="lead__title">{typing.boardTitle}</div>
        <ol className="lead">
          {Array.from({ length: BOARD_ROWS }, (_, i) => {
            const s = board[i]
            return (
              <li key={i} data-empty={s ? undefined : true}>
                <span className="rk">{i + 1}</span>
                <span className="who">{s?.name ?? ''}</span>
                <span className="wpm">{s ? s.wpm : ''}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
