import 'server-only'

import { STILL_BOX, fitWhole, type Still } from './card.ts'

/**
 * An entry's picture, as a PNG the card can draw. `next/og` draws with resvg, which paints a WebP
 * as an empty frame, and every Lab image is WebP; `sharp` is the one WebP decoder installed.
 *
 * **The only file outside `scripts/` that may import `sharp`** (CLAUDE.md's import table, and
 * `check:bundles`), on two conditions: it is `server-only`, and it runs at build time alone. Every
 * Lab card is prerendered by `next build` (`generateStaticParams`, `dynamicParams = false` on each
 * `opengraph-image`), so no request ever reaches it.
 *
 * The picture is kept whole: scaled to fit the card's image column (`fitWhole`), never cropped,
 * never enlarged. Its own size is read from the file, not trusted from the data.
 *
 * If `sharp` can't be loaded, or the file can't be read, this returns `null` and the card is drawn
 * with its words alone. A missing picture must never fail the build.
 */
type SharpModule = { default: (input: string, opts?: object) => SharpLike }
interface SharpLike {
  metadata(): Promise<{ width?: number; height?: number; pageHeight?: number }>
  resize(w: number, h: number, opts?: object): SharpLike
  png(): SharpLike
  toBuffer(): Promise<Buffer>
}

const loadSharp = () => import('sharp') as unknown as Promise<SharpModule>

export async function rasterStill(file: string, load: () => Promise<SharpModule> = loadSharp): Promise<Still | null> {
  try {
    const sharp = (await load()).default
    // the first frame of an animated WebP; its height is one page's
    const meta = await sharp(file, { animated: false }).metadata()
    const w = meta.width
    const h = meta.pageHeight ?? meta.height
    if (!w || !h) return null
    const fit = fitWhole(w, h, STILL_BOX.w, STILL_BOX.h)
    const png = await sharp(file, { animated: false, limitInputPixels: 64e6 }).resize(fit.w, fit.h, { fit: 'fill' }).png().toBuffer()
    return { src: `data:image/png;base64,${png.toString('base64')}`, w: fit.w, h: fit.h }
  } catch {
    return null
  }
}
