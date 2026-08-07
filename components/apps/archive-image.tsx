import { imageSize } from '@/lib/image-size'

import { OpenCardButton } from './interactive'

/**
 * An archive image, shown at its own shape.
 *
 * Dimensions are read from the file at build time, so the box has the right aspect ratio before
 * the image loads: no crop, no layout shift, and the card measures correctly on the first pass.
 *
 * The size cap is applied as a `max-width` derived from the ratio, NOT as `max-height`. A
 * `max-height` overrides `aspect-ratio` and silently reshapes the box — that bug cropped a
 * square image into a 1.45:1 letterbox. Capping the width instead keeps the box exactly the
 * image's shape however it is constrained, so nothing is ever cut off.
 */
export function ArchiveImage({ cardId, src, alt }: { cardId: string; src: string; alt: string }) {
  const size = imageSize(src)
  const ratio = size ? size.width / size.height : 16 / 9

  return (
    <OpenCardButton cardId={cardId} className="arc-img" label={`Open ${alt} full size`}>
      <span className="arc-img__box" style={{ ['--ratio' as string]: `${ratio}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- dimensions known, so no shift */}
        <img src={src} alt={alt} width={size?.width} height={size?.height} loading="lazy" />
      </span>
    </OpenCardButton>
  )
}
