'use client'

import { AnimatePresence } from 'motion/react'

import type { PreviewData } from '@/lib/lab/preview/data'

import { PreviewWindow, type Win } from './window'

/**
 * The stack (DIRECTION "Windows, cards and the sheet"): at most three windows, each opened from a
 * link in the one under it, cascading to the right. Exits play out through `AnimatePresence`, so a
 * closed window leaves in 120ms rather than vanishing.
 */
export function Stack({
  wins,
  data,
  elAt,
  register,
  onClose,
  onHidden,
  reduced,
}: {
  wins: Win[]
  data: PreviewData | null
  elAt: (level: number) => HTMLElement | null
  register: (n: number, el: HTMLElement | null) => void
  onClose: (level: number) => void
  onHidden: (level: number) => void
  reduced: boolean
}) {
  return (
    <div className="lab-pv-layer" data-preview-layer data-count={wins.length}>
      <AnimatePresence>
        {wins.map((w) => (
          <PreviewWindow
            key={w.n}
            win={w}
            data={data}
            parent={() => (w.level > 0 ? elAt(w.level - 1) : null)}
            register={register}
            onClose={onClose}
            onHidden={onHidden}
            reduced={reduced}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
