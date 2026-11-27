# Next: the spec for the real Lab

The mockup is approved as a reference, not as code. Aahil, 27 Nov, at the end of the live session:

> "the mockup level is fine now, start building the actual thing, keep the html page as only reference
> dont try to copy it over here build on top of it as its just a mockup where shortcuts were taken
> (progress bar not finishing fully, animations , hover states etc)"

So the React build takes **what** this page does and how it looks from here (`README.md` describes every
part, `design/DIRECTION.md` still owns every value), and **how** from the project's own rules. The
shortcuts below are the places where copying the mockup would copy a bug.

Still to come from plan `lab-v2-b-a` task 3: the Tracks list (proposed in a table with licences, bundled
only after Aahil approves; it fills the Sound menu's empty Tracks slot), the colophon, and the doors to
the rest of the site that still go to the holding page.

## Decisions, with his words

Earlier rounds (#35, #36, #38) are in `README.md`. These are from the live session of 27 Nov.

| # | Decision | His words |
|---|---|---|
| 1 | **Home bands list top-level entries only**: studies, series, builds, essays, standalone notes; never a chapter or a study's note. A row that holds others says how many ("A series · eight chapters"); the band's count and "All N in" still count every entry. Check rule H1 holds it. | The orchestrator's default, shown in round 1 (five Shopkeeper chapters in Studies "drifts back to the overfitting he rejected"); not overturned. |
| 2 | **Latest stays the six newest entries of any kind**, no cap per series. | "no need to cap latest" |
| 3 | **Premium Night's frame is brass**, `#7F6C45` for both `--border` and `--shadow-ink`: the offset is the frame's own colour, as on the canvas. Day is unchanged. | "pick brass" (of three: the old `#4A453B`/`#2B2822`, umber, brass) |
| 4 | **His name is one pre-rendered Kokoro clip**, voice `af_heart`, the same on every device. | "pick brass and kokoro" |
| 5 | **Pull-quotes are the lede's size** (`--fs-lede`, 1.19–1.375rem), never display size. | "the quotes are too big" |
| 6 | **Entries get a right rail** from 1200px: On this page (marks the heading being read), Share, Links to this page, Related; sticky, scrolling on its own when taller than the screen. Below 1200px it's a block after the text. Sidenotes and the pull-quote move into the text column on entries. | "right section of pages looks empty, better to put related and other stuff there" |
| 7 | **Share at the end of every entry and in the rail**: one Share… button, the device's share sheet where there is one, else a small menu of Copy link, X, LinkedIn (folded into one control at wrap-up so short entries pass rule 5; he saw the three as a row). | "there is no share option at end of pages / put it on side too" |
| 8 | **Centre the composition**: text column plus rail together on entries; home and section pages already centre at 1440 and 1920. | "the site looks too left sided" |
| 9 | **Links out unfurl like a chat app**: OG image, favicon and domain, title, description; fetched at build time, never on load. | "link previews are too generic show actual ones like wa does" |
| 10 | **A preview never covers its link**: below the link when it fits, else above, else on the roomier side with its height capped. The link stays clickable; the reader moves down into the window to read and scroll it. | "the preview should never open such that it blocks the link itself, i should be able to click on the link if i want, and if i want to preview i move mouse down a bit to scroll through the page" |
| 11 | **Smaller previews**: cards 360px wide, whole-page windows 460px and at most `min(60vh, 500px)`. | "make the preview window smaller" |
| 12 | **The chapter picker is a drop-down** over the page (framed like a window, closes on Esc or a press outside); opening it moves nothing. | "this picker … the whole layout, fix" |
| 13 | **The reading dot and its trail are visible in every look.** Night: the dot's outline is ink at 85%, and a line under the bar fills from the left to the dot. Light looks (Paper, Day): the trail is the accent, 4px, laid over the bar's edge, since the edge itself is ink. Chapter ticks are brighter on dark grounds. | "the pet in dark mode is barely visible and progress bars of the article on top bar are not visible"; then "ligtht mode progress bar fix" |
| 14 | **Hover speed and animation** are left to the build (below). | "im ignoring how fast the hover states are working (not good) and lack of animations" |

## Shortcuts the mockup took, and what the build does instead

1. **The reading progress never reaches 100%.** The dot's x runs from 120px to `innerWidth − 38px` over
   the whole document (bar, footer and all), the trail stops at the dot's centre, and when the footer
   scrolls into view the dot jumps into it and the trail freezes short of the end. Build: progress is the
   *article's* own `(scrollY − articleTop) / (articleHeight − innerHeight)`, clamped 0–1, ending at the end of
   the body (before References), so finishing the text fills the bar exactly. Draw the trail with
   `transform: scaleX(p)` on a full-width element (no layout per frame), in the one rAF loop; the dot rides
   the trail's end. The footer hop stays, but only after the trail is full.
2. **Hover intent and dismiss are single fixed timers** (300ms open, 220ms close), with no grace between
   links and no path toward the window. Build:
   - 300ms for a first open; once a window has opened, the next link hovered within 600ms opens at 90ms;
   - close at 220ms, cancelled on any re-entry, and never while the pointer moves toward the window
     (a safe triangle from the pointer to the window's near corners);
   - placement re-runs on resize and on the window's own content growing, not only at open (the mockup
     measures once).
3. **No enter, exit or page-change motion.** All on `cubic-bezier(0.16, 1, 0.3, 1)`, owned by
   `lib/motion/reduced.ts` (reduced motion: opacity only, no travel):
   - windows enter rising 6px and scaling from 0.98 at the link's corner, 180ms, opacity over the first
     120ms; exit 120ms, opacity and 4px down, no scale. A cascaded window enters from the side it steps to;
   - controls: 120ms in, 180ms out; chips and buttons lift 1px and grow their offset shadow by 1px, and press
     to 1px on `:active` at 80ms; underlines darken from `--ink-muted` to `--ink`;
   - page changes: the reading column fades and rises 8px over 240ms; the bar and rail don't move; scroll to
     top happens before the fade, never animated;
   - home bands reveal their rows in a 30ms stagger the first time each enters the viewport, once a visit;
   - the rail's On this page slides its accent bar between headings (180ms transform);
   - Share's "Link copied" crossfades in 140ms and returns after 1.8s;
   - no hover sounds; the `peek` cue only on a tap, click or focus-open.
4. **Link unfurls are a one-off script** (`unfurl.mjs`), committed output, ImageMagick for resizing. Build:
   - the same fetch as a script under `scripts/`, writing JSON beside `content/data` and images to `public/`
     (WebP, 640×336; favicons 32px), committed, so `next build` makes no network call and the page makes none;
   - `content:check` refuses a link out with no unfurl and no stated fallback, the way it refuses an image
     path with no file;
   - one honest user agent (`lab-unfurl/1.0`). A site that refuses it keeps the card built from the content.
     Don't retry as a browser. Medium refuses all scripts: his two essays use a stand-in built from his own
     copy (title, opening, first picture), marked `standIn`, until the essays are canonical on the site and
     Medium is the copy.
5. **The rail waits for the first scroll.** It's hidden until the reader scrolls a quarter of a screen,
   because with it showing at load, entries broke the first-screen rules (5: at most 15 controls on desktop;
   7: chrome text at most half the body text). Not raised with him as a choice. Build keeps it unless he
   asks for the rail at load, which means changing those rules, and that's his call.
6. **The name speaks with the device's voice** (`speechSynthesis`, an `en-IN` voice when there is one).
   Build: render "AH-hil" once with Kokoro `af_heart`, ship the one small file, play it through the one audio
   owner (`lib/audio.ts`), keeping the rules in README "His name": only an explicit Mute silences it, and the
   gesture lock still applies.
7. **Share shares `location.href`**, which in the mockup is a file URL with a hash route. Build: the page's
   canonical `/lab/...` URL, and every entry gets its own OG tags (title, lede, an image from its lead) so a
   shared Lab link unfurls as well as the links it cites.
8. **Hash routes and client-rendered pages.** Build: real routes (`/lab`, `/lab/<section>`,
   `/lab/<section>/<entry>`, `/lab/<section>/<parent>/<child>`), server-rendered, readable with JS off
   (non-negotiable 4: real DOM).
9. **Scroll work on the main thread.** The mockup's On this page and the rail's reveal listen to `scroll` and
   read every heading's rect. Build: `IntersectionObserver` for both, and the progress trail in the rAF loop.
10. **Document-level listeners per render.** The chapter picker and the rail add `document` listeners on each
    page render and remove them lazily once their element is gone. Build: component effects with cleanup; the
    picker as a disclosure with focus moving into the list and back to the summary on Esc.
11. **One 4 MB file with everything inlined** (fonts, WebP, unfurl images as data URIs). Build: real assets,
    `next/font/local`, images lazy with their sizes declared.
12. **The bar's trail colour is set per light or dark ground** (`data-dark`), not per theme token. Build:
    a `--trail` token per theme in `content/themes.ts`, checked by `scripts/contrast.mjs` against the bar at 3:1.

## Open questions

- **Copy.** Every line marked `P(...)` in `content/copy.js` is a proposal listed in `COPY.md` for veto,
  including this session's: "On this page", "Share this page", "Copy link", "Link copied".
- **The rail at load or on the first scroll** (shortcut 5).
- **Kokoro sample.** He picked Kokoro without hearing it; render the clip and let him hear it before it
  ships. A recording of him is still the exact alternative.
- **Unfurls with no image** (Wikipedia ×3, GNOME Extensions, Wayland, MySQL docs) show text only, and
  oracle.com refuses the fetch. Fine as is, or a quieter text card for those?
- **Task 2's privacy calls** are still his to rule on (README, "Task 2 content"): his teammates' names, the
  other winners on the hackathon board, and "Samsung Prism", all kept as published in the essays.
- **Holt's verdict names** are cited from its public connector description; check them against githolt.com.
- **Dependencies.** The canvas takes none and `/` takes gsap and lenis; the Lab's own rule isn't written
  yet. Previews, placement and the rail are hand-rolled here and can stay so.
