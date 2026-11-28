import type { CSSProperties, ReactNode } from 'react'

import type { Image } from '@/lib/lab/types'

/**
 * An essay's lead: its cover where it has one (`cover`), else its opening paragraph (`opening`),
 * set at the lede's size, in words alone (no box: rule K excepts it). The opening arrives rendered
 * from the body pipeline. It rises in on first view.
 */
export function Opening({ children }: { children: ReactNode }) {
  return (
    <div className="lab-opening" data-draw="in">
      {children}
    </div>
  )
}

export function Cover({ image }: { image: Image }) {
  return (
    <figure className="lab-shot" data-draw="in" style={{ '--ar': image.w / image.h } as CSSProperties}>
      {/* pre-sized WebP with its size declared (API.md §4); next/image would add a resizer the Lab does not need */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} width={image.w} height={image.h} alt={image.alt} fetchPriority="high" decoding="async" />
      {image.caption ? <figcaption className="lab-caption">{image.caption}</figcaption> : null}
    </figure>
  )
}
