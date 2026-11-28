'use client'

import { animate } from 'motion/mini'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { prefersReducedMotion } from '@/lib/motion/reduced'
import { EASE_BEZIER, LAB, REDUCED, sec } from '@/lib/motion/tokens'

const onPop = (cb: () => void) => {
  window.addEventListener('popstate', cb)
  return () => window.removeEventListener('popstate', cb)
}
const kindInUrl = () => new URLSearchParams(location.search).get('kind') ?? 'all'

/**
 * The index's kind filter (plan PR 9): one row of buttons, Everything and each kind the Lab holds,
 * shown rather than folded into a menu. It works on the server-rendered list around it
 * (`[data-index]`): rows of other kinds are hidden, a year left with none is hidden with them, and
 * the rows that return rise in as the home's bands do. The choice is kept in the address
 * (`?kind=`), so a filtered index can be linked to and Back undoes it.
 *
 * With JavaScript off the row is not shown at all (lists.css, `scripting: none`) and every entry is
 * listed, so nothing on the page needs a script to work.
 */
export function KindFilter({
  kinds,
  label,
  shown,
}: {
  /** `[value, label]`, Everything first. */
  kinds: [string, string][]
  /** The group's name for assistive tech ("Show"). */
  label: string
  /** "Showing {count}", and the count's words by number: `[one, many]` with `{n}`. */
  shown: { template: string; one: string; many: string }
}) {
  const ref = useRef<HTMLDivElement>(null)
  // the address's ?kind= (Everything on the server), until the reader picks one here
  const linked = useSyncExternalStore(onPop, kindInUrl, () => 'all')
  const [chosen, setChosen] = useState<string | null>(null)
  const kind = chosen ?? (kinds.some(([v]) => v === linked) ? linked : 'all')
  const [said, setSaid] = useState('')

  const apply = useCallback(
    (k: string, { motion }: { motion: boolean }) => {
      const root = ref.current?.closest('[data-index]')
      if (!root) return
      const back: HTMLElement[] = []
      let count = 0
      for (const row of root.querySelectorAll<HTMLElement>('[data-years] li[data-kind]')) {
        const on = k === 'all' || row.dataset.kind === k
        if (on && row.hidden) back.push(row)
        row.hidden = !on
        if (on) count += 1
      }
      for (const year of root.querySelectorAll<HTMLElement>('[data-year]')) year.hidden = !year.querySelector('li[data-kind]:not([hidden])')
      if (motion && back.length) {
        const reduced = prefersReducedMotion()
        back.slice(0, 24).forEach((row, i) =>
          animate(
            row,
            reduced ? { opacity: [0, 1] } : { opacity: [0, 1], transform: [`translateY(${LAB.windowIn.rise}px)`, 'translateY(0px)'] },
            { duration: sec(reduced ? REDUCED.maxDuration : LAB.page.duration), delay: reduced ? 0 : sec(i * LAB.bandStagger), ease: EASE_BEZIER },
          ),
        )
      }
      return count
    },
    [],
  )

  // a linked ?kind= applies once the page is live, and again on Back or Forward
  useEffect(() => {
    if (chosen === null) apply(kind, { motion: false })
  }, [kind, chosen, apply])

  const choose = (k: string) => {
    if (k === kind) return
    setChosen(k)
    const n = apply(k, { motion: true }) ?? 0
    setSaid(shown.template.replace('{count}', (n === 1 ? shown.one : shown.many).replace('{n}', String(n))))
    const url = new URL(location.href)
    if (k === 'all') url.searchParams.delete('kind')
    else url.searchParams.set('kind', k)
    history.replaceState(history.state, '', url)
  }

  return (
    <div className="lab-filter" ref={ref} data-kind-filter="">
      <div className="lab-filter-row" role="group" aria-label={label}>
        {kinds.map(([value, text]) => (
          <button key={value} type="button" className="lab-filter-btn" data-filter={value} aria-pressed={kind === value} onClick={() => choose(value)}>
            {text}
          </button>
        ))}
      </div>
      <p className="sr" aria-live="polite">
        {said}
      </p>
    </div>
  )
}
