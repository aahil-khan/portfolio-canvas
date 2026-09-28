/**
 * What a file actually is, from its first bytes — never from its name or the browser's say-so.
 *
 * Only four answers. SVG is deliberately not one of them: it is XML that can carry script, and
 * served from our own origin that is an XSS, not a picture.
 */
export type Sniffed = 'png' | 'jpeg' | 'webp' | 'pdf'

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x)
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))

export function sniff(b: Uint8Array): Sniffed | null {
  if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (starts(b, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (starts(b, ascii('RIFF')) && starts(b, ascii('WEBP'), 8)) return 'webp'
  if (starts(b, ascii('%PDF-'))) return 'pdf'
  return null
}
