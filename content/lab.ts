import data from './data/lab.json' with { type: 'json' }

/*
 * The Lab's chrome copy: every sentence on a Lab page that is not an entry's. The data lives in
 * `content/data/lab.json` → `copy` (camelCase keys, `{name}` placeholders). The Lab's content
 * (sections, entries, terms, bodies) is not here: it loads through `lib/lab/content.ts`, which
 * picks the real set or the demo set, so components never know which they have.
 *
 * The switches beside the copy (`public`, `demo`) are read only by `lib/lab/visibility.ts`.
 * Import it as `@/content/lab`, never through `@/content`, so no other page's chunks carry it.
 * The cast goes through `unknown` for the same reason as the other wrappers: the type is declared,
 * never inferred from the JSON's current contents.
 */

/** Chrome copy by key. Missing keys are a bug in the caller, so `labText` throws on them. */
export const labCopy = (data as unknown as { copy: Record<string, string> }).copy

/** A copy line with its `{name}` placeholders filled. Throws on an unknown key. */
export function labText(key: string, vars: Record<string, string | number> = {}): string {
  const line = labCopy[key]
  if (line === undefined) throw new Error(`content/data/lab.json has no copy.${key}`)
  return line.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
