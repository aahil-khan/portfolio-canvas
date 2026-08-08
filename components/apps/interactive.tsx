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
