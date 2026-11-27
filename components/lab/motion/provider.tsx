'use client'

import { LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

import { useReducedMotion } from '@/lib/motion/reduced'
import { EASE_BEZIER } from '@/lib/motion/tokens'

const features = () => import('./features').then((m) => m.default)

/**
 * Motion for the whole Lab: `LazyMotion` with `m` components only (strict), its features loaded
 * after first paint, and `MotionConfig` fed from the one owner of reduced motion
 * (`lib/motion/reduced.ts`), never `reducedMotion="user"`, so the query is read once
 * (DIRECTION, "The Lab → Motion and hover timing").
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <LazyMotion features={features} strict>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={{ ease: EASE_BEZIER }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
