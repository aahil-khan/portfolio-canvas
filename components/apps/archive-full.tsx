import { imageSize } from '@/lib/image-size'

/**
 * The full-size view of an archive image — its real shape, nothing cropped.
 *
 * Lazy, deliberately. This card is spawned only when someone opens it, but MeasureRig renders
 * every card that exists at boot, so an eager image here meant every archive picture was
 * downloaded on the canvas home page for cards nobody had opened. The wrapper carries the real
 * aspect ratio, so the measured height is identical either way.
 */
export function ArchiveFull({ src, alt }: { src: string; alt: string }) {
  const size = imageSize(src)
  return (
    <div className="arc-full" style={{ aspectRatio: size ? `${size.width} / ${size.height}` : '16 / 9' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- dimensions known, no layout shift */}
      <img src={src} alt={alt} width={size?.width} height={size?.height} loading="lazy" decoding="async" />
    </div>
  )
}
