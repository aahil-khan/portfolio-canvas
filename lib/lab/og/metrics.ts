/**
 * Text widths from a TrueType font's own tables, so a card's layout can count its lines before
 * satori draws it: a long title steps down a size and a lede gives up a line, rather than either
 * running out of the card. Reads `head` (units per em), `hhea` and `hmtx` (advances) and the
 * format 4 `cmap` (characters to glyphs). Kerning is left out, which only ever makes a measure a
 * little wider than the drawn text, so the count errs towards one line more, never one fewer.
 *
 * No imports, so Node runs it as it is (`npm test`).
 */

export interface FontMetrics {
  /** A character's advance in em. Characters the font lacks count as the font's average. */
  advance(ch: string): number
}

const tag = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3])

export function readMetrics(buf: Uint8Array): FontMetrics {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const tables: Record<string, number> = {}
  const n = v.getUint16(4)
  for (let i = 0; i < n; i++) tables[tag(buf, 12 + i * 16)] = v.getUint32(12 + i * 16 + 8)
  for (const t of ['head', 'hhea', 'hmtx', 'cmap']) if (tables[t] === undefined) throw new Error(`lib/lab/og/metrics.ts: the font has no ${t} table`)

  const upm = v.getUint16(tables.head + 18)
  const nMetrics = v.getUint16(tables.hhea + 34)
  const adv = (glyph: number) => v.getUint16(tables.hmtx + 4 * Math.min(glyph, nMetrics - 1))

  // the Unicode BMP subtable, format 4
  const cmap = tables.cmap
  let sub = -1
  for (let i = 0; i < v.getUint16(cmap + 2); i++) {
    const r = cmap + 4 + i * 8
    const platform = v.getUint16(r)
    const encoding = v.getUint16(r + 2)
    const off = cmap + v.getUint32(r + 4)
    if (((platform === 3 && encoding === 1) || platform === 0) && v.getUint16(off) === 4) sub = off
  }
  if (sub < 0) throw new Error('lib/lab/og/metrics.ts: the font has no format 4 cmap')
  const segs = v.getUint16(sub + 6) / 2
  const ends = sub + 14
  const starts = ends + segs * 2 + 2
  const deltas = starts + segs * 2
  const ranges = deltas + segs * 2
  const glyphOf = (code: number): number => {
    for (let i = 0; i < segs; i++) {
      if (code > v.getUint16(ends + i * 2)) continue
      const start = v.getUint16(starts + i * 2)
      if (code < start) return 0
      const delta = v.getInt16(deltas + i * 2)
      const range = v.getUint16(ranges + i * 2)
      if (range === 0) return (code + delta) & 0xffff
      const g = v.getUint16(ranges + i * 2 + range + (code - start) * 2)
      return g === 0 ? 0 : (g + delta) & 0xffff
    }
    return 0
  }

  const cache = new Map<string, number>()
  let sum = 0
  let count = 0
  for (let c = 0x61; c <= 0x7a; c++) {
    sum += adv(glyphOf(c))
    count++
  }
  const average = sum / count / upm
  return {
    advance(ch) {
      let a = cache.get(ch)
      if (a === undefined) {
        const g = glyphOf(ch.codePointAt(0) ?? 0)
        a = g ? adv(g) / upm : average
        cache.set(ch, a)
      }
      return a
    },
  }
}

/** The width of `text` in px, at `size` px with `tracking` em between letters. */
export function measure(m: FontMetrics, text: string, size: number, tracking = 0): number {
  let w = 0
  for (const ch of text) w += m.advance(ch) + tracking
  return w * size
}

/**
 * The lines `text` breaks into at `width` px, breaking at spaces as a browser and satori do. A word
 * longer than the line takes a line of its own (satori breaks it further; this counts it once more
 * for each extra width it needs).
 */
export function countLines(m: FontMetrics, text: string, size: number, width: number, tracking = 0): number {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return 0
  const space = measure(m, ' ', size, tracking)
  let lines = 1
  let line = 0
  for (const word of words) {
    const w = measure(m, word, size, tracking)
    if (line === 0) {
      lines += Math.max(0, Math.ceil(w / width) - 1)
      line = w > width ? w % width : w
    } else if (line + space + w <= width) line += space + w
    else {
      lines += Math.ceil(w / width)
      line = w > width ? w % width : w
    }
  }
  return lines
}

/**
 * `text` as it fits in `lines` lines of `width`: whole, or cut after the last word that leaves room
 * for an ellipsis, so a card never ends a line mid-word.
 */
export function clampText(m: FontMetrics, text: string, size: number, width: number, lines: number, tracking = 0): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (countLines(m, clean, size, width, tracking) <= lines) return clean
  const words = clean.split(' ')
  for (let n = words.length - 1; n > 0; n--) {
    const cut = `${words.slice(0, n).join(' ').replace(/[\s,;:.·–—-]+$/u, '')}…`
    if (countLines(m, cut, size, width, tracking) <= lines) return cut
  }
  return `${words[0]}…`
}
