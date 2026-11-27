'use client'

import { useSyncExternalStore } from 'react'

import { bareillyTime } from '@/lib/lab/view'

let now = ''
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

function tick() {
  now = bareillyTime()
  for (const l of listeners) l()
  timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
}
function subscribe(l: () => void) {
  listeners.add(l)
  if (listeners.size === 1) tick()
  return () => {
    listeners.delete(l)
    if (!listeners.size) clearTimeout(timer)
  }
}

/**
 * The time in Bareilly, beside the city's name in the footer. The server renders no time (it
 * would be the build's), so the first client render agrees with the HTML and the time appears
 * after hydration, ticking on the minute.
 */
export function Clock({ city }: { city: string }) {
  const time = useSyncExternalStore(subscribe, () => now, () => '')
  return (
    <span data-clock>
      {city}
      {time ? <span className="lab-clock-time"> {time}</span> : null}
    </span>
  )
}
