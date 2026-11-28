import { labCard } from '@/lib/lab/og/render'

/** The Lab home's share card (PR 3's approved design; `lib/lab/og`). Prerendered at build. */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamic = 'force-static'

export default function Image() {
  return labCard('/lab')
}
