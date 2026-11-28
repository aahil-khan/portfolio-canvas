# Lab extras: the surfaces the mockup never drew

This is a static proof of PR 3 in plan `plan-the-real-lab`. It draws everything the approved mockup
(`prototype/lab-v2b/`) left out, so Aahil can give a verdict before any of it is built in React. His
verdict on it gates PRs 8 (contributions on `/`), 12 (the name clip), 13 (share cards), 15 (`/agents`
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
| `audio/` | the eight name takes (Kokoro-82M, American and British male voices), as Opus, 3.6 to 8.0 KB each |
| `fonts/` | Tiro Devanagari Hindi and Noto Naskh Arabic, subset to the name's glyphs, आहिल and اءحل (3.8 and 2.5 KB), with their OFL licences |
| `assets/` | a tall photo (his archive's smartwatch board, 420 × 560 WebP) for the share-card proof |
| `tools/` | `render-takes.py` (Kokoro), `measure-takes.py` (syllable lengths), `score-takes.py` (which syllable carries the stress) and `subset-name-fonts.py`: how the takes and fonts were made |
| `check.mjs` | the bundler and the check |
| `COPY.md` | every line written for this page, for veto |

**Query params:** `?view=` takes `site-nav`, `site-band`, `site-contrib`, `canvas-lab`, `back-desk`,
`cards`, `colophon`, `agents`, `voices` or `name-hover`. The look comes from `?theme=cream|tokyo-night` (for `/`,
the canvas and Paper), or `?look=lab&mode=light|dark` (the Lab theme). `?bare` hides the mockup's corner tag.

## Round 2 (Aahil's verdict on #41)

> "i dont like any of the voice, plus put a guys voice not girl and only name Aahil part, share cards look good,
> but dont crop out images, try to fit them, 3) yes, 4) yes, also change the "Premium" thing later on, its to be
> called the lab theme dark and light"; "first part and second part are of around the same length … its more like
> aaa hil types"; "hover should show my name in hindi and urdu aswell, just like bollywood movies"

- **The name:** twelve new takes, all male voices, saying "Aahil" alone. *(Replaced in round 3.)*
- **The name on hover:** a new view, `name-hover`, with three scripts in one lockup, in two layouts. *(Reworked in round 3.)*
- **Share cards:** images fitted whole, with a sixth card that proves a tall image.
- **Renamed:** "Premium" is the **Lab theme**, with **Light** and **Dark**. That covers this page: its query
  params, `data-look="lab"`, `data-mode="light|dark"`, labels and copy. The real build applies the rename later.
- **Approved:** the From the Lab band, the Lab tile's colour, and the agents note.

## Round 3 (Aahil's verdict)

> "only play audio on click of this, one line version is better of hover but you're repeating Aahil again there, also
> the voice bubble should move when playing, switch urdu with arabic, i dont like any of the voices, the
> pronounciation is correct voice i dont like"

- **The hover:** one line only (the title card is gone). The Latin "Aahil" is gone from it too, since the reader is
  already hovering it. It shows **आहिल · عاهل** and a **voice bubble**.
- **Sound only from the bubble:** a click, a tap, or Enter. Nothing plays on hover.
- **The bubble's dots move** for exactly as long as the clip plays, tied to the audio's `playing` and
  `ended`/`pause` events. Under reduced motion they pulse in opacity only. (`shot` always emulates reduced motion,
  so the PR adds one frame from a normal-motion browser.)
- **Arabic script replaces Urdu:** عاهل in Noto Naskh Arabic, `lang="ar" dir="rtl"`, with the spelling then still to
  confirm (final in round 4: اءحل). Nastaliq is gone.
- **Voices:** see below. He confirmed the pronunciation and disliked Kokoro's voices.

## Round 4 (Aahil's verdict)

> "spelling is fine, i hate all hindi voices go for american or british or leave the voice part"

- **The spellings are final:** आहिल, and اءحل (what he typed on an Arabic keyboard: ا ء ح ل). The Naskh subset now
  carries ء and ح. "Spelling to confirm" is gone.
- **Every Hindi and Indian take is gone,** the round-3 Kokoro reference (`hm_omega`, a Hindi voice) included.
- **Eight takes in American and British male voices** (the `voices` view). **This is the last voice round:** if none
  of them is right, the name ships with no voice.
- `name-hover`'s bubble plays take 1 unless another is picked on the voices page.

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
- **Desktop:** a framed pill, first in the bar, in the look's own frame (brass in the Lab theme's Dark).
- **Phone:** a 44px row of its own under the bar, with the full words and one line of reassurance:
  "Your windows are where you left them."

The other option was an icon-only "←" in the bar. It would fit, but it wouldn't say where it goes,
and the plan's rule is "every link names its destination".

### Share cards (`cards`)
Five kinds of page (the front page, a section, a chapter, a build and an essay), each in Paper, the Lab theme's Light and Dark. Each card is a real 1200 × 630 box, scaled to fit with a transform, so the check
measures the real size.

Each card is one framed window on the look's ground: a title bar with the AK mark and the page's address,
the kind, the title, the lede, and the handwritten date. A build, an experiment or an essay gets its lead's image, **fitted whole, never cropped** (round 2). The area is
the card's own surface, and the frame is drawn round the picture itself. The build's 16:10 screenshot is the
wide proof, and the experiment's 3:4 photo (from his archive) is the tall one.
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

### The name: new voices (`voices`)
The target is the pronunciation he approved in round 3: **"aaa hil"**, two syllables about equal in length, the
stress on the first, never "ah-HILL".

- **Rendered:** `tools/render-takes.py`, through `cx heavy`. Kokoro-82M (Apache 2.0, local) in its twelve American
  (`am_*`) and British (`bm_*`) male voices, `am_santa` left out as a novelty voice. Each read eight phoneme strings
  (back or front *a*, held or not, a secondary stress on *hil*, or as two words) and two spellings ("Aahil",
  "Aah-hil"), at speeds 0.8 to 1.1: 474 renders (the slot's timeout cut the last six, all `bm_lewis` spellings).
- **Measured:** `tools/measure-takes.py` splits each take at the h. 119 renders came out at 0.9–1.15; `am_eric` had none.
  `tools/score-takes.py` then compares the two syllables' pitch and loudness, so a take that puts the weight on
  *hil* is caught.
- **Picked:** one take per voice, from the eight voices Kokoro's own notes grade highest, alternating US and UK. Each
  split was checked on a spectrogram, and each take was re-measured **from the shipped Opus file**. One first pick
  (`am_fenrir` at 0.8) moved to 0.79 after encoding and was swapped for one that holds.
- **Not listened to:** I can't hear. The choice by ear is his.

| Take | Voice | Accent | Input | Speed | aa / hil (s) | Ratio | aa pitch / hil pitch | KB |
|---|---|---|---|---|---|---|---|---|
| 1 | `am_michael` | American | `ˈɑːhɪl` | 0.9 | 0.26 / 0.26 | 1.00 | 139 / 108 Hz | 4.7 |
| 2 | `bm_george` | British | `ˈaːːhɪl` | 0.8 | 0.41 / 0.42 | 0.98 | 185 / 115 Hz | 8.0 |
| 3 | `am_fenrir` | American | `ˈɑːːˌhɪl` | 1.0 | 0.20 / 0.21 | 0.95 | 192 / 121 Hz | 3.6 |
| 4 | `bm_fable` | British | `ˈɑːhɪl` | 0.9 | 0.24 / 0.23 | 1.04 | 168 / 99 Hz | 5.0 |
| 5 | `am_puck` | American | `ˈɑːːˌhɪl` | 0.8 | 0.25 / 0.25 | 1.00 | 143 / 124 Hz | 4.7 |
| 6 | `bm_lewis` | British | `ˈɑː hɪl` | 0.8 | 0.33 / 0.33 | 1.00 | 107 / 80 Hz | 5.6 |
| 7 | `am_liam` | American | "Aah-hil" | 0.8 | 0.35 / 0.32 | 1.09 | 154 / 98 Hz | 6.9 |
| 8 | `bm_daniel` | British | `ˈɑːːhɪl` | 0.9 | 0.30 / 0.28 | 1.07 | 148 / 114 Hz | 6.9 |

Every voice is Kokoro-82M's, under its Apache 2.0 licence. The engine runs offline at build time, and only the
clips ship. "Use on the name" picks the take the bubble plays, on this page and on `name-hover`.

### The name on hover (`name-hover`)
It is drawn open twice: **Hovering** (the bubble waits) and **Playing** (after a press on the bubble).
- **The lockup:** आहिल · اءحل, set to one optical size, in the look's window frame with a 3px hard shadow, kept
  small because it is a hover. The scripts are in ink, and the only accent is the bubble.
  - Devanagari: Tiro Devanagari Hindi, 1.31rem.
  - Arabic: Noto Naskh Arabic Medium, 1.25rem.
- **Interaction:**
  - The lockup accepts the pointer, with a 12px bridge from the name, so the bubble can be reached.
  - Keyboard: focus on the name opens it, Tab reaches the bubble, and Enter plays.
  - Touch: a tap on the name opens it, and a tap on the bubble plays.
- **Accessibility:**
  - `lang="hi"` on the Devanagari, and `lang="ar" dir="rtl"` on the Arabic.
  - A screen reader hears "Aahil" once, then "pronounced AA-hil". The bubble is labelled "Play how Aahil is said:
    AA-hil", and the scripts are `aria-hidden`.
- **Spellings:** आहिल and اءحل, final (round 4).

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
for the Lab's pages), at 390 × 844 and 1440 × 900. That is 60 screens.

| Rule | Holds |
|---|---|
| O | Nothing scrolls sideways, no box clips its text, and every card's content fits its window (a clamped title or lede that loses a line fails). |
| C | Every visible text run is at least 4.5:1 (3:1 when large) on the ground it is drawn on, composited through every translucent layer. Text that something else covers, such as the drawer's scrim, is skipped. |
| A | The accent is at most 5% of the screen's pixels, counting every accent on screen, so the Dark cards count too. |
| G | 18 share cards, each exactly 1200 × 630, and no entry image cropped: each is drawn at its own aspect ratio, inside its area. One wide image and one tall image must be present. |
| P | Eight takes, each a male American (`am_*`) or British (`bm_*`) voice with aa/hil at 0.9–1.15 and at most 20 KB. Each decodes in an `AudioContext`, is 0.5 to 2 s long, and plays from its button. |
| F | On `name-hover`, the Devanagari and Arabic faces load from the page and cover the name's glyphs. Both states are open and on screen, with no second Latin "Aahil", and each name button reads "Aahil" with a description. Hovering plays nothing. The bubble plays the clip once, and its dots move only while it plays. |
| N | No request leaves `data:` or `file:` on load, and no script error. |
| S | The bundle is under 8 MB and points at no local file. |
