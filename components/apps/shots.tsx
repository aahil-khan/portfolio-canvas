import { imageSize } from '@/lib/image-size'

import { Carousel, type Slide } from './carousel'

/**
 * Screenshots for a project or role. SERVER component.
 *
 * Reads every image's real dimensions from disk at build time and hands them to the client
 * carousel, so the frame is the right shape before anything loads — no layout shift, and the
 * card's measured height is correct on the first pass.
 *
 * An entry with no images renders nothing. There was a dashed "drop a screenshot here" slot
 * here before, which is a note to the author showing on a stranger's screen — three of the
 * eight entries carried one.
 */
export function Shots({
  images,
  alt,
  full,
}: {
  images?: readonly string[]
  alt: string
  full?: boolean
}) {
  const list = images ?? []
  if (list.length === 0) return null

  const slides: Slide[] = list.map((src) => {
    const size = imageSize(src)
    return { src, width: size?.width, height: size?.height }
  })

  // the frame takes the FIRST slide's shape; the author controls order, and every other slide
  // is drawn `contain` inside it rather than cropped to match
  const first = slides[0]
  const ratio = first.width && first.height ? first.width / first.height : 16 / 9

  return (
    <Carousel
      slides={slides}
      alt={alt}
      ratio={ratio}
      className={full ? 'carousel--full' : undefined}
    />
  )
}
