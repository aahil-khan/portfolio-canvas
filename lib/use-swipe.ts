'use client'

import { useEffect, type RefObject } from 'react'

export type SwipeDir = 'up' | 'down' | 'left' | 'right'

/**
 * Turns a swipe on `ref` into a direction.
 *
 * Snake and 2048 were arrow-key games, which on a phone means they were not games at all: the
 * board rendered, the score sat at zero and nothing could ever move it. Both take the same four
 * directions, so they take the same hook.
 *
 * Two things that are easy to get wrong here:
 *
 * - The board lives inside a vertically scrolling sheet, so a swipe up would otherwise scroll the
 *   card away mid-game. `touch-action: none` on the board declares the intent, but Chrome still
 *   recognises a quick drag as a fling and keeps it live for the best part of a second, eating
 *   the next tap. Only `preventDefault` on a non-passive `touchmove` actually suppresses it —
 *   the same lesson the sheet's own drag handle taught.
 * - Mouse pointers are ignored. On a desktop the keyboard is the real control, and treating a
 *   click-drag across the board as a move made the game feel like it had a mind of its own.
 */
export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  onSwipe: (dir: SwipeDir) => void,
  threshold = 24,
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let x0 = 0
    let y0 = 0
    let active = false

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      x0 = e.clientX
      y0 = e.clientY
      active = true
    }
    const up = (e: PointerEvent) => {
      if (!active) return
      active = false
      const dx = e.clientX - x0
      const dy = e.clientY - y0
      if (Math.hypot(dx, dy) < threshold) return
      onSwipe(
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up',
      )
    }
    const cancel = () => {
      active = false
    }
    const move = (e: TouchEvent) => {
      if (active) e.preventDefault()
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    el.addEventListener('touchmove', move, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
      el.removeEventListener('touchmove', move)
    }
  }, [ref, onSwipe, threshold])
}
