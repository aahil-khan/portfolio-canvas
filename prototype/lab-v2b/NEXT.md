# Next: Aahil's two amendments of 27 Nov (for the next worker)

Task 2's reading pages are built and checked. These two amendments came in during task 2 and are not
built yet. They also apply to the home and chapter 05. Read `README.md` first, then this.

## Amendment 1: the name, the home's sections, and full-entry windows

His words: "the say it one should be a special hover, it will just say AH-hil and play audio
automatically without any button, there is no clear separation bw sections, and they should list like
the first 5 entries of each, and as for hover to other articles within lab, it shouldnt show a preview
only with open it button, it should be fully viewable and scrollable within the hover window, only
external links get the previews".

### 1a. The name: a special hover

What exists: `nameTrigger()` in `lab.js` renders `<button class="term name" data-preview="name">`.
Its card is the `key === 'name'` branch of `cardOf()` (title, "AH-hil KHAN", a **Say it** button,
"More about me"). `sayName()` speaks with `speechSynthesis` (device voice, `en-IN`, rate 0.85). Copy:
`name.say`, `name.bar`, `name.play`, `name.playLabel`, `name.none`, `name.more` in `content/copy.js`.

What to change:
- Take the name out of the preview system: drop `data-preview="name"`, give it `data-name`, and
  delete the `name` branch of `cardOf()` and the button special case in the click handler
  (`if (a.matches('button'))`). Delete the now-unused copy keys, and set `name.say` to `AH-hil`.
- A small tooltip of its own (`.name-tip`, `role="tooltip"`, `aria-describedby` from the name): just
  "AH-hil", no title, no button, no link. Show it on pointerenter (desktop), on tap (phone) and on focus.
- Speak on that same event, **once per hover**: set a flag on enter, clear it on leave, so resting
  on the name never retriggers.
- **Gesture lock:** Chrome refuses `speechSynthesis.speak()` (and a suspended `AudioContext`) before
  the page has had a user gesture. Test `navigator.userActivation.hasBeenActive`. If it's false, show
  the tooltip and queue the play for the first `pointerdown`/`keydown` anywhere. Write this up in the
  README.
- **Mute:** this is the one exception to "muted on arrival", but an *explicit* Mute still silences
  it. `Lab.audio.muted` (`audio.js`) is that explicit state; it starts `false`. Interface sounds being
  off (`interfaceOn`, the arrival default) must **not** block the name. Check `A.muted` only.
- Give it a distinct underline: terms are dotted and entries solid, so try `double`, 1px, in
  `--ink-muted`. Rule U still needs 3:1 against the ground.
- The check's rule **N** (`check.mjs`, "the name card plays only on an explicit action") must be
  rewritten:
  - before any gesture, a hover shows the tooltip "AH-hil" with no `button` inside and speaks 0 times;
    the next click speaks once;
  - after a gesture, a hover speaks once, staying on the name speaks no more, and leaving and coming
    back speaks again;
  - `Lab.audio.setMuted(true)` then a hover speaks 0 times;
  - phone: a tap shows the tooltip and speaks once.
  `window.__audio.speak` already counts `speak()` calls (the `INSTRUMENT` init script).

### 1b. The home's sections

What exists: `home()` in `lab.js`, the `.sections` grid in `lab.css` (three text columns: title,
thesis, count). Rule **H1** in `check.mjs` forbids entry titles outside Latest.

What to change:
- Make each section its own band: a `.box`-style block per section (Paper: the 2px edge and hard
  shadow; Premium: a tone step and hairline, as `.box` already does). On desktop, the heading,
  thesis and count go on the left and the list on the right. On a phone they stack.
- List the section's **first 5 entries, newest first** (handwritten date, title, kind; `entryRow()`
  already renders exactly this), then "All N in <section>" linking to `#/<section>` (a section link,
  which previews).
- Don't print the word "newest": it's in rule H2's `TIME_WORDS`.
- Keep Latest. Drop **H1**, and replace it with: every band shows `min(5, n)` rows plus its "All N
  in" link. Keep **H2** (time words, nothing that counts progress) and the phone fold check (b).

### 1c. Windows: a link to a Lab page opens the whole page

What exists: one preview element (`pv`) and a single-card state machine in `lab.js` ("previews:
one card for…"): `cardOf()`, `openPreview()`, `closePreview()`, hover intent 300ms, dismiss 220ms,
sheets on touch. Entry cards show kind, date, title, lede, first paragraph and "Open the page".

What to change:
- **Internal entry links open the full entry** in the window: lead, body, figures, references, ends.
  Build it by calling `entryPage(e)` (which returns a fresh `<article>`, listeners included) and
  appending it to the window body. No "Open it" button and no excerpt. Make the window's `h1` a link
  to the page: on a phone it's the only way through, since the sheet covers the tapped words.
- Do the same for tag and section links (`tagPage()`, `sectionPage()`). Terms keep their definition
  cards, references their source cards, board squares their topic cards.
- **External links** (`a.ext`: the References list, a build's "Source on GitHub" and "Open it live",
  term cards' sources) get the small card: title, site, one line. Build a url → `{ title, site, line }`
  map from every entry's `refs` and the builds' `repo`/`live`; fall back to the hostname and the link
  text. Key them `ext:<url>`.
- **Scroll inside, never the page:** desktop windows are about 560px wide with `max-height: min(70vh,
  640px)`; the body gets `overflow-y: auto; overscroll-behavior: contain`. The existing "page scroll
  closes a floating preview" listener has to ignore wheel scrolling inside a window. Inside a window,
  reset the page layout: `.page` loses its max-width and padding, `.side` stops floating, `.wide`
  loses its negative margin, `.num` hides, and `.entry-title` drops to `--fs-h2`.
- **A stack of up to 3:** replace `pv` with an array of `{ el, trigger, key, how, mode }`. A trigger
  inside window *i* opens window *i+1*, replacing anything above it. Track a "keep level" on
  `pointerover`: the deepest window under the pointer, or the window whose trigger is under it. Close
  hover-opened windows above that level after the 220ms dismiss delay. That one rule replaces the
  `pointerout`/`pointerleave` pair and keeps the hover-intent and dismiss tests in rule P passing.
  Esc or an outside click closes the top window. A click on the link itself still navigates (desktop).
- **Traps:**
  - **Duplicate ids.** `entryPage()` emits `id="ref-…"`, `id="end-…"`, `aria-labelledby` and
    `data-jump`. Inside a window, prefix every id and every reference to one (`w1-`, `w2-`, …),
    or a citation jumps to the page behind.
  - **The haggle input id.** `instruments/haggle.js` gives its input a generated `uid`, so it's safe.
  - **Board squares.** `instruments/registry.js` uses `id="sq-T01"` for `aria-activedescendant`;
    prefix those too.
- **Phone:** a tap opens the full entry as a near-full-height sheet (`max-height: 92vh`) with Close,
  drawn as one surface: keep task 2's double-frame fix (`.preview.is-sheet`, top edge only). Skip the
  "scroll the tapped words clear" step for these sheets.
- **Check rules to add:**
  - hovering an entry link on chapter 05 opens a window holding `.entry-body` with the same number of
    paragraphs as that entry's page;
  - `scrollHeight > clientHeight`, and a `mouse.wheel` over it changes its `scrollTop` but not
    `window.scrollY`;
  - a link inside it opens a second window, and Esc closes only the top one;
  - hovering an `a.ext` in the References list shows a card with a title and a site.
  - Relax rule P's "every card has a way further" (`card-more`) to terms and references; the
    per-route `LINKS` helper has the same test.

## Amendment 2: the Sound control, on the canvas's own sound menu

His words: "sound section also looks a bit off, also its too big, i love how canvas handles it".

What exists: `player/player.js` (panel, the Radio/Tracks/Noise tabs, levels) and `player/noise.js`
(five synthesised noises). The CSS is in `lab.css` under "the side player". Opening the panel on
desktop sets `html.player-pushed`, and `.lab-main` reflows by 320px. Checks 23–26 cover it: 24 asserts
the reflow, and the phone panel closing on a pick, a scroll, Esc and an outside tap.

What to change:
- Rebuild the panel as the canvas menu, matched closely in each look's tokens. Sources:
  `components/desktop/sound-menu.tsx`, `app/desktop.css` (`.sound__menu`, `.sound__row`,
  `.sound__stations`, `.sound__head`, `.sound__shuffle`, `.sound__credit`, `.mix*`, `.arrange__menu`,
  `.arrange__label`, `.arrange__hint`) and `lib/ambience.ts`.
- Rows in the canvas's order:
  - Interface sounds (toggle plus hint);
  - Ambience (toggle plus "playing · <station>");
  - the stations, with a shuffle and the now-playing equaliser;
  - the mixer: one Master fader, and a toggle that reveals Music and Interface;
  - a one-line credit.
- The Lab's extras go in the same compact pattern: Noise as one more small group (five rows, plus
  "add under the music"), and Tracks as a group that stays empty until task 3. Use a small segmented
  row only if the canvas-sized menu really can't hold them.
- A **compact dropdown** under the bar's Sound pill, the canvas menu's size, with no reflow: delete
  `player-pushed` and its margin rule. Rewrite rule 24's desktop part from "the reflow works" to
  "the open menu doesn't cover the reading column, or closes on outside click". Keep the phone part:
  a small drop-down sheet that closes on a pick, a scroll, Esc and an outside tap.
- Keep the stored keys (`canvas.sound`, `canvas.station`, the levels) so choices carry between the
  desk and the Lab. Keep the bar's control a small pill.
- Measure the canvas menu: run the canvas with `cx dev -- npm run dev` on `$PORT`, open the Sound
  menu, read its `getBoundingClientRect()` at 1440×900 and 390×844, and shoot it. Add a check rule
  capping the Lab menu at that footprint ±10% for the same viewport. Hard-code the measured numbers
  in `check.mjs` with a comment naming where they came from.
- Shots for the PR: the open menu in Paper (cream) and Premium Night, at desktop and phone, beside
  the canvas's menu.
