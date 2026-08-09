import { imageSize } from '@/lib/image-size'

import type { ArchiveShot } from '@/content'

import { Carousel, type Slide } from './carousel'

/** Cap on a thumbnail's height, so a tall photo can't take over the feed it sits in. */
const MAX_H = 320

/**
 * The two custom properties that size a thumbnail, set on the FIGURE rather than the picture.
 *
 * `--max-h` is spent as a max-WIDTH derived from the ratio, never a max-height: a max-height
 * overrides `aspect-ratio` and silently reshapes the box, which is what once cropped a square
 * image into a 1.45:1 letterbox.
 *
 * On the figure, because the caption is the figure's other child. Sized on the picture alone,
 * the caption belonged to the column instead — a line about a 198px portrait ran the full 436px
 * of the card and wrapped past the picture's right edge, reading as another paragraph of note
 * rather than as a caption. Capping the figure makes the picture's width the caption's measure.
 */
const sizing = (ratio: number) => ({
  ['--ratio' as string]: `${ratio}`,
  ['--max-h' as string]: `${MAX_H}px`,
})

/**
 * The picture (or pictures) on an archive entry. SERVER component.
 *
 * Dimensions are read from the files at build time, so every frame is the right shape before
 * anything loads: no crop, no layout shift, and the card measures correctly on the first pass.
 *
 * Two things are opt-in per entry, and both default off:
 *
 * `images` — several files instead of one, paged with the same carousel the project cards use.
 * `fullscreen` — whether any of them can be opened in the big viewer.
 *
 * Off by default because of what happened when it wasn't. Every archive image used to be a
 * button that spawned the picture as its own card on the canvas, so the one thing in a feed you
 * scroll past was the one thing that lifted when the pointer crossed it, promising an
 * interaction nobody was reaching for. Most entries here are an aside next to a sentence. The
 * ones that are actually worth looking at closely say so.
 */
export function ArchiveImage({
  images,
  alt,
  fullscreen,
}: {
  images: readonly ArchiveShot[]
  alt: string
  fullscreen?: boolean
}) {
  if (images.length === 0) return null

  const slides: Slide[] = images.map((shot) => {
    const { src, caption } = typeof shot === 'string' ? { src: shot, caption: undefined } : shot
    const size = imageSize(src)
    return { src, caption, width: size?.width, height: size?.height }
  })

  const first = slides[0]
  const ratio = first.width && first.height ? first.width / first.height : 16 / 9

  /*
   * A single picture that can't be opened has nothing to run on the client — no paging, no
   * viewer — so it stays plain server-rendered markup rather than mounting a carousel to do
   * nothing. The sizing below reproduces what the frame would have been, so turning `fullscreen`
   * on changes whether there is a button, never how big the picture is.
   */
  if (slides.length === 1 && !fullscreen) {
    return (
      <figure className="arc-img" style={sizing(ratio)}>
        <span className="arc-img__box">
          {/* eslint-disable-next-line @next/next/no-img-element -- dimensions known, so no shift */}
          <img src={first.src} alt={alt} width={first.width} height={first.height} loading="lazy" />
        </span>
        {first.caption ? <figcaption className="arc-img__cap">{first.caption}</figcaption> : null}
      </figure>
    )
  }

  return (
    <figure className="arc-img arc-img--live" style={sizing(ratio)}>
      <Carousel
        slides={slides}
        alt={alt}
        ratio={ratio}
        className="carousel--arc"
        zoomable={fullscreen}
      />
    </figure>
  )
}
