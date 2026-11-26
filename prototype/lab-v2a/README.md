# Lab v2A: the static mockup

Version A of the Lab ("Obsidian, my own flavour"), built fresh. This is Task 1, the first-slice
gate: the system plus two real pages.

- `#/lab`: the general home (Featured, Latest, tours, every section, the map window).
- `#/lab/agent-reliability/shopkeeper/03-blind-agent`: one real chapter.

Everything else in the lists links to an honest stub that says it's coming in the next round.

## Open it

The deliverable is one self-contained file: `~/projects/scratch/lab-mockups/lab-v2a.html`. Open it
from disk. It makes no network request on load; only the Music stations do, and only after a tap.

Add `?theme=<id>` to any route to force a theme without saving it, e.g.
`lab-v2a.html#/lab/agent-reliability/shopkeeper/03-blind-agent?theme=cream`.

## Build and check

```bash
node --experimental-strip-types --no-warnings prototype/lab-v2a/build.mjs            # writes lab-v2a.html, copies it to scratch
node --experimental-strip-types --no-warnings prototype/lab-v2a/build.mjs --fixtures # lab-v2a.fixtures.html, never shipped
cx heavy -- node --experimental-strip-types --no-warnings prototype/lab-v2a/check.mjs
```

Needs Node ≥ 22.6 (the build imports `content/themes.ts` directly, so the 18 site themes are never
copied by hand). The check uses the playwright-core in `~/.local/share/cx-tools` and the server's
cached Chromium, in one launch, always closed. It writes review screenshots to `.shots/`
(gitignored) and prints one row per view and size, with the measured value for every rule.

What the check covers: the anti-template rules A1–A16 and privacy rules P1–P3 from the plan's
research §5, contrast in all 20 themes, reduced motion, the idle budget, JS errors, network, phone
overflow and hit areas, hygiene (no `backdrop-filter`, size ≤ 1.5 MB, no reference to the old
Lab, stable routes), and generality (the fixture build). P2 reads company names from the study
tracker at check time and prints only a count, never a name.

States it scripts on both views, at both sizes: a folder window (desktop) or the path sheet
(phone); a hover preview (desktop only, since previews never appear on touch); Listen playing
(chapter); the theme list, including switching a theme; and the side player open.

## How it's put together

```
build.mjs        content + themes + fonts + src → one HTML file
check.mjs        builds, then audits every view and state
src/lab.css      every style; colours only through theme tokens
src/lab-themes.json   lab-dark and lab-light (the 18 site themes come from content/themes.ts)
src/NN-*.js      plain scripts, concatenated in order inside one function (file:// can't load modules)
content/         <section>/<slug>.md with front matter, tours.json, external.json, ui.json (every UI string)
content/fixtures/     a 4th section, an experiment, a series, a note with no ID, a build with no clip,
                      a pinned essay: only in the --fixtures build
content/assets/  the Holt screenshot, downscaled from public/work/
fonts/           Space Grotesk (copy of app/fonts), Space Mono 400 (Latin subset), Caveat (date subset), with licences
```

Pages are types driven by data. Featured is whatever is pinned (newest pinned wins), else the newest
item with an artifact; Latest is the five most recently updated items of any kind; Related, the
folder lists and the map edges are computed at build time from links, tags, series and tours. No
template code names a slug or a series, and the check greps for it.

The Lab's nine added tokens are derived for each of the 18 site themes exactly as the plan's §4
says: `--surface-alt` and `--surface-sunken` at ±4% toward the ink, `--hairline` at 10% ink,
`--link` = ink, `--link-underline` = accent, `--accent-text` and `--focus` walked from the accent
toward the ink until they clear 4.5:1 on every ground, `--selection` at 28% accent.

## Stand-ins (everything here that isn't the real thing yet)

| What | Stand-in | The real thing (task) |
|---|---|---|
| **Listen** narration | The device's speech engine, labelled in the strip as a stand-in. Where the browser has no voice (headless Chromium, many in-app browsers) the highlight advances on timing alone and the strip says so. | Pre-rendered Kokoro-82M audio with sentence timings (build) |
| **(say it)** | The device voice saying "Aahil Khan"; the five level bars are a CSS loop, not real levels. | The pre-rendered name clip with its levels (Task 4) |
| **Listen time** | Computed at 165 words a minute. Read time is computed at 230. Neither is typed. | The narration's real length (build) |
| **Holt's clip** | The githolt.com home screenshot from `public/work/`, downscaled to 1280px. | A recorded clip (Task 3 / later) |
| **Every page except the two above** | An honest stub with the real title, line, status and date. | Tasks 2–5 |
| **Tour times** | Hidden: only the stop count shows, because most stops have no text to time yet. | Task 2 |
| **The map** | Static. One column per section, edges only from real links, labels in words. | Interactive pan and zoom with a seeded layout (Task 2) |
| **The side player** | Stations and the mixer only. Stations stream from their sources after a tap. | Tracks and brown, pink and rain noise (Task 4) |
| **External link card** | Metadata typed into `content/external.json` on 2026-11-26. | Captured by a script at build time (Task 3) |
| **Home, Desk, Colophon, For AI agents** | Labelled stubs inside the mockup. | `/`, `/canvas` (exist), colophon and `/agents` (Task 5) |
| **The cat** | Not here. | Task 6 |

Caveat on the dates is the decided font (plan §8), not a stand-in. It is subset to the date
characters (17.6 KB) and set only inside `<time>`.

## Decisions taken while building

- The Listen and (say it) buttons play even when interface sounds are off. Mute is owned by one
  switch (`sound` in `src/10-audio.js`) and governs the cues; pressing Listen is an explicit request
  for audio, and making it silently do nothing would read as broken.
- The numbered contents sit under the title on desktop, move into the left margin at ≥ 1680px, and
  live in the path sheet on a phone, so the artifact stays on the first phone screen (rule A11).
- The home's "Start here" block is headed "New here? Take a tour", because rule A5 bans
  "start here" as a heading.
- The pull-quote repeats a sentence from earlier in the body, so it is verbatim (rule A16), and it
  is not read twice by Listen.
