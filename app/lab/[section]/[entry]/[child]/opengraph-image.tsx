import { routes } from '@/lib/lab/content'
import { labCard, labPath } from '@/lib/lab/og/render'

/** A chapter's or a study note's share card (PR 3's approved design; `lib/lab/og`). One per child, prerendered at build. */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamicParams = false

export function generateStaticParams() {
  return routes()
    .filter((r) => r.kind === 'entry')
    .map((r) => r.path.split('/').slice(2))
    .filter((s) => s.length === 3)
    .map(([section, entry, child]) => ({ section, entry, child }))
}

export default async function Image({ params }: { params: Promise<{ section: string; entry: string; child: string }> }) {
  const { section, entry, child } = await params
  return labCard(labPath(section, entry, child))
}
