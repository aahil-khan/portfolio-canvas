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

`scripts/contrast.mjs` enforces ≥ 4.5:1 for every `--ink*` on every `--surface*`, in every
theme. It fails the build. Do not eyeball this — 17 themes is far past what eyes catch, and the
last build shipped a token at 4.23:1.

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

## Non-negotiables

1. Pan and zoom **never** pass through React state. Transform lives in a ref, written to
   `world.style.transform` in a rAF loop.
2. `--accent` ≤ ~5% of pixels.
3. No `backdrop-filter` inside the transformed world.
4. Every dock item is a real `<button>`. Every window is real, server-rendered DOM.
5. `/resume` renders completely with JavaScript disabled.
