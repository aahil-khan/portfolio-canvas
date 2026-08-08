'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useMeasuring } from '@/components/desktop/measuring-context'
import { mines as C } from '@/content/arcade'
import { recordBest } from '@/lib/best'
import { play } from '@/lib/audio'

interface Cell {
  mine: boolean
  adj: number
  open: boolean
  flag: boolean
}

type Status = 'idle' | 'playing' | 'won' | 'lost'

const N = C.cols * C.rows

const blank = (): Cell[] =>
  Array.from({ length: N }, () => ({ mine: false, adj: 0, open: false, flag: false }))

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

  const reveal = useCallback(
    (i: number) => {
      if (status === 'won' || status === 'lost') return
      setCells((prev) => {
        let next: Cell[]
        let live = status
        if (status === 'idle') {
          next = layMines(i)
          live = 'playing'
          setStatus('playing')
          setStartedAt(Date.now())
        } else {
          next = prev.map((c) => ({ ...c }))
        }
        const cell = next[i]
        if (cell.flag || cell.open) return next

        if (cell.mine) {
          for (const c of next) if (c.mine) c.open = true
          setStatus('lost')
          play('fail')
          return next
        }

        cascade(next, i)
        const cleared = next.every((c) => c.mine || c.open)
        if (cleared) {
          setStatus('won')
          play('score')
          const secs = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 1
          recordBest('mines', secs, true) // a completion time: lower wins
        } else if (live === 'playing') {
          play('tick')
        }
        return next
      })
    },
    [status, startedAt],
  )

  const toggleFlag = useCallback(
    (i: number) => {
      if (status === 'won' || status === 'lost' || status === 'idle') return
      setCells((prev) => {
        const next = prev.map((c) => ({ ...c }))
        if (!next[i].open) next[i].flag = !next[i].flag
        return next
      })
      play('tick')
    },
    [status],
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
            {c.flag && !c.open ? '⚑' : c.open && c.mine ? '✳' : c.open && c.adj ? c.adj : ''}
          </button>
        ))}
      </div>

      <div className="game__foot">
        <span className="game__hint">
          {status === 'won'
            ? `${C.won} · ${elapsed}s`
            : status === 'lost'
              ? C.lost
              : `${flagsLeft} ${C.flagsLeft} · ${elapsed}s`}
        </span>
        <button type="button" className="btn" onClick={reset}>
          {C.reset}
        </button>
      </div>
    </div>
  )
}
