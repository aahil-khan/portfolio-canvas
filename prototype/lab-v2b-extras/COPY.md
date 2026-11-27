# Proposed copy, for veto

These lines were written for this page, not taken from a source. Veto or rewrite any of them. Once
the build lands they become data he edits at `/edit`.

Not listed here:
- **Sample entry content** (titles, dates, ledes, counts). It comes from the approved mockup's demo
  entries and is replaced by his own.
- **Lines copied from the live site** (`content/data/site.json`, `components/desktop/desk-only.tsx`).

## `/`

| Where | Line | Why |
|---|---|---|
| Nav, and the phone drawer | Lab | The plan's label |
| Band eyebrow | From the Lab | The plan's name for the band |
| Band heading | The working, written up | Says what the Lab is in `/`'s plain register, five words |
| Band lede | Longer pages on what I study, build and try, including the parts that didn't work. | One sentence, as the plan asks; echoes the Lab's own "New here?" |
| Band side label | Sections | Plain |
| Band count | {n} entries | Plain |
| Band link | Everything in the Lab → | The old plan's wording |
| Contributions heading | On GitHub this year | Names the source and the span |
| Contributions lede | {total} contributions in the last year. | From `content/contributions.ts`, unchanged |

## The canvas

| Where | Line | Why |
|---|---|---|
| Dock tile and window title | Lab | The plan's label |
| Window prompt, first line | The Lab is where I write up what I study, build and try, as full pages. | Plan `lab-v2-b-a`, "with proper prompts" |
| Window prompt, second line | Opening one takes you off the desk to a reading page; the desk stays exactly as you left it. | Same plan |
| Under the prompt | Or start at the Lab's front page → | Same plan; moved up so it shows without scrolling |
| Per section | All {n} | Short, so it fits beside the section name |
| Window, last line | Every Lab page has ← Back to the desk at the top. | Says the way back before it's needed |

## Back to the desk

| Where | Line | Why |
|---|---|---|
| The pill | Back to the desk | Approved mockup (`back.desk`) |
| Phone row, beside it | Your windows are where you left them. | The phone row has room for one line of reassurance, and it is true: the desk restores cards and camera |

## Share cards

| Where | Line | Why |
|---|---|---|
| Front page, kind | The Lab · Aahil Khan | Names the place and the person, since the card has no entry |
| Section, kind | A section of the Lab | Plain |
| Section, count | {n} entries · a study, a series, two notes | Counts by kind, from the data |
| Chapter, kind | {series} · Chapter {nn} of {total} | The approved series line |
| Build, kind / Essay, kind | A build / An essay | Plain |
| Every card, right of the foot | Aahil Khan | The byline |

## Colophon

| Where | Line | Why |
|---|---|---|
| Eyebrow / title | Aahil Khan · Colophon / How this site is made | Plain |
| Lede | One person, a handful of open-source projects and a lot of hard borders. This page lists what the site is built from, who made those parts, and how to cite it. | Says what the page is for, in his tone |
| Type rows | Every heading and paragraph. / Code, and nothing else. / Dates, by hand. | One clause each, from DIRECTION.md's rules for each face |
| Code rows | The framework and the renderer. / Every enter, exit and page change in the Lab. / Smooth scrolling on desktop. / The scroll-linked motion on the front page. / Where a preview window opens. / Lab pages, from Markdown to HTML at build time. / Code highlighting, at build time. / The RSS and Atom feeds. | What each library does here, from the plan's table |
| After the code rows | The desk uses none of these beyond Next and React: its pan, zoom, drag and animation are written by hand. | CLAUDE.md's dependency rule, as a fact a reader cares about |
| Sound rows | Synthesised in the browser with Web Audio. There are no sound files. / Six public internet stations, streamed from their own servers and named in the Sound menu. / Spoken by Kokoro-82M, voice af_heart, rendered once to one small file. | DIRECTION.md's Sound section; `lib/ambience.ts`; the name decision |
| Counting | Pages are counted by the site's own counter: no cookies, no identifiers, and nothing sent to anyone else. | The plan's one analytics sentence |
| Inspired by | yevtam.com for the dock and the cursor, and ajvadlaseen.com for the type, borders and shadows. Everything else is mine. | `/`'s footer credit, reworded as a sentence |
| How to cite | Name the page, its date and its address. Every Lab page shows the date it was written and the date it last changed; cite the one you read. | Plain |
| Citation format | Khan, Aahil. "{title}." The Lab, {date}. {url} | A common web-citation shape |

## For AI agents

| Where | Line | Why |
|---|---|---|
| Lede | If you are a model reading this site, or building one that does: every page has a plain-text version, and this page says where they are. | Addresses both readers |
| `/llms.txt` | The map: every page, one line each, in the llmstxt.org format. | The plan |
| `/llms-full.txt` | Every page's text in one file, for reading the whole site at once. | The plan |
| `<any page>.md` | Add .md to any address for that page as Markdown, with absolute links. Each page also names it in a link tag. | The plan (`.md` twins, `rel="alternate"`) |
| `/feed.xml` | New Lab pages as RSS and Atom, newest first. | The plan (`feed`) |
| **Using what you read** | Quote and summarise freely, with a link to the page. Say when a page is dated or marked as a draft: the dates are there so a reader can tell what is current. | **A placeholder for his own usage note.** The plan calls it "his usage note"; this is only a starting point |

## The name page (mockup only, not shipped)

The take labels and the explanatory lines are notes for choosing a take, not site copy.
