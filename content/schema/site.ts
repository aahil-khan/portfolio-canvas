import type { Field } from '../../lib/edit/schema.ts'
import { site } from '../site.ts'

/**
 * The front page's copy is ~80 short strings in a nested object. Hand-writing a field for each
 * would be a second copy of `site.json` that drifts, so the schema is read off the current shape
 * instead: the editor can change any string, but not add or remove keys, which is what a
 * component reading `site.work.title` needs.
 */

const HELP: Record<string, string> = {
  openTo: 'Under the top bar, beside the name. Leave empty to hide.',
  headline: 'The hero line: lead, then emphasis (bold, revealed word by word — keep it short), then tail.',
  toDesk: 'The hero\'s second button. It jumps down to the canvas pitch, not straight to /canvas.',
  'portraitEgg.taps': 'How many taps on the photo it takes to ask the question.',
  'portraitEgg.answers': 'Accepted answers. Matching ignores case, punctuation and repeated letters.',
  'door.note': 'Last and small — a nudge, not a barrier.',
  'closer.title': 'A line break here is kept.',
}

/** "portraitEgg" → "Portrait egg". */
const humanise = (key: string) => {
  const s = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function copyTree(label: string, value: unknown, path = ''): Field {
  const help = HELP[path]
  if (typeof value === 'number') return { kind: 'num', label, help }
  if (Array.isArray(value))
    return { kind: 'list', label, help, of: { kind: 'str', label: 'Entry' } }
  if (value && typeof value === 'object')
    return {
      kind: 'obj',
      label,
      help,
      fields: Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, copyTree(humanise(k), v, path ? `${path}.${k}` : k)]),
      ),
    }
  // an empty string today is a deliberate "hidden", so it stays allowed
  return { kind: 'text', label, help, optional: value === '' }
}

export const siteSchema: Field = copyTree('Front page', site)
