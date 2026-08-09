'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { PostControls, ScoreStats, useBoard } from '@/components/apps/games/board'
import { useMeasuring } from '@/components/desktop/measuring-context'
import { mines as C, scoreboard } from '@/content/arcade'
import { recordBest } from '@/lib/best'
import { play } from '@/lib/audio'

interface Cell {
  mine: boolean
  adj: number
  open: boolean
  flag: boolean
  /** The mine that ended the game, so the board can say which one it was. */
  boom?: boolean
  /** A flag on a cell that turned out to be safe, revealed at the end alongside the mines. */
  wrong?: boolean
}

type Status = 'idle' | 'playing' | 'won' | 'lost'

const N = C.cols * C.rows

const blank = (): Cell[] =>
  Array.from({ length: N }, () => ({ mine: false, adj: 0, open: false, flag: false }))

const copy = (cells: Cell[]): Cell[] => cells.map((c) => ({ ...c }))

const neighbours = (i: number): number[] => {
  const x = i % C.cols
  const y = Math.floor(i / C.cols)
  const out: number[] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < C.cols && ny >= 0 && ny < C.rows) out.push(ny * C.cols + nx)
    }
  }
  return out
}

/**
 * Mines are laid AFTER the first click, never on it or its neighbours.
 *
 * Generating up front means the first click can lose instantly, which is not a game so much as a
 * coin toss. Clearing the 3x3 around the opening click also guarantees it cascades, so every
 * game starts with a real board to read rather than a single "1".
 */
function layMines(first: number): Cell[] {
  const cells = blank()
  const banned = new Set([first, ...neighbours(first)])
  const spots: number[] = []
  for (let i = 0; i < N; i++) if (!banned.has(i)) spots.push(i)
  for (let k = 0; k < C.count && spots.length; k++) {
    const pick = Math.floor(Math.random() * spots.length)
    cells[spots[pick]].mine = true
    spots.splice(pick, 1)
  }
  for (let i = 0; i < N; i++) {
    cells[i].adj = neighbours(i).filter((n) => cells[n].mine).length
  }
  return cells
}

/** Flood-fills from a zero cell. Mutates a copy the caller owns. */
function cascade(cells: Cell[], from: number) {
  const queue = [from]
  while (queue.length) {
    const i = queue.pop()!
    const c = cells[i]
    if (c.open || c.flag) continue
    c.open = true
    if (c.adj === 0 && !c.mine) queue.push(...neighbours(i))
  }
}

/** Opens every target. Returns the first mine opened, or -1 if they were all safe. */
function openAll(cells: Cell[], targets: number[]): number {
  let boom = -1
  for (const t of targets) {
    const c = cells[t]
    if (c.open || c.flag) continue
    if (c.mine) {
      if (boom < 0) boom = t
      continue
    }
    cascade(cells, t)
  }
  return boom
}

/**
 * The end of a lost game: every mine open, the fatal one marked, and any flag that turned out to
 * be wrong marked too.
 *
 * Showing the wrong flags is the part that matters. Without it a loss tells you only *that* you
 * misread the board, and a game whose whole content is deduction owes you the step you got wrong.
 */
function bust(cells: Cell[], boom: number) {
  for (const c of cells) {
    if (c.mine) c.open = true
    if (c.flag && !c.mine) c.wrong = true
  }
  cells[boom].boom = true
}

/** True once every safe cell is open, which is the only win condition. */
const cleared = (cells: Cell[]) => cells.every((c) => c.mine || c.open)

/**
 * Minesweeper. The safest of the four to put on a canvas: pure pointer input, so there is no
 * contention with the global keyboard shortcuts at all, and a fixed 9x9 board that can never
 * change the card's measured height.
 */
export function Minesweeper() {
  const measuring = useMeasuring()
  const [cells, setCells] = useState<Cell[]>(blank)
  const [status, setStatus] = useState<Status>('idle')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const held = useRef(false)
  const holdTimer = useRef<number | null>(null)

  /*
   * Only a cleared board is a result. A game you lost took however long it took, and a game
   * still in progress has a clock running, but neither is a time worth ranking — so both offer
   * 0 to the board, which is the value `useBoard` treats as "nothing to post".
   */
  const board = useBoard('mines', status === 'won' ? elapsed : 0)

  useEffect(() => {
    if (measuring || status !== 'playing' || startedAt === null) return
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 250)
    return () => window.clearInterval(id)
  }, [measuring, status, startedAt])

  const reset = useCallback(() => {
    setCells(blank())
    setStatus('idle')
    setStartedAt(null)
    setElapsed(0)
  }, [])

  /*
   * Everything is computed before any setState.
   *
   * This used to run inside a `setCells` updater that also called `setStatus`, `setStartedAt`
   * and `recordBest`. Updaters can be invoked during render and are re-invoked under
   * StrictMode, so that fired state changes mid-render and could bank the same win twice — the
   * identical bug Snake's step loop carries a comment about. Updaters must be pure; the side
   * effects belong out here, where they run once per click.
   */
  const reveal = useCallback(
    (i: number) => {
      if (status === 'won' || status === 'lost') return

      // the first click lays the field around itself, so it can never be the mine
      const first = status === 'idle'
      const next = first ? layMines(i) : copy(cells)
      const startAt = first ? Date.now() : startedAt

      const cell = next[i]
      if (cell.flag) return

      /*
       * Clicking a number you have already satisfied opens the rest of its neighbours.
       *
       * "Chording" is most of the speed in minesweeper: without it the endgame is clicking every
       * remaining square one at a time, having already done all of the thinking. It is only
       * offered when the flags around the cell match its number — and it can still lose, because
       * a flag in the wrong place is your mistake, not the board's.
       */
      let targets: number[]
      if (cell.open) {
        if (!cell.adj) return
        const around = neighbours(i)
        if (around.filter((n) => next[n].flag).length !== cell.adj) return
        targets = around.filter((n) => !next[n].flag && !next[n].open)
        if (!targets.length) return
      } else {
        targets = [i]
      }

      const boom = openAll(next, targets)

      if (boom >= 0) {
        bust(next, boom)
        setCells(next)
        setStatus('lost')
        play('fail')
        return
      }

      if (cleared(next)) {
        // a cleared board flags its own mines; leaving them blank reads as unfinished
        for (const c of next) if (c.mine) c.flag = true
        const secs = Math.max(1, Math.round((Date.now() - (startAt ?? Date.now())) / 1000))
        setCells(next)
        setElapsed(secs)
        setStatus('won')
        play('score')
        recordBest('mines', secs, true) // a completion time: lower wins
        return
      }

      setCells(next)
      if (first) {
        setStatus('playing')
        setStartedAt(startAt)
      }
      play('tick')
    },
    [status, startedAt, cells],
  )

  const toggleFlag = useCallback(
    (i: number) => {
      if (status === 'won' || status === 'lost' || status === 'idle') return
      if (cells[i].open) return
      const next = copy(cells)
      next[i].flag = !next[i].flag
      setCells(next)
      play('tick')
    },
    [status, cells],
  )

  const flagsLeft = C.count - cells.filter((c) => c.flag).length

  return (
    <div className="game">
      <div
        className="game__board ms"
        onContextMenu={(e) => e.preventDefault()}
        style={{ gridTemplateColumns: `repeat(${C.cols}, 30px)`, gridTemplateRows: `repeat(${C.rows}, 30px)` }}
      >
        {cells.map((c, i) => (
          <button
            type="button"
            key={i}
            className="ms__c"
            data-open={c.open || undefined}
            data-n={c.open && !c.mine && c.adj ? c.adj : undefined}
            data-mine={c.open && c.mine ? true : undefined}
            data-boom={c.boom || undefined}
            data-wrong={c.wrong || undefined}
            data-flag={c.flag || undefined}
            aria-label={`cell ${i}`}
            onContextMenu={(e) => {
              e.preventDefault()
              toggleFlag(i)
            }}
            /* long-press to flag, for touch where there is no right button */
            onPointerDown={() => {
              held.current = false
              holdTimer.current = window.setTimeout(() => {
                held.current = true
                toggleFlag(i)
              }, 400)
            }}
            onPointerUp={() => {
              if (holdTimer.current) window.clearTimeout(holdTimer.current)
              if (!held.current) reveal(i)
            }}
            onPointerLeave={() => {
              if (holdTimer.current) window.clearTimeout(holdTimer.current)
            }}
          >
            {c.wrong ? '⚑' : c.flag && !c.open ? '⚑' : c.open && c.mine ? '✳' : c.open && c.adj ? c.adj : ''}
          </button>
        ))}
      </div>

      {/* a completion time, so the first column is a run rather than a score */}
      <ScoreStats game="mines" value={elapsed} board={board} runLabel={scoreboard.run} />

      <div className="game__foot">
        {status === 'won' ? (
          <PostControls board={board} />
        ) : (
          <span className="game__hint">
            {status === 'lost'
              ? C.lost
              : status === 'idle'
                ? C.hint
                : `${flagsLeft} ${C.flagsLeft}`}
          </span>
        )}
        <button type="button" className="btn" onClick={reset}>
          {C.reset}
        </button>
      </div>
    </div>
  )
}
