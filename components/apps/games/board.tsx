'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { useMeasuring } from '@/components/desktop/measuring-context'
import { scoreboard, type BoardId } from '@/content/arcade'
import { play } from '@/lib/audio'
import { getBestServerSnapshot, getBestSnapshot, subscribeBest } from '@/lib/best'
import {
  beats,
  fetchBoard,
  formatScore,
  getPlayerServerSnapshot,
  getPlayerSnapshot,
  postScore,
  setPlayerName,
  subscribePlayer,
  type BoardScore,
} from '@/lib/scores'

/**
 * The scoreboard every arcade game carries: your best, and the best anyone has posted.
 *
 * One hook and two small components rather than four copies, because the four games disagree
 * about almost everything else — a grid, a snake, a tile board, a quote — and the one thing they
 * should not disagree about is what a score looks like.
 *
 * The two pieces are handed back separately on purpose. `ScoreStats` is a fixed-height block that
 * sits above each game's foot; `PostControls` goes *inside* the existing foot row, replacing the
 * hint once a run is over. Card heights here are measured once from real content and reused for
 * collision avoidance and framing, so a control that appears mid-game has to take the place of
 * something rather than push the card taller than it was measured.
 */

type Status = 'idle' | 'posting' | 'posted' | 'failed'

export function useBoard(game: BoardId, value: number) {
  const measuring = useMeasuring()
  const bests = useSyncExternalStore(subscribeBest, getBestSnapshot, getBestServerSnapshot)
  const [rows, setRows] = useState<BoardScore[]>([])
  const [status, setStatus] = useState<Status>('idle')

  const best = bests[game] ?? 0

  /*
   * The name field, seeded from the last name this browser posted under.
   *
   * `draft` starts null rather than being seeded from storage, and the field falls back to the
   * store until the visitor actually types. Seeding it would mean either reading localStorage
   * during render (a hydration mismatch) or writing state from an effect (a cascading render on
   * every mount) — the two things `lib/best.ts` exists to avoid.
   */
  const stored = useSyncExternalStore(subscribePlayer, getPlayerSnapshot, getPlayerServerSnapshot)
  const [draft, setDraft] = useState<string | null>(null)
  const name = draft ?? stored

  useEffect(() => {
    if (measuring) return
    let live = true
    fetchBoard(game)
      .then((next) => live && setRows(next))
      .catch(() => {
        /* the game is entirely playable without a board */
      })
    return () => {
      live = false
    }
  }, [measuring, game])

  /*
   * A fresh run re-arms the post button, so a second good score can also go up.
   *
   * Adjusted during render rather than from an effect: this is state derived from a prop
   * changing, which React documents as a render-time adjustment, and routing it through an
   * effect would both trip the lint rule and paint one frame with a stale button.
   */
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (value === 0 && status !== 'idle') setStatus('idle')
  }

  const post = useCallback(async () => {
    if (status === 'posting' || status === 'posted' || value <= 0) return
    setStatus('posting')
    const who = name.trim()
    if (who) setPlayerName(who)
    const next = await postScore(game, who, value).catch(() => null)
    if (!next) {
      setStatus('failed')
      return
    }
    setRows(next)
    setStatus('posted')
    play('tick')
  }, [game, name, value, status])

  const world = rows[0] ?? null

  return {
    /** This visitor's stored best, 0 before they have ever finished a run. */
    best,
    /** The whole top-N, for the one game that shows a list rather than a single number. */
    rows,
    /** The single best score anyone has posted, or null while it loads or if nobody has. */
    world,
    /** True when the world record on the board was posted under this browser's name. */
    isMine: !!world && !!name.trim() && world.name === name.trim(),
    /** True when the run just finished would improve this visitor's own stored best. */
    isPersonalBest: beats(game, value, best),
    /** True when the run just finished would take the world record. */
    isWorldBest: !!value && (!world || beats(game, value, world.value)),
    name,
    setName: setDraft,
    status,
    post,
  }
}

export type Board = ReturnType<typeof useBoard>

/** The three-up strip: this run, your best, the world's best. Fixed height in every state. */
export function ScoreStats({
  game,
  value,
  board,
  runLabel,
}: {
  game: BoardId
  value: number
  board: Board
  /** Overrides the first column's label — Minesweeper measures a run, not a score. */
  runLabel?: string
}) {
  const { best, world, isMine } = board
  return (
    <div className="stats">
      <div className="stat">
        <b>{formatScore(game, value)}</b>
        <span>{runLabel ?? scoreboard.score}</span>
      </div>
      <div className="stat">
        <b>{formatScore(game, best)}</b>
        <span>{scoreboard.yours}</span>
      </div>
      <div className="stat stat--world" data-mine={isMine || undefined}>
        <b>
          {formatScore(game, world?.value)}
          {world ? (
            isMine ? (
              <span className="crown">{scoreboard.mine}</span>
            ) : (
              <i className="who">— {world.name}</i>
            )
          ) : null}
        </b>
        <span>{scoreboard.world}</span>
      </div>
    </div>
  )
}

/**
 * Name field and post button, for the game's own foot row.
 *
 * Rendered only once a run is over — its caller swaps it in for the hint, so the row it lives in
 * keeps the height it was measured at.
 */
export function PostControls({ board }: { board: Board }) {
  const { name, setName, status, post } = board
  const label =
    status === 'posting'
      ? scoreboard.posting
      : status === 'posted'
        ? scoreboard.posted
        : status === 'failed'
          ? scoreboard.failed
          : scoreboard.submit
  return (
    <>
      <input
        className="game__name"
        name="player"
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 24))}
        placeholder={scoreboard.namePlaceholder}
        aria-label={scoreboard.namePlaceholder}
      />
      <button
        type="button"
        className="btn btn--go"
        onClick={post}
        disabled={status === 'posting' || status === 'posted'}
      >
        {label}
      </button>
    </>
  )
}
