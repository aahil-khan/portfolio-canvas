'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PostControls, useBoard } from '@/components/apps/games/board'
import { useMeasuring } from '@/components/desktop/measuring-context'
import { scoreboard, typing } from '@/content/arcade'
import { recordBest } from '@/lib/best'
import { play } from '@/lib/audio'
import { formatScore } from '@/lib/scores'

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
  const sink = useRef<HTMLInputElement>(null)

  const words = useMemo(() => quote.split(' '), [quote])
  const typedWords = typed.split(' ')

  /*
   * The quote, exploded to characters with their absolute index in the quote.
   *
   * Words stay grouped so a word can be `white-space: nowrap` and never break mid-word; the
   * space that follows each one is its own cell, outside that group, so it remains a wrap
   * opportunity and can still hold the caret.
   */
  const cells = useMemo(() => {
    let i = 0
    return words.map((w, wi) => {
      const chars = [...w].map((ch) => ({ ch, i: i++ }))
      const space = wi < words.length - 1 ? { ch: ' ', i: i++ } : null
      return { chars, space }
    })
  }, [words])
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

  /* `now` is advanced by the interval and by every keystroke; reading the clock during render
   * would be impure and would drift between renders that happen for other reasons. */
  const elapsed = startedAt === null ? 0 : Math.max(0, now - startedAt) / 1000

  /*
   * Correct characters, compared position by position against the quote.
   *
   * This used to count whole words only, which meant nothing on screen moved until you finished
   * one — WPM sat still mid-word and accuracy dipped for every character of a word you were
   * typing perfectly. Per-character is also what the display now shows, and the two disagreeing
   * was the actual bug.
   */
  const correctChars = useMemo(() => {
    let n = 0
    for (let i = 0; i < typed.length && i < quote.length; i++) {
      if (typed[i] === quote[i]) n += 1
    }
    return n
  }, [typed, quote])

  const wpm = elapsed > 0.5 ? Math.round(correctChars / 5 / (elapsed / 60)) : 0
  const accuracy = typed.length ? Math.round((correctChars / typed.length) * 100) : 100

  /* Personal best and the shared board plumbing. Only a completed run is offered up. */
  const board = useBoard('typing', finished ? wpm : 0)

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
    sink.current?.focus()
  }, [])


  return (
    <div className="game" data-keys tabIndex={-1}>
      {/*
        * The key sink lies directly on top of the quote instead of off at `left: -9999px`.
        *
        * Two reasons, both only visible on a phone. Focusing an off-screen input makes the
        * browser scroll to reveal it, which threw the card sideways the moment you started; and
        * a tap has to land on the input itself to raise the keyboard reliably — routing it
        * through a click handler on the text is a bet on synthesised events that does not always
        * pay out. Laid over the quote, the tap simply hits the input.
        */}
      <div className="type__field">
        <div className="type__quote">
          {cells.map((cell, wi) => {
            const cellFor = ({ ch, i }: { ch: string; i: number }) => (
              <span
                key={i}
                className="type__c"
                data-s={i < typed.length ? (typed[i] === ch ? 'ok' : 'bad') : undefined}
                /* the caret sits before the next character owed, and only while a run is live */
                data-caret={i === typed.length && !finished ? true : undefined}
              >
                {ch}
              </span>
            )
            return (
              <span key={wi} className="type__w">
                <span className="type__word">{cell.chars.map(cellFor)}</span>
                {cell.space ? cellFor(cell.space) : null}
              </span>
            )
          })}
          {/* overtyping past the end still needs somewhere to show the caret */}
          {typed.length >= quote.length && !finished ? (
            <span className="type__c" data-caret />
          ) : null}
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
          /* the quotes are deliberately lowercase; a phone keyboard capitalises the first letter
             of every one of them otherwise, and the first word can never be typed correctly */
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>

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
        <div className="stat">
          <b>{formatScore('typing', board.best)}</b>
          <span>{scoreboard.yours}</span>
        </div>
      </div>

      {/* one row, always present — swapping in the post controls must not change the height */}
      <div className="game__foot">
        {finished ? (
          <>
            <PostControls board={board} />
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
            const s = board.rows[i]
            return (
              <li key={i} data-empty={s ? undefined : true}>
                <span className="rk">{i + 1}</span>
                <span className="who">{s?.name ?? ''}</span>
                <span className="wpm">{s ? s.value : ''}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
