'use client'

import * as m from 'motion/react-m'
import { useLayoutEffect, useState, type ReactNode } from 'react'

import { useReducedMotion } from '@/lib/motion/reduced'
import { EASE_BEZIER, LAB, REDUCED, sec } from '@/lib/motion/tokens'

/** False until the first Lab page has hydrated; every page mounted after that came by a soft navigation. */
let hydrated = false

/**
 * A page change (DIRECTION, "Motion and hover timing"; NEXT.md shortcut 3): scroll to the top first,
 * never animated, then the reading column fades and rises 8px over 240ms. The bar and the rail are
 * outside it and don't move. The first page of a visit renders as served: no fade, so the text is
 * there at first paint and with JavaScript off. Under reduced motion it is opacity only, 120ms.
 */
export function ColumnTransition({ className, children }: { className?: string; children: ReactNode }) {
  const reduced = useReducedMotion()
  const [first] = useState(() => !hydrated)

  useLayoutEffect(() => {
    if (!first) {
      window.__lenis?.scrollTo(0, { immediate: true, force: true })
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
    hydrated = true
  }, [first])

  return (
    <m.div
      className={className}
      initial={first ? false : reduced ? { opacity: 0 } : { opacity: 0, y: LAB.page.rise }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: sec(reduced ? REDUCED.maxDuration : LAB.page.duration), ease: EASE_BEZIER }}
    >
      {children}
    </m.div>
  )
}
