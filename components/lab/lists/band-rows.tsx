'use client'

import { useInView } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

import { useReducedMotion } from '@/lib/motion/reduced'
import { EASE_BEZIER, LAB, REDUCED, sec } from '@/lib/motion/tokens'

/** Bands whose rows have revealed this visit. A full load is a new visit; a soft navigation is not. */
const seen = new Set<string>()

const noop = () => () => {}
/** False while hydrating server HTML, true when this component first mounts on the client. */
const useClientMount = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )

export interface BandRow {
  key: string
  kind: string
  node: ReactNode
}

/**
 * A home band's rows (DIRECTION, "Motion and hover timing"): the first time the band enters the
 * viewport, its rows rise 8px and fade in, 30ms apart, once a visit.
 *
 * Nothing is ever hidden from a reader who cannot see the reveal. The server renders every row
 * visible, so with JavaScript off the band is complete; a band already on screen when the page
 * hydrates is marked seen and left as it is (no flash of hidden text); only a band still below
 * the fold is hidden, instantly, and revealed when it scrolls in. A page that arrives by a soft
 * navigation is rendered on the client, so its unseen bands start hidden and reveal as they enter.
 * Under reduced motion the reveal is opacity only, within 120ms.
 */
export function BandRows({ id, rows, className }: { id: string; rows: BandRow[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const clientMount = useClientMount()
  // a page rendered on the client (a soft navigation) starts its unseen bands hidden
  const [startHidden] = useState(() => clientMount && !seen.has(id))
  // a page hydrated in place hides only a band still below the fold, before it can be seen
  const [armed, setArmed] = useState(false)
  const inView = useInView(ref, { once: true, amount: 0.15 })
  const state: 'shown' | 'hidden' = (startHidden || armed) && !inView ? 'hidden' : 'shown'

  useLayoutEffect(() => {
    const ul = ref.current
    if (!ul || seen.has(id) || clientMount) return
    const r = ul.getBoundingClientRect()
    if (r.top < window.innerHeight && r.bottom > 0) seen.add(id)
    else setArmed(true)
    // mount only: the band's first position decides it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (inView) seen.add(id)
  }, [inView, id])

  const rise = reduced ? 0 : LAB.page.rise
  const duration = sec(reduced ? REDUCED.maxDuration : LAB.page.duration)
  return (
    // the observer watches this box, which never remounts; the list inside remounts once if it is
    // hidden after hydrating, because Motion applies `initial` at render, before its features load
    <div ref={ref} className="lab-band-rows">
    <m.ul
      key={armed ? 'armed' : 'served'}
      className={className}
      data-band-rows=""
      data-reveal={state}
      data-armed={startHidden || armed ? '' : undefined}
      initial={startHidden || armed ? 'hidden' : false}
      animate={state}
      variants={{ shown: { transition: { staggerChildren: reduced ? 0 : sec(LAB.bandStagger) } }, hidden: {} }}
    >
      {rows.map((r) => (
        <m.li
          key={r.key}
          className="lab-lrow"
          data-kind={r.kind}
          variants={{
            hidden: { opacity: 0, transform: `translateY(${rise}px)`, transition: { duration: 0 } },
            shown: { opacity: 1, transform: 'translateY(0px)', transition: { duration, ease: EASE_BEZIER } },
          }}
        >
          {r.node}
        </m.li>
      ))}
    </m.ul>
    </div>
  )
}
