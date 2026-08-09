'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { PostControls, ScoreStats, useBoard } from '@/components/apps/games/board'
import { useMeasuring } from '@/components/desktop/measuring-context'
import { snake as C } from '@/content/arcade'
import { recordBest } from '@/lib/best'
import { play } from '@/lib/audio'
import { useSwipe, type SwipeDir } from '@/lib/use-swipe'

type Point = { x: number; y: number }
type Status = 'idle' | 'running' | 'paused' | 'over'
/** The bonus apple and how many steps it has left before it goes. */
type Bonus = { p: Point; left: number }

const G = C.grid
const key = (p: Point) => p.y * G + p.x
const START: Point[] = [
  { x: 8, y: 8 },
  { x: 7, y: 8 },
  { x: 6, y: 8 },
]

const DIRS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
}

const SWIPE_DIRS: Record<SwipeDir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

function freeSpot(occupied: Point[]): Point {
  const taken = new Set(occupied.map(key))
  const open: number[] = []
  for (let i = 0; i < G * G; i++) if (!taken.has(i)) open.push(i)
  const pick = open[Math.floor(Math.random() * open.length)] ?? 0
  return { x: pick % G, y: Math.floor(pick / G) }
}

/**
 * Snake.
 *
 * The wrapper carries `data-keys`, so the arrow keys, WASD and space belong to the game rather
 * than the canvas — without it, space and Escape would reach the global handler while you're
 * mid-run. The step loop is a `setTimeout` chain rather than rAF because the speed is in
 * milliseconds per move, not frames, and it never starts while MeasureRig is measuring.
 */
export function Snake() {
  const measuring = useMeasuring()
  const [body, setBody] = useState<Point[]>(START)
  const [food, setFood] = useState<Point>({ x: 12, y: 4 })
  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)
  const [bonus, setBonus] = useState<Bonus | null>(null)
  /** The direction the last committed step used, so a fast double-tap can't reverse into itself. */
  const lastDir = useRef<Point>({ x: 1, y: 0 })
  /**
   * Turns waiting for a step, at most two deep.
   *
   * Writing the direction straight into a ref loses inputs: at 170ms a step, a quick up-then-left
   * round a corner arrives well inside one tick and the up is overwritten before it is ever
   * played. Worse, both were checked against the *committed* direction, so going up then
   * immediately left while still travelling right let the second turn pass the 180° test and the
   * snake reversed into its own neck. Queueing fixes both: each turn is validated against the one
   * ahead of it in the queue, and every one of them gets a step of its own.
   */
  const turns = useRef<Point[]>([])
  const wrap = useRef<HTMLDivElement>(null)

  /*
   * Personal best and the global board, both from `useBoard`. The personal one comes straight
   * out of the best-store rather than being copied into state in an effect — that would cascade
   * a second render on every mount, and `recordBest` already notifies subscribers, so it
   * updates itself the moment a run beats the record.
   *
   * Only a finished run is offered to the board; a score still being played is not a result.
   */
  const board = useBoard('snake', status === 'over' ? score : 0)

  const reset = useCallback(() => {
    setBody(START)
    setFood(freeSpot(START))
    setBonus(null)
    setScore(0)
    turns.current = []
    lastDir.current = { x: 1, y: 0 }
    setStatus('running')
    wrap.current?.focus()
  }, [])

  /** Queue a turn, rejecting a reversal or a repeat of whatever it would follow. */
  const turn = useCallback((v: Point) => {
    const prev = turns.current[turns.current.length - 1] ?? lastDir.current
    if (v.x === -prev.x && v.y === -prev.y) return
    if (v.x === prev.x && v.y === prev.y) return
    if (turns.current.length < 2) turns.current.push(v)
  }, [])

  /*
   * Everything is computed before any setState.
   *
   * This used to run inside a `setBody` updater, with a nested `setScore` updater that called
   * `recordBest` — which notifies the best-store's subscribers. Updaters can be invoked during
   * render and are re-invoked under StrictMode, so that fired a setState in the Arcade launcher
   * mid-render and would have double-counted food. Updaters must be pure; side effects belong
   * out here.
   */
  const step = useCallback(() => {
    const d = turns.current.shift() ?? lastDir.current
    lastDir.current = d

    /*
     * The edges wrap. Only the snake is solid.
     *
     * With walls, the first thirty seconds are the dangerous part and the board gets emptier the
     * better you do — exactly backwards. Wrapping moves the whole difficulty into the snake's own
     * length, so the game gets harder as it earns the right to.
     */
    const head = { x: (body[0].x + d.x + G) % G, y: (body[0].y + d.y + G) % G }

    // the tail square is about to be vacated, so following it is legal
    if (body.slice(0, -1).some((p) => p.x === head.x && p.y === head.y)) {
      setStatus('over')
      play('fail')
      if (score > 0) recordBest('snake', score)
      return
    }

    const ate = head.x === food.x && head.y === food.y
    const tookBonus = !!bonus && head.x === bonus.p.x && head.y === bonus.p.y
    const next = ate ? [head, ...body] : [head, ...body.slice(0, -1)]
    setBody(next)

    let gained = 0
    if (ate) gained += 1
    if (tookBonus) gained += C.bonusWorth

    if (tookBonus) {
      setBonus(null)
      play('score')
    } else if (bonus) {
      // the bonus is on a step budget rather than a clock, so pausing can't run it out
      setBonus(bonus.left > 1 ? { ...bonus, left: bonus.left - 1 } : null)
    }

    if (ate) {
      const total = score + gained
      const grown = freeSpot(bonus && !tookBonus ? [...next, bonus.p] : next)
      setFood(grown)
      // a bonus every few apples, so a long run has something to chase besides the next square
      if (!bonus && total > 0 && total % C.bonusEvery === 0) {
        setBonus({ p: freeSpot([...next, grown]), left: C.bonusSteps })
      }
      play('tick')
    }
    if (gained) setScore(score + gained)
  }, [body, food, score, bonus])

  useEffect(() => {
    if (measuring || status !== 'running') return
    // speeds up as it grows, down to a floor
    const ms = Math.max(C.minSpeed, C.startSpeed - score * 4)
    const id = window.setTimeout(step, ms)
    return () => window.clearTimeout(id)
  }, [measuring, status, step, score, body])

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        setStatus((s) => (s === 'running' ? 'paused' : s === 'paused' ? 'running' : s))
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setStatus((s) => (s === 'running' ? 'paused' : s))
        return
      }
      const d = DIRS[e.key.length === 1 ? e.key.toLowerCase() : e.key]
      if (!d) return
      e.preventDefault()
      if (status === 'idle' || status === 'over') reset()
      turn(d)
    },
    [status, reset, turn],
  )

  /* the same four moves the arrow keys make, minus the 180° turn into your own neck */
  const onSwipe = useCallback(
    (d: SwipeDir) => {
      if (status === 'idle' || status === 'over') reset()
      turn(SWIPE_DIRS[d])
    },
    [status, reset, turn],
  )
  useSwipe(wrap, onSwipe)

  const bodySet = new Map(body.map((p, i) => [key(p), i]))

  return (
    <div className="game" data-keys tabIndex={-1} ref={wrap} onKeyDown={onKey}>
      <div
        className="game__board snake"
        style={{ gridTemplateColumns: `repeat(${G}, 20px)`, gridTemplateRows: `repeat(${G}, 20px)` }}
      >
        {Array.from({ length: G * G }, (_, i) => {
          const idx = bodySet.get(i)
          return (
            <div
              key={i}
              className="snake__c"
              data-s={idx === undefined ? undefined : idx === 0 ? 'head' : 'body'}
              data-food={key(food) === i ? true : undefined}
              data-bonus={bonus && key(bonus.p) === i ? true : undefined}
              /* it fades over its last few steps, so it is visibly about to leave */
              data-going={bonus && key(bonus.p) === i && bonus.left <= 8 ? true : undefined}
            />
          )
        })}
      </div>

      <ScoreStats game="snake" value={score} board={board} />

      {/* the hint gives way to the post controls, so the row keeps its measured height */}
      <div className="game__foot">
        {status === 'over' && score > 0 ? (
          <PostControls board={board} />
        ) : (
          <span className="game__hint">
            {status === 'paused' ? C.paused : status === 'over' ? C.over : C.hint}
          </span>
        )}
        <button type="button" className="btn" onClick={reset}>
          {C.reset}
        </button>
      </div>
    </div>
  )
}
