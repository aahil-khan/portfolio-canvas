/**
 * His name (API.md §6): the stub renders the double-underlined name only. PR 12 replaces the
 * module's insides (the tooltip with its pronunciation, the one Kokoro clip) and keeps the export.
 */
export function Name({ name }: { name: string }) {
  return <span className="lab-name">{name}</span>
}
