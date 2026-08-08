'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { useMeasuring } from '@/components/desktop/measuring-context'
import { snake as C } from '@/content/arcade'
import { getBestServerSnapshot, getBestSnapshot, recordBest, subscribeBest } from '@/lib/best'
import { play } from '@/lib/audio'
import { useSwipe, type SwipeDir } from '@/lib/use-swipe'

type Point = { x: number; y: number }
type Status = 'idle' | 'running' | 'paused' | 'over'

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

function freeSpot(body: Point[]): Point {
  const taken = new Set(body.map(key))
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
  const dir = useRef<Point>({ x: 1, y: 0 })
  /** The direction the last committed step used, so a fast double-tap can't reverse into itself. */
  const lastDir = useRef<Point>({ x: 1, y: 0 })
  const wrap = useRef<HTMLDivElement>(null)

  /*
   * The persisted best comes straight from the store rather than being copied into state in an
   * effect — that would cascade a second render on every mount, and `recordBest` already
   * notifies subscribers, so this updates itself when a run beats the record.
   */
  const bests = useSyncExternalStore(subscribeBest, getBestSnapshot, getBestServerSnapshot)
  const best = bests.snake ?? 0

  const reset = useCallback(() => {
    setBody(START)
    setFood(freeSpot(START))
    setScore(0)
    dir.current = { x: 1, y: 0 }
    lastDir.current = { x: 1, y: 0 }
    setStatus('running')
    wrap.current?.focus()
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
    const d = dir.current
    lastDir.current = d
    const head = { x: body[0].x + d.x, y: body[0].y + d.y }

    // walls and self are both fatal; wrapping would make the board meaningless
    const hitWall = head.x < 0 || head.y < 0 || head.x >= G || head.y >= G
    const hitSelf = body.slice(0, -1).some((p) => p.x === head.x && p.y === head.y)
    if (hitWall || hitSelf) {
      setStatus('over')
      play('fail')
      if (score > 0) recordBest('snake', score)
      return
    }

    const ate = head.x === food.x && head.y === food.y
    const next = ate ? [head, ...body] : [head, ...body.slice(0, -1)]
    setBody(next)
    if (ate) {
      setFood(freeSpot(next))
      setScore(score + 1)
      play('tick')
    }
  }, [body, food, score])

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
      // a 180° turn would run straight into the neck
      if (d.x === -lastDir.current.x && d.y === -lastDir.current.y) return
      dir.current = d
    },
    [status, reset],
  )

  /* the same four moves the arrow keys make, minus the 180° turn into your own neck */
  const onSwipe = useCallback(
    (d: SwipeDir) => {
      const v = SWIPE_DIRS[d]
      if (status === 'idle' || status === 'over') reset()
      if (v.x === -lastDir.current.x && v.y === -lastDir.current.y) return
      dir.current = v
    },
    [status, reset],
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
            />
          )
        })}
      </div>

      <div className="game__foot">
        <span className="game__hint">
          {status === 'over'
            ? `${C.over} · ${C.score} ${score}`
            : status === 'paused'
              ? C.paused
              : status === 'idle'
                ? C.hint
                : `${C.score} ${score} · ${C.best} ${Math.max(best, score)}`}
        </span>
        <button type="button" className="btn" onClick={reset}>
          {C.reset}
        </button>
      </div>
    </div>
  )
}
