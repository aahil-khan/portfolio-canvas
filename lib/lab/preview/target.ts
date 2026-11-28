/**
 * A link's `data-preview` (API.md §5): `entry:<id> | term:<id> | tag:<id> | ref:<key> | out:<url>`.
 * An entry opens a window holding the whole entry; everything else opens a card (decision 11).
 */
export type TargetKind = 'entry' | 'term' | 'tag' | 'ref' | 'out'

export interface Target {
  kind: TargetKind
  /** The id, the reference's key, or the URL. */
  id: string
}

const KINDS: readonly TargetKind[] = ['entry', 'term', 'tag', 'ref', 'out']

export function parseTarget(v: string | null | undefined): Target | null {
  if (!v) return null
  const i = v.indexOf(':')
  if (i < 1) return null
  const kind = v.slice(0, i) as TargetKind
  const id = v.slice(i + 1)
  if (!KINDS.includes(kind) || !id) return null
  if (kind === 'out' && !/^https?:\/\//.test(id)) return null
  return { kind, id }
}

/** A window (the whole entry) or a card. */
export const isWindow = (t: Target): boolean => t.kind === 'entry'

/** The domain a reader recognises: `www.` dropped. */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
