/**
 * A whole entry for a window (plan PR 10): the entry's own static page, fetched same-origin when a
 * reader's intent starts (never on load), its `article[data-entry]` taken out and cached for the
 * visit. The largest entry page is about 22 KB gzipped, far under the plan's 150 KB line, so there
 * is no fragment route.
 *
 * Each window gets its own copy (`adoptEntry`): ids prefixed, the page's hooks renamed, and what
 * cannot work inside a window removed (Share, On this page, any button: their handlers live on
 * the page they came from). The title becomes a link to the page: the way through.
 */
import { prefixIds, renameHooks } from './prefix-ids.ts'

const cache = new Map<string, Promise<Element | null>>()

/** The path a link points at, without its hash: the cache key. */
export const pathKey = (href: string): string => {
  const u = new URL(href, location.href)
  return u.pathname.replace(/\/$/, '') + u.search
}

/** Starts fetching the entry behind `href`, or returns the fetch already under way. */
export function entryArticle(href: string): Promise<Element | null> {
  const key = pathKey(href)
  let p = cache.get(key)
  if (!p) {
    p = fetch(key, { credentials: 'same-origin', headers: { Accept: 'text/html' } })
      .then((r) => (r.ok ? r.text() : null))
      .then((html) => {
        if (!html) return null
        const doc = new DOMParser().parseFromString(html, 'text/html')
        return doc.querySelector('article[data-entry]')
      })
      .catch(() => null)
      .then((a) => {
        // a failure is not cached: the next intent tries again
        if (!a) cache.delete(key)
        return a
      })
    cache.set(key, p)
  }
  return p
}

/** What a window must not carry: it cannot work there. */
const DEAD = ['[data-share]', '[data-toc]', '.lab-rail-wide', 'button', 'script', 'style', 'link']

/** A fresh copy of `article` for the window with prefix `prefix`, linking its title to `href`. */
export function adoptEntry(article: Element, prefix: string, href: string): HTMLElement {
  const copy = document.importNode(article, true) as HTMLElement
  for (const el of copy.querySelectorAll(DEAD.join(','))) el.remove()
  // a rail section left empty by the removals goes too
  for (const el of copy.querySelectorAll('[data-rail-in]')) if (!el.children.length) el.closest('[data-rail]')?.remove()
  const h1 = copy.querySelector('h1')
  if (h1) {
    const a = document.createElement('a')
    a.href = href
    a.className = 'lab-pv-title-link'
    a.textContent = h1.textContent
    h1.replaceChildren(a)
  }
  // the page's inline motion styles came from the page's own enter; a copy starts settled
  for (const el of copy.querySelectorAll<HTMLElement>('[style]')) {
    el.style.removeProperty('opacity')
    el.style.removeProperty('transform')
  }
  prefixIds(copy, prefix)
  renameHooks(copy)
  return copy
}
