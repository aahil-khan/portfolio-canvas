'use client'

import { type RefObject, useEffect, useRef } from 'react'

interface Options {
  /** The element that actually moves. */
  nodeRef: RefObject<HTMLElement | null>
  /** Where you grab it. For a card that's the title bar; for the hero it's the whole thing. */
  handleRef: RefObject<HTMLElement | null>
  x: number
  y: number
  toWorld: (px: number, py: number) => { x: number; y: number }
  onMove: (x: number, y: number) => void
  onRaise: () => void
  onDoubleTap?: () => void
  disabled?: boolean
}

/**
 * Drag an object in world space.
 *
 * Two things here are easy to get wrong and both were found the hard way in the prototype:
 *
 *  1. The delta is divided by the camera scale, or the object drifts away from the cursor at
 *     any zoom other than 1:1.
 *  2. Double-tap resolves on pointer UP, never on down. Deciding on the way down means a click
 *     followed quickly by a drag is swallowed as a double tap and the object refuses to move.
 */
export function useDragObject({
  nodeRef, handleRef, x, y, toWorld, onMove, onRaise, onDoubleTap, disabled,
}: Options) {
  /*
   * Tap state lives in a ref, NOT in the effect closure.
   *
   * The first click raises the card, which changes state upstream, which recreates the
   * `onDoubleTap` callback, which re-runs this effect — resetting a closure-local timestamp to
   * 0 and making the second click look like a first one. Double-click silently never fired.
   * A ref survives re-registration, so the gesture no longer depends on render churn.
   */
  const tap = useRef({ t: 0, x: 0, y: 0 })

  useEffect(() => {
    const handle = handleRef.current
    const node = nodeRef.current
    if (!handle || !node || disabled) return

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('button,a')) return
      e.stopPropagation()

      const now = performance.now()
      const second =
        now - tap.current.t < 320 &&
        Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) < 6
      tap.current = { t: now, x: e.clientX, y: e.clientY }
      let moved = false

      handle.setPointerCapture(e.pointerId)
      handle.dataset.dragging = 'true'
      onRaise()

      const start = toWorld(e.clientX, e.clientY)
      let nx = x
      let ny = y
      let raf: number | null = null

      const move = (ev: PointerEvent) => {
        const p = toWorld(ev.clientX, ev.clientY)
        nx = x + (p.x - start.x)
        ny = y + (p.y - start.y)
        if (Math.hypot(nx - x, ny - y) > 3) moved = true
        if (raf === null)
          raf = requestAnimationFrame(() => {
            node.style.left = `${nx}px`
            node.style.top = `${ny}px`
            raf = null
          })
      }
      const up = () => {
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', up)
        handle.removeEventListener('pointercancel', up)
        delete handle.dataset.dragging
        if (raf !== null) cancelAnimationFrame(raf)
        if (moved) onMove(nx, ny)
        else if (second && onDoubleTap) onDoubleTap()
      }
      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', up)
      handle.addEventListener('pointercancel', up)
    }

    handle.addEventListener('pointerdown', onDown)
    return () => handle.removeEventListener('pointerdown', onDown)
  }, [handleRef, nodeRef, x, y, toWorld, onMove, onRaise, onDoubleTap, disabled])
}
