/**
 * `?card=` — the canvas's one piece of addressable state.
 *
 * The canvas is a single URL, which meant nothing inside it could be linked to: a project only
 * existed as a card you had to be told to pan to. This puts whichever card you deliberately
 * opened into the address bar, and opens it again when someone follows that address.
 *
 * Written with `history.replaceState`, NOT `next/navigation`'s router:
 *
 *   - `router.replace` re-renders the tree and round-trips to the server for the RSC payload.
 *     The camera transform lives in a ref that is written straight to `world.style.transform`
 *     in a rAF loop, so a remount would drop the viewer wherever the fresh render decided —
 *     and the whole point of CLAUDE.md's first rule is that this never goes through React.
 *   - `replaceState` over `pushState` because opening a card is not browsing. Every open would
 *     otherwise add a back-button step that undoes nothing visible, and twenty cards in you
 *     could not get back to the page you arrived from.
 */

const PARAM = 'card'

export function readCardParam(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = new URLSearchParams(window.location.search).get(PARAM)
    return raw?.trim() || null
  } catch {
    return null
  }
}

export function writeCardParam(id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get(PARAM) === id) return
    if (id) url.searchParams.set(PARAM, id)
    else url.searchParams.delete(PARAM)
    window.history.replaceState(null, '', url.toString())
  } catch {
    /* sandboxed iframe, or an opaque origin — the canvas works fine without an address */
  }
}

/** Clears the parameter only if it currently names `id`, so closing card A can't wipe card B. */
export function clearCardParam(id: string): void {
  if (readCardParam() === id) writeCardParam(null)
}

/** The absolute link to one card, for a copy-link action. */
export function cardUrl(id: string): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set(PARAM, id)
  return url.toString()
}
