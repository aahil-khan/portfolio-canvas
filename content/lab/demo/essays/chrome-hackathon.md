![Konta’s knowledge graph of 310 pages beside the Prism Web Agent Hackathon winners’ board, which lists team Aegis among the winners.](/lab/demo/chrome-hackathon/essay-chrome-hackathon-1.webp "w=800 h=500 | Built in 10 days, almost scrapped midway — ended up winning it all.")

:::side[Where this ran.]
This essay first ran on Medium[^medium], and is reproduced here in full with its images. Two screenshots have a detail blurred: a bookmark bar, and one label in a graph.
:::

I had built exactly two:

- one that changed a webpage’s background color
- another that randomly played a meme video on your screen

That was my entire experience.

Ten days later, my team Aegis won the Samsung Prism Web Agent Hackathon.

We built Konta — a privacy-first, fully local AI agent that turns your messy browser history into a semantic [[t:knowledge-graph|knowledge graph]].

This is the story of how four people who barely understood Chrome extensions ran into every possible constraint, almost quit halfway, and still shipped something that won.

## The One Line That Changed Everything

The problem statement was simple: Use browser data (history, bookmarks, etc.) in a meaningful way.

Most teams went in a predictable direction — summaries, dashboards, maybe a bit of AI.

But there was one small line in the brief:

> “Using local models will earn additional brownie points.”

That stuck.

Instead of sending user data to APIs, we asked: What if everything stayed local?

No cloud. No external calls. No data leaving your machine.

That’s where Konta started — as a [[t:local-first|local-first]] knowledge graph + semantic search engine living entirely inside the browser.

## The Setup: Divide and Survive

We picked [[t:plasmo|Plasmo]] as our extension framework (hot reload saved us more times than I can count) and split into parallel tracks:

- Sanyam → ML pipeline ([[t:wasm|WASM]] + embeddings + graph structure)
- Anoushka → UI/UX (making complex data usable)
- Anshum → frontend + graph rendering chaos
- Me → glue work (event capture, [[t:sessionization|sessionization]], wiring everything together)

Every night was basically:

“What broke today, and how do we unblock each other?”

## Reality Check: Chrome Extensions Are Pain

[[t:manifest-v3|Manifest V3]] is not friendly.

We ran into:

- [[t:service-worker|Service worker]] limitations
- Memory constraints for local ML
- [[t:content-script|Content script]] injection rules
- Messaging issues between background + UI
- Libraries randomly breaking (looking at you, `react-force-graph`)

We pushed through and shipped a V1.

And honestly?

It was… mid.

## The Lowest Point

Then something happened that almost killed the project.

While testing, I accidentally opened Chrome’s built-in feature: “Show history by groups.”

I just stared at it.

It looked… exactly like what we built.

I showed the team.

Silence.

That moment hits different in a [[tag:hackathons|hackathon]] — when you realize:

“Did we just reinvent something that already exists?”

Morale dropped hard.

## The Pivot

We had two choices:

- Ship and hope for the best
- Or rethink everything

We chose the second.

Instead of asking:

“What did Chrome already build?”

We asked:

“What can Chrome NOT do?”

That changed everything.

## Meet Konta

Konta isn’t a history viewer.

It’s a local-first, deterministic web intelligence agent.

Everything runs inside your browser using [[t:indexeddb|IndexedDB]]. No tracking. No cloud. No surprises.

### 1. Timeline + 3-Layer Search

Your history isn’t a list — it’s a story.

Konta turns it into sessions:

- grouped by time
- split by inactivity
- adjusted for context switches

![An Airbnb page with Konta’s side panel open, showing the day’s browsing grouped into labelled sessions such as a trip, shopping and project work.](/lab/demo/chrome-hackathon/essay-chrome-hackathon-2.webp "w=800 h=500 | Konta transforms raw browser history into structured, time aware sessions you can actually navigate.")

Then we added a 3-layer search system:

- [[t:tf-idf|TF-IDF]] + [[t:cosine-similarity|cosine ranking]]
- Semantic [[t:embedding|embedding]] search (understands intent)
- Keyword fallback

You don’t need to remember titles anymore. Just describe what you were doing.

![Konta’s side panel searching a loose phrase and listing matching pages from history, including ones whose titles don’t contain the words typed.](/lab/demo/chrome-hackathon/essay-chrome-hackathon-3.webp "w=800 h=500 | Search that works even when you don’t remember exact words, powered by semantic understanding, not just keywords.")

### 2. Knowledge Graph (The Fun Part)

This is where things got interesting.

We:

- generated embeddings using [[t:minilm|all-MiniLM-L6-v2]]
- ran it fully in-browser via [[t:transformers-js|Transformers.js]]
- clustered using [[t:louvain|Louvain community detection]]

The result?

A graph where:

- nodes = pages
- edges = meaningful relationships

![Konta’s full knowledge graph view: about a hundred coloured nodes in small linked clusters on a dark canvas.](/lab/demo/chrome-hackathon/essay-chrome-hackathon-4.webp "w=800 h=500 | Your browsing, visualized as a living graph of ideas, not a flat list of links.")

These relationships aren’t random — they’re based on:

- semantic similarity
- time proximity
- shared context

We even added an explainability panel:

“Why are these two nodes connected?”

![The graph with a Connection Explanations panel open, breaking one link’s strength into semantic similarity, keyword overlap and time proximity. One cluster label is blurred.](/lab/demo/chrome-hackathon/essay-chrome-hackathon-5.webp "w=800 h=500 | Every connection is explainable — no black-box decisions, just transparent relationships.")

Because if everything is local and private, it also needs to be understandable and trustworthy.

### 3. Projects > Bookmarks

Bookmarks are graveyards.

Konta replaces them with Projects — but intentionally avoids being “too smart.”

Instead of automatically grouping and moving your data, Konta:

- detects repeated patterns
- identifies when you’re working on something meaningful
- nudges you to create a project

![A GitHub repository page with a small Konta card in the corner: “Project detected”, with a confidence score and buttons to track it or dismiss.](/lab/demo/chrome-hackathon/essay-chrome-hackathon-6.webp "w=800 h=500 | Instead of auto organizing your data, Konta nudges you, keeping control in your hands")

You stay in control.

This was a deliberate design choice:

Konta is deterministic and predictable, not automatic and opaque.

Once created, a Project becomes a structured workspace:

- curated links
- consistent context
- no silent changes in the background

And with one click: → Launch the entire project into a Chrome [[t:tab-group|Tab Group]].

![The SkillMap site open in a Chrome tab group, with Konta’s Projects panel listing the six sites saved to that project.](/lab/demo/chrome-hackathon/essay-chrome-hackathon-7.webp "w=800 h=500 | Projects turn scattered tabs into focused workspaces — launch everything you need in one click.")

### 4. Focus Mode

We didn’t want to just track behavior — we wanted to influence it (carefully).

- Focus Mode → blocks distracting domains locally

![A blocked page for instagram.com, beside Konta’s Focus Mode panel with Social Media switched on and other categories off.](/lab/demo/chrome-hackathon/essay-chrome-hackathon-8.webp "w=800 h=500 | Distractions blocked locally, without sending your browsing data anywhere.")

## The Final Layer: Privacy

We were paranoid about this (in a good way).

So we added:

- excluded domains (completely blind tracking)
- local-only storage
- export/import (manual sync, no cloud dependency)
- a clear privacy explanation

![Konta’s settings panel over a new-tab illustration: notification and project switches, then privacy controls for excluded domains, export, import and clearing data. The bookmark bar is blurred.](/lab/demo/chrome-hackathon/essay-chrome-hackathon-9.webp "w=800 h=500 | Full control over your data — from excluded domains to local-only storage and export.")

The goal:

The user should never feel watched.

## What Actually Won Us the Hackathon

It wasn’t just features.

It was:

- committing to local-first AI
- embracing constraints instead of avoiding them
- pivoting when we realized we weren’t unique
- building something deterministic, explainable, and trustworthy

That low moment? It forced us to build something better.

## If You Want to Try It

We [[tag:open-source|open sourced]] everything![^konta]

If you try it, I’d genuinely love to know:

- what feels useful
- what feels unnecessary
- what you’d want next

## Final Thought

The biggest lesson wasn’t technical.

It was this:

Sometimes the moment you feel like your idea is useless is exactly when it becomes interesting.
