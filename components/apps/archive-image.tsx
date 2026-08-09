import { imageSize } from '@/lib/image-size'

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
 *
 * Deliberately inert. This used to be a button that spawned the image as its own card, which
 * made a picture in a feed the one thing on the card that moved when the pointer crossed it —
 * a hover state on something people are reading past, promising an interaction nobody was
 * looking for. The full-size card still exists and is still reachable by name from ⌘K; it just
 * isn't hiding under the thumbnail any more.
 */
export function ArchiveImage({ src, alt }: { src: string; alt: string }) {
  const size = imageSize(src)
  const ratio = size ? size.width / size.height : 16 / 9

  return (
    <span className="arc-img">
      <span className="arc-img__box" style={{ ['--ratio' as string]: `${ratio}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- dimensions known, so no shift */}
        <img src={src} alt={alt} width={size?.width} height={size?.height} loading="lazy" />
      </span>
    </span>
  )
}
