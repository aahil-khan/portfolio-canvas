'use client'

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from 'react'

import { useDragObject } from '@/lib/canvas/use-drag-object'

import { AppIcon } from './app-icon'

export interface CardDef {
  id: string
  label: string
  icon: string
  colour: string
  tint: string
  width: number
  rotate: number
  body: ReactNode
  /**
   * Parked at a fixed spot and invisible to every layout algorithm.
   *
   * The deep-space card sits far outside the normal camera bounds on purpose. If it took part in
   * `fitAll`, `arrange` or `randomise` it would drag the framing out to include it and shrink
   * everything else to nothing — so those skip it, and it can't be dragged out of position.
   */
  pinned?: boolean
  /**
   * A fixed home in world coordinates, applied on every boot.
   *
   * Pinned cards are re-placed here even when a saved session says otherwise, so closing the
   * deep-space card doesn't retire the easter egg permanently.
   */
  at?: { x: number; y: number }
}

interface Props {
  def: CardDef
  x: number
  y: number
  z: number
  focused: boolean
  /** Screen rect of the dock icon this grew from, for the open animation. */
  origin?: DOMRect | null
  /** Arrangement override for the card's resting tilt. Falls back to its own `rotate`. */
  rotate?: number
  /** True only while an arrangement is animating, so drags stay instant. */
  arranging?: boolean
  /** Set to play the exit animation; the card unmounts when it finishes. */
  closing?: boolean
  onClosed: (id: string) => void
  onMeasure: (id: string, height: number) => void
  onMove: (id: string, x: number, y: number) => void
  onRaise: (id: string) => void
  onClose: (id: string) => void
  onFocusInto: (id: string) => void
  toWorld: (px: number, py: number) => { x: number; y: number }
  /** Current camera scale — needed to convert screen deltas into this card's local space. */
  scale: () => number
}

/** Cards taller than this scroll internally. Everything else sizes to its content. */
export const MAX_CARD_H = 640

export function Card({
  def, x, y, z, focused, origin, closing, rotate, arranging,
  onMeasure, onMove, onRaise, onClose, onClosed, onFocusInto, toWorld, scale,
}: Props) {
  const el = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const played = useRef(false)
  const tilt = rotate ?? def.rotate

  // Height is measured, never declared. Every hand-picked height in the prototype was wrong
  // (one by 243px) because checking scrollHeight vs clientHeight detects overflow but is
  // structurally blind to slack.
  useLayoutEffect(() => {
    if (el.current) onMeasure(def.id, el.current.offsetHeight)
  }, [def.id, onMeasure])

  useDragObject({
    nodeRef: el,
    handleRef: head,
    x,
    y,
    toWorld,
    onMove: useCallback((nx: number, ny: number) => onMove(def.id, nx, ny), [def.id, onMove]),
    onRaise: useCallback(() => onRaise(def.id), [def.id, onRaise]),
    onDoubleTap: useCallback(() => onFocusInto(def.id), [def.id, onFocusInto]),
    disabled: def.pinned,
  })

  /**
   * Transform that takes this card's screen rect onto `target`'s screen rect.
   *
   * The card sits inside `#world`, which is scaled, so a transform written here is applied in
   * LOCAL space and then multiplied by the camera scale. Screen-space deltas must therefore be
   * divided by that scale, or the card flies to the wrong place at any zoom but 100%. The size
   * ratio needs no correction — it's a ratio of two screen measurements, so the scale cancels.
   * Deltas are measured centre-to-centre because `transform-origin` is the centre.
   */
  const morphTo = useCallback(
    (from: DOMRect, target: DOMRect) => {
      const s = scale() || 1
      const dx = (target.left + target.width / 2 - (from.left + from.width / 2)) / s
      const dy = (target.top + target.height / 2 - (from.top + from.height / 2)) / s
      return `translate(${dx}px,${dy}px) rotate(${tilt}deg) scale(${target.width / from.width},${target.height / from.height})`
    },
    [tilt, scale],
  )

  /* --- open animation: grow out of the dock icon, or pop in place --- */
  useEffect(() => {
    const node = el.current
    if (!node || played.current) return
    played.current = true
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const rect = node.getBoundingClientRect()
    if (origin && rect.width > 0) {
      node.animate(
        [
          { transform: morphTo(rect, origin), opacity: 0, borderRadius: '23.5%' },
          {
            transform: `rotate(${tilt}deg)`,
            opacity: 1,
            borderRadius: 'var(--radius-card)',
          },
        ],
        { duration: 340, easing: 'cubic-bezier(.16,1,.3,1)' },
      )
    } else {
      node.animate(
        [
          { transform: `rotate(${tilt}deg) scale(.92)`, opacity: 0 },
          { transform: `rotate(${tilt}deg) scale(1)`, opacity: 1 },
        ],
        { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' },
      )
    }
  }, [origin, tilt, morphTo])

  /*
   * Exit animation. The card can't just be dropped from state — unmounting it immediately is
   * what made closing feel abrupt. It shrinks back into its dock icon (or in place, for cards
   * with no dock home) and only then tells the parent to remove it.
   */
  useEffect(() => {
    if (!closing) return
    const node = el.current
    const finish = () => onClosed(def.id)
    if (!node || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish()
      return
    }
    const from = node.getBoundingClientRect()
    const icon = document.querySelector<HTMLElement>(`[data-app-id="${def.id}"]`)
    const to = icon?.getBoundingClientRect()

    /*
     * `fill: 'forwards'` matters here. Without it the animation reverts to the element's own
     * styles the instant it finishes, so the card flashes back at full opacity for the frame or
     * two before React unmounts it — reading as a ghost of the card you just closed.
     */
    const opts: KeyframeAnimationOptions = {
      duration: to ? 300 : 220,
      easing: 'cubic-bezier(.16,1,.3,1)',
      fill: 'forwards',
    }
    const anim = to
      ? node.animate(
          [
            { transform: `rotate(${tilt}deg)`, opacity: 1 },
            { transform: morphTo(from, to), opacity: 0, borderRadius: '23.5%' },
          ],
          opts,
        )
      : node.animate(
          [
            { transform: `rotate(${tilt}deg) scale(1)`, opacity: 1 },
            { transform: `rotate(${tilt}deg) scale(.9)`, opacity: 0 },
          ],
          opts,
        )
    anim.onfinish = finish
    anim.oncancel = finish
  }, [closing, def.id, tilt, onClosed, morphTo])

  return (
    <div
      ref={el}
      data-obj
      data-card
      data-pinned={def.pinned || undefined}
      className={arranging ? 'card is-arranging' : 'card'}
      style={{
        left: x,
        top: y,
        zIndex: z,
        width: def.width,
        maxHeight: MAX_CARD_H,
        transform: def.rotate ? `rotate(${tilt}deg)` : undefined,
        ['--c' as string]: def.colour,
        ['--c-soft' as string]: def.tint,
      }}
      data-focused={focused || undefined}
      onPointerDownCapture={() => onRaise(def.id)}
    >
      <div ref={head} className="card__head">
        <span className="card__ico">
          <AppIcon name={def.icon} size={15} />
        </span>
        <span className="card__name">{def.label}</span>
        <button
          type="button"
          className="card__x"
          aria-label={`Close ${def.label}`}
          onClick={(e) => {
            e.stopPropagation()
            onClose(def.id)
          }}
        />
      </div>
      <div className="card__body">{def.body}</div>
    </div>
  )
}
