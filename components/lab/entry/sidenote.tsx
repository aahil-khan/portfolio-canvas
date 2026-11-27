import type { ReactNode } from 'react'

/**
 * A sidenote outside a body, in the text column (on entries the rail took the margin, decision 6).
 * Sidenotes written in a body (`:::side`) are rendered by the pipeline as `aside[data-side]` and
 * styled the same way.
 */
export function Sidenote({ children }: { children: ReactNode }) {
  return (
    <aside className="lab-sidenote" data-side="">
      {children}
    </aside>
  )
}
