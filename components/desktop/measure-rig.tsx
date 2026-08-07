'use client'

import { useLayoutEffect, useRef } from 'react'

import { AppIcon } from './app-icon'
import { MAX_CARD_H, type CardDef } from './card'

/**
 * Renders every card once, off-screen, to learn its real height.
 *
 * Placement needs a card's height *before* it exists, so without this a card that has never
 * been opened is placed using a guessed fallback — and a 640px card dropped into a 320px slot
 * overlaps whatever is below it. Dock cards mostly got away with it; project and screenshot
 * cards, which are only ever spawned, did not.
 *
 * The rig unmounts as soon as the measurements are taken, so this costs one hidden layout pass.
 */
export function MeasureRig({
  cards,
  onMeasured,
}: {
  cards: readonly CardDef[]
  onMeasured: (heights: Map<string, number>) => void
}) {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const node = root.current
    if (!node) return
    const heights = new Map<string, number>()
    node.querySelectorAll<HTMLElement>('[data-measure]').forEach((el) => {
      heights.set(el.dataset.measure!, Math.min(MAX_CARD_H, el.offsetHeight))
    })
    onMeasured(heights)
  }, [onMeasured])

  return (
    <div
      ref={root}
      aria-hidden
      style={{
        position: 'absolute',
        left: -99999,
        top: 0,
        visibility: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {cards.map((c) => (
        // same structure and classes as a real card, but height:auto so it reports its content
        <div
          key={c.id}
          data-measure={c.id}
          className="card"
          style={{
            width: c.width,
            ['--c' as string]: c.colour,
            ['--c-soft' as string]: c.tint,
          }}
        >
          <div className="card__head">
            <span className="card__ico">
              <AppIcon name={c.icon} size={15} />
            </span>
            <span className="card__name">{c.label}</span>
            <span className="card__x" />
          </div>
          <div className="card__body">{c.body}</div>
        </div>
      ))}
    </div>
  )
}
