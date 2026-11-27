# The Lab's contract

Plan `plan-the-real-lab` builds `/lab` in 17 PRs, several at once. This file is what they share.
PR 1 (Foundations) wrote it, and **it is frozen from then on.** A worker who finds it wrong, or
needs something it does not say, tells the orchestrator, who lands a one-file contract PR. Workers
never edit it inside a feature PR, so parallel PRs never touch the same file.

`design/DIRECTION.md` ("The Lab") owns every colour, size, font, duration and easing. This file
says where things live and what they are called. CLAUDE.md owns how the code is built.

Contents: [1 Types](#1-types) · [2 Loaders](#2-loaders) · [3 URLs](#3-urls) ·
[4 Markdown](#4-markdown) · [5 The rendered DOM](#5-the-rendered-dom) · [6 Slot modules](#6-slot-modules) ·
[7 Cross-lane events](#7-cross-lane-events) · [8 Tokens and motion](#8-tokens-and-motion) ·
[9 Analytics](#9-analytics) · [10 Storage keys](#10-storage-keys) · [11 The check](#11-the-check) ·
[Visibility](#visibility) · [Demo mode](#demo-mode) · [The empty Lab](#the-empty-lab)

## Where things live

| Path | Holds | Written by |
|---|---|---|
| `content/data/lab.json` | `public`, `demo`, `copy`, and the **real** `sections`, `tags`, `entries` | PR 1 (switches, empty), PR 2 (copy), Aahil at `/edit` (content) |
| `content/data/lab-terms.json` | the real glossary: `Term[]` | PR 2 (empty), Aahil |
| `content/data/lab-figures.json` | the real figure data: `Record<id, Figure>` | PR 2 (empty), Aahil |
| `content/data/lab-unfurls.json` | link-out cards, keyed by URL: `Record<url, Unfurl>` | PR 2 (`{}`), PR 7's script |
| `content/data/studies/<id>.json` | a study's board: `StudyData` | Aahil (via `scripts/lab-import-study.ts`) |
| `content/lab/<section>/<slug>.md` | a top-level entry's body | Aahil |
| `content/lab/<section>/<parent-slug>/<slug>.md` | a child's body (a chapter, a study's note) | Aahil |
| `content/lab/demo/` | **the demo set**, mirroring all of the above (see [Demo mode](#demo-mode)) | PR 2 |
| `content/lab/fixture/` | the test-only fixture, loaded only with `LAB_FIXTURE=kinds` | PR 2 |
| `public/lab/<entry-id>/*.webp` | the real set's images | Aahil |
| `public/lab/demo/<entry-id>/*.webp` | the demo set's images | PR 2 |
| `public/lab/unfurl/*` | unfurl images and favicons | PR 7 |
| `lib/lab/visibility.ts` | **the only reader** of `public` and `demo` | PR 1 |
| `lib/lab/types.ts` | §1 | PR 1 |
| `lib/lab/content.ts` | §2 | PR 2 |
| `lib/lab/rules.ts` | `validateLab(lab, bodies, fileExists)` | PR 2 |
| `lib/lab/look.ts` | the look, the Lab theme's mode, Aa (§8, §10) | PR 1 |
| `lib/motion/reduced.ts`, `lib/motion/tokens.ts` | §8 | PR 1 |
| `lib/events.ts` | §9 | PR 1 (no-op), PR 4 |
| `scripts/check-lab.mjs`, `scripts/check-lab/*.mjs`, `scripts/lab-routes.ts` | §11 | PR 1, then one lane file per PR |

`content/data/lab.json` holds the copy for the Lab's chrome (`copy`, a flat `Record<string,
string>`); keys are camelCase and named by the PR that adds them. Entries' own words are entry
fields and bodies, never `copy`. Nothing in `components/` contains a sentence.

## 1. Types

All in `lib/lab/types.ts`. Read the file for the doc comments; this is the map.

| Type | What |
|---|---|
| `Kind` | `'study' \| 'series' \| 'chapter' \| 'note' \| 'build' \| 'experiment' \| 'essay'`; `KINDS` lists them |
| `TOP_LEVEL_KINDS` | every kind but `chapter`. A note is top-level when it has no `parent` |
| `Section` | `{ id, title, thesis, hero? }`. No `hidden` flag: a section with no top-level entries is simply never shown (Experiments, today) |
| `Tag` | `{ id, title, about? }`; at most `MAX_TAGS` (8) in the whole Lab |
| `Ref` | `{ title, site, line?, url: string \| null }`, cited `[^key]`, numbered by first use |
| `Term` | `{ id, name, def, link?, source }` |
| `Image`, `Demo` | `{ src, w, h, alt, caption? }`; a `Demo` adds `poster` |
| `LeadData` | `{ instrument?, figure?, of?, demo?, images?, cover? }` |
| `LEAD_CHAINS` | the lead each kind falls back through, first match wins: study `board → logline`; series `progress`; chapter and note `instrument → keyline`; build `demo → screens → figure → install`; experiment `figure → result`; essay `cover → opening`. Every chain ends in something the kind must have, which `validateLab` checks |
| `Entry` | the union `Study \| Series \| Chapter \| Note \| Build \| Experiment \| Essay`; `EntryOf<K>` narrows. Shared fields: `id, slug, section, title, lede?, published, updated?, draft?, tags?, mentions?, refs?, pull?, leadIntro?, lead?` |
| per kind | study `log?`; series `study?, premise?`; chapter `parent, order, keyLine?`; note `parent?, topic?, keyLine?`; build `install?, repo?, live?, result?, ending, endingKind`; experiment `result, ending, endingKind`; essay `opening, canonical?` |
| `EndingKind` | `'do' \| 'use' \| 'measure'`, framing "What I'd do now", dated as of the entry's last update |
| `Unfurl` | `{ title, description?, site, domain, img?, icon?, standIn? }` |
| `StudyData`, `Topic` | a study's tracks and topics; `status` is `done \| doing \| todo \| parked \| later` |
| `Figure` | `{ instrument, caption?, data }`; `data`'s shape is the instrument's (PR 11's registry) |
| `LabFile` | `content/data/lab.json`: `{ public, demo, copy, sections, tags, entries }` |
| `LabContent` | `{ sections, tags, entries }`: what a set holds, and what the demo set's `lab.json` holds |
| `Lab` | what `getLab()` returns: `{ copy, sections, tags, entries, terms, figures, unfurls, studies }` |
| `LabRoute` | one page under `/lab`, as `routes()` lists it (§3) |
| `PreviewTarget` | `entry:<id> \| term:<id> \| tag:<id> \| ref:<key> \| out:<url>` (§5) |
| `RESERVED_IDS` | `index`, `tags`, `glossary` (routes) and `demo`, `fixture` (directories beside the bodies). No section, entry, tag or term may take one |

Dates are `YYYY-MM-DD` days. `published` is `null` only while `draft` is true; a draft is listed as
"later" and has no page of its own. `pinned`, `done`, `status` and `pullQuote` from the old plan do
not exist.

`types.ts`, `visibility.ts`, `content.ts` and `rules.ts` are **importable by Node with
`--experimental-strip-types`**: relative imports with `.ts` extensions, no `@/` alias, no enums,
so the tests, `content:check` and the check load them directly.

## 2. Loaders

`lib/lab/content.ts` (PR 2). Server only: it reads the filesystem at build. Every function reads
**the active set** (see [Demo mode](#demo-mode)), and nothing that calls them knows which set it has.

| Function | Returns |
|---|---|
| `getLab(): Lab` | the active set, loaded once and indexed |
| `routes(): LabRoute[]` | every page under `/lab`, in a stable order: home, sections, entries, index, tags, glossary. Drafts are not routes. A section with no top-level entry is not a route |
| `entryByPath(segments: readonly string[]): Entry \| null` | `[section, slug]` or `[section, parent, child]`; `null` for anything that is not a published entry |
| `pathOf(entry: Entry): string` | its `/lab/…` path |
| `bodyOf(id: string): string` | its Markdown body, `''` when it has none |
| `children(id: string): Entry[]` | a series' chapters by `order`, or a study's notes by `published` |
| `related(id: string): Entry[]` | links first (body links and `mentions`, in order of first appearance), then entries sharing a tag (most shared first), then its own section by date. **Never empty** while the Lab has two or more entries |
| `backlinks(id: string): Entry[]` | entries whose body links here or whose `mentions` name it |
| `readTime(id: string): number` | minutes, at `WORDS_PER_MINUTE` (220), at least 1 |
| `homeBands(): { section: Section; entries: Entry[]; total: number }[]` | one band per shown section: `min(5, n)` **top-level** entries by date, newest first (decision 1); `total` counts every entry in the section, children included |
| `latest(n = 6): Entry[]` | the `n` newest published entries of **any** kind, no cap per series (decision 2) |
| `newHere(section?: string): { counts: Partial<Record<Kind, number>>; start: Entry } \| null` | what a section (or the whole Lab) holds by kind, and where to begin: the oldest entry of the highest-ranked kind present (study, series, build, experiment, essay, note) |

`LAB_FIXTURE=kinds`, read only by `content.ts`, adds `content/lab/fixture/` to the active set. Every
fixture id starts `fx-`, so rule 4 can prove none reaches a default build.

`validateLab(lab, bodies, fileExists)` (PR 2) runs at `next build` (through `content/validate.ts`),
in `npm run content:check`, and, from PR 14, on every `/edit` save. It runs over **both** sets.

## 3. URLs

| Path | Page | `LabRoute.kind` |
|---|---|---|
| `/lab` | the home | `home` |
| `/lab/<section>` | a section | `section` |
| `/lab/<section>/<slug>` | a top-level entry | `entry` |
| `/lab/<section>/<parent>/<slug>` | a child: a chapter under its series, a note under its study | `entry` |
| `/lab/index` | every entry, by year | `index` |
| `/lab/tags/<tag>` | one tag | `tag` |
| `/lab/glossary` | every term | `glossary` |

Canonical URLs are absolute on `https://aahil-khan.xyz` (`SITE_URL` in `lib/site.ts`). Routes are
statically generated: `generateStaticParams` with `dynamicParams = false`, so anything else is a
clean 404.

## 4. Markdown

Bodies are Markdown through unified (`lib/lab/markdown/**`, server only), rendered to React with
`hast-util-to-jsx-runtime`. **No MDX, no raw HTML**: HTML in a body renders as text.

| Syntax | Means |
|---|---|
| `[[id\|words]]` | a link to an entry, by id |
| `[[t:id\|words]]` | a glossary term |
| `[[tag:id\|words]]` | a tag |
| `[^key]` | a numbered reference from the entry's `refs`. The Lab's own citation syntax, not GFM footnotes, which are off |
| `::figure{of="id"}` | a figure from `lab-figures.json`, rendered by its instrument |
| `:::side[Heading]` … `:::` | a sidenote |
| fenced code with a language | Shiki at build, on the CSS-variables theme mapped to the ink tiers |
| `![alt](src "w=1200 h=675")` | an image with its size declared; `src` under `public/` |
| GFM tables, strikethrough, autolinks | on |

## 5. The rendered DOM

Every Lab page is server-rendered, readable with JavaScript off. The check and the client islands
find things by these attributes, never by class names:

| Selector | On |
|---|---|
| `article[data-entry="<id>"]` | the entry: lead, body, ending. Previews fetch a page and take this element |
| `[data-body-end]` | an empty marker after the body's last block, before References. Progress reaches 1 exactly when it meets the viewport's bottom edge |
| `[data-lead]` | exactly one per entry: the lead |
| `[data-rail]` | the rail (from 1200px) or its block after the text |
| `[data-toc]` | On this page |
| `[data-tool-log]`, `[data-num]` | text set in Space Mono |
| `[data-annot]`, `time[datetime]` | text set in Caveat (with `[data-dot]`, the reading dot) |
| `[data-demo-marker]` | the "Demo content" marker in the bar, only while demo is on |
| `a[data-preview="<PreviewTarget>"]` | every link that previews: a plain server-rendered `<a>` with a real `href`. One delegated controller (PR 10) handles hover, focus and taps for the whole page |

## 6. Slot modules

PR 6 ships these as stubs, so the shell renders before the lanes land. The named PR replaces the
module's insides and keeps its exports.

| Module | Exports | Stub | Replaced by |
|---|---|---|---|
| `components/lab/preview/index.tsx` | `PreviewRoot` | renders `null` | PR 10 |
| `components/lab/instruments/index.tsx` | `Lead`, `Figure` | the static, server-rendered fallback | PR 11 |
| `components/lab/sound/index.tsx` | `SoundControl` | renders `null` | PR 12 |
| `components/lab/name/index.tsx` | `Name` | the double-underlined name only | PR 12 |

## 7. Cross-lane events

DOM `CustomEvent`s dispatched on `document`, so lanes never import each other.

| Event | `detail` | Fired by | Heard by |
|---|---|---|---|
| `lab:preview-open` | `{ via: 'hover' \| 'focus' \| 'tap' \| 'click' }` | previews (PR 10) | sound (PR 12): plays `peek` for anything but `hover` |
| `lab:cue` | `{ name: 'counter' \| 'deal' \| 'turn' }` | instruments (PR 11), the picker (PR 6) | sound (PR 12) |

## 8. Tokens and motion

- **CSS custom properties**, values in DIRECTION's Lab section:
  - from `content/themes.ts`, on every theme: `--canvas-base`, `--canvas-grid`, `--surface`,
    `--raised`, `--ink`, `--ink-muted`, `--ink-subtle`, `--accent`, `--accent-ink`, `--border`,
    `--shadow-ink`, `--hair`, `--mark`, `--trail`;
  - in the Lab's CSS (`app/lab/lab.css`, PR 6): the `--lab-fs-*` scale, `--lab-lh-body`,
    `--lab-measure`, `--lab-bar-h`, `--lab-pad`, `--lab-gutter`, `--lab-rail`,
    `--lab-margin-col`, `--lab-edge`, and the Lab theme's `--border-strong`, `--highlight`,
    `--tb-tint`, `--focus`.
- **Themes.** `themes` is the site's 18. `labThemes` is the Lab theme's two palettes,
  `lab-light` and `lab-dark`, each `labOnly: true`. `allThemes` is both, and only
  `themeCss()` and the contrast check read it. **No picker outside the Lab may list a Lab theme**,
  and none can: they import `themes`. `lib/theme.ts` accepts only the 18.
- **The look** (`lib/lab/look.ts`, the one owner): Paper is the site's theme; the Lab theme sets
  `data-theme` to its palette and leaves `canvas.theme` alone. State lives on `<html>`:
  `data-look` (`paper | lab`), `data-mode` (`light | dark`), `data-theme`, `data-paper-theme`,
  `data-dark` (`1 | 0`), `data-aa-measure` (`wide | comfortable`), `data-aa-size` (`16 | 17 | 19`).
  `lookBootScript` writes them before first paint; the Lab layout renders it as the first thing in
  its tree, after the root layout's theme boot script. React reads them only through
  `useSyncExternalStore(subscribeLook, getLookSnapshot, getLookServerSnapshot)`. The setters are
  `setLook`, `setLabMode`, `setPaperTheme` (through `lib/theme.ts`), `toggleDark`, `setAa`.
  For one visit, `?look=paper|lab`, `?mode=light|dark` and `?theme=<site theme>` override the
  stored look without saving it; the check opens pages that way.
- **`lib/motion/tokens.ts`**: `EASE` (`cubic-bezier(0.16, 1, 0.3, 1)`), `EASE_BEZIER` for Motion,
  `SITE`, `LAB` (every Lab duration and distance from NEXT shortcut 3), `INTENT` (300 / 90 / 600 /
  220), `REDUCED.maxDuration` (120), and `sec()` (ms → s). Components never type a duration.
- **`lib/motion/reduced.ts`**: the one owner of reduced motion. `REDUCED_QUERY`, `MOTION_QUERY`,
  `prefersReducedMotion()` (effects and handlers only; `true` on the server),
  `subscribeReducedMotion()`, and `useReducedMotion()` (render, with a fixed server snapshot of
  `true`). Motion's `MotionConfig reducedMotion` is fed from `useReducedMotion()`, never `"user"`.

## 9. Analytics

`track(name, props)` from `lib/events.ts`. Names are `EVENT_NAMES`, props are typed per name
(`EventProps`), and every value is a bucket from a closed set:

| Name | Props |
|---|---|
| `lab_view` | `path`, `kind` (a page kind), `source` (`linkedin \| x \| desk \| site \| direct`) |
| `read_depth` | `path`, `depth` (`25 \| 50 \| 75 \| 100`) |
| `lead_use` | `path`, `lead` |
| `preview_open` | `via`, `target` (`entry \| term \| tag \| ref \| out`) |
| `look_switch` | `look`, `mode?` |
| `name_say`, `agents_view`, `back_to_desk` | none |
| `player_start` | `source` (`station \| noise \| track`) |
| `player_minutes` | `minutes` (`1 \| 5 \| 15 \| 30 \| 60`) |
| `share` | `path`, `via` (`native \| copy \| x \| linkedin`) |
| `md_view` | `path` |

PR 1 ships `track()` as a typed no-op; PR 4 implements it behind the site's one admission gate. No
cookies, no identifiers, no third parties. Call it freely from any lane: the call sites do not
change when it starts sending.

## 10. Storage keys

| Key | Store | Owner | Holds |
|---|---|---|---|
| `canvas.theme` | local | `lib/theme.ts` | the site theme, which Paper follows |
| `canvas.sound` | local | `lib/audio.ts` | mute |
| `canvas.station`, `canvas.ambience`, `canvas.masterVolume`, `canvas.ambienceVolume`, `canvas.uiVolume` | local | `lib/audio.ts`, `lib/ambience.ts` | the shared Sound menu |
| `lab.look` | local | `lib/lab/look.ts` | `paper \| lab` |
| `lab.mode` | local | `lib/lab/look.ts` | `light \| dark` |
| `lab.aa` | local | `lib/lab/look.ts` | `{"measure":"wide\|comfortable","size":16\|17\|19}` |
| `lab.from` | session | `lib/canvas/session.ts` (PR 16) | `desk` while the reader came from the canvas |
| `canvas.admitted` | session | `lib/admission.ts` | `1` once this tab passed the admission gate; never sent |

The mockup's `lab.theme` key is gone: Paper is the site's own theme. Every read and write is in a
`try`, because storage can be absent.

## 11. The check

`npm run check:lab -- [--require=<ids>|all] [--only=<ids>] [--lighthouse] [--quick] [--url=<base>]`

Unless given `--url`, `scripts/check-lab.mjs` runs `npm run build`, serves it with `next start` on
`$PORT`, runs `npm run check` against that server (`CONTRAST_URL`, so the contrast audit reads this
build), then every rule. If a selected rule needs the fixture, it builds again with
`LAB_FIXTURE=kinds` into `.next/fixture` (`NEXT_DIST_DIR`) and serves that on `$PORT + 2`. It ends
`LAB OK` (exit 0) or `LAB FAIL n` (exit 1).

**One file per lane** under `scripts/check-lab/`. Its default export is a rule, or a list of rules:

```js
export default {
  id: 'G',                 // an id from the plan's table; anything else fails the run
  title: 'Progress',
  needs: ['server'],       // any of 'build', 'server', 'browser', 'fixture'
  async run(ctx) {
    return { fail: [/* one string per failed assertion */], notes: [/* context */] }
    // or, while the feature does not exist yet:
    return { notBuilt: 'no entry page yet' }
  },
}
```

A rule no file defines, or one that returns `notBuilt`, is "not built". **`--require` turns "not
built" into a failure**; without it, "not built" is reported and passes. A rule that throws fails.

`ctx` gives every rule:

| Field | What |
|---|---|
| `root`, `base`, `fixtureBase` | the repo, the server under test, the fixture server (or `null`) |
| `lab` | `{ built, routes }` from `scripts/lab-routes.ts`, which reads `routes()`; `built` is false until PR 2 |
| `visibility` | `{ labPublic, labDemo, DEMO_CONTENT, DEMO_PUBLIC }` |
| `widths`, `looks` | the matrix: 390×844, 768×1024, 1024×768, 1440×900, 1920×1080; Paper cream, Paper tokyo-night, Lab theme Light, Lab theme Dark (each a `query` string for §8's overrides). `--quick` narrows to 390 and 1440 in one look, for iteration only |
| `get(path, { fixture })` | `{ status, headers, text }`, redirects not followed |
| `page(path, contextOptions)` | `{ page, context, errors, close }` in the one shared Chromium (cached, never installed), console and page errors collected |
| `quick`, `lighthouse` | the flags |

Rules in PR 1: **4** and **B** (`static.mjs`), **I** (`visibility.mjs`). Rule 4's reduced-motion
allowlist holds the canvas's seven older calls by path and count; anything new fails.

## Visibility

- **The switch:** `content/data/lab.json` → `"public": false`. PR 17 changes that one line.
- **The owner:** `lib/lab/visibility.ts` exports `labPublic`, and is its only reader. Metadata,
  `next.config.ts`, the sitemap, `/feed.xml`, `llms.txt`, the doors on `/` and the canvas Lab window
  all ask it.
- **While hidden:** every `/lab/**` response carries `X-Robots-Tag: noindex` (`next.config.ts`,
  which covers 404s, OG images and `.md` twins), and every Lab page carries
  `<meta name="robots" content="noindex, nofollow">` (`labMetadata()`, PR 6). The sitemap, the
  feed and `llms.txt` name no Lab URL. `/`, `/canvas` and the nav link nowhere into it.
- **Never a `robots.txt` Disallow.** It would publish the path, and crawlers would never see the
  `noindex`.
- `/lab` still answers while hidden, so Aahil can review it on the live site.
- Rule I holds all of this on every PR, and the public state in PR 17.

## Demo mode

Aahil, approving the plan on 27 Nov: "dont pre populate lab with content ill add eveyrhting acc to
me later, for now, have a demo mode with pre populated contetnt so that i can understnad look and
feel on prod, we'll delete everything in the end".

- **The second switch:** `content/data/lab.json` → `"demo": true`, beside `public`. Its only
  reader is `lib/lab/visibility.ts`, which exports `labDemo`, `DEMO_CONTENT`
  (`content/lab/demo`) and `DEMO_PUBLIC` (`/lab/demo`). Loaders take the paths from there, never
  from a literal.
- **The real content starts empty.** `lab.json` holds `public: false`, `demo: true` and empty
  `sections`, `tags` and `entries`; `lab-terms.json` and `lab-figures.json` start `[]` and `{}`.
  Aahil fills them himself at `/edit`.
- **The demo set lives apart**, so that deleting it is one directory and one flag:
  - `content/lab/demo/lab.json` (`LabContent`: `sections`, `tags`, `entries`),
    `content/lab/demo/lab-terms.json`, `lab-figures.json`, `lab-unfurls.json`,
    `content/lab/demo/studies/<id>.json`, and its bodies at
    `content/lab/demo/<section>/…/<slug>.md`;
  - its images under `public/lab/demo/`, referenced as `/lab/demo/…`;
  - its tests under `content/lab/demo/*.test.ts` (`npm test` already runs `content/**/*.test.ts`).
  PR 2 writes it.
- **The loaders choose the set.** `getLab()` and everything built on it return the demo set while
  `labDemo` is on, and the real set while it is off. `copy` always comes from
  `content/data/lab.json`: the chrome's words are real either way. No component knows which set it
  has.
- **The marker.** While demo is on, every Lab page shows one small, quiet "Demo content" marker in
  the bar: `[data-demo-marker]`, its words from `copy.demoMarker`, styled per DIRECTION. Aahil
  sees it on prod; nobody else does, because `/lab` is hidden. Rule I checks it shows exactly when
  `demo` is true.
- **The demo set passes the same `validateLab` rules as the real set, privacy denylist
  included.** `content:check` and the build run them over both sets, whichever is active.
- **No file outside `content/lab/demo/`, `public/lab/demo/` and `lib/lab/visibility.ts` names a
  demo id.** Rule 4 checks it for every id in the demo set's `lab.json` (quoted, or between
  slashes, in code under `app/`, `components/`, `lib/`, `content/` and `scripts/`).
- **The clean-up is one PR:** delete `content/lab/demo/` and `public/lab/demo/`; delete the
  `demo` field from `lab.json`, `labDemo`, `DEMO_CONTENT` and `DEMO_PUBLIC` from
  `visibility.ts`, and `demo` from `RESERVED_IDS`; delete the marker, `copy.demoMarker` and its
  check in rule I. Nothing else should need to change; if something does, a rule above was broken.

## The empty Lab

**A requirement for PRs 6 and 9.** With demo off and no real entries, every Lab route renders a
proper page, and nothing crashes on empty data:

- `/lab` renders the home with its intro and a short note, from `copy`, that the Lab is being set
  up. No bands, no Latest, no "All 0 entries".
- `/lab/index` and `/lab/glossary` render with an empty-state line from `copy`.
- Section, entry and tag routes 404 cleanly: there are none to generate, and
  `dynamicParams = false` refuses the rest.
- The bar, the footer, the look switch and Aa work as on any page.
- `homeBands()`, `latest()`, `related()` and `backlinks()` return `[]`, `newHere()` returns `null`,
  and `routes()` returns the home, the index and the glossary.

PR 6 and PR 9 each prove it by building once with `demo: false` locally (and reverting).
