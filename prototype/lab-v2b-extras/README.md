# Lab extras: the surfaces the mockup never drew

This is a static proof of PR 3 in plan `plan-the-real-lab`. It draws everything the approved mockup
(`prototype/lab-v2b/`) left out, so Aahil can give a verdict before any of it is built in React. His
verdict here gates PRs 8 (contributions on `/`), 12 (the name clip), 13 (share cards), 15 (`/agents`
and the colophon) and 16 (the doors).

```bash
cx heavy -- node prototype/lab-v2b-extras/check.mjs   # bundles, then checks; ends with EXTRAS OK
node prototype/lab-v2b-extras/check.mjs --bundle      # bundle only: .build/ and ~/projects/scratch/lab-mockups/lab-extras.html
```

`index.html` also opens straight from disk. With no `?view=` it lists every view and look.

| Path | Holds |
|---|---|
| `index.html` | every view, rendered from the sample data at the top of its script |
| `extras.css` | the tokens, plus rules copied from `app/site.css` (`.site`), `app/desktop.css` (`.desk`, `.card`, `#dock`) and `lab-v2b/lab.css` (`.lab`), and the new surfaces |
| `audio/` | the six name takes as Opus, 5.7 to 8.3 KB each |
| `check.mjs` | the bundler and the check |
| `COPY.md` | every line written for this page, for veto |

**Query params:** `?view=` takes `site-nav`, `site-band`, `site-contrib`, `canvas-lab`, `back-desk`,
`cards`, `colophon`, `agents` or `voices`. The look comes from `?theme=cream|tokyo-night` (for `/`, the
canvas and Paper), or `?look=premium&mode=day|night`. `?bare` hides the mockup's corner tag.

## Sample content

**Every entry title, date, count and lede on this page is a sample.** Aahil decided on 2026-11-27 that the
real Lab won't be pre-populated. He adds his own content later, and a demo mode shows sample
content until then. The samples here are the approved mockup's demo entries (the Shopkeeper, Agent
reliability, Drag to Workspace, Holt and the two essays). The contribution calendar is a seeded
pseudo-random year. What he is judging is the surface around them.

## The views

### `/`: the nav, with Lab (`site-nav`)
"Lab" goes between Work and Contact, as the plan says. It is a route among in-page anchors, so it
carries the Lab's own outward mark (`.ext` in `lab.css`: a corner and its diagonal, drawn in CSS). On a
phone it sits in the drawer, in the same place.

### `/`: From the Lab, after Work (`site-band`)
It shows the three newest entries of any kind (decision 2), the sections with their counts, and one way
in ("Everything in the Lab →"). It uses `/`'s own frame and type: an eyebrow, a section head, a framed card
with a hard shadow and a pill button. The one thing borrowed from the Lab is the handwritten dates, so
the band says where it leads before anyone reads it.

Two designs were weighed:
- **A framed band in the Lab's look**, with a window title bar and Paper's tokens. On `/` that read
  as an embedded foreign page.
- **`/`'s language with one Lab cue**, which is what's drawn.

The old plan's "featured entry plus two" became "three newest" because the evergreen home dropped
Featured. The band is plain links with no reveal, so it works with JS off.

### `/`: GitHub contributions, in Work (`site-contrib`)
This is the canvas card's calendar (`.gh` in `desktop.css`, the same 53-week grid, key and login) as a
framed block at the end of Work, before the band. The card's pastel green is swapped for an **ink ramp**:
`/` has no card colour, and a yellow ramp would spend the page's accent budget on one calendar. On a
phone it scrolls sideways inside its frame and opens on the newest weeks, as the canvas card does
(`direction: rtl`).

### `/canvas`: the Lab window, in Words (`canvas-lab`)
A **Lab** tile joins Writing, Archive and Résumé in the Words folder. Its window has:
- the plan's two-line prompt;
- **"Or start at the Lab's front page →" right under the prompt**;
- each section's two newest top-level entries, with a handwritten date, the title, a one-line claim
  and the kind;
- "All N" per section;
- a closing line saying that every Lab page leads back.

The front-page link moved up from the end, where the plan had it. At the canvas's real 640px cap the
window scrolls, and the link was hidden below the fold at 1440 × 900.

**The tile's colour, `#C9DDF7`, is a proposal.** It is a glass blue, kept apart from the Words lavender.

**On a phone the desk is desktop-only today** (`components/desktop/desk-only.tsx`), so the 390 frame is
that page, unchanged. A phone reaches the Lab from `/` instead.

### Lab: ← Back to the desk (`back-desk`)
In the approved mockup it was loose 13px text before the mark. **On a phone it wrapped to three lines
and pushed the bar apart.** Now it is a door:
- **Desktop:** a framed pill, first in the bar, in the look's own frame (brass on Night).
- **Phone:** a 44px row of its own under the bar, with the full words and one line of reassurance:
  "Your windows are where you left them."

The other option was an icon-only "←" in the bar. It would fit, but it wouldn't say where it goes,
and the plan's rule is "every link names its destination".

### Share cards (`cards`)
Five kinds of page (the front page, a section, a chapter, a build and an essay), each in Paper, Premium
Day and Premium Night. Each card is a real 1200 × 630 box, scaled to fit with a transform, so the check
measures the real size.

Each card is one framed window on the look's ground: a title bar with the AK mark and the page's address,
the kind, the title, the lede, and the handwritten date. A build or an essay gets a still from its lead.
A chapter gets the mockup's outlined numeral.

**An OG image can't follow a visitor's look,** so Aahil picks one look for every card.

### Colophon and For AI agents (`colophon`, `agents`)
These are Lab pages, with the Lab bar and footer, in all four looks.

**The colophon** lists:
- fonts, code, sound and the voice, each with its licence;
- the one analytics sentence;
- how to cite.

**For AI agents** has:
- the four plain-text endpoints, as small windows;
- a `curl` example;
- a usage note, **which is his to write**;
- how to cite.

### The name: six takes (`voices`)
The six Kokoro-82M `af_heart` renders from `lab-v2-research-and/notes/tts/` are encoded to 48 kbps
Opus (5.7 to 8.3 KB each) and are playable. Each take is labelled with what was fed to the model and the
phonemes it spoke. "Use on the name" makes the demo line below play that take, with the AH-hil tooltip.

**Takes 1 and 5 are byte-identical.** Kokoro reads the plain spelling as exactly the phonemes take 5 was
given, so there are five distinct takes. Every take says the full name; the build trims the chosen one
to "Aahil".

## Found on the way

- **A live bug on `/`:** in the phone drawer, the "highly recommended" badge inherits `--accent-ink`
  onto `--surface`. That is **1.05:1 in tokyo-night**. The mockup fixes it with `color: var(--ink)` on
  `.drawer__badge`. The same line is needed in `app/site.css`.
- `/`'s footer gains "For AI agents" in PR 16. It isn't drawn here, since it is one more link in a row
  that already exists.

## Facts to confirm before PR 15

The colophon's credits are from memory of each project's public licence, not checked against the
repositories:
- Space Grotesk (Florian Karsten), Space Mono (Colophon Foundry) and Caveat (Pablo Impallari) are under
  SIL OFL 1.1.
- Next.js, React, Motion, Lenis, Floating UI, unified and Shiki are MIT.
- GSAP is under its own standard licence.
- Kokoro-82M's weights are Apache 2.0.

PR 15 reads each from the installed package's `LICENSE`.

## The check (`check.mjs`)

It runs every view in every look it applies to (cream and tokyo-night for `/` and the canvas, all four
for the Lab's pages), at 390 × 844 and 1440 × 900. That is 52 screens.

| Rule | Holds |
|---|---|
| O | Nothing scrolls sideways, no box clips its text, and every card's content fits its window (a clamped title or lede that loses a line fails). |
| C | Every visible text run is at least 4.5:1 (3:1 when large) on the ground it is drawn on, composited through every translucent layer. Text that something else covers, such as the drawer's scrim, is skipped. |
| A | The accent is at most 5% of the screen's pixels, counting every accent on screen, so the Night cards count too. |
| G | 15 share cards, each exactly 1200 × 630. |
| P | All six takes decode in an `AudioContext`, are 0.5 to 2 s long, and play from their buttons. |
| N | No request leaves `data:` or `file:` on load, and no script error. |
| S | The bundle is under 8 MB and points at no local file. |
