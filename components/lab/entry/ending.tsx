import type { ReactNode } from 'react'

import type { EndingKind } from '@/lib/lab/types'
import { formatDay } from '@/lib/lab/view'

const LABEL: Record<EndingKind, string> = { do: 'endingDo', use: 'endingUse', measure: 'endingMeasure' }

/** "What I'd do now", dated as of the entry's last update so it never reads stale (rule E). */
export function Ending({ id, kind, asOf, today, copy, children }: { id: string; kind: EndingKind; asOf: string; today: string; copy: Record<string, string>; children: ReactNode }) {
  return (
    <aside className="lab-ending lab-prose" data-ending aria-labelledby={`end-${id}`}>
      <p className="lab-end-label" id={`end-${id}`}>
        <strong>{copy[LABEL[kind]]}</strong>
        <span className="meta">{copy.endingAsof}</span>
        <time dateTime={asOf}>{formatDay(asOf, today)}</time>
      </p>
      {children}
    </aside>
  )
}
