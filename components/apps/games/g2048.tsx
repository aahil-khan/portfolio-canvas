'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { PostControls, ScoreStats, fromTextField, useBoard } from '@/components/apps/games/board'

import { g2048 as C } from '@/content/arcade'
import { recordBest } from '@/lib/best'
import { play } from '@/lib/audio'
import { useSwipe } from '@/lib/use-swipe'

const S = C.size
/** Board geometry, mirrored by the CSS. 6 + 4×68 + 3×6 + 6 = 302px. */
const CELL = 68
const GAP = 6
const PAD = 6
export const BOARD = PAD * 2 + S * CELL + (S - 1) * GAP
const at = (i: number) => PAD + i * (CELL + GAP)

/**
 * A tile with an identity.
 *
 * The first version rendered 16 grid cells from a number[], which meant every move replaced the
 * DOM wholesale and nothing could animate — tiles teleported. Giving each tile a stable `id` and
 * absolute position lets React keep the same node across a move, so a CSS transition on
 * `transform` slides it.
 */
interface Tile {
  id: number
  r: number
  c: number
  v: number
  /** Just spawned: pops in rather than sliding from nowhere. */
  born?: boolean
  /** Absorbed another tile this move: pulses once. */
  merged?: boolean
  /** Was absorbed. Rides to the target cell underneath the survivor, then is dropped. */
  gone?: boolean
}

type Dir = 'up' | 'down' | 'left' | 'right'

let seq = 0
const nextId = () => ++seq

/** Cells with no tile on them, as [r, c]. */
function freeCells(tiles: Tile[]): [number, number][] {
  const taken = new Set(tiles.filter((t) => !t.gone).map((t) => t.r * S + t.c))
  const out: [number, number][] = []
  for (let r = 0; r < S; r++) {
    for (let c = 0; c < S; c++) if (!taken.has(r * S + c)) out.push([r, c])
  }
  return out
}

function spawn(tiles: Tile[]): Tile[] {
  const free = freeCells(tiles)
  if (!free.length) return tiles
  const [r, c] = free[Math.floor(Math.random() * free.length)]
  return [...tiles, { id: nextId(), r, c, v: Math.random() < 0.9 ? 2 : 4, born: true }]
}

/**
 * A fixed opening deal.
 *
 * Randomising it would need either an impure render — where the server and the client disagree
 * and hydration breaks — or a setState in an effect, which cascades an extra render every time
 * the card mounts. The board diverges on the first move anyway, since every move spawns.
 */
function opening(): Tile[] {
  return [
    { id: nextId(), r: 1, c: 1, v: 2 },
    { id: nextId(), r: 2, c: 2, v: 2 },
  ]
}

/** Row/column indices for line `n`, ordered so index 0 is the direction of travel. */
function line(dir: Dir, n: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < S; i++) {
    if (dir === 'left') out.push([n, i])
    else if (dir === 'right') out.push([n, S - 1 - i])
    else if (dir === 'up') out.push([i, n])
    else out.push([S - 1 - i, n])
  }
  return out
}

/**
 * Slides and merges, returning every tile — survivors AND the absorbed ones.
 *
 * The absorbed tile keeps its identity and is given the winner's destination, so it slides into
 * place and is only removed once the animation has played. Dropping it immediately is what makes
 * naive implementations look like tiles blink out mid-slide.
 */
function move(tiles: Tile[], dir: Dir): { next: Tile[]; gained: number; moved: boolean } {
  const grid = new Map<number, Tile>()
  for (const t of tiles) if (!t.gone) grid.set(t.r * S + t.c, t)

  const next: Tile[] = []
  let gained = 0
  let moved = false

  for (let n = 0; n < S; n++) {
    const cells = line(dir, n)
    let target = 0
    let last: Tile | null = null
    let lastMergedAt = -1

    for (const [r, c] of cells) {
      const tile = grid.get(r * S + c)
      if (!tile) continue

      // same value as the tile just placed, and that one hasn't already merged this move
      if (last && last.v === tile.v && lastMergedAt !== target - 1) {
        const [mr, mc] = cells[target - 1]
        next.push({ ...tile, r: mr, c: mc, gone: true })
        last.v *= 2
        last.merged = true
        gained += last.v
        lastMergedAt = target - 1
        moved = true
        last = null
        continue
      }

      const [tr, tc] = cells[target]
      if (tr !== tile.r || tc !== tile.c) moved = true
      const placed: Tile = { ...tile, r: tr, c: tc, born: false, merged: false }
      next.push(placed)
      last = placed
      target += 1
    }
  }

  return { next, gained, moved }
}

const canMove = (tiles: Tile[]): boolean =>
  freeCells(tiles).length > 0 ||
  (['up', 'down', 'left', 'right'] as Dir[]).some((d) => move(tiles, d).moved)

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

/** Must outlast the CSS transition on .g2048__t, or absorbed tiles vanish mid-slide. */
const SETTLE_MS = 150

/**
 * 2048.
 *
 * `data-keys` on the wrapper hands the arrow keys to the game — the canvas otherwise treats bare
 * letters as shortcuts. The board is a fixed 302px square, so the card's measured height is
 * constant however the game goes.
 */
export function Game2048() {
  const [tiles, setTiles] = useState<Tile[]>(opening)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const settle = useRef<number | null>(null)

  /* Personal best and the global board. Only a finished run is offered up — see `board.tsx`. */
  const board = useBoard('2048', over ? score : 0)

  useEffect(() => () => { if (settle.current) window.clearTimeout(settle.current) }, [])

  const reset = useCallback(() => {
    if (settle.current) window.clearTimeout(settle.current)
    setTiles(spawn(spawn([])))
    setScore(0)
    setOver(false)
    wrap.current?.focus()
  }, [])

  /*
   * One move, whatever asked for it. A key and a swipe differ only in how the direction is
   * named, so the board logic lives here and both entry points hand it a `Dir`.
   */
  const applyMove = useCallback(
    (dir: Dir) => {
      if (over) return

      const res = move(tiles, dir)
      if (!res.moved) return

      // absorbed tiles are kept for one beat so they can finish sliding
      setTiles(res.next)

      if (res.gained) {
        const total = score + res.gained
        setScore(total)
        recordBest('2048', total)
        play('tick')
      }

      if (settle.current) window.clearTimeout(settle.current)
      settle.current = window.setTimeout(() => {
        const survivors = res.next.filter((t) => !t.gone).map((t) => ({ ...t, merged: false }))
        const grown = spawn(survivors)
        setTiles(grown)
        if (!canMove(grown)) {
          setOver(true)
          play('fail')
        }
      }, SETTLE_MS)
    },
    [tiles, over, score],
  )

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      // the name field lives inside this wrapper; w/a/s/d belong to it while it has focus
      if (fromTextField(e)) return
      const dir = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key]
      if (!dir) return
      e.preventDefault()
      applyMove(dir)
    },
    [applyMove],
  )

  /* SwipeDir and Dir name the same four directions, so this needs no translation table */
  useSwipe(wrap, applyMove)

  return (
    <div className="game" data-keys tabIndex={-1} ref={wrap} onKeyDown={onKey}>
      <div className="game__board g2048" style={{ width: BOARD, height: BOARD }}>
        {/* static wells, so an empty cell still reads as part of a grid */}
        {Array.from({ length: S * S }, (_, i) => (
          <div
            key={`cell-${i}`}
            className="g2048__cell"
            style={{ transform: `translate(${at(i % S)}px, ${at(Math.floor(i / S))}px)` }}
          />
        ))}
        {tiles.map((t) => (
          <div
            key={t.id}
            className="g2048__t"
            data-v={t.v}
            data-born={t.born || undefined}
            data-merged={t.merged || undefined}
            style={{ transform: `translate(${at(t.c)}px, ${at(t.r)}px)`, zIndex: t.gone ? 1 : 2 }}
          >
            {t.v}
          </div>
        ))}
      </div>

      <ScoreStats game="2048" value={score} board={board} />

      {/* the hint gives way to the post controls, so the row keeps its measured height */}
      <div className="game__foot">
        {over && score > 0 ? (
          <PostControls board={board} />
        ) : (
          <span className="game__hint">{over ? C.over : C.hint}</span>
        )}
        <button type="button" className="btn" onClick={reset}>
          {C.reset}
        </button>
      </div>
    </div>
  )
}
