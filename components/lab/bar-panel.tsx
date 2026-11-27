'use client'

import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

import { useReducedMotion } from '@/lib/motion/reduced'
import { EASE_BEZIER, LAB, REDUCED, sec } from '@/lib/motion/tokens'

/**
 * A panel the bar opens: the theme picker and the reader settings. On a desktop it is a popover
 * under the bar, framed like a window (rule K); on a phone (≤ 760px, CSS) the same element is a
 * sheet pinned to the bottom with a 44px Close (DIRECTION, "Phone sheet"). Opening one closes the
 * other, since a press anywhere outside a panel closes it.
 *
 * Esc closes it and returns focus to its button; a press outside closes it. On opening, focus moves
 * to a `[data-autofocus]` control, else the chosen option (`[aria-pressed="true"]`), else the first. It enters like a
 * window, rising 6px with its opacity over the first 120ms (180ms), and leaves in 120ms, 4px down;
 * with reduced motion, opacity only.
 *
 * While a panel is open the bar stays on screen (`Progress` reads `aria-expanded` in the bar), so a
 * phone's bar never slides away with its sheet.
 */
export function useBarPanel(): {
  open: boolean
  setOpen: (o: boolean | ((o: boolean) => boolean)) => void
  button: RefObject<HTMLButtonElement | null>
  panel: RefObject<HTMLDivElement | null>
} {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open])

  return { open, setOpen, button, panel }
}

export function BarPanel({
  id,
  title,
  closeLabel,
  open,
  onClose,
  panel,
  button,
  className = '',
  children,
  ...data
}: {
  id: string
  title: string
  closeLabel: string
  open: boolean
  onClose: () => void
  panel: RefObject<HTMLDivElement | null>
  button: RefObject<HTMLButtonElement | null>
  className?: string
  children: ReactNode
} & Record<`data-${string}`, string | boolean>) {
  const reduced = useReducedMotion()
  const rise = reduced ? 0 : LAB.windowIn.rise
  const drop = reduced ? 0 : LAB.windowOut.drop

  useEffect(() => {
    if (!open) return
    const el = panel.current
    const target =
      el?.querySelector<HTMLElement>('[data-autofocus]:not(:disabled)') ??
      el?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      el?.querySelector<HTMLElement>('.lab-panel-body button:not(:disabled), .lab-panel-body a[href]')
    target?.focus({ preventScroll: true })
    target?.scrollIntoView?.({ block: 'nearest' })
  }, [open, panel])

  return (
    <AnimatePresence>
      {open && (
        <m.div
          ref={panel}
          id={id}
          className={`lab-panel ${className}`}
          role="dialog"
          aria-labelledby={`${id}-h`}
          data-lenis-prevent
          {...data}
          initial={{ opacity: 0, y: rise }}
          animate={{
            opacity: 1,
            y: 0,
            transition: reduced
              ? { duration: sec(REDUCED.maxDuration) }
              : { duration: sec(LAB.windowIn.duration), ease: EASE_BEZIER, opacity: { duration: sec(LAB.windowIn.opacity), ease: EASE_BEZIER } },
          }}
          exit={{ opacity: 0, y: drop, transition: { duration: sec(reduced ? REDUCED.maxDuration : LAB.windowOut.duration), ease: EASE_BEZIER } }}
        >
          <div className="lab-window-bar lab-panel-bar">
            <h2 id={`${id}-h`}>{title}</h2>
            <button
              type="button"
              className="lab-panel-close"
              data-panel-close
              onClick={() => {
                onClose()
                button.current?.focus()
              }}
            >
              {closeLabel}
            </button>
          </div>
          <div className="lab-panel-body">{children}</div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
