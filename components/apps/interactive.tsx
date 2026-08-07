'use client'

import type { ReactNode } from 'react'

import { useOpenCard } from '@/components/desktop/open-context'

/** A row in Work or Experience that drills into a detail card. */
export function DetailRow({
  cardId,
  year,
  title,
  sub,
  tag,
}: {
  cardId: string
  year: string
  title: string
  sub?: string
  tag?: string
}) {
  const open = useOpenCard()
  return (
    <button type="button" className="item" onClick={() => open(cardId)}>
      <span className="yr">{year}</span>
      <span>
        <span className="ttl">{title}</span>
        {sub ? <span className="sub">{sub}</span> : null}
      </span>
      {tag ? <span className="tag">{tag}</span> : null}
    </button>
  )
}

/**
 * The 16:9 screenshot slot. Fixed ratio, so dropping a real image in reflows nothing.
 * Clicking it promotes the shot to its own card, so shots can sit side by side.
 */
export function ShotSlot({ cardId, src, alt }: { cardId: string; src?: string; alt: string }) {
  const open = useOpenCard()
  return (
    <button type="button" className="shot" onClick={() => open(cardId)} aria-label={`Open ${alt}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- fixed-ratio slot, no layout shift
        <img src={src} alt={alt} />
      ) : (
        <span>
          Screenshot
          <small>click to open as a card</small>
        </span>
      )}
    </button>
  )
}

/** Non-interactive large version, used inside the promoted shot card. */
export function ShotFrame({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="shot" style={{ cursor: 'default', marginBottom: 0 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- fixed-ratio slot, no layout shift
        <img src={src} alt={alt} />
      ) : (
        <span>
          Screenshot
          <small>drop the image in here</small>
        </span>
      )}
    </div>
  )
}

/** Wraps arbitrary content in a button that opens another card. */
export function OpenCardButton({
  cardId,
  className,
  label,
  children,
}: {
  cardId: string
  className?: string
  label: string
  children: ReactNode
}) {
  const open = useOpenCard()
  return (
    <button type="button" className={className} aria-label={label} onClick={() => open(cardId)}>
      {children}
    </button>
  )
}

export function OpenLink({ cardId, children }: { cardId: string; children: ReactNode }) {
  const open = useOpenCard()
  return (
    <button type="button" className="link" onClick={() => open(cardId)}>
      {children}
    </button>
  )
}
