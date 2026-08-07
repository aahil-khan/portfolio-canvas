import { imageSize } from '@/lib/image-size'

/** The full-size view of an archive image — its real shape, nothing cropped. */
export function ArchiveFull({ src, alt }: { src: string; alt: string }) {
  const size = imageSize(src)
  return (
    <div className="arc-full" style={{ aspectRatio: size ? `${size.width} / ${size.height}` : '16 / 9' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- dimensions known, no layout shift */}
      <img src={src} alt={alt} width={size?.width} height={size?.height} />
    </div>
  )
}
