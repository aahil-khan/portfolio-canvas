# Design direction — locked

Every value here was **measured from a real browser**, not guessed. Do not substitute a value
that "looks about right" — if something needs to change, change it here first and say why.

## The idea in one line

A macOS-style desktop on an infinite canvas: neobrutalist windows — hard black border, hard
offset shadow, no blur — floating on a soft warm gradient, opened from a glass dock.

Two references, split by role:

- **yevtam.com → the shell.** Layout, dock, cursor, the fact that the page never scrolls.
- **ajvadlaseen.com → the surface.** Typography, warmth, black borders, hard shadows.

The split matters: hard shadows stay crisp at every zoom level, where `backdrop-filter` glass
costs a full repaint on every pan frame. Glass is allowed **only** on the dock and the top pill,
which are `position:fixed` and never inside the transformed world.

## Type

`Space Grotesk` — 400 / 500 / 700. Self-host via `next/font/local`; never a Google CDN URL
(the last build broke when a versioned gstatic URL 404'd).

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| `display` — hero name | `clamp(2.75rem, 6vw, 4.5rem)` | 700 | 0.95 | -0.02em |
| `title` — window titles | 0.9375rem | 500 | 1.2 | -0.005em |
| `heading` — in-window h2 | 1.375rem | 700 | 1.15 | -0.01em |
| `body` | 1rem | 400 | 1.6 | normal |
| `label` — meta, chips | 0.75rem | 500 | 1.3 | 0.04em, uppercase |

Body measure caps at **64ch**. Windows are not wide enough to need more, and text that runs the
full window width is the fastest way to make this look like a wireframe.

### The front page scale

`/` is full-bleed, so the table above — sized for a 560px window — does not reach far enough for
it. These are declared on `.site` in `app/site.css` and apply to that surface only. Both ends of
each clamp are tuned, not just the maximum:

| Token | Value | Why the floor matters |
|---|---|---|
| `--fs-mega` — hero name | `clamp(4rem, 15vw, 10.5rem)` | At 390px the name must still out-weigh the headline, which runs four lines there. A 3.25rem floor lost that fight. |
| `--fs-display` — hero headline | `clamp(1.625rem, 4.2vw, 3.75rem)` | Its first floor (2.25rem) made a five-line paragraph heavier than the name on a phone. |
| `--fs-heading` — section h2 | `clamp(1.375rem, 2.6vw, 2.25rem)` | Matches the in-window heading at its floor, so the two surfaces agree where they meet. |
| `--fs-body` | `1.0625rem` | A step up from the résumé's 1rem. Part of this page's brief is readers who are not squinting at interfaces all day. |

## Colour — the `cream` theme (default)

```css
--canvas-base:    #F7F5EE;   /* warm off-white, the world's floor */
--canvas-glow:    rgba(255,255,255,0.75);
--canvas-grid:    rgba(22,22,22,0.055);

--surface:        #FFFFFF;   /* window body */
--surface-alt:    #FDF7C4;   /* window title bar — measured from ajvad --background */
--surface-sunken: #F4F2EA;

--ink:            #161616;   /* measured: yevtam --page-fg */
--ink-muted:      rgba(22,22,22,0.62);
--ink-subtle:     rgba(22,22,22,0.45);

--accent:         #FACC00;   /* measured: ajvad --main / --chart-1 */
--accent-ink:     #161616;   /* text on accent — never white, fails contrast badly */

--border:         #161616;
--border-width:   2px;
--shadow-hard:    4px 4px 0 0 var(--border);
--shadow-hard-lg: 6px 6px 0 0 var(--border);
```

Canvas background reproduces yevtam's construction, warmed:

```css
background:
  radial-gradient(circle at 50% 8%,  rgba(255,255,255,0.75), transparent 34%),
  radial-gradient(circle at 20% 18%, rgba(255,255,255,0.35), transparent 28%),
  linear-gradient(180deg, #FBFAF6 0%, #F7F5EE 36%, #F1EFE6 100%);
```

**`--accent` is a highlight, not a surface.** Hold it to roughly 5% of pixels: the active dock
indicator, focused window title bar, link underlines, the focus ring. A window filled with
`#FACC00` reads as a warning, not a brand.

### Theme contract

Every theme **must** define all of the tokens above. `--border` is a *token*, never the literal
`#000` — pure black borders are correct in `cream` and wrong in Mocha or Dracula. `--accent-ink`
is per-theme too, because whether text on the accent should be light or dark flips between them.

`scripts/check-contrast.mjs` enforces ≥ 4.5:1 for every `--ink*` on every `--surface*` (and
`--raised`), in every theme, the Lab's two palettes included: 20 in all. It reads computed
colours off the live page in the server's cached Chromium, and it **fails when it finds no
browser** rather than skipping (`CONTRAST_SKIP=1` is the one deliberate way past). Do not eyeball
this — 20 themes is far past what eyes catch, and the last build shipped a token at 4.23:1.

## Geometry

```css
--radius-window: 12px;
--radius-chip:   8px;
--radius-pill:   999px;

--dock-size:     54px;   /* measured from yevtam */
--dock-gap:      6px;    /* measured */
--dock-radius:   23.5%;  /* measured — percentage radius, the macOS squircle */
--dock-bottom:   28px;   /* yevtam uses 102px; too high once windows exist */
--dock-pad:      12px;
--dock-panel-r:  22px;   /* measured */
```

Window default size `560×420`, min `320×240`.

## Motion

One easing for everything that decelerates: `cubic-bezier(0.16, 1, 0.3, 1)` — measured from
yevtam's dock. Durations: 450ms dock width, 320ms window open/close, 180ms hover.

Dock click bounce, measured from yevtam's GSAP timeline:
`scale 1.08 / y -2` (140ms) → `scale 0.98 / y 1` (120ms) → `scale 1 / y 0` (180ms).

**Reduced motion** collapses all of it to opacity-only, and kills pan momentum. One owner:
`lib/motion/reduced.ts`. Not a branch scattered per component — that is how the last build
produced a hydration mismatch (React #418).

## Cursor

Copy yevtam's gate exactly; it is the correct one:

```css
@media (hover: hover) and (pointer: fine) {
  [data-cursor="dot"], [data-cursor="dot"] * { cursor: none !important; }
}
```

7px dot, `position:fixed`, `pointer-events:none`, follows with a short lerp. Never on touch.
Native `:focus-visible` rings are untouched — the dot is decoration, not a replacement.

## Sound

Synthesised via Web Audio. **Zero audio files.** Muted on arrival. One `AudioContext`, unlocked
on first gesture. This must never be startling.

Cue gains stay low — the loudest, `theme`, peaks near 0.08 where its five voices overlap — and
those numbers encode the balance *between* cues. The interface bus then applies a make-up gain of
2.5, so the peak that actually reaches the output is ≈ 0.2. That exists because the mixer's two
halves are different beasts: the music is a mastered track through an `<audio>` element at ~0.4
of full scale, continuous and full band, while a cue is a 1.8kHz-rolled transient lasting a tenth
of a second. Matched by the numbers, they are ~25dB apart to a listener. Change the make-up gain
in `lib/audio.ts`, never the cue table, or the cues drift out of balance with each other.

## The Lab

`/lab` is a reading surface, built from the approved mockup `prototype/lab-v2b/` (#35–#39). Every
value below is from that mockup's `lab.css` or from `prototype/lab-v2b/NEXT.md`, which records
Aahil's decisions of 27 Nov. The code copies are `content/themes.ts` (colour) and
`lib/motion/tokens.ts` (motion). The contract between PRs is `content/lab/API.md`.

### Themes (revised 27 Nov)

Aahil, 27 Nov, on the first build's "Paper | Lab theme" switch and its separate light/dark button:
"bring out all themes that the main site has and a picker like that too … keep lab dark as
default". So the Lab has **one theme picker**, like the canvas's Themes window: Light and Dark
groups with a swatch each, holding the site's 18 and the Lab's two palettes, Lab Light and Lab
Dark, 20 in all, the Lab's own first in each group. A desktop popover under the bar; on a phone a
sheet.

- **The Lab keeps its own choice** (`lab.theme`, `lib/lab/look.ts`), **Lab Dark by default** whatever
  the system prefers. It never reads or writes `canvas.theme`: picking a theme in the Lab changes
  nothing on `/` or the canvas, and picking one there changes nothing here.
- **The Lab's palettes stay Lab-only.** They are `labThemes` in `content/themes.ts`, apart from the
  site's `themes`, so the canvas's Themes window, its dock menu, the command palette, the terminal
  and `/`'s toggle still list exactly 18 and cannot list them by mistake. `allThemes` (20) is read
  by `themeCss()`, the contrast check and the Lab's picker.
- **Every theme keeps the frame language.** One geometry under all 20, so a theme change moves
  nothing: the 2px `--border` frame and a zero-blur offset on every box, window, card, figure and
  panel, title bars, 12px radii (rule K). A site theme draws its rules as the border at 2px
  (`--rule-w: 2px`); a Lab palette draws a 1px `--hair` inside the same edge.
- A theme change crossfades colours in 320ms. With JavaScript off the Lab is Lab Dark.

| Lab palette token | Light | Dark |
|---|---|---|
| `--canvas-base` | `#FAFAF7` | `#0B0B0A` |
| `--surface` | `#FFFFFF` | `#131311` |
| `--raised` | `#F3F2EE` | `#1B1A17` |
| `--ink` / `--ink-muted` / `--ink-subtle` | `#141413` / .70 / .60 | `#EEECE5` / .66 / .54 (lifted in the Lab, below) |
| `--border` | `#262520`, a warm near-black | **`#7F6C45`, brass** (decision 3: "pick brass") |
| `--shadow-ink` | `#B9B4A6`, a softer warm stone | **`#7F6C45`**: frame and offset are one colour, as on the canvas |
| `--hair` | `rgba(20,20,19,.10)` | `rgba(238,236,229,.08)` |
| `--accent` / `--accent-ink` | `#FACC00` / `#141413` | `#F5C518` / `#0B0B0A` |
| `--mark` | `color-mix(#FACC00 55%, #FFF)` | `color-mix(#F5C518 85%, #131311)` |
| `--trail` | `#FACC00` | `rgba(238,236,229,.66)` |
| `--canvas-grid` | `transparent` | `transparent` |

The constants a Lab palette adds in the Lab's CSS, not in `themes.ts` because no other surface
needs them:

| Constant | Light | Dark | Used for |
|---|---|---|---|
| `--border-strong` | `rgba(20,20,19,.18)` | `rgba(238,236,229,.18)` | control hover rings, the bar's edge in Dark |
| `--highlight` | `rgba(255,255,255,.9)` | `rgba(255,255,255,.05)` | the 1px inset top light on boxes |
| `--tb-tint` | 16% | 9% | accent mixed into title bars |
| `--focus` | `#141413` (yellow in Light is a fill, never a line) | `#F5C518` | the focus ring |

A site theme's title bar is `color-mix(--accent 25%, --surface)`, 12% on dark themes.

### Contrast on dark grounds (27 Nov)

"Dark mode lacks contrast in places making stuff difficult to read." A dark theme's ink tiers are
tuned for the canvas's windows, where 4.5:1 is the bar; a page of reading needs more. Inside the
Lab, and only there, every dark palette (the 13 site themes and Lab Dark) is lifted to:

| Text | Token | At least |
|---|---|---|
| Body | `--ink` | **10:1** on the page |
| Secondary: meta, captions, the rail, references | `--ink-muted` | **7:1** on the page, a box and a panel |
| The smallest labels | `--ink-subtle` | **5.5:1** likewise |
| A rule that carries meaning, a border | `--rule` (the frame's colour) | **3:1** against its ground |

A tier that already passes keeps its theme's colour; otherwise ink mixes toward white and the
lower tiers toward the lifted ink, by the smallest step that passes (`lib/lab/ink.ts`, which the
Lab layout renders as CSS). Lab Dark's muted ink lands at `#BAB9B3`, its subtle at `#A6A59F`.
Light themes keep their own tiers. The check holds every number (rules 16 and 17).

**Rules that carry meaning** (a quote's edge, the pull-quote, an aside, "What I'd do now") are drawn
in `--rule`, the frame's colour, never the hairline: in Lab Dark the hairline was 1.2:1, and the
pull-quote's rule vanished but for its 48px of accent. Rules that only separate rows stay `--hair`.

**Scrollbars**, on `/lab` only: thin, the thumb `color-mix(--ink 50%, --canvas-base)` on the page's
ground or a transparent track, ≥ 3:1 thumb against track in every theme. `scrollbar-color` plus the
`::-webkit-scrollbar` pseudo-elements for Safari.

### Tokens

Five tokens join every theme (`content/themes.ts`). The Lab's palettes state them outright (above). The
site's 18 derive them by one rule, written once in `withLabTokens`:

| Token | CSS | Light site theme | Dark site theme | For |
|---|---|---|---|---|
| `trail` | `--trail` | the accent | `--ink-muted` | the reading-progress line under the bar |
| `raised` | `--raised` | `--surface` | `--surface` | menus, popovers, panels |
| `shadowInk` | `--shadow-ink` | `--border` | `--border` | the offset shadow's colour |
| `hair` | `--hair` | `--border` | `--border` | the rule between rows |
| `mark` | `--mark` | `color-mix(accent 70%, surface)` | the accent | `<mark>` and selections, under `--accent-ink` |

**The trail** (NEXT shortcut 12, decision 13) is visible in every theme. On a dark ground it is a
2px line of its own under the bar, filling from the left to the dot, so it is held to **3:1 against
the bar's ground** (`--canvas-base`). On a light ground (the light site themes, Lab Light) the bar's edge
is ink, so the trail is the accent, **4px, laid over that edge** (`bottom: -3px`), and read as the edge
changing colour; there it is held to **3:1 against the edge** (`--border`). The contrast check
measures both. `--accent-ink` must reach 4.5:1 on `--mark` too.

### Type

Three families on a Lab page, at most, unless the reader picks a fourth for the text (Aa, below).
Space Grotesk is preloaded; Mono and Caveat are `display: optional`, so they never delay the first
paint.

| Family | Weight | Only in |
|---|---|---|
| Space Grotesk | 400 / 500 / 700 | everything else, and the reading text by default |
| Space Mono | 400 | `pre, code, kbd, [data-tool-log], [data-num]` |
| Caveat | 500 | `time, [data-annot], [data-dot]`, never more than 8 words |
| Literata (Aa: Serif) | 200–900, roman and italic | the reading text, once a reader picks it. Declared, never preloaded, so it is fetched only then |
| the system's sans (Aa: System) | — | the reading text, once a reader picks it |

**The reading text** is an entry's title, sub-line, lead intro and column. The chrome around it (the
bar, the rail, chips, end headings) stays Space Grotesk in every setting.

| Token | Value | Role |
|---|---|---|
| `--lab-fs-hero` | `clamp(3rem, 9vw, 7rem)` | a section page's title, the only hero |
| `--lab-fs-num` | `clamp(4.5rem, 12vw, 9rem)` | a chapter's faint big number |
| `--lab-fs-title` | `clamp(2.5rem, 5.2vw, 4rem)` | the home's and an entry's title. A 2.5rem floor keeps title ÷ meta ≥ 3 on a phone |
| `--lab-fs-h2` | `max(clamp(1.375rem, 2.2vw, 1.75rem), body × 1.3)` | in-body h2, band titles |
| `--lab-fs-lede` | `max(clamp(1.1875rem, 1.6vw, 1.375rem), body × 1.15)` | ledes, quotes, an essay's opening |
| `--lab-fs-pull` | `var(--lab-fs-lede)` | the pull-quote, **at the lede's size**, never display size (decision 5: "the quotes are too big") |
| `--lab-fs-body` | `1.0625rem` (17px); Aa sets 14–22px | body |
| `--lab-lh-body` | `1.75`; Aa: tight `1.55`, relaxed `1.95` (`1.65` normal on a phone) | body line height (rule 13: ≥ 1.7 on desktop by default) |
| `--lab-fs-meta` | `max(.8125rem, body × .765)`: 13px up to a 17px body | meta, chips, the rail, references |
| `--lab-fs-hand` | `max(1.375rem, body × 1.294)` | Caveat at 500: 22px reads like 17px of Space Grotesk |
| `--lab-fs-code` | `var(--lab-fs-meta)` | code |

The steps above the body follow it, so the hierarchy holds at every size Aa offers: the meta never
drops under 13px, h2 and the lede stay above the body. Rule 8 holds the default page to ≤ 6 sizes,
largest ÷ smallest ≥ 3, smallest ≥ 13px, ≤ 2 sizes in 13–17px, and at 14px and 22px checks that
the hierarchy holds and nothing is under 13px.

### Reader settings (Aa, 27 Nov)

"Font should be configurable not only 3 options … line length should be configurable with options
like keep stuff centre aligned (it will move right panel down) vs this layout option." Aa is a
panel under the bar (a sheet on a phone). Every setting is remembered (`lab.aa`) and applied before
first paint; Reset returns all of them to the defaults.

| Setting | Options | Default |
|---|---|---|
| Text size | 14–22px, in 1px steps, − and + around the value | 17px |
| Font | Sans (Space Grotesk), Serif (Literata), System (the device's sans) | Sans |
| Line spacing | Tight, Normal, Relaxed | Normal |
| Line length | Narrow ≈ 62ch (`32em`), Comfortable ≈ 72ch (`37em`), Wide ≈ 96ch (`47.5em`) | Wide |
| Layout | Side panel (the column and the rail), Centred (the column alone, the rail after the text) | Side panel |

Line length is offered from 700px and Layout from 1200px, the widths where each changes anything.
The measure is in ems of Space Grotesk, rescaled by each font's character width (`--lab-cw`: 1,
.979 for Literata, 1.046 for the system sans, measured on body text), so each length holds its
character count in every font.

### Layout

| Token | Value | Note |
|---|---|---|
| `--lab-measure` | `47.5em`, about **96ch** of Space Grotesk at 17px | Wide, the default (approved with the mockup) |
| Comfortable (Aa) | `37em`, about **72ch** | `data-aa-measure="comfortable"` |
| Narrow (Aa) | `32em`, about **62ch** | `data-aa-measure="narrow"` |
| `--lab-bar-h` | `56px` | the fixed bar |
| `--lab-pad` | `24px` | page side padding |
| `--lab-gutter` | `48px` | between the column and the rail or margin |
| `--lab-rail` | **`272px`, from 1200px** (decision 6) | On this page, Share, Links to this page, Related, Tags |
| `--lab-margin-col` | `280px`, from 1440px | sidenotes' margin on list pages |
| `--lab-edge` | `2px` | every box's edge, in every theme |

- **The rail** (decision 6, revised 27 Nov). From 1200px, in the Side panel layout, an entry is two
  columns, column plus rail, **centred together** (decision 8; rule C: |left gap − right gap| ≤
  24px at 1440 and 1920). **It is there from the first screen.** The first build hid it until a
  quarter screen of scroll; Aahil, seeing it: "the hidden right panel until scroll down doesn't
  make sense". Rules 5 and 7 count the reading column and the bar, not the rail beside them.
- **The rail never scrolls as one block** ("right panel having scroll bar as a whole is
  irritating, rather break down into sections"). Its box is sticky at
  `top: calc(--lab-bar-h + 24px)`, `min(100vh − bar − 48px, the text's height)` tall. Each section
  (On this page, Share, Links to this page, Related, Tags) keeps its heading and scrolls its own
  list. The sections share the height: each gets its content's height while all fit, and past that
  the room is shared out evenly (grid rows of `minmax(0, max-content)`), so a short section never
  scrolls because a long one is long. A list that continues fades at that edge. Related holds up to
  eight entries.
- **Centred** (Aa → Layout): the column alone, centred on the page, and the rail a block after the
  text, as below 1200px. Below 1200px the rail is a block after the text, without On this page or
  its copy of Share. On entries, sidenotes and the pull-quote sit in the text column.
- **On this page** marks the heading being read: an IntersectionObserver, with the accent bar
  (`inset 2px 0 0 --accent`) sliding between headings.
- **Home and section pages** centre at 1440 and 1920 already.

### Windows, cards and the sheet

Previews follow decisions 10 and 11.

| | Value |
|---|---|
| Card (term, tag, ref, link out) | **360px** wide, `max-width: calc(100vw − 32px)` |
| Window (a whole entry) | **460px** wide, height at most **`min(60vh, 500px)`**, scrolling inside |
| Placement | below the link when it fits, else above, else the roomier side with the height capped. **Never over its link.** The link stays clickable. |
| Stack | at most 3, cascading to the right; Esc closes the top one only |
| Phone sheet | pinned to the bottom, one surface: it draws only its top edge (`--lab-edge` solid, plus the mockup's `0 −12px 32px −20px` ink-35% lift, the one blurred shadow, because the sheet is the screen's own edge), at most 55vh for a card and **92vh** for a whole entry, a 44px Close, the tapped words scrolled clear |
| Unfurl card | image (640×336 WebP), favicon (32px), domain, a two-line title, a three-line description; text only when a site has no image |

### Motion and hover timing

One easing, `cubic-bezier(0.16, 1, 0.3, 1)`. Durations are milliseconds. From NEXT shortcuts 2 and
3; `lib/motion/tokens.ts` is the code copy (`LAB`, `INTENT`).

| What | Value |
|---|---|
| Hover before a first preview opens | **300ms** |
| Hover before the next opens, within the grace | **90ms** |
| The grace after a preview was open | **600ms** |
| Leaving before a preview closes | **220ms**, cancelled by any re-entry, and never while the pointer moves through the safe triangle toward the window |
| Placement | re-runs on resize and when the window's own content grows |
| A window entering | 180ms; rises 6px and scales from 0.98 at the link's corner; opacity over the first 120ms. A cascaded window enters from the side it steps to |
| A window leaving | 120ms; opacity, 4px down, no scale |
| Controls | 120ms in, 180ms out; chips and buttons lift 1px and grow their offset by 1px; press to 1px on `:active` at 80ms; underlines darken from `--ink-muted` to `--ink` |
| A page change | scroll to the top first, never animated; then the column fades and rises 8px over 240ms. The bar and the rail don't move |
| Home band rows | a 30ms stagger, the first time each band enters the viewport, once a visit |
| On this page's accent bar | 180ms transform between headings |
| The theme picker and Aa opening / closing | as a window: 180ms, rising 6px, opacity over the first 120ms / 120ms, 4px down |
| "Link copied" | 140ms crossfade; returns after 1.8s |
| Leads drawing on first view | 450ms, 30ms stagger |
| A theme change | 320ms colour crossfade |
| The bar sliding away | 280ms |
| The reading dot | follows in 320ms; blinks every 4.2s; falls asleep after 20s still |
| The name's tooltip | 140ms opacity, 180ms transform |
| Hover | 180ms |

**Reduced motion** (one owner, `lib/motion/reduced.ts`): every animation is opacity only and ≤ 120ms,
nothing travels, the dot stays still, and Lenis never starts. Motion's `MotionConfig` is fed from the
owner, never `reducedMotion="user"`, so the query is not read twice. No hover sounds anywhere; the
`peek` cue plays only for a tap, click or focus-open.

### The reading progress

Progress is the body's own: `p = clamp((scrollY − bodyTop) / (bodyHeight − innerHeight), 0, 1)`,
where the body ends at `[data-body-end]`, before References (shortcut 1). Finishing the text fills
the trail exactly. The trail is `transform: scaleX(p)` on a full-width element, never a width, and
the dot rides its end. The dot (22px) is ink-outlined; in Lab Dark its outline is ink at 85%, 1.75px,
filled `--raised`. The footer hop happens only once `p = 1`. Chapter ticks are 14×6px,
`--ink` at 18% on light grounds and **34% on dark ones** (decision 13), the current one filled
`--accent`.

### Demo content

Until Aahil writes the real Lab, it can show a **demo set**: `content/data/lab.json` → `"demo": true`
(Aahil, 27 Nov: "have a demo mode with pre populated content so that i can understand look and feel
on prod, we'll delete everything in the end"). While it is on, every Lab page shows a small, quiet
**"Demo content"** marker in the bar, at `--lab-fs-meta` and `--ink-muted`, with no fill and no
accent, so it reads as a label rather than a warning. Its words are `copy.demoMarker`. The rules are
in API.md, "Demo mode".

### Open questions, answered (27 Nov)

- The essays keep names as published. No value.
- ~~The rail appears after the first scroll~~: overturned the same day, once Aahil saw it. The rail
  is there from the first screen (above, Layout).
- The Lab goes live without Tracks. No value until Aahil approves a list.

## Non-negotiables

1. Pan and zoom **never** pass through React state. Transform lives in a ref, written to
   `world.style.transform` in a rAF loop.
2. `--accent` ≤ ~5% of pixels.
3. No `backdrop-filter` inside the transformed world.
4. Every dock item is a real `<button>`. Every window is real, server-rendered DOM.
5. **`/` renders completely with JavaScript disabled.** The guarantee moved here when `/resume`
   was removed — the front page is the plain, readable surface now, and it 308s from the old URL.
   What keeps this true: `.reveal` is visible in CSS and hidden at runtime, and the Experience
   collapse is gated on `@media (scripting: enabled)`, so nothing is ever hidden behind a control
   that cannot work.
