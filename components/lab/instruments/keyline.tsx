import type { ReactNode } from 'react'

/**
 * A chapter's or note's key line (`keyline`, the end of their chains), and a study's newest log
 * line (`logline`): one sentence set at the lede's size in a box, with its date in the hand where
 * it has one. The key line arrives rendered (links and all) from the body pipeline.
 */
export function Keyline({ children }: { children: ReactNode }) {
  return (
    <div className="lab-keyline box" data-box data-draw="in">
      {children}
    </div>
  )
}

export function Logline({ did, date }: { did: string; date?: ReactNode }) {
  return (
    <div className="lab-keyline box" data-box data-draw="in">
      {date ? <p className="lab-keyline-date">{date}</p> : null}
      <p>{did}</p>
    </div>
  )
}
