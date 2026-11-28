/**
 * The share cards' fonts, read from disk: static TrueType copies of the Space Grotesk and Caveat the
 * Lab already serves (`fonts/`, with their licence). `next/og` reads neither WOFF2 nor a variable
 * font's other weights, and nothing here fetches a font from anywhere.
 *
 * Read from the repo root (the working directory at `next build` and under `npm test`), as Next's
 * own `opengraph-image` docs read theirs. Every Lab card is prerendered at build, so this runs then
 * and never on a request.
 *
 * Relative `.ts` imports, for Node.
 */
import fs from 'node:fs'
import path from 'node:path'

import type { CardMetrics } from './card.ts'
import { FAMILY } from './card.ts'
import { readMetrics } from './metrics.ts'

export const FONT_DIR = 'lib/lab/og/fonts'

const FILES = {
  regular: 'space-grotesk-400.ttf',
  medium: 'space-grotesk-500.ttf',
  bold: 'space-grotesk-700.ttf',
  hand: 'caveat-500.ttf',
} as const

export interface CardFont {
  name: string
  data: Buffer
  weight: 400 | 500 | 700
  style: 'normal'
}

let loaded: { fonts: CardFont[]; metrics: CardMetrics } | null = null

export function cardFonts(root: string = process.cwd()): { fonts: CardFont[]; metrics: CardMetrics } {
  if (loaded) return loaded
  const read = (f: string) => fs.readFileSync(path.join(root, FONT_DIR, f))
  const regular = read(FILES.regular)
  const medium = read(FILES.medium)
  const bold = read(FILES.bold)
  loaded = {
    fonts: [
      { name: FAMILY.sans, data: regular, weight: 400, style: 'normal' },
      { name: FAMILY.sans, data: medium, weight: 500, style: 'normal' },
      { name: FAMILY.sans, data: bold, weight: 700, style: 'normal' },
      { name: FAMILY.hand, data: read(FILES.hand), weight: 500, style: 'normal' },
    ],
    metrics: { regular: readMetrics(regular), medium: readMetrics(medium), bold: readMetrics(bold) },
  }
  return loaded
}
