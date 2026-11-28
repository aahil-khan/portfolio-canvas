import lab from '../../content/data/lab.json' with { type: 'json' }

/**
 * The Lab's two switches, and their one reader. Contract: `content/lab/API.md`, "Visibility" and
 * "Demo mode".
 *
 * Both live in `content/data/lab.json`, beside the content they gate. Nothing else reads those two
 * fields: page metadata, `next.config.ts` headers, the sitemap, `/feed.xml`, `llms.txt`, the
 * doors on `/` and the canvas, the loaders and the check all ask this file.
 *
 * Imported by relative path with a `.ts`-free JSON import, so `next.config.ts`, the app and the
 * Node scripts (`--experimental-strip-types`) all resolve it the same way.
 */

/**
 * `false` until PR 17. While false, every `/lab/**` response is `noindex` (meta and header), no
 * sitemap, feed or `llms.txt` lists a Lab URL, and no page links to `/lab`. The URL still
 * answers, so the Lab can be reviewed on the live site.
 */
export const labPublic: boolean = lab.public === true

/**
 * `true` while the Lab shows demo content: the loaders serve the set under `DEMO_CONTENT` instead
 * of `lab.json`'s own `sections`, `tags` and `entries`, and every Lab page shows the "Demo content"
 * marker in its bar. The clean-up deletes the field, the directories below and the marker.
 */
export const labDemo: boolean = lab.demo === true

/** Where the demo set lives. The loaders take the path from here, never from a literal. */
export const DEMO_CONTENT = 'content/lab/demo'
/** Where the demo set's images live, as a `public/` URL prefix. */
export const DEMO_PUBLIC = '/lab/demo'

/** The `<meta name="robots">` every Lab page carries while hidden. */
export const LAB_ROBOTS_HIDDEN = 'noindex, nofollow'
/** The `X-Robots-Tag` header every `/lab/**` response carries while hidden. */
export const LAB_X_ROBOTS_HIDDEN = 'noindex'
