import type { ReactNode } from 'react'

/**
 * Figure data's words, with the two inline marks figure text uses: `code` and ==marked==. Figure
 * data is plain JSON, not a body, so it never goes through the Markdown pipeline; this is the
 * whole of its syntax. Server-safe (no directive), so server and client instruments share it.
 */
export function Inline({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = []
  const re = /`([^`]+)`|==([^=]+)==/g
  let last = 0
  for (let m; (m = re.exec(text)); ) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(m[1] !== undefined ? <code key={m.index}>{m[1]}</code> : <mark key={m.index}>{m[2]}</mark>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.length === 1 ? out[0] : <>{out}</>
}

/** The same words with the marks taken out, for labels. */
export const plain = (text: string): string => text.replace(/`|==/g, '')

/** Rupees as the shop says them: ₹899, ₹1,050 (prices here stay under a lakh, where Indian and Western grouping agree). */
export const rupees = (n: number): string => `₹${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
