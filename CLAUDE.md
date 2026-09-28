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
node scripts/contrast.mjs                          # WCAG check, all themes — must exit 0
npm test                                           # editor + content rules (node --test)
npm run content:check                              # validate content/data/*.json in a second
```

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

**`/` is the one exception.** The scrolling front page uses `gsap`, `gsap/ScrollTrigger`,
`@gsap/react` and `lenis`, because scroll-linked scrub, velocity-reactive motion and smooth
scrolling are genuinely not worth hand-rolling a second time. The rule that replaces "no
dependencies" is narrower and testable:

> Those four packages may only be imported from `components/site/*` and `lib/site-motion.ts`.
> **`/canvas` must not load a byte of them.**

That is a real constraint, not an intention — they are all reached through one client component,
`components/site/motion.tsx`, so the code splitter keeps them in a chunk `/canvas` never
references. Verify after any change to the site's imports:

```bash
npm run build
# then confirm the gsap chunk is referenced by /'s HTML and not by /canvas's
node -e "const fs=require('fs'),p=require('path');const d='.next/static/chunks';
const w=x=>fs.readdirSync(x,{withFileTypes:true}).flatMap(e=>e.isDirectory()?w(p.join(x,e.name)):[p.join(x,e.name)]);
const g=w(d).filter(f=>f.endsWith('.js')&&/ScrollTrigger|lenis|gsap/i.test(fs.readFileSync(f,'utf8')));
for(const[n,f]of[['/','.next/server/app/index.html'],['/canvas','.next/server/app/canvas.html']])
  console.log(n, g.some(c=>fs.readFileSync(f,'utf8').includes(p.basename(c)))?'LOADS GSAP':'clean')"
```

Expected: `/ LOADS GSAP`, `/canvas clean`. `npm run check:bundles` runs the same check and also
proves neither page loads any of the editor's code.

## The editor and deploys

- **`/edit`** — `app/edit`, `components/edit`, `lib/edit`, `app/api/edit/*`. Off (404) unless all
  five `EDIT_*` variables are set (`.env.example`). Security-sensitive: a GitHub App token sealed
  in an AES-GCM `__Host-` cookie, an allowlisted numeric user id, an Origin check on every write,
  a nonce CSP from `proxy.ts` scoped to `/edit` only. Tests: `npm test` (node --test, no deps).
- Local: `EDIT_DEV_FAKE=1 npm run dev` gives a signed-in editor over an in-memory repo. Ignored
  when `NODE_ENV=production`.
- **Deploys come from `main`.** A timer on aahil-server pulls and rebuilds within a minute of a
  push (`deploy/`). **Never `stage deploy portfolio-redesign` from the laptop** — it would clobber
  the server's git checkout.

## Workflow

Design work goes **static-first**: prove a look or a feel in plain HTML under `prototype/`
before building it in React. This project was rebuilt three times because components were
written before anyone had approved how it should look. Do not skip the gate.

After a visual change, take a screenshot and look at it. Don't report a UI change as done
without having seen it render.
