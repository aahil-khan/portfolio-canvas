'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { PreviewData } from '@/lib/lab/preview/data'
import { useReducedMotion } from '@/lib/motion/reduced'

import { Delegate, type Recorded } from './delegate'
import { Stack } from './stack'
import type { Win } from './window'

import './preview.css'

export type { Recorded }

export interface ControllerProps {
  queue: Recorded[]
  onReady: () => void
}

/**
 * The previews, once a reader has shown intent: the delegated controller (`delegate.ts`) and the
 * stack it opens. Loaded on demand by `PreviewRoot` (index.tsx), with Floating UI, the windows and
 * their CSS. React state changes only when a window opens or closes, and when the cards' data
 * arrives; pointer moves never reach it.
 */
export function Controller({ queue, onReady }: ControllerProps) {
  const reduced = useReducedMotion()
  const pathname = usePathname()
  const [wins, setWins] = useState<Win[]>([])
  const [data, setData] = useState<PreviewData | null>(null)
  const [delegate] = useState(() => new Delegate(setWins, setData))

  useEffect(() => {
    const stop = delegate.attach(queue)
    onReady()
    return stop
  }, [delegate, queue, onReady])

  // a page change closes the stack (the first path is the one it loaded on: nothing to close)
  useEffect(() => {
    delegate.pageIs(pathname)
  }, [pathname, delegate])

  return <Stack wins={wins} data={data} elAt={delegate.elAt} register={delegate.register} onClose={delegate.close} onHidden={delegate.hidden} reduced={reduced} />
}
