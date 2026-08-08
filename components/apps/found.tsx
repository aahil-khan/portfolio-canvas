'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { useMeasuring } from '@/components/desktop/measuring-context'
import { deepSpace } from '@/content/eggs'
import { findEgg } from '@/lib/eggs'

const CLAIMED = 'canvas.found'

/**
 * The card parked in deep space.
 *
 * Pinned: it can't be dragged, and it's excluded from fit-all, tidy and every other arrangement.
 * Without that, framing "everything" would have to include a card thousands of world pixels away
 * and would shrink the real content to a speck.
 *
 * The count is a bit of warmth, not a metric. One visitor counts once, enforced here with a
 * localStorage flag and backstopped by the rate limit on the endpoint — both trivially
 * defeatable, which is fine for something whose only job is to say "others got here too".
 */
export function FoundIt() {
  const measuring = useMeasuring()
  const [count, setCount] = useState<number | null>(null)
  const [justClaimed, setJustClaimed] = useState(false)

  /*
   * Read through useSyncExternalStore rather than copied into state in an effect, which would
   * cascade a render on every mount. Nothing else ever writes this key, so the subscribe is a
   * no-op; the snapshot is a boolean, so it stays referentially stable.
   */
  const alreadyClaimed = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(CLAIMED) === '1'
      } catch {
        return false
      }
    },
    () => false,
  )
  const claimed = alreadyClaimed || justClaimed

  useEffect(() => {
    if (measuring) return
    let live = true
    fetch('/api/found')
      .then((r) => r.json())
      .then((d: { found?: number }) => live && setCount(d.found ?? 0))
      .catch(() => live && setCount(0))
    return () => {
      live = false
    }
  }, [measuring])

  /*
   * The egg is awarded on the click, NOT on mount.
   *
   * This card is pinned, so it is placed on the canvas at every boot whether or not anyone has
   * been near it — mounting is not evidence of anything. Pressing the button is the only signal
   * that a human actually panned out here and read it.
   */
  const claim = useCallback(async () => {
    if (claimed) return
    setJustClaimed(true)
    findEgg('deepspace')
    try {
      localStorage.setItem(CLAIMED, '1')
    } catch {
      /* private mode */
    }
    try {
      const res = await fetch('/api/found', { method: 'POST' })
      const d = (await res.json()) as { found?: number }
      if (typeof d.found === 'number') setCount(d.found)
    } catch {
      setCount((c) => (c ?? 0) + 1)
    }
  }, [claimed])

  const n = count ?? 0
  // once claimed the total includes you, so the interesting number is everyone else
  const others = Math.max(0, claimed ? n - 1 : n)
  const label = claimed
    ? others === 0
      ? deepSpace.claimedFirst
      : others === 1
        ? deepSpace.claimedOne
        : deepSpace.claimedMany.replace('{n}', String(others))
    : deepSpace.claim

  return (
    <div className="found">
      <p className="lede">{deepSpace.lede}</p>
      <p>{deepSpace.body}</p>
      <button type="button" className="btn" onClick={claim} disabled={claimed}>
        {label}
        {claimed ? null : (
          <span className="found__n"> ({deepSpace.soFar.replace('{n}', String(n))})</span>
        )}
      </button>
    </div>
  )
}
