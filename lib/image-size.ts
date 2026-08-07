import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Read an image's pixel dimensions from its header. SERVER ONLY.
 *
 * Why this exists: an archive entry can be any shape — a meme screenshot, a tall phone photo,
 * a wide diagram. Forcing them all into a 16:9 box with `object-fit: cover` crops the subject
 * out of anything that isn't widescreen.
 *
 * The alternative to reading dimensions is either asking whoever writes the content to type
 * `w`/`h` by hand, or letting the browser size the image on load — which shifts layout *and*
 * breaks the card-height measurement, since the image has no height when the card is measured.
 * Reading the header at build time costs nothing and means the author only ever types a path.
 *
 * Only the four formats the web actually uses here are parsed. Anything else returns null and
 * the caller falls back to a fixed ratio.
 */

export interface ImageSize {
  width: number
  height: number
}

const cache = new Map<string, ImageSize | null>()

function parse(buf: Buffer): ImageSize | null {
  // PNG — IHDR is always the first chunk, width/height at bytes 16..24, big-endian
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }

  // GIF — logical screen descriptor, little-endian
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
  }

  // WebP — three sub-formats, each stores the size differently
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16)
    if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
    if (kind === 'VP8L') {
      const bits = buf.readUInt32LE(21)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (kind === 'VP8X') {
      const w = buf[24] | (buf[25] << 8) | (buf[26] << 16)
      const h = buf[27] | (buf[28] << 8) | (buf[29] << 16)
      return { width: w + 1, height: h + 1 }
    }
  }

  // JPEG — walk the marker segments looking for a start-of-frame
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i++
        continue
      }
      const marker = buf[i + 1]
      // SOF0..SOF15, excluding the non-frame markers DHT (c4), JPG (c8) and DAC (cc)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) }
      }
      i += 2 + buf.readUInt16BE(i + 2)
    }
  }

  return null
}

/** `publicPath` is a path under `public/`, e.g. `/archive/thing.png`. */
export function imageSize(publicPath: string): ImageSize | null {
  if (cache.has(publicPath)) return cache.get(publicPath) ?? null
  let size: ImageSize | null = null
  try {
    // only the header is needed, but these files are small enough that reading whole is simpler
    const buf = readFileSync(path.join(process.cwd(), 'public', publicPath.replace(/^\//, '')))
    size = parse(buf)
  } catch {
    size = null
  }
  cache.set(publicPath, size)
  return size
}
