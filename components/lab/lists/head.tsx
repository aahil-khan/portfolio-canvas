import Link from 'next/link'
import type { ReactNode } from 'react'

import './lists.css'

/**
 * The top of a list page: the eyebrow (its "The Lab" a quiet link home), the title, and the line
 * under it. `size="hero"` is a section page's title, the Lab's only hero size (DIRECTION, "The Lab
 * → Type"); every other list page takes the entry title's size.
 */
export function ListHead({
  lab,
  eyebrow,
  title,
  lede,
  size = 'title',
  children,
}: {
  /** The words "The Lab", linked to the home. */
  lab: string
  /** Anything after them ("· a tag"), already worded by the copy. */
  eyebrow?: string
  title: string
  lede?: ReactNode
  size?: 'hero' | 'title'
  children?: ReactNode
}) {
  return (
    <div className="lab-lhead" data-list-head="">
      <p className="lab-eyebrow lab-lhead-eyebrow">
        <Link className="quiet" href="/lab">
          {lab}
        </Link>
        {eyebrow ? <span>{eyebrow}</span> : null}
      </p>
      <h1 className={size === 'hero' ? 'lab-lhead-hero' : 'lab-lhead-title'}>{title}</h1>
      {lede ? <p className="lab-lhead-lede">{lede}</p> : null}
      {children}
    </div>
  )
}

/** "→", drawn: a text arrow would count against rule 6, and this one is decoration. */
export function Arrow() {
  return (
    <svg className="lab-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M2 8h11M9 4l4 4-4 4" />
    </svg>
  )
}
