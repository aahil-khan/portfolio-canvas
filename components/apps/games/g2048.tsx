'use client'

import { useCallback, useRef, useState, useSyncExternalStore } from 'react'

import { g2048 as C } from '@/content/arcade'
import { getBestServerSnapshot, getBestSnapshot, recordBest, subscribeBest } from '@/lib/best'
import { play } from '@/lib/audio'

const S = C.size
type Board = number[]

const empty = (): Board => Array<number>(S * S).fill(0)

function spawn(board: Board): Board {
  const free: number[] = []
  board.forEach((v, i) => {
    if (!v) free.push(i)
  })
  if (!free.length) return board
  const next = [...board]
  next[free[Math.floor(Math.random() * free.length)]] = Math.random() < 0.9 ? 2 : 4
  return next
}

/**
 * Collapses one line toward index 0, returning the new line and what it scored.
 *
 * A tile that has already merged this move can't merge again — without the `merged` guard,
 * [2,2,4] would collapse to [8] in a single move instead of [4,4].
 */
function collapse(line: number[]): { line: number[]; gained: number } {
  const tiles = line.filter(Boolean)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2)
      gained += tiles[i] * 2
      i++
    } else {
      out.push(tiles[i])
    }
  }
  while (out.length < S) out.push(0)
  return { line: out, gained }
}

type Dir = 'up' | 'down' | 'left' | 'right'

/** Index list for one row/column, ordered so index 0 is the direction of travel. */
function lineIndices(dir: Dir, n: number): number[] {
  const idx: number[] = []
  for (let i = 0; i < S; i++) {
    if (dir === 'left') idx.push(n * S + i)
    else if (dir === 'right') idx.push(n * S + (S - 1 - i))
    else if (dir === 'up') idx.push(i * S + n)
    else idx.push((S - 1 - i) * S + n)
  }
  return idx
}

function move(board: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  const next = [...board]
  let gained = 0
  let moved = false
  for (let n = 0; n < S; n++) {
    const idx = lineIndices(dir, n)
    const before = idx.map((i) => board[i])
    const { line, gained: g } = collapse(before)
    gained += g
    idx.forEach((i, k) => {
      if (next[i] !== line[k]) moved = true
      next[i] = line[k]
    })
  }
  return { board: next, gained, moved }
}

const canMove = (board: Board): boolean =>
  (['up', 'down', 'left', 'right'] as Dir[]).some((d) => move(board, d).moved)

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

/**
 * 2048.
 *
 * `data-keys` on the wrapper hands the arrow keys to the game — the canvas otherwise treats bare
 * letters as shortcuts. The grid is a fixed 4x4, so the card's measured height is constant no
 * matter how the board fills up.
 */
/**
 * A fixed opening deal.
 *
 * Randomising it would need either an impure render — where the server and the client disagree
 * and hydration breaks — or a setState in an effect, which cascades an extra render every time
 * the card mounts, including inside the measurement rig. The board diverges on the first move
 * anyway, since every move spawns a random tile.
 */
function opening(): Board {
  const b = empty()
  b[5] = 2
  b[10] = 2
  return b
}

export function Game2048() {
  const [board, setBoard] = useState<Board>(opening)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  // straight from the store; recordBest notifies subscribers, so this needs no effect
  const bests = useSyncExternalStore(subscribeBest, getBestSnapshot, getBestServerSnapshot)
  const best = bests['2048'] ?? 0

  const reset = useCallback(() => {
    setBoard(spawn(spawn(empty())))
    setScore(0)
    setOver(false)
    wrap.current?.focus()
  }, [])

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      const dir = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key]
      if (!dir || over) return
      e.preventDefault()
      const res = move(board, dir)
      if (!res.moved) return
      const next = spawn(res.board)
      setBoard(next)
      if (res.gained) {
        /*
         * Computed here rather than inside a setScore updater. `recordBest` notifies the store's
         * subscribers, and an updater can run during render — which fired a setState in the
         * Arcade launcher while this component was rendering. Updaters must stay pure.
         */
        const total = score + res.gained
        setScore(total)
        recordBest('2048', total)
        play('tick')
      }
      if (!canMove(next)) {
        setOver(true)
        play('fail')
      }
    },
    [board, over, score],
  )

  return (
    <div className="game" data-keys tabIndex={-1} ref={wrap} onKeyDown={onKey}>
      <div
        className="game__board g2048"
        style={{ gridTemplateColumns: `repeat(${S}, 68px)`, gridTemplateRows: `repeat(${S}, 68px)` }}
      >
        {board.map((v, i) => (
          <div key={i} className="g2048__t" data-v={v || undefined}>
            {v || ''}
          </div>
        ))}
      </div>

      <div className="game__foot">
        <span className="game__hint">
          {over ? C.over : `${C.score} ${score.toLocaleString()} · ${C.best} ${Math.max(best, score).toLocaleString()}`}
        </span>
        <button type="button" className="btn" onClick={reset}>
          {C.reset}
        </button>
      </div>
    </div>
  )
}
