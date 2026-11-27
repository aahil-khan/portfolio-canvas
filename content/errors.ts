/**
 * The words on the error pages: `app/not-found.tsx`, `app/error.tsx` and `app/global-error.tsx`.
 *
 * Code rather than `content/data/` because these pages are not the facts of a life: they change
 * when the site does, not when its owner's news does, as with `edit.ts`. Node-importable (no
 * imports), so rule SB reads the 404's heading from here.
 */
export const errors = {
  notFound: {
    /** The browser tab, before " — <name>". */
    tabTitle: 'Not found',
    meta: '404',
    title: 'Nothing lives here.',
    lede: 'The link may be old, or the page may have moved. These are the places that do exist.',
    /** Where the page offers to go instead, in order. */
    links: [
      { href: '/', label: 'The front page' },
      { href: '/work', label: 'All the work' },
      { href: '/canvas', label: 'The canvas' },
    ],
  },
  error: {
    meta: 'Error',
    title: 'Something broke on this page.',
    lede: 'It wasn’t you. Trying again usually works; if it doesn’t, the front page will.',
    retry: 'Try again',
    home: 'The front page',
    /** Shown with the error's digest, so a report can be matched to the server's log. */
    ref: 'Reference',
  },
  /** When even the root layout failed: no theme, no fonts, no bar. */
  global: {
    tabTitle: 'Something broke',
    title: 'Something broke.',
    lede: 'The site couldn’t load this page. Trying again usually works.',
    retry: 'Try again',
    home: 'The front page',
  },
} as const
