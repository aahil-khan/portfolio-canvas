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

| File | Holds |
|---|---|
| `profile.ts` | name, role, location, email, links, intro, headline stats |
| `projects.ts` | selected work — add a project by copying one block |
| `experience.ts` | jobs, education, awards |
| `writing.ts` | posts |
| `stack.ts` | the tool shelf and logo paths |
| `apps.ts` | the dock order, card colours and widths |

Assets: project screenshots go in `public/work/` (add `image:` to the project), the résumé PDF
goes in `public/` (set `profile.resumePdf`). Both are optional — links and image slots only
appear once the file exists, and the validator checks the path resolves.

Each file is a plain typed array, so excess-property checks catch a mistyped field. `content/
validate.ts` covers what types can't — duplicate slugs, a `stack` entry with no matching tool,
an `image` path with no file, and the two typos that shipped for months in the old backend
(`"Al Powered"` for `"AI Powered"`, `"non-based"` for `"n8n-based"`).

It's called at module scope in `app/page.tsx`, so **bad content fails `next build`** rather than
rendering a blank card, and in dev it re-runs on every save.

Card heights are never declared — they're measured from real content at runtime. Widths are in
`apps.ts`.

## Dependencies

Runtime dependencies: **none beyond Next and React.** The prototype proved WAAPI (`el.animate`)
plus rAF covers every animation here, so there's no motion library, and pointer/wheel/pinch are
hand-rolled. Keep it that way unless something genuinely can't be done — this is a canvas app
where main-thread budget matters.

## Workflow

Design work goes **static-first**: prove a look or a feel in plain HTML under `prototype/`
before building it in React. This project was rebuilt three times because components were
written before anyone had approved how it should look. Do not skip the gate.

After a visual change, take a screenshot and look at it. Don't report a UI change as done
without having seen it render.
