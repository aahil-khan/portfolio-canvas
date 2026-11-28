# portfolio-canvas

Aahil Khan's portfolio: an infinite-canvas desktop. A dock opens draggable windows onto a
pannable, zoomable surface. Replaces the scrolling site in `../portana-frontend`.

## Read first

@design/DIRECTION.md is the source of truth for every colour, size, font and easing.
Take values from there rather than inventing them. Change it first if something needs to move.

## Commands

```bash
npm run dev          # localhost:3000
npm run build        # must stay green; TS strict, no ignoreBuildErrors
npm run lint
node scripts/shot.mjs <url> [--w 1440] [--h 900]   # screenshots to .shots/
npm run check:contrast                             # WCAG check, all 20 themes — must exit 0
npm test                                           # editor + content rules (node --test)
npm run content:check                              # validate content/data/*.json in a second
npm run check:bundles                              # the import table below, after a build
npm run check:lab -- --require=<ids>               # the Lab's check: builds, serves on $PORT, runs the rules
```

Check command: npm run check
Quick check command: npm run typecheck && npm run lint

Needs Node ≥ 22.6: the tests and `content:check` run `.ts` directly via `--experimental-strip-types`.

`check:contrast` and `check:lab` drive the server's cached Chromium through the playwright-core in
`~/.local/share/cx-tools`, the one `shot` uses. Nothing installs a browser. With no browser,
`check:contrast` **fails** instead of skipping (`CONTRAST_SKIP=1` skips it on purpose).

`scripts/shot.mjs` drives Chrome through the puppeteer-core bundled with the chrome-devtools-mcp
plugin. There is no local puppeteer dependency, and that is deliberate.

## Rules that are easy to get wrong here

- **Pan/zoom must never go through React state.** The transform lives in a ref and is written
  to `world.style.transform` in a rAF loop. React re-renders only on open/close/focus/minimise.
  Routing pointer moves through `useState` makes this jank, and it cannot be fixed later without
  a rewrite.
- **Window drag deltas divide by scale** (`dx / scale`), or windows drift from the cursor when
  zoomed.
- **Don't use Motion's `layoutId` for window open/close.** It fights the canvas transform. Use an
  explicit FLIP: measure the dock icon rect and the window rect in *screen* space, set the
  initial transform, animate to identity.
- **No `backdrop-filter` inside the transformed world** — it repaints on every pan frame. Glass
  belongs only on the fixed dock and top pill.
- **`--border` is a token, never a literal `#000`.** Themes flip it.
- **Reduced motion and mute each have exactly one owner.** Never branch per component — that
  produced a hydration mismatch (React #418) in the previous build.

## Content

**All copy lives in `content/`. Nothing in `components/` should contain a sentence.** If you
catch yourself typing prose into a component, it belongs in a content file instead.

**The facts are data, edited in the browser.** `content/data/*.json` holds everything that changes
when life does — profile, projects, experience, archive, now, writing, the tool shelf, the front
page's copy. The owner edits them at **`/edit`** on the live site (GitHub sign-in, one commit per
save). Agents edit the same files through the **`update-content` skill**
(`.claude/skills/update-content/SKILL.md`) — use it for any content change, never the `.ts`
wrappers.

| Path | Holds |
|---|---|
| `data/*.json` | the editable content — `profile`, `projects`, `experience`, `archive`, `now`, `writing`, `stack`, `site` |
| `schema/index.ts` | what each field is and means; drives validation and the `/edit` forms |
| `profile.ts`, `projects.ts`, … | thin wrappers that type the JSON; components import from `@/content` as before |
| `apps.ts`, `themes.ts`, `tutorial.ts`, `eggs.ts`, `props.ts`, … | still code — not editable in `/edit` |
| `edit.ts` | the editor's own copy |
| `data/lab.json`, `lab/` | the Lab (`/lab`): its two switches (`public`, `demo`), its copy, sections, tags and entries; bodies are Markdown under `content/lab/`, the demo set under `content/lab/demo/`. **`content/lab/API.md` is the contract every Lab PR builds on.** Not in `/edit` until the Lab's editor PR. |

The "wins" headline number is computed from `awards` (`{"derived":"wins"}` in `profile.json`).

Assets: project and role screenshots go in `public/work/`, listed in `images: []` — one renders
as a plain frame, several as a carousel. The résumé PDF goes in `public/` (set
`profile.resumePdf`). `/edit` uploads them for you (PNG/JPEG/WebP/PDF only, checked by content,
never SVG).

**One set of rules, three places.** `lib/edit/rules.ts` (`validateSet`) runs at `next build` (via
`content/validate.ts`, called at module scope in `app/page.tsx`), on every `/edit` save before it
commits, and in `npm run content:check`. It covers the schema plus what types can't — duplicate
slugs, a `stack` entry with no matching tool, an image path with no file, and the two typos that
shipped for months in the old backend (`"Al Powered"`, `"non-based"`). So **bad content fails
the build**, and a save that would fail it is refused instead.

Card heights are never declared — they're measured from real content at runtime. Widths are in
`apps.ts`.

## Dependencies

**The canvas has none beyond Next and React, and that has not changed.** WAAPI (`el.animate`)
plus rAF covers every animation there, so there is no motion library, and pointer/wheel/pinch
are hand-rolled. This is a canvas app where main-thread budget matters — keep it that way.

The other surfaces each take a few, and each package is held to where it may be imported from and
which pages may load it. Every package is pinned exactly. All of them were installed at once (the
Lab's foundations PR), so later PRs never touch `package.json` or `package-lock.json`.

| Package | May be imported from | Must load on | Must not load on |
|---|---|---|---|
| `gsap`, `gsap/ScrollTrigger`, `@gsap/react` | `components/site/*`, `lib/site-motion.ts` | `/` | `/canvas`, `/lab/**`, `/edit` |
| `lenis` | `components/site/motion.tsx`, `components/lab/motion/*` | `/` | `/canvas`, `/edit` |
| `motion` | `components/lab/**` | `/lab/**` | `/`, `/canvas`, `/edit` |
| `@floating-ui/react` | `components/lab/preview/**`, `components/lab/menus/**` | on demand only | `/`, `/canvas`, `/edit` |
| `unified`, `remark-*`, `rehype-*`, `hast-*`, `mdast-*`, `micromark-*`, `shiki` | `lib/lab/markdown/**`, each file marked `import 'server-only'` | none | **any** client chunk |
| `open-graph-scraper`, `sharp` | `scripts/` | none | anything in `app/` |
| `feed` | route handlers (`app/**/route.ts`) | none | any client chunk |
| editor code | `app/edit`, `components/edit`, `lib/edit`, `app/api/edit` | `/edit` | every other page |

**`/canvas` loads none of them**, and no Lab or editor code either. The Lab's own JavaScript on an
entry page's first load is **≤ 60 KB gzipped**, Next and React excluded.

Why each one: `/` keeps GSAP and Lenis for scroll-linked scrub and smooth scrolling. The Lab uses
Motion for every enter, exit, page change and scroll-linked progress, not GSAP (Motion's core is
8 KB to GSAP + ScrollTrigger's 45 KB), and Lenis on desktop only. Previews place with Floating UI,
loaded on first intent. Bodies are Markdown through unified, rendered on the server, never MDX:
bodies are edited at `/edit` and each save commits to `main`, and MDX would put executable JSX in
that content. Plan `plan-the-real-lab` has the measurements.

That is a real constraint, not an intention. **`npm run check:bundles` proves every row** after
`npm run build`: it reads each page's client reference manifest for the chunks its first load
takes, follows chunk names to what it can load later, finds each package by a marker string, and
scans the source for where each package is imported. A marker must match a chunk once something
imports its package, or the check fails as stale. Run it after any change to imports:

```bash
npm run build && npm run check:bundles
```

Expected: every row holds. `/` loads gsap and lenis; `/canvas` is clean for every package and for
editor code; `/edit` loads the editor and nothing from the Lab.

## The Lab

`/lab` is being built in 17 PRs (plan `plan-the-real-lab`), **hidden** until the last one:
`content/data/lab.json` → `"public": false`. While hidden, every `/lab` response is `noindex` (meta
and an `X-Robots-Tag` header), no sitemap, feed or `llms.txt` lists it, and nothing links to it.
The URL still answers, so it can be reviewed on the live site. It shows **demo content** until
Aahil writes the real Lab (`"demo": true`), with a "Demo content" marker in its bar.

- **`content/lab/API.md` is the contract**: types, loaders, URLs, Markdown syntax, the rendered
  DOM, slot modules, events, tokens, storage keys, the check's interface, the demo rules. It is
  frozen: a worker who finds it wrong tells the orchestrator, who lands a one-file contract PR.
- **`lib/lab/visibility.ts` is the only reader of `public` and `demo`.** Everything else asks it.
- **`lib/lab/look.ts` owns the Lab's theme and reader settings (Aa).** The Lab's picker offers all
  20 palettes, the site's 18 and the Lab's two (`labThemes` in `content/themes.ts`, which no picker
  outside the Lab can list), and keeps its own choice, `lab.theme`, Lab Dark by default. It never
  touches `canvas.theme`. `lib/lab/ink.ts` lifts dark palettes' ink for reading, inside `.lab` only.
- **`lib/motion/reduced.ts` owns reduced motion** for the whole site; `lib/motion/tokens.ts` holds
  every duration. Nothing else reads the media query in TypeScript, apart from the canvas's seven
  older effect-time calls, which `check:lab` rule 4 allowlists by path and count.
- **The check:** `npm run check:lab -- --require=<ids>`. Each lane's rules are one file under
  `scripts/check-lab/`. A rule whose feature isn't built yet reports "not built", and `--require`
  turns that into a failure.

## The editor and deploys

- **`/edit`** — `app/edit`, `components/edit`, `lib/edit`, `app/api/edit/*`. Off (404) unless all
  five `EDIT_*` variables are set (`.env.example`). Security-sensitive: a GitHub App token sealed
  in an AES-GCM `__Host-` cookie, an allowlisted numeric user id, an Origin check on every write,
  a nonce CSP from `proxy.ts` scoped to `/edit` only. Tests: `npm test` (node --test, no deps).
- Local: `EDIT_DEV_FAKE=1 npm run dev` gives a signed-in editor over an in-memory repo. Ignored
  when `NODE_ENV=production`.
- **Deploys come from `main`** — see [Deploy](#deploy).

## Deploy

Deploy command: node scripts/wait-live.mjs
Orchestrator may deploy after a merge: yes

Vercel deploys `main` by itself, on every merge and on every `/edit` save (each save is a commit
to `main`). There is nothing to trigger: the command waits until `/api/version` on the live site
reports the commit (`git rev-parse HEAD`, or a sha passed as an argument), then smoke-checks
`/`, `/canvas`, `/edit` and `/api/version` with GET requests only. It exits non-zero after 10
minutes without the commit, or if any page fails — including `/edit` 404ing, which means its
`EDIT_*` variables are missing on Vercel. `LIVE_URL` points it elsewhere.

## Workflow

Design work goes **static-first**: prove a look or a feel in plain HTML under `prototype/`
before building it in React. This project was rebuilt three times because components were
written before anyone had approved how it should look. Do not skip the gate.

After a visual change, take a screenshot and look at it. Don't report a UI change as done
without having seen it render.
