import { routes } from '@/lib/lab/content'
import { labCard, labPath } from '@/lib/lab/og/render'

/** A section's share card (PR 3's approved design; `lib/lab/og`). One per section, prerendered at build. */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamicParams = false

export function generateStaticParams() {
  return routes()
    .filter((r) => r.kind === 'section')
    .map((r) => ({ section: r.path.split('/')[2] }))
}

export default async function Image({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  return labCard(labPath(section))
}
