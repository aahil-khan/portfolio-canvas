'use client'

import { type RefObject, useCallback, useEffect, useMemo, useRef } from 'react'

import {
  type Camera,
  type Rect,
  type Viewport,
  clampScale,
  fitCamera,
  focusCamera,
  centreCamera,
  revealCamera,
  screenToWorld as toWorld,
  wheelToScale,
  zoomAt,
  zoomFloor,
} from './geometry'

/**
 * How far the grid overhangs the viewport on every side.
 *
 * It has to exceed the largest cell the grid is ever drawn at — 48 world px at MAX_SCALE 2 is
 * 96 — because the grid is scrolled by wrapping it within one cell, and anything less would
 * swing a bare edge into view at the wrap.
 */
const GRID_BLEED = 100

/** Always-positive modulo. `%` keeps the sign of the dividend, which would jump the wrap. */
const mod = (v: number, m: number) => ((v % m) + m) % m

/**
 * Is anything between `target` and `card` actually able to consume a vertical scroll?
 *
 * Overflowing is not enough — `.card` itself clips with `overflow: hidden`, and so do several
 * app internals — and declaring a scrolling overflow is not enough either, since a container
 * whose content fits has nothing to give. Both have to hold, so the computed style is only read
 * for the handful of elements that overflow, and only while the pointer is over the one focused
 * card. Everywhere else this costs a `closest()` and nothing more.
 */
const scrollerIn = (target: HTMLElement, card: HTMLElement): boolean => {
  for (let el: HTMLElement | null = target; el; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1) {
      const overflow = getComputedStyle(el).overflowY
      if (overflow === 'auto' || overflow === 'scroll') return true
    }
    if (el === card) break
  }
  return false
}

interface Options {
  viewportRef: RefObject<HTMLDivElement | null>
  worldRef: RefObject<HTMLDivElement | null>
  /** The backdrop grid, which lives on the viewport and is moved by the camera. Optional. */
  gridRef?: RefObject<HTMLDivElement | null>
  /** Called when the scale changes, for the zoom readout. Debounced to animation frames. */
  onScale?: (scale: number) => void
  /** True while a card is being dragged, so the canvas doesn't pan underneath it. */
  enabled?: boolean
}

/**
 * The camera.
 *
 * THE RULE: pan and zoom never pass through React state. The transform lives in a ref and is
 * written to `world.style.transform` inside a rAF loop; React re-renders only when a card
 * opens, closes, or takes focus. Routing 60fps pointer moves through `useState` is the single
 * most reliable way to make this class of UI janky, and it can't be retrofitted later.
 */
export function useCanvas({ viewportRef, worldRef, gridRef, onScale }: Options) {
  const cam = useRef<Camera>({ x: 0, y: 0, s: 1 })
  const dirty = useRef(true)
  const anim = useRef<number | null>(null)
  const vel = useRef({ x: 0, y: 0 })
  /*
   * Zoom is EASED, panning is not.
   *
   * A mouse notch or a +/- press is one big discrete jump; applying it directly makes zoom feel
   * stepped and cheap. So zoom writes a target scale plus the screen point to keep anchored, and
   * the rAF loop converges on it. Panning stays 1:1 — any easing there would make dragging feel
   * like the canvas is lagging behind your hand.
   */
  const zoomTo = useRef<{ s: number; px: number; py: number } | null>(null)
  /** Bumped whenever the user moves the camera by hand, cancelling a pending "fly back". */
  const interrupted = useRef(0)

  const viewport = useCallback(
    (): Viewport => ({
      width: window.innerWidth,
      height: window.innerHeight,
      top: 78,
      bottom: 108,
    }),
    [],
  )

  const get = useCallback(() => ({ ...cam.current }), [])
  const set = useCallback((next: Camera) => {
    cam.current = next
    dirty.current = true
  }, [])

  const screenToWorld = useCallback((px: number, py: number) => toWorld(cam.current, px, py), [])

  const stopAnim = useCallback(() => {
    if (anim.current !== null) cancelAnimationFrame(anim.current)
    anim.current = null
  }, [])

  const flyTo = useCallback(
    (to: Camera, ms = 560) => {
      stopAnim()
      zoomTo.current = null
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        set(to)
        return
      }
      const from = { ...cam.current }
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms)
        const k = 1 - Math.pow(1 - p, 3)
        set({
          x: from.x + (to.x - from.x) * k,
          y: from.y + (to.y - from.y) * k,
          s: from.s + (to.s - from.s) * k,
        })
        if (p < 1) anim.current = requestAnimationFrame(step)
      }
      anim.current = requestAnimationFrame(step)
    },
    [set, stopAnim],
  )

  /** Step the zoom about the middle of the visible band — used by the +/- controls and keys. */
  const zoomBy = useCallback(
    (factor: number) => {
      const vp = viewport()
      stopAnim()
      const base = zoomTo.current?.s ?? cam.current.s
      zoomTo.current = {
        s: clampScale(base * factor, zoomFloor(cam.current.s)),
        px: vp.width / 2,
        py: vp.top + (vp.height - vp.top - vp.bottom) / 2,
      }
      dirty.current = true
    },
    [stopAnim, viewport],
  )

  const reveal = useCallback(
    (target: Rect) => flyTo(revealCamera(cam.current, target, viewport()), 520),
    [flyTo, viewport],
  )
  const centre = useCallback(
    (target: Rect) => flyTo(centreCamera(cam.current, target, viewport()), 520),
    [flyTo, viewport],
  )
  const focus = useCallback(
    (target: Rect) => flyTo(focusCamera(target, viewport())),
    [flyTo, viewport],
  )
  const fit = useCallback(
    (rects: readonly Rect[]) => {
      const next = fitCamera(rects, viewport())
      if (next) flyTo(next)
    },
    [flyTo, viewport],
  )

  /* --- the single rAF that writes the transform --- */
  useEffect(() => {
    let raf = 0
    let lastScale = -1
    const world = worldRef.current
    const grid = gridRef?.current
    const frame = () => {
      const target = zoomTo.current
      if (target) {
        /*
         * The floor is taken from the target, not from the live scale.
         *
         * Taken from the live scale it moves as the easing runs, so a step that should have been
         * allowed gets clamped away mid-converge and `zoomAt` returns the camera untouched —
         * the loop then re-runs the same frame forever, holding `dirty` high and starving
         * everything else that wants to paint.
         */
        const floor = Math.min(zoomFloor(cam.current.s), target.s)
        const next = cam.current.s + (target.s - cam.current.s) * 0.2
        if (Math.abs(target.s - next) < 0.002) {
          cam.current = zoomAt(cam.current, target.px, target.py, target.s, floor)
          zoomTo.current = null
        } else {
          cam.current = zoomAt(cam.current, target.px, target.py, next, floor)
        }
        dirty.current = true
      }
      if (dirty.current && world) {
        const { x, y, s } = cam.current
        world.style.transform = `translate3d(${x}px,${y}px,0) scale(${s})`
        /*
         * The grid moves by transform, and only by a fraction of one cell.
         *
         * Panning it with `background-position` was correct and slow: changing that property
         * repaints the whole element, so every pan frame repainted a full-screen layer. A
         * transform is handled by the compositor and repaints nothing. The pattern repeats every
         * `cell`, so translating by the offset modulo the cell is indistinguishable from
         * translating by the whole thing — the element overhangs the viewport by GRID_BLEED on
         * each side, which is more than the largest cell, so the wrap never exposes an edge.
         *
         * The `+ GRID_BLEED` cancels that overhang, which is what keeps the lines landing on the
         * exact same pixels as `background-position: x y` did.
         *
         * `background-size` is written only when the zoom actually changed. It is the one part
         * that does repaint, and panning must not pay for it.
         */
        if (grid) {
          const cell = 48 * s
          // under a few pixels a 1px line every `cell` is a flat wash, and an expensive one
          if (cell >= 6) {
            if (s !== lastScale) {
              grid.style.backgroundSize = `${cell}px ${cell}px`
              grid.style.opacity = '1'
            }
            const gx = mod(x + GRID_BLEED, cell)
            const gy = mod(y + GRID_BLEED, cell)
            grid.style.transform = `translate3d(${gx}px,${gy}px,0)`
          } else if (s !== lastScale) {
            grid.style.opacity = '0'
          }
        }
        if (s !== lastScale) {
          lastScale = s
          onScale?.(s)
        }
        dirty.current = false
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [worldRef, gridRef, onScale])

  /* --- pan, momentum, zoom --- */
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return

    let panning = false
    let panId: number | null = null
    let last = { x: 0, y: 0, t: 0 }

    const glide = (vx: number, vy: number) => {
      stopAnim()
      const step = () => {
        vx *= 0.94
        vy *= 0.94
        set({ ...cam.current, x: cam.current.x + vx, y: cam.current.y + vy })
        if (Math.hypot(vx, vy) > 0.12) anim.current = requestAnimationFrame(step)
      }
      anim.current = requestAnimationFrame(step)
    }

    const onDown = (e: PointerEvent) => {
      // anything with .obj handles its own drag; only empty canvas pans
      if (e.button !== 0 || (e.target as HTMLElement).closest('[data-obj]')) return
      panning = true
      panId = e.pointerId
      vp.setPointerCapture(panId)
      document.body.style.cursor = 'grabbing'
      last = { x: e.clientX, y: e.clientY, t: performance.now() }
      vel.current = { x: 0, y: 0 }
      interrupted.current++
      zoomTo.current = null
      stopAnim()
    }

    const onMove = (e: PointerEvent) => {
      if (!panning || e.pointerId !== panId) return
      const now = performance.now()
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      const dt = Math.max(1, now - last.t)
      set({ ...cam.current, x: cam.current.x + dx, y: cam.current.y + dy })
      // exponential smoothing, so one noisy frame can't dominate a flick
      vel.current = { x: vel.current.x * 0.7 + (dx / dt) * 0.3, y: vel.current.y * 0.7 + (dy / dt) * 0.3 }
      last = { x: e.clientX, y: e.clientY, t: now }
    }

    const onUp = (e: PointerEvent) => {
      if (!panning || e.pointerId !== panId) return
      panning = false
      document.body.style.cursor = ''
      const { x, y } = vel.current
      if (Math.hypot(x, y) > 0.12 && !matchMedia('(prefers-reduced-motion: reduce)').matches)
        glide(x * 16, y * 16)
    }

    const onWheel = (e: WheelEvent) => {
      /*
       * The wheel belongs to the canvas unless a card has been clicked into.
       *
       * It used to belong to whatever the pointer happened to be over, which meant crossing a
       * card mid-scroll silently handed the wheel to it and the pan died under the cursor.
       * Cards are scattered across the world, so on any real journey that is most of the way —
       * navigation was unusable. Now hovering a card is not a claim on anything: you have to
       * click a card to focus it, and only the focused card takes the wheel.
       *
       * Even then it only takes it if there is genuinely something to scroll, so a focused card
       * whose content fits doesn't become a dead patch of screen. When it does scroll, it is
       * still deliberately NOT chained to the canvas at the edge — reaching the bottom of a card
       * and having the whole world lurch is disorienting.
       *
       * Zoom is unaffected either way: ctrl/⌘ + wheel is a gesture rather than a scroll.
       */
      const zooming = e.ctrlKey || e.metaKey
      if (!zooming) {
        const card = (e.target as HTMLElement).closest<HTMLElement>('[data-card][data-focused]')
        if (card && scrollerIn(e.target as HTMLElement, card)) return
      }

      e.preventDefault()
      stopAnim()
      interrupted.current++
      if (zooming) {
        const base = zoomTo.current?.s ?? cam.current.s
        zoomTo.current = {
          s: clampScale(wheelToScale(base, e.deltaY), zoomFloor(cam.current.s)),
          px: e.clientX,
          py: e.clientY,
        }
        dirty.current = true
      } else {
        zoomTo.current = null
        set({ ...cam.current, x: cam.current.x - e.deltaX, y: cam.current.y - e.deltaY })
      }
    }

    /* --- two-finger pinch --- */
    const touches = new Map<number, PointerEvent>()
    let pinch = 0
    const dist = () => {
      const [a, b] = [...touches.values()]
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }
    const touchDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      touches.set(e.pointerId, e)
      if (touches.size === 2) pinch = dist()
    }
    const touchMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return
      touches.set(e.pointerId, e)
      if (touches.size === 2) {
        const d = dist()
        if (pinch > 0) {
          const [a, b] = [...touches.values()]
          set(
            zoomAt(
              cam.current,
              (a.clientX + b.clientX) / 2,
              (a.clientY + b.clientY) / 2,
              cam.current.s * (d / pinch),
              zoomFloor(cam.current.s),
            ),
          )
        }
        pinch = d
      }
    }
    const touchUp = (e: PointerEvent) => {
      touches.delete(e.pointerId)
      if (touches.size < 2) pinch = 0
    }

    vp.addEventListener('pointerdown', onDown)
    vp.addEventListener('pointermove', onMove)
    vp.addEventListener('pointerup', onUp)
    vp.addEventListener('pointercancel', onUp)
    vp.addEventListener('pointerdown', touchDown)
    vp.addEventListener('pointermove', touchMove)
    vp.addEventListener('pointerup', touchUp)
    vp.addEventListener('pointercancel', touchUp)
    // passive:false because the canvas must be able to preventDefault the page zoom
    vp.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      vp.removeEventListener('pointerdown', onDown)
      vp.removeEventListener('pointermove', onMove)
      vp.removeEventListener('pointerup', onUp)
      vp.removeEventListener('pointercancel', onUp)
      vp.removeEventListener('pointerdown', touchDown)
      vp.removeEventListener('pointermove', touchMove)
      vp.removeEventListener('pointerup', touchUp)
      vp.removeEventListener('pointercancel', touchUp)
      vp.removeEventListener('wheel', onWheel)
    }
  }, [viewportRef, set, stopAnim])

  return useMemo(
    () => ({ get, set, screenToWorld, flyTo, reveal, centre, focus, fit, zoomBy, viewport, interrupted }),
    [get, set, screenToWorld, flyTo, reveal, centre, focus, fit, zoomBy, viewport],
  )
}

export type CanvasApi = ReturnType<typeof useCanvas>
