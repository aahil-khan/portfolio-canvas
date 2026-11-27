// The two essays, in full, from the Medium export (~/projects/scratch/medium-export/posts/). His words
// are S(...) blocks; the opening paragraph is the lead (Lab.data, `opening`), so each body starts at
// the paragraph after it. Line breaks inside one of his paragraphs are joined with a space. Images are
// his, re-encoded to WebP under assets/; three have a private detail pixelated (see the README).
// Format: see the contract in content/bodies-shopkeeper.js.
var Lab = window.Lab = window.Lab || {};
(function () {
  function P(text, where, reason) { return { text: text, proposal: true, where: where, reason: reason }; }
  function S(text, source) { return { text: text, source: source }; }

  var L = 'the essay, Medium, 14 Nov 2025';
  var C = 'the essay, Medium, 19 Mar 2026';
  var l = function (t) { return S(t, L); };
  var c = function (t) { return S(t, C); };
  // the path is written out in full: the bundler inlines every literal assets/… path it finds
  var img = function (path, w, h, alt, caption, src) { return { img: { src: path, w: w, h: h, alt: alt, caption: caption ? S(caption, src) : null } }; };
  var li = function (src) { return function () { return [].slice.call(arguments).map(function (t) { return S(t, src); }); }; };
  var ll = li(L), cl = li(C);

  // Glossary terms these essays use. Plain one-line definitions; the source names the essay that uses them.
  // its glossary terms live in content/terms.js

  Object.assign(Lab.bodies, {
    'old-laptop': {
      pull: 'Use systemd, not tmux, for persistent services.',
      blocks: [
        img('assets/essay-old-laptop-1.webp', 800, 455, 'A dark dashboard titled aahil-server, with tiles grouped as Core Services, Developer Tools, Monitoring, Automation and Jobs, Media, Links and Projects.', 'My home server dashboard — everything I run lives here.', L),
        { side: P('This essay first ran on Medium[^medium], and is reproduced here in full with its images. One screenshot has an IP address blurred.', 'Old laptop essay, sidenote', 'Says where the text comes from, and what was changed'), sideHead: P('Where this ran.', 'Old laptop essay, sidenote lead-in', '') },
        { p: l('At the time, I didn’t see any real benefit. It was just something fun and nerdy to try.') },
        { p: l('But building my [[t:home-server|home server]] ended up being one of the best engineering decisions I’ve made. Today, that old laptop:') },
        { list: ll('Runs 50+ services', 'Acts as my testing environment', 'Hosts microservices, databases, and APIs', 'Has a full observability stack', 'Saves me [[t:vps|VPS]] costs', 'And has taught me more DevOps and Linux than any course') },
        { p: l('This is the story of how I built it.') },

        { h2: l('Hardware & Base Setup') },
        { p: l('My “cloud” is an HP Pavilion x360 Convertible:') },
        { list: ll('Intel i5–8250U (quad-core)', '16 GB RAM', '500GB NVMe + 1TB SSD', 'NVIDIA MX130 GPU', 'Ubuntu 24.04 LTS') },
        { h3: l('What I learned early') },
        { p: l('At first, I ran everything in [[t:tmux|tmux]] sessions. Then my house had frequent power cuts.') },
        { p: l('I lost every running service.') },
        { p: l('That’s when I learned the hard way:') },
        { p: l('Use [[t:systemd|systemd]], not tmux, for persistent services.') },
        { p: l('Today, every important component runs through systemd.') },

        { h2: l('My Hosting & Security Philosophy') },
        { p: l('My server is secure by default because nothing is publicly accessible unless I explicitly expose it.') },
        { h3: l('Access paths') },
        { p: l('1. [[t:cloudflare-access|Cloudflared Access TCP]]') },
        { list: ll('Uses Cloudflared login first', 'This is how I SSH from my laptop') },
        { p: l('2. [[t:tailscale|Tailscale]] (mesh VPN)') },
        { list: ll('Backup remote access', 'Works even if Cloudflared or DNS fails') },
        { p: l('3. [[t:cloudflare-tunnel|Cloudflared tunnels]] for hosting') },
        { list: ll('I expose a Docker port', 'Route it through Cloudflared', 'Map it to a subdomain on my domain', 'A systemd service keeps the tunnel alive') },
        { p: l('Unless I expose something myself, nobody can even discover the machine.') },
        { p: l('This was a huge confidence boost while [[tag:self-hosting|self-hosting]].') },

        { h2: l('My SSH Shell Setup') },
        img('assets/essay-old-laptop-2.webp', 800, 448, 'A terminal logged in to aahil-server: swap, temperature and process counts, Ubuntu update notices, and a custom prompt on the last line. The IPv6 address is blurred.'),
        { p: l('My customized SSH shell — this is how I usually connect to the server when I’m working locally or through Cloudflared Access.') },

        { h2: l('How I Actually Use My Home Server Daily') },
        { h3: l('1. Testing all my official projects locally') },
        { p: l('I run my production-grade work here before deploying:') },
        { list: ll('SkillMap', 'Portana', 'Intellidine', 'Edutube', 'Many experiments and prototypes') },
        { p: l('This saves me cloud costs and makes testing much faster.') },
        { h3: l('2. Running all my backend APIs locally') },
        { p: l('I deploy frontends to Vercel, but all backends run here.') },
        { p: l('It’s faster, cheaper, and I can develop in peace without burning VPS hours.') },
        { h3: l('3. Self Hosting Tools') },
        { p: l('I run several tools that help me automate, orchestrate, or extend my workflow:') },
        { list: ll('[[t:n8n|n8n]] — my automation workflow engine (webhooks, API chaining, background tasks)', '[[t:jellyfin|Jellyfin]] — occasional media server', '[[t:transmission|Transmission daemon]] — rarely used now, but integrated with my Telegram bot', '[[t:ollama|Ollama]] — local LLM inference engine') },
        { p: l('Most of these run inside [[t:docker|Docker]] for easy management and isolation.') },
        { h3: l('4. Debugging with real DevOps tools') },
        { p: l('I use:') },
        { list: ll('[[t:dashy|Dashy]] as my homepage', '[[t:portainer|Portainer]] for container management', '[[t:dozzle|Dozzle]] for streaming logs', '[[t:glances|Glances]] and [[t:netdata|Netdata]] for system metrics', '[[t:uptime-kuma|Uptime Kuma]] for uptime alerts', '[[t:healthchecks|Healthchecks]] for cron monitoring') },
        { p: l('This setup feels like running my own mini cloud.') },
        { h3: l('5. Using MySQL') },
        { p: l('I’ve hosted public test databases for projects, and it’s extremely convenient for development.') },
        { h3: l('6. Rarely — Jellyfin & downloads') },
        { p: l('I have a media server hosted through Jellyfin and a telegram bot to download torrents and files. I don’t use these too much, but they’re great to have.') },

        { h2: l('Container Management — Docker Everywhere') },
        img('assets/essay-old-laptop-3.webp', 800, 436, 'Portainer’s container list: a column of running containers with their stacks, images, creation dates and IP addresses.', 'Portainer Dashboard', L),
        { h3: l('Why Portainer?') },
        { p: l('Because it gives me:') },
        { list: ll('Resource usage per container', 'Start/stop/restart', 'exec into containers', 'Volume/network visibility', 'Stack deployments') },
        { p: l('It’s simply the best GUI for managing a Docker-heavy server.') },

        { h2: l('Real-Time Logs With Dozzle') },
        img('assets/essay-old-laptop-4.webp', 800, 438, 'Dozzle in the browser: a list of hosts and containers on the left, and a live stream of request logs from a backend on the right.', 'Dozzle Dashboard', L),
        { p: l('Perfect for debugging microservices or watching events in real time.') },
        { p: l('Especially when something misbehaves.') },

        { h2: l('System Monitoring With Glances and Netdata') },
        img('assets/essay-old-laptop-5.webp', 800, 435, 'Glances in a terminal: CPU, memory, swap and load bars across the top, network and disk rates down the side, and a table of 28 containers with their CPU and memory use.', 'Glances Dashboard', L),
        img('assets/essay-old-laptop-6.webp', 800, 439, 'Netdata’s system overview: dials for disk reads and writes, CPU and RAM use, and network traffic, above smaller pressure and load charts.', 'Netdata', L),
        { p: l('I can see:') },
        { list: ll('CPU', 'RAM', 'Disk I/O', 'Network traffic', 'Processes', 'Container usage') },
        { p: l('All in one place.') },

        { h2: l('Uptime Monitoring') },
        img('assets/essay-old-laptop-7.webp', 800, 436, 'Uptime Kuma’s dashboard: nine services up and none down, each with its uptime percentage, above a table of recent checks and their responses.', 'Uptime Kuma Dashboard', L),
        { p: l('Every service is tracked. If something fails, I get notified instantly.') },

        { h2: l('The Telegram Bot — My Failsafe') },
        img('assets/essay-old-laptop-8.webp', 800, 219, 'A Telegram chat with the aahil-server bot: the message “stats” and its reply with uptime, CPU, memory and disk usage.', 'Telegram Web', L),
        { p: l('This was one of the first things I wrote — a simple Bash script + Telegram API + Transmission daemon.') },
        { p: l('Even today, it acts as my:') },
        { list: ll('emergency download tool', 'server status helper') },
        { p: l('If every other layer breaks, this bot still works.') },

        { h2: l('n8n') },
        img('assets/essay-old-laptop-9.webp', 800, 313, 'An n8n workflow on its canvas: a chain of connected nodes that reads tasks and sends reminders through Telegram.', 'A custom n8n workflow to remind tasks thorough telegram', L),
        { p: l('I’m still getting comfortable with n8n, but I’ve already begun using it for small workflow automations.') },

        { h2: l('Including a Fun ASCII Tool') },
        { p: l('One tool I recently tried is `ascii-view`,[^ascii] which transforms images into really clean ASCII art.') },
        img('assets/essay-old-laptop-10.webp', 800, 401, 'A photo of a red rose beside the same photo rendered in coloured ASCII characters.'),
        { p: l('I didn’t make it myself — just found it interesting, so I’ve linked the official GitHub repo for anyone curious.') },

        { h2: l('DevOps Skills I Picked Up') },
        { p: l('Running this server taught me:') },
        { list: ll('how to manage microservices', 'Docker networking and healthchecks', 'systemd service files', 'log streaming and debugging', '[[t:reverse-proxy|reverse proxies]]', 'Linux hardening', 'cron monitoring', 'database hosting', 'cost-efficient deployment', 'Cloudflared tunnels', 'uptime management', 'VPN-based security') },
        { p: l('This was better than any formal DevOps course.') },

        { h2: l('Why You Should Build a Home Server') },
        { p: l('If you’re even a little curious about self-hosting, building a home server is absolutely worth it. You don’t need fancy hardware — an old laptop and a bit of curiosity are more than enough. You’ll learn real DevOps skills, understand how systems behave in the real world, and gain confidence that no tutorial can match. It becomes your own little cloud: a place to host projects, experiment freely, break things safely, and grow as a developer. If you’ve been thinking about it, take the leap — you’ll be surprised by how much you learn.') },

        { h2: l('Conclusion — The Best Engineering Decision I Made') },
        { p: l('What started as a fun experiment became:') },
        { list: ll('my backend environment', 'my microservices lab', 'my hosting platform', 'my personal cloud', 'my DevOps university') },
        { p: l('This old laptop now powers everything from production-grade services to AI workloads — and it has saved me countless hours and costs.') },
        { p: l('If you’re even thinking about building a home server:') },
        { p: l('Do it. You’ll learn more than you expect. And it might just become the most important machine you own.') },
      ],
      refs: {
        medium: { title: 'How I Turned an Old Laptop Into My Personal Cloud Server', site: 'Medium · 14 Nov 2025', line: S('By Aahil Khan on November 14, 2025.', 'the Medium export'), url: 'https://medium.com/@aahilminookhan/how-i-turned-an-old-laptop-into-my-personal-cloud-server-16d07de27399' },
        ascii: { title: 'ascii-view', site: 'GitHub · gouwsxander', line: S('Transforms images into really clean ASCII art; linked from the essay as the official repo.', L), url: 'https://github.com/gouwsxander/ascii-view' },
      },
    },

    'chrome-hackathon': {
      pull: 'Sometimes the moment you feel like your idea is useless is exactly when it becomes interesting.',
      blocks: [
        img('assets/essay-chrome-hackathon-1.webp', 800, 500, 'Konta’s knowledge graph of 310 pages beside the Prism Web Agent Hackathon winners’ board, which lists team Aegis among the winners.', 'Built in 10 days, almost scrapped midway — ended up winning it all.', C),
        { side: P('This essay first ran on Medium[^medium], and is reproduced here in full with its images. Two screenshots have a detail blurred: a bookmark bar, and one label in a graph.', 'Chrome essay, sidenote', 'Says where the text comes from, and what was changed'), sideHead: P('Where this ran.', 'Chrome essay, sidenote lead-in', '') },
        { p: c('I had built exactly two:') },
        { list: cl('one that changed a webpage’s background color', 'another that randomly played a meme video on your screen') },
        { p: c('That was my entire experience.') },
        { p: c('Ten days later, my team Aegis won the Samsung Prism Web Agent Hackathon.') },
        { p: c('We built Konta — a privacy-first, fully local AI agent that turns your messy browser history into a semantic [[t:knowledge-graph|knowledge graph]].') },
        { p: c('This is the story of how four people who barely understood Chrome extensions ran into every possible constraint, almost quit halfway, and still shipped something that won.') },

        { h2: c('The One Line That Changed Everything') },
        { p: c('The problem statement was simple: Use browser data (history, bookmarks, etc.) in a meaningful way.') },
        { p: c('Most teams went in a predictable direction — summaries, dashboards, maybe a bit of AI.') },
        { p: c('But there was one small line in the brief:') },
        { quote: c('“Using local models will earn additional brownie points.”') },
        { p: c('That stuck.') },
        { p: c('Instead of sending user data to APIs, we asked: What if everything stayed local?') },
        { p: c('No cloud. No external calls. No data leaving your machine.') },
        { p: c('That’s where Konta started — as a [[t:local-first|local-first]] knowledge graph + semantic search engine living entirely inside the browser.') },

        { h2: c('The Setup: Divide and Survive') },
        { p: c('We picked [[t:plasmo|Plasmo]] as our extension framework (hot reload saved us more times than I can count) and split into parallel tracks:') },
        { list: cl('Sanyam → ML pipeline ([[t:wasm|WASM]] + embeddings + graph structure)', 'Anoushka → UI/UX (making complex data usable)', 'Anshum → frontend + graph rendering chaos', 'Me → glue work (event capture, [[t:sessionization|sessionization]], wiring everything together)') },
        { p: c('Every night was basically:') },
        { p: c('“What broke today, and how do we unblock each other?”') },

        { h2: c('Reality Check: Chrome Extensions Are Pain') },
        { p: c('[[t:manifest-v3|Manifest V3]] is not friendly.') },
        { p: c('We ran into:') },
        { list: cl('[[t:service-worker|Service worker]] limitations', 'Memory constraints for local ML', '[[t:content-script|Content script]] injection rules', 'Messaging issues between background + UI', 'Libraries randomly breaking (looking at you, `react-force-graph`)') },
        { p: c('We pushed through and shipped a V1.') },
        { p: c('And honestly?') },
        { p: c('It was… mid.') },

        { h2: c('The Lowest Point') },
        { p: c('Then something happened that almost killed the project.') },
        { p: c('While testing, I accidentally opened Chrome’s built-in feature: “Show history by groups.”') },
        { p: c('I just stared at it.') },
        { p: c('It looked… exactly like what we built.') },
        { p: c('I showed the team.') },
        { p: c('Silence.') },
        { p: c('That moment hits different in a [[tag:hackathons|hackathon]] — when you realize:') },
        { p: c('“Did we just reinvent something that already exists?”') },
        { p: c('Morale dropped hard.') },

        { h2: c('The Pivot') },
        { p: c('We had two choices:') },
        { list: cl('Ship and hope for the best', 'Or rethink everything') },
        { p: c('We chose the second.') },
        { p: c('Instead of asking:') },
        { p: c('“What did Chrome already build?”') },
        { p: c('We asked:') },
        { p: c('“What can Chrome NOT do?”') },
        { p: c('That changed everything.') },

        { h2: c('Meet Konta') },
        { p: c('Konta isn’t a history viewer.') },
        { p: c('It’s a local-first, deterministic web intelligence agent.') },
        { p: c('Everything runs inside your browser using [[t:indexeddb|IndexedDB]]. No tracking. No cloud. No surprises.') },
        { h3: c('1. Timeline + 3-Layer Search') },
        { p: c('Your history isn’t a list — it’s a story.') },
        { p: c('Konta turns it into sessions:') },
        { list: cl('grouped by time', 'split by inactivity', 'adjusted for context switches') },
        img('assets/essay-chrome-hackathon-2.webp', 800, 500, 'An Airbnb page with Konta’s side panel open, showing the day’s browsing grouped into labelled sessions such as a trip, shopping and project work.', 'Konta transforms raw browser history into structured, time aware sessions you can actually navigate.', C),
        { p: c('Then we added a 3-layer search system:') },
        { list: cl('[[t:tf-idf|TF-IDF]] + [[t:cosine-similarity|cosine ranking]]', 'Semantic [[t:embedding|embedding]] search (understands intent)', 'Keyword fallback') },
        { p: c('You don’t need to remember titles anymore. Just describe what you were doing.') },
        img('assets/essay-chrome-hackathon-3.webp', 800, 500, 'Konta’s side panel searching a loose phrase and listing matching pages from history, including ones whose titles don’t contain the words typed.', 'Search that works even when you don’t remember exact words, powered by semantic understanding, not just keywords.', C),
        { h3: c('2. Knowledge Graph (The Fun Part)') },
        { p: c('This is where things got interesting.') },
        { p: c('We:') },
        { list: cl('generated embeddings using [[t:minilm|all-MiniLM-L6-v2]]', 'ran it fully in-browser via [[t:transformers-js|Transformers.js]]', 'clustered using [[t:louvain|Louvain community detection]]') },
        { p: c('The result?') },
        { p: c('A graph where:') },
        { list: cl('nodes = pages', 'edges = meaningful relationships') },
        img('assets/essay-chrome-hackathon-4.webp', 800, 500, 'Konta’s full knowledge graph view: about a hundred coloured nodes in small linked clusters on a dark canvas.', 'Your browsing, visualized as a living graph of ideas, not a flat list of links.', C),
        { p: c('These relationships aren’t random — they’re based on:') },
        { list: cl('semantic similarity', 'time proximity', 'shared context') },
        { p: c('We even added an explainability panel:') },
        { p: c('“Why are these two nodes connected?”') },
        img('assets/essay-chrome-hackathon-5.webp', 800, 500, 'The graph with a Connection Explanations panel open, breaking one link’s strength into semantic similarity, keyword overlap and time proximity. One cluster label is blurred.', 'Every connection is explainable — no black-box decisions, just transparent relationships.', C),
        { p: c('Because if everything is local and private, it also needs to be understandable and trustworthy.') },
        { h3: c('3. Projects > Bookmarks') },
        { p: c('Bookmarks are graveyards.') },
        { p: c('Konta replaces them with Projects — but intentionally avoids being “too smart.”') },
        { p: c('Instead of automatically grouping and moving your data, Konta:') },
        { list: cl('detects repeated patterns', 'identifies when you’re working on something meaningful', 'nudges you to create a project') },
        img('assets/essay-chrome-hackathon-6.webp', 800, 500, 'A GitHub repository page with a small Konta card in the corner: “Project detected”, with a confidence score and buttons to track it or dismiss.', 'Instead of auto organizing your data, Konta nudges you, keeping control in your hands', C),
        { p: c('You stay in control.') },
        { p: c('This was a deliberate design choice:') },
        { p: c('Konta is deterministic and predictable, not automatic and opaque.') },
        { p: c('Once created, a Project becomes a structured workspace:') },
        { list: cl('curated links', 'consistent context', 'no silent changes in the background') },
        { p: c('And with one click: → Launch the entire project into a Chrome [[t:tab-group|Tab Group]].') },
        img('assets/essay-chrome-hackathon-7.webp', 800, 500, 'The SkillMap site open in a Chrome tab group, with Konta’s Projects panel listing the six sites saved to that project.', 'Projects turn scattered tabs into focused workspaces — launch everything you need in one click.', C),
        { h3: c('4. Focus Mode') },
        { p: c('We didn’t want to just track behavior — we wanted to influence it (carefully).') },
        { list: cl('Focus Mode → blocks distracting domains locally') },
        img('assets/essay-chrome-hackathon-8.webp', 800, 500, 'A blocked page for instagram.com, beside Konta’s Focus Mode panel with Social Media switched on and other categories off.', 'Distractions blocked locally, without sending your browsing data anywhere.', C),

        { h2: c('The Final Layer: Privacy') },
        { p: c('We were paranoid about this (in a good way).') },
        { p: c('So we added:') },
        { list: cl('excluded domains (completely blind tracking)', 'local-only storage', 'export/import (manual sync, no cloud dependency)', 'a clear privacy explanation') },
        img('assets/essay-chrome-hackathon-9.webp', 800, 500, 'Konta’s settings panel over a new-tab illustration: notification and project switches, then privacy controls for excluded domains, export, import and clearing data. The bookmark bar is blurred.', 'Full control over your data — from excluded domains to local-only storage and export.', C),
        { p: c('The goal:') },
        { p: c('The user should never feel watched.') },

        { h2: c('What Actually Won Us the Hackathon') },
        { p: c('It wasn’t just features.') },
        { p: c('It was:') },
        { list: cl('committing to local-first AI', 'embracing constraints instead of avoiding them', 'pivoting when we realized we weren’t unique', 'building something deterministic, explainable, and trustworthy') },
        { p: c('That low moment? It forced us to build something better.') },

        { h2: S('If You Want to Try It', C + '; one word of his heading changed, because the Lab’s copy rules refuse it') },
        { p: c('We [[tag:open-source|open sourced]] everything![^konta]') },
        { p: c('If you try it, I’d genuinely love to know:') },
        { list: cl('what feels useful', 'what feels unnecessary', 'what you’d want next') },

        { h2: c('Final Thought') },
        { p: c('The biggest lesson wasn’t technical.') },
        { p: c('It was this:') },
        { p: c('Sometimes the moment you feel like your idea is useless is exactly when it becomes interesting.') },
      ],
      refs: {
        medium: { title: 'Chrome Already Built Our Idea. We Won the Hackathon Anyway.', site: 'Medium · 19 Mar 2026', line: S('By Aahil Khan on March 19, 2026.', 'the Medium export'), url: 'https://medium.com/@aahilminookhan/chrome-already-built-our-idea-we-won-the-hackathon-anyway-fdf2d3c9e219' },
        konta: { title: 'konta-oss/konta', site: 'GitHub', line: S('“We open sourced everything!” The repository the essay links.', C), url: 'https://github.com/konta-oss/konta' },
      },
    },
  });
})();
