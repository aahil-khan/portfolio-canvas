import 'server-only'

import { ImageResponse } from 'next/og'

import { getLab } from '../content.ts'
import { t } from '../view.ts'
import { OG_SIZE, cardTree } from './card.ts'
import { cardFonts } from './fonts.ts'
import { cardFor } from './model.ts'
import { OG_THEME, palette } from './palette.ts'
import { rasterStill } from './raster.ts'

/**
 * One Lab page's share card as a 1200 × 630 PNG: what the four `opengraph-image.tsx` files under
 * `app/lab/` return. Each of them is prerendered at build, so this runs in `next build` alone.
 *
 * Drawn in `OG_THEME`, Lab Dark: a card can't follow a visitor's theme, so it takes the Lab's
 * default. Nothing here fetches: the fonts and the picture are files on disk.
 */
export async function labCard(pagePath: string, theme: string = OG_THEME): Promise<Response> {
  const model = cardFor(pagePath)
  if (!model) return new Response(null, { status: 404 })
  const { fonts, metrics } = cardFonts()
  const still = model.image ? await rasterStill(model.image.file) : null
  const tree = cardTree(model, palette(theme), metrics, still, t(getLab().copy, 'barMark'))
  // the tree is plain { type, props } objects, which is what satori reads JSX as
  return new ImageResponse(tree as unknown as React.ReactElement, { ...OG_SIZE, fonts })
}

/** The path of a Lab page from its route's params, for `labCard`. */
export const labPath = (...segments: string[]) => ['/lab', ...segments].join('/')
