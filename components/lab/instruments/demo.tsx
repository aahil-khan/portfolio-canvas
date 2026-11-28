'use client'

import { useState, type CSSProperties } from 'react'

import type { Demo as DemoData } from '@/lib/lab/types'
import { MOTION_QUERY, useReducedMotion } from '@/lib/motion/reduced'

import { useLeadUse } from './live'

/**
 * A build's looping demo (`demo`). The animated WebP plays only for a reader who has not asked for
 * reduced motion, chosen by the browser through `<picture>` with the one owner's query
 * (`MOTION_QUERY`), so it is right before any script runs and with JavaScript off; everyone else
 * sees the still poster. A Pause button (WCAG 2.2.2: anything moving for over five seconds can be
 * stopped) swaps in the poster and back; it needs JavaScript, and is not offered under reduced
 * motion, where nothing moves.
 */
export function Demo({ demo, labels }: { demo: DemoData; labels: { pause: string; play: string } }) {
  const [paused, setPaused] = useState(false)
  const reduced = useReducedMotion()
  const used = useLeadUse('demo')
  return (
    <figure className="lab-shot lab-demo-shot" data-draw="in" style={{ '--ar': demo.w / demo.h } as CSSProperties}>
      <picture>
        {paused ? null : <source media={MOTION_QUERY} srcSet={demo.src} width={demo.w} height={demo.h} />}
        <img src={demo.poster} width={demo.w} height={demo.h} alt={demo.alt} fetchPriority="high" decoding="async" />
      </picture>
      {reduced ? null : (
        <button
          type="button"
          className="lab-chip lab-demo-toggle"
          data-needs-js
          onClick={() => {
            used()
            setPaused((p) => !p)
          }}
        >
          {paused ? labels.play : labels.pause}
        </button>
      )}
      {demo.caption ? <figcaption className="lab-caption">{demo.caption}</figcaption> : null}
    </figure>
  )
}
