'use client'

import { useSyncExternalStore } from 'react'

import { useOpenCard } from '@/components/desktop/open-context'
import { arcade } from '@/content/arcade'
import { getBestServerSnapshot, getBestSnapshot, subscribeBest } from '@/lib/best'

/** Minesweeper's best is a time, where lower is better; everything else is a score. */
function formatBest(id: string, value: number | undefined): string {
  if (!value) return arcade.noScore
  if (id !== 'mines') return value.toLocaleString()
  const m = Math.floor(value / 60)
  return `${m}:${String(value % 60).padStart(2, '0')}`
}

/**
 * The arcade launcher: four rows that each drill into their own card.
 *
 * One dock tile rather than four. The dock is a considered set of nine, and four toys would
 * unbalance it — this reuses the same drill-in pattern as Work and Experience, so the games
 * arrive as spawned cards that can sit side by side.
 */
export function ArcadeLauncher() {
  const bests = useSyncExternalStore(subscribeBest, getBestSnapshot, getBestServerSnapshot)
  const open = useOpenCard()

  return (
    <>
      <p className="lede">{arcade.lede}</p>
      {arcade.games.map((g) => (
        <button type="button" className="item" key={g.id} onClick={() => open(`game:${g.id}`)}>
          <span className="yr">{formatBest(g.id, bests[g.id])}</span>
          <span>
            <span className="ttl">{g.label}</span>
            <span className="sub">{g.sub}</span>
          </span>
          <span className="tag">{g.tag}</span>
        </button>
      ))}
    </>
  )
}
