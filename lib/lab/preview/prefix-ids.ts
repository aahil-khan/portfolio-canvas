/**
 * A whole entry, copied into a window, must not collide with the page behind it (plan PR 10, rule
 * W). Every id inside the window gets the window's prefix (`w1-`, `w2-`, …), and so does every
 * reference to one: `href="#…"`, `for`, `headers` and the ARIA id lists. A citation inside a window
 * then jumps within that window, never to the page behind it.
 *
 * The page's own hooks (API.md §5) are renamed in the copy, `data-x` → `data-pv-x`, so nothing that
 * looks for the page's article, lead, body end or rail ever finds the window's instead.
 *
 * Written against the few Element members it needs, so the tests run in Node without a DOM.
 */

export interface El {
  readonly tagName: string
  readonly children: ArrayLike<El>
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  hasAttribute(name: string): boolean
}

/** Attributes that hold one id, or a space-separated list of them. */
const ID_LISTS = [
  'for',
  'headers',
  'list',
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'aria-flowto',
  'aria-details',
  'aria-errormessage',
  'aria-activedescendant',
]

/** The page-level hooks a window's copy must not carry under their own names. */
export const PAGE_HOOKS = [
  'data-entry',
  'data-body-end',
  'data-lead',
  'data-column',
  'data-rail',
  'data-rail-in',
  'data-rail-section',
  'data-rail-list',
  'data-toc',
  'data-toc-bar',
  'data-picker',
  'data-picker-panel',
  'data-refs',
  'data-backlinks',
  'data-related',
  'data-tags',
]

function walk(el: El, fn: (el: El) => void): void {
  fn(el)
  for (let i = 0; i < el.children.length; i++) walk(el.children[i], fn)
}

export function prefixIds(root: El, prefix: string): void {
  const p = (id: string) => (id.startsWith(prefix) ? id : prefix + id)
  walk(root, (el) => {
    const id = el.getAttribute('id')
    if (id) el.setAttribute('id', p(id))
    for (const a of ID_LISTS) {
      const v = el.getAttribute(a)
      if (v) el.setAttribute(a, v.trim().split(/\s+/).map(p).join(' '))
    }
    if (el.tagName.toLowerCase() === 'a') {
      const href = el.getAttribute('href')
      if (href && href.length > 1 && href.startsWith('#')) el.setAttribute('href', '#' + p(decodeURIComponent(href.slice(1))))
    }
  })
}

/** Renames the page's hooks in a window's copy (`data-lead` → `data-pv-lead`, value kept). */
export function renameHooks(root: El): void {
  walk(root, (el) => {
    for (const a of PAGE_HOOKS) {
      if (!el.hasAttribute(a)) continue
      el.setAttribute(`data-pv-${a.slice(5)}`, el.getAttribute(a) ?? '')
      el.removeAttribute(a)
    }
  })
}
