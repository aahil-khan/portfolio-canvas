import { imageSize } from '@/lib/image-size'

import { Carousel, type Slide } from './carousel'
import { ShotSlot } from './interactive'

/**
 * Screenshots for a project or role. SERVER component.
 *
 * Reads every image's real dimensions from disk at build time and hands them to the client
 * carousel, so the frame is the right shape before anything loads — no layout shift, and the
 * card's measured height is correct on the first pass.
 *
 * With no images it falls back to the dashed placeholder slot, so an entry with nothing
 * attached still shows where a screenshot would go.
 */
export function Shots({
  images,
  cardId,
  alt,
  full,
}: {
  images?: readonly string[]
  /** Card to open when a slide is clicked. Omit inside the full-size card itself. */
  cardId?: string
  alt: string
  full?: boolean
}) {
  const list = images ?? []

  if (list.length === 0) {
    return full ? (
      <div className="shot" style={{ cursor: 'default', marginBottom: 0 }}>
        <span>
          Screenshot
          <small>drop the image in here</small>
        </span>
      </div>
    ) : (
      <ShotSlot cardId={cardId ?? ''} alt={alt} />
    )
  }

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
      cardId={cardId}
      ratio={ratio}
      className={full ? 'carousel--full' : undefined}
    />
  )
}
