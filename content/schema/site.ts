import type { Field } from '../../lib/edit/schema.ts'
import { site } from '../site.ts'

/**
 * The front page's copy is ~80 short strings in a nested object. Hand-writing a field for each
 * would be a second copy of `site.json` that drifts, so the schema is read off the current shape
 * instead: the editor can change any string, but not add or remove keys, which is what a
 * component reading `site.work.title` needs. Its TypeScript type is inferred from the JSON, so
 * that rule is what keeps a valid edit from changing the type and failing the build.
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
    // at least one, so the inferred type of site.json can never become never[]
    return { kind: 'list', label, help, min: 1, of: { kind: 'str', label: 'Entry' } }
  if (value && typeof value === 'object')
    return {
      kind: 'obj',
      label,
      help,
      fields: Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, copyTree(humanise(k), v, path ? `${path}.${k}` : k)]),
      ),
    }
  // a blank string today is a deliberate "hidden": it may stay blank, but the key never goes
  return { kind: 'text', label, help, empty: value === '' }
}

export const siteSchema: Field = copyTree('Front page', site)
