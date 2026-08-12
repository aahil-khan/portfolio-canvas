'use client'

import { useId, useState } from 'react'

import { site } from '@/content'
import { rich } from '@/lib/rich'

/**
 * One role in the Experience section — collapsed on phones, always open on a desktop.
 *
 * The collapse is driven by `data-open` and CSS, NOT by conditionally rendering the body, and
 * that matters for two reasons:
 *
 *  - **No jump.** The server always emits `data-open="0"`, and the media query hides the body
 *    during the first paint. Deciding in JavaScript instead would mean shipping every card open
 *    and snapping them shut at hydration.
 *  - **No JavaScript, no collapse.** The rule is gated on `@media (scripting: enabled)`, so a
 *    browser with JS off never hides anything behind a control that cannot work. Same technique
 *    the reveal-on-scroll uses to keep the page readable.
 *
 * The toggle is `display: none` above the breakpoint, which also takes it out of the
 * accessibility tree — so `aria-expanded="false"` is never announced next to a body that is
 * plainly visible.
 */
export function JobCard({
  slug,
  period,
  place,
  role,
  company,
  lede,
  highlights,
  stack,
}: {
  slug: string
  period: string
  place: string
  role: string
  company: string
  lede: string
  highlights: readonly string[]
  stack: readonly string[]
}) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()

  return (
    <article className="job reveal" id={`job-${slug}`} data-job data-open={open ? '1' : '0'}>
      <p className="job__when">
        <b>{period}</b>
        {place}
      </p>

      <h3>
        <button
          type="button"
          className="job__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          <span>
            {role} <span className="job__at">— {company}</span>
          </span>
          <span className="job__chev" aria-hidden />
          <span className="job__sr">{open ? site.experience.collapse : site.experience.expand}</span>
        </button>
      </h3>

      <div className="job__body" id={bodyId}>
        <p className="job__lede">{rich(lede)}</p>
        <ul className="job__points">
          {highlights.map((h, i) => (
            <li key={i}>{rich(h)}</li>
          ))}
        </ul>
        <div className="s-chips">
          {stack.map((t) => (
            <span className="s-chip" key={t}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}
