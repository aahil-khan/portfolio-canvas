/*
 * prototype/lab/shared/pieces.js: the Lab's content, for every mockup direction.
 *
 * SHAPE. `constellations` and `pieces` below are exactly the proposed content/data/lab.json
 * (plan.md, "Content model and authoring"). Paste them into a .json file and they are valid
 * JSON. That is the point of this file: if a mockup can be filled from here, `/edit` forms and
 * the update-content skill can fill the real thing, with no layout work.
 *
 * NO COORDINATES. Nothing here says where a star goes. shared/layout.js computes every position
 * from shelf + constellation + date + links, so adding a piece is adding a row.
 *
 * TRANSCRIBED VERBATIM from content/data/, typos and all (they are the owner's to fix):
 *   title          projects.name · writing.title · archive.title
 *   blurb          projects.tagline · writing.blurb · archive.meta (absent where meta is)
 *   body           archive.note. Projects: lede, then highlights as a `- ` list. SOP Opera's
 *                  archive story is its first paragraph: the archive entry joins its project,
 *                  which is how 16 source items become 15 pieces;
 *                  the four Arcade games make 19.
 *   when           archive.when, or the source's `year`, as the display date
 *   href, images, fullscreen, pinned    as in the source (`image` + `caption` → `images[0]`)
 *   Arcade games   content/arcade.ts games: id → slug, label → title, sub → blurb
 *   project        projects.slug, so /work/<slug> stays the project's page
 *
 * PROPOSALS, for the user to correct (research.md §4, plan.md open question 8):
 *   shelf          notes | playground. Cursor Search Provider and Pretext are on the Playground.
 *   kind           write-up | essay | experiment | scrap | found | game (`game` is new, for the Arcade)
 *   status         ongoing | shelved | done, only where the source text says so
 *   constellation  one per piece, from `constellations`; brookie, landscape and Modern Family
 *                  are deliberately loose stars
 *   links          one direction only (backlinks are computed); four, each with a plain reason
 *   constellations the five named groups and their order (order = slot order in the sky)
 *   isProject      mockup flag for the ?work=a|b switch: under (a) these four live in /work
 *   card           NEW optional ref → a canvas card id in content/apps.ts. The piece opens that
 *                  card instead of a piece page: the four games open `arcade`, the real card
 *                  that already plays them. Validation must resolve it, like `project`.
 *   the Arcade     the Playground becomes the one home for the canvas's fun stuff, so the four
 *                  games join it as stars in an "Arcade" constellation (appended last, slot 5)
 *   date           YYYY-MM sort key. Where the source gives only a year, the month is a
 *                  placeholder (-01) and `when` keeps the year, so no view shows the guess.
 *                  Modern Family's "right now" and the four games (no date at all) are dated by
 *                  the commit that added them (2026-08).
 *
 * A plain script, not a module, so it works over file:// and loads in Node (`global.window={}`).
 */
window.LAB = {
  // Enum labels for `shelf`, not lab.json rows: in the React build they are the enum's labels in
  // content/schema. `altName` is the plan's suggested first-shelf name under ?work=b.
  "shelves": [
    { "id": "notes", "name": "Notes & write-ups", "altName": "Work & write-ups" },
    { "id": "playground", "name": "Playground" }
  ],

  // ── content/data/lab.json from here down ─────────────────────────────────────────────────
  "constellations": [
    { "id": "hackathons", "name": "Hackathons" },
    { "id": "agent-memory", "name": "Agent memory" },
    { "id": "self-hosting", "name": "Self-hosting" },
    { "id": "hardware", "name": "Hardware" },
    { "id": "the-web", "name": "The web" },
    { "id": "arcade", "name": "Arcade" }
  ],
  "pieces": [
    {
      "slug": "holt",
      "title": "Holt",
      "shelf": "notes",
      "kind": "write-up",
      "date": "2026-01",
      "when": "2026",
      "blurb": "Will this repo merge your PR?",
      "body": "Find open source projects that will actually merge your first PR\n\n- Built an open source tool that analyses GitHub PR history to predict whether repositories welcome outside contributors.\n- Achieved an MCC of **0.61–0.63**, outperforming a single prompt LLM baseline (0.32) custom benchmark.\n- Analysed **10,000+** repositories and generated **12,600+** reports in production.\n- Shipped a Next.js web app, FastAPI backend, browser extension, and Python CLI/TUI.",
      "status": "ongoing",
      "constellation": "hackathons",
      "links": ["flowsync"],
      "project": "holt",
      "isProject": true,
      "images": [
        { "src": "/work/screenshot-from-2026-10-12-01-15-50-1.png" },
        { "src": "/work/screenshot-from-2026-10-12-01-16-37-1.png" },
        { "src": "/work/screenshot-from-2026-10-12-01-16-57-1.png" }
      ]
    },
    {
      "slug": "sop-opera",
      "title": "SOP Opera",
      "shelf": "notes",
      "kind": "write-up",
      "date": "2026-08",
      "when": "Aug 2026",
      "blurb": "Agentic industrial safety intelligence",
      "body": "Genuinely the most planning I've ever done for a hackathon project, I dug through existing industrial solutions of the problem statement, downloaded their demo versions to take inspo (they think I'm a potential customer and send me emails lol), then sat with a pen and paper to think of the best way to build the architecture, used an actual steel plant floor plan in the project and built everything alone in like 3 days. Went into finals not knowing what to expect and came out with the win (>_<)\n\nA compound risk engine that catches the hazard no single sensor is looking for.\n\n- Fuses gas readings, work permits, isolation state and worker location into **hazard pathways** — the danger that only exists when four boring facts line up.\n- Cut the false negative rate from **44.5% to 0%** across 593 statutorily labelled cases, and alarms **28 minutes** before a conventional single sensor threshold fires.\n- **LangGraph** multi agent assessment pipeline with conditional agent fan-out and hybrid pgvector/SQL retrieval over a clause level regulatory corpus.\n- The risk verdict stays **fully deterministic**, and every generated citation is validated against the evidence it was retrieved from — no confidently invented regulations.\n- Durable Postgres job queue plus a non-blocking **WebSocket** layer with per client backpressure, so a slow browser never stalls the pipeline.\n- Hash chained, **tamper evident audit trail**: edit or reorder a recorded safety decision and the verification endpoint names the exact sequence where it happened.",
      "constellation": "hackathons",
      "project": "sop-opera",
      "isProject": true,
      "images": [
        { "src": "/work/sop-opera-1.webp" },
        { "src": "/work/sop-opera-2.webp" },
        { "src": "/work/sop-opera-3.webp" }
      ]
    },
    {
      "slug": "flowsync",
      "title": "FlowSync AI",
      "shelf": "notes",
      "kind": "write-up",
      "date": "2025-01",
      "when": "2025",
      "blurb": "Project memory for coding agents, over MCP",
      "body": "Persistent memory for coding agents, so they stop re-learning your codebase every session.\n\n- Gives coding agents durable project context via the **Model Context Protocol**.\n- A **VS Code extension** and MCP server for context logging, project search, recent changes and branch-aware RAG retrieval.\n- Event-driven async **AWS pipeline** that reads git diffs with Bedrock models and pulls out the decisions, risks and tasks hiding in them.\n- Branch-aware RAG with DynamoDB caching: **1.26s** median push-to-search latency, **1.60s** p95.",
      "constellation": "agent-memory",
      "project": "flowsync",
      "isProject": true,
      "images": [
        { "src": "/work/flowsync-1.png" },
        { "src": "/work/flowsync-2.png" }
      ]
    },
    {
      "slug": "konta",
      "title": "Konta",
      "shelf": "notes",
      "kind": "write-up",
      "date": "2025-01",
      "when": "2025",
      "blurb": "Local-first context aware browsing",
      "body": "A Chrome extension that turns your browsing into a private, on-device knowledge base.\n\n- **Local-first**: nothing ever leaves the machine. The semantic embeddings run on-device.\n- Multi-stage retrieval pipeline for private, low-latency search.\n- **Knowledge graph** linking pages by semantic, temporal and contextual relationships.\n- Sessionization with context-boundary detection, so your tax admin and your holiday research never end up in the same context.",
      "constellation": "agent-memory",
      "project": "konta",
      "isProject": true,
      "images": [
        { "src": "/work/konta-3.webp" },
        { "src": "/work/konta-2.webp" },
        { "src": "/work/konta-1.webp" }
      ]
    },
    {
      "slug": "chrome-hackathon",
      "title": "Chrome Already Built Our Idea.",
      "shelf": "notes",
      "kind": "essay",
      "date": "2026-01",
      "when": "2026",
      "blurb": "We won the hackathon anyway.",
      "constellation": "hackathons",
      "links": ["konta"],
      "href": "https://medium.com/@aahilminookhan/chrome-already-built-our-idea-we-won-the-hackathon-anyway-fdf2d3c9e219"
    },
    {
      "slug": "old-laptop-cloud",
      "title": "An Old Laptop as a Cloud Server",
      "shelf": "notes",
      "kind": "essay",
      "date": "2025-01",
      "when": "2025",
      "blurb": "Self-hosting, end to end.",
      "constellation": "self-hosting",
      "href": "https://medium.com/@aahilminookhan/how-i-turned-an-old-laptop-into-my-personal-cloud-server-16d07de27399"
    },
    {
      "slug": "this-site",
      "title": "This site",
      "shelf": "notes",
      "kind": "write-up",
      "date": "2026-08",
      "when": "Aug 2026",
      "blurb": "Next.js · zero runtime dependencies",
      "body": "Built it because a scrolling résumé felt like everyone else’s.",
      "constellation": "the-web",
      "links": ["portana"]
    },
    {
      "slug": "cursor-search-providor",
      "title": "Cursor Search Provider",
      "shelf": "playground",
      "kind": "experiment",
      "date": "2026-07",
      "when": "July 2026",
      "blurb": "My very first Gnome Extension!",
      "body": "nothing crazy, forked a repo called vscode-search-provider and made it compatible with cursor, it has 12 downloads yay!",
      "constellation": "the-web",
      "href": "https://extensions.gnome.org/extension/10553/cursor-search-provider"
    },
    {
      "slug": "portana",
      "title": "Portana",
      "shelf": "notes",
      "kind": "write-up",
      "date": "2025-01",
      "when": "2025",
      "blurb": "Next.js · Fastify · Qdrant · Docker",
      "body": "The version of this site before this one: a conversational portfolio you interrogated instead of scrolled, with n8n workflows auto-syncing content from GitHub and LinkedIn. Had lots of issues I didn't wanna fix, Retired, fondly.",
      "status": "done",
      "constellation": "self-hosting"
    },
    {
      "slug": "modern-family",
      "title": "Modern Family",
      "shelf": "playground",
      "kind": "scrap",
      "date": "2026-08",
      "when": "right now",
      "blurb": "S1 E20",
      "body": "Binge watching it lately, pretty funny show, highly recommend.",
      "status": "ongoing",
      "images": [
        { "src": "/archive/modern-family.webp" }
      ],
      "pinned": true
    },
    {
      "slug": "pretext",
      "title": "Pretext",
      "shelf": "playground",
      "kind": "found",
      "date": "2026-07",
      "when": "Jul 2026",
      "body": "This repo redefines how text is rendered on webpages, its pretty cool, been wanting to check it out and use it somewhere, haven't been able to yet.",
      "constellation": "the-web",
      "href": "https://github.com/chenglou/pretext"
    },
    {
      "slug": "chinese-watch",
      "title": "Reverse Engineering a cheap Chinese watch",
      "shelf": "playground",
      "kind": "experiment",
      "date": "2026-07",
      "when": "July 2026",
      "body": "My dad got us these \"smartwatches\", they have a whole GSIM module, bluetooth connectivity, touchscreen and even a working camera. I'm trying to reverse engineer them to dump the firmware and run my own custom software (doom ofc) on it, currently figured out which test pads are +ve, -ve and gnd, need a USB-UART adapter, USB logic analyzer, and maybe a CH341A programmer + SOIC-8 clip to continue, will pick this up when I get some free time (and the money to buy these).",
      "status": "shelved",
      "constellation": "hardware",
      "links": ["usb-camera"],
      "images": [
        { "src": "/archive/watch/watch-front.jpeg", "caption": "front of the motherboard" },
        { "src": "/archive/watch/watch-back.jpeg", "caption": "backside, see the round areas? they're the test pads" },
        { "src": "/archive/watch/watch-screen.jpeg", "caption": "watch developer menu" }
      ]
    },
    {
      "slug": "usb-camera",
      "title": "Turing Laptop camera into a USB Webcam",
      "shelf": "playground",
      "kind": "experiment",
      "date": "2026-06",
      "when": "June 2026",
      "body": "Had an old Samsung N150 Plus lying around, took out the camera and connected the wires to a standard usb, worked on the first try and has a surprisingly good quality feed. Going to use it for something cool soon.",
      "constellation": "hardware",
      "images": [
        { "src": "/archive/usb-cam/usb-camera.jpeg" }
      ],
      "fullscreen": true
    },
    {
      "slug": "brookie",
      "title": "Baked a Brookie!",
      "shelf": "playground",
      "kind": "scrap",
      "date": "2026-05",
      "when": "May 2026",
      "blurb": "Brookie = Brownie + Cookie",
      "body": "Can you believe this was my first attempt at baking anything ever? It was crazy good, turns out baking isn't hard at all, you guys are just noobs.",
      "images": [
        { "src": "/archive/brookie/brookie.jpeg" }
      ],
      "fullscreen": true
    },
    {
      "slug": "landscape",
      "title": "A cool picture I took",
      "shelf": "playground",
      "kind": "scrap",
      "date": "2026-06",
      "when": "June 2026",
      "images": [
        { "src": "/archive/landscape/landscape-1.jpeg", "caption": "Puranpur, India" }
      ],
      "fullscreen": true
    },
    {
      "slug": "typing",
      "title": "Typing Test",
      "shelf": "playground",
      "kind": "game",
      "date": "2026-08",
      "blurb": "Words per minute, on a global board",
      "constellation": "arcade",
      "card": "arcade"
    },
    {
      "slug": "mines",
      "title": "Minesweeper",
      "shelf": "playground",
      "kind": "game",
      "date": "2026-08",
      "blurb": "9×9, ten mines, right-click or hold to flag",
      "constellation": "arcade",
      "card": "arcade"
    },
    {
      "slug": "snake",
      "title": "Snake",
      "shelf": "playground",
      "kind": "game",
      "date": "2026-08",
      "blurb": "Arrow keys, WASD or swipe",
      "constellation": "arcade",
      "card": "arcade"
    },
    {
      "slug": "2048",
      "title": "2048",
      "shelf": "playground",
      "kind": "game",
      "date": "2026-08",
      "blurb": "Swipe or arrow keys. You will not get 2048.",
      "constellation": "arcade",
      "card": "arcade"
    }
  ]
}
