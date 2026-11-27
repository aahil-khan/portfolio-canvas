// Entry bodies for the builds: Drag to Workspace, Holt, the Datesheet generator. Format: the
// parent's writers' contract (inline markup as in content/copy.js; P = proposed, S = from a source).
var Lab = window.Lab = window.Lab || {};
(function () {
  function P(text, where, reason) { return { text: text, proposal: true, where: where, reason: reason }; }
  function S(text, source) { return { text: text, source: source }; }

  // its glossary terms live in content/terms.js

  Object.assign(Lab.charts = Lab.charts || {}, {
    holt: {
      caption: S('Matthews correlation coefficient on Holt’s custom benchmark, from −1 to 1 with 0 no better than chance: Holt’s rules 0.61–0.63, a single-prompt LLM baseline 0.32.', 'content/data/projects.json, Holt highlights'),
      max: 1,
      rows: [
        { label: 'Holt’s fixed rules', lo: 0.61, hi: 0.63 },
        { label: 'One LLM prompt, the baseline', lo: 0.32, base: true },
      ],
    },
  });

  var DTW = 'Drag to Workspace';
  var HOLT = 'Holt';
  var DS = 'Datesheet generator';
  var README = 'adapted from the Drag to Workspace README';

  Object.assign(Lab.bodies, {
    'drag-to-workspace': {
      meta: { updated: '2026-11-27' },
      pull: 'A tool that takes over that gesture is one you uninstall in a day.',
      blocks: [
        { h2: P('Letting go at the edge sends the window; holding opens a picker', DTW + ', first heading', 'States how it works, from the README') },
        { p: P('Drag a window to the left or right edge of the screen, and a small tab shows which [[t:gnome-workspace|workspace]] it will go to. Let go straight away and it goes to the next one, while you stay where you are. Keep holding and a column of every workspace on that side opens, with live previews: drop on the half nearest the edge to send the window there, or on the inner half to go with it.', DTW, README + ', How it works') },
        { p: P('Point at the thin line above the first card and a new workspace opens right next to this one, if you use [[t:dynamic-workspaces|dynamic workspaces]]. The window keeps its size and place, and stays maximised if it was. Change your mind, drag back from the edge or press Escape, and nothing moves.', DTW, README + ', How it works and Features') },
        { h2: P('Only the top two thirds of each edge move windows, so tiling keeps working', DTW, 'States the design decision') },
        { p: P('GNOME already uses those edges: drag a window to the side and it [[t:edge-tiling|tiles to half the screen]]. A tool that takes over that gesture is one you uninstall in a day. So by default only the top two thirds of each side edge move windows, and the bottom third tiles as it always did. Which part of the edge, and how close the pointer has to get, are both settings.', DTW, README + ', FAQ: does it get in the way of half-screen tiling?') },
        { p: P('The top edge and the edges between monitors need a longer hold, for the same reason: GNOME maximises and moves windows between screens there. Let go without choosing a workspace, and GNOME does what it normally would.', DTW, README + ', FAQ') },
        { h2: P('The drag logic imports nothing from GNOME, so it tests under plain node', DTW, 'States how it is tested') },
        { p: P('The decisions live in `lib/logic.js`, which has no GNOME imports, so `make test` runs them under node. The real drags run in `make e2e`: a throwaway headless [[t:gnome-shell|GNOME Shell]] with its own home and session bus, where a driver moves a virtual pointer over real windows, and any JavaScript error in the shell’s log fails the run.[^readme]', DTW, README + ', Building and testing') },
        { p: P('There’s no version check at runtime. Each range of GNOME versions from 46 to 51 gets its own zip, with only the code that range runs, and each zip is tested on real distro builds. It works on [[t:wayland|Wayland]] and X11, and with a finger on a touchscreen. Like [[holt|Holt]], it’s [[tag:open-source|open source]]: translations and bug reports go to the repository.', DTW, README + ', Requirements, Features and Contributing') },
      ],
      refs: {
        readme: { title: 'Drag to Workspace, the README', site: 'GitHub · aahil-khan/drag-to-workspace',
          line: S('“Every version is tested on real distro builds: Ubuntu 24.04 and 26.04, Debian 13, Fedora 41 to 45, and AlmaLinux 10.”', 'the README, quoted'),
          url: 'https://github.com/aahil-khan/drag-to-workspace#readme' },
        ego: { title: 'GNOME Extensions', site: 'extensions.gnome.org',
          line: S('The README’s note on it: “under review on extensions.gnome.org”.', 'the README, quoted'),
          url: 'https://extensions.gnome.org/' },
      },
      endingKind: 'do',
      ending: P('Get it through review on extensions.gnome.org, so installing is one click instead of a terminal line; it’s in the queue there.[^ego] Until then, the script above is the way in. The caveat: it’s tested on the distro builds the README lists, on GNOME 46 to 51, not on every setup people run.', DTW + ', the ending', 'Grounded in the README’s install note'),
    },

    holt: {
      meta: { updated: '2026-11-27' },
      pull: 'The verdict comes from fixed rules over GitHub’s own data, not from a model’s opinion.',
      blocks: [
        { h2: P('Whether a repo merges outsiders is in its pull requests, not its README', HOLT + ', first heading', 'States the idea behind it') },
        { p: P('Holt answers one question before you spend a weekend on a first pull request: will this repository actually merge it? It reads the repo’s recent pull requests. Do people outside the team get replies, and does their work get merged?[^site] From that it gives one of six verdicts, in words: worth your time, a long shot, not worth your time, not enough evidence, a personal project, or a list rather than code.', HOLT, 'adapted from Holt’s own description of its verdicts') },
        { p: P('The verdict comes from fixed rules over GitHub’s own data, not from a model’s opinion. That was a choice, and the benchmark is why.', HOLT, 'adapted from Holt’s own description') },
        { h2: P('Fixed rules scored an MCC of 0.61 to 0.63, against 0.32 for one LLM prompt', HOLT, 'States the measured result') },
        { p: P('On a custom benchmark, Holt’s rules reach a [[t:mcc|Matthews correlation coefficient]] of 0.61 to 0.63. A single-prompt LLM baseline, asked the same question, gets 0.32. MCC runs from −1 to 1, with 0 no better than a coin, and it doesn’t reward a classifier for saying yes to everything, which accuracy would. That makes it the fair number for a [[tag:evals|yes-or-no call]] like this one.', HOLT, 'adapted from projects.json, Holt highlights; MCC’s definition') },
        { figure: 'chart', of: 'holt' },
        { p: P('It started as a simple CLI, grew into a TUI, and shipped as a web app with a FastAPI backend, a browser extension and the Python CLI beside it.[^repo] More than 10,000 repositories have been analysed and over 12,600 reports generated in production, and it won the Most Useful Real World Workflow Award.', HOLT, 'adapted from content/data/now.json and projects.json, Holt') },
      ],
      refs: {
        site: { title: 'Holt', site: 'githolt.com',
          line: S('Holt reads a repository’s recent pull requests, whether outside contributors get replies and merges, and gives one of six verdicts from fixed rules over GitHub’s own data.', 'Holt’s own description of how it decides'),
          url: 'https://githolt.com' },
        repo: { title: 'holt-oss/holt', site: 'GitHub',
          line: S('Holt’s source: the Next.js web app, the FastAPI backend, the browser extension and the Python CLI and TUI.', 'content/data/projects.json, Holt links and highlights'),
          url: 'https://github.com/holt-oss/holt' },
      },
      endingKind: 'measure',
      ending: P('Whether a verdict holds when you ask twice. The [[agent-reliability|reliability study]]’s first build runs Holt’s verdicts for consistency and scores them with [[t:pass-k|pass^3]], [[t:wilson-interval|Wilson intervals]] and [[t:mcnemar|McNemar’s test]], because a verdict that flips between runs is worse than none; [[t02|the note on pass^k]] explains the arithmetic. The caveat on the number above: it’s one custom benchmark, so 0.61–0.63 says the rules beat one prompt, not that they’re right about your repository.', HOLT + ', the ending', 'Grounded in the tracker’s log: Build 1, Holt verdict consistency'),
    },

    datesheet: {
      meta: { updated: '2026-11-27' },
      pull: 'The fix was the unglamorous one: move the workflow into MySQL, so every step is a row that outlives the tab.',
      blocks: [
        { h2: P('A schedule that lived in the session died with a page refresh', DS + ', first heading', 'States the problem, from experience.json') },
        { p: P('The Datesheet generator builds Thapar University’s exam timetable, and I worked on its backend from March to July 2025. It kept the work in [[t:session-state|session state]], so a timetable in progress lived only as long as one visit: a page refresh, or a dropped connection, and it was gone.', DS, 'adapted from experience.json: couldn’t survive a page refresh; session-based state') },
        { p: P('The fix was the unglamorous one: move the workflow into MySQL, so every step is a row that outlives the tab. Once the state was durable, the rest followed from it: sign-in, several people working at once, and [[t:savepoint|savepoints]], so a half-built timetable resumes where it stopped instead of starting over.', DS, 'adapted from experience.json: persistent MySQL-backed workflow, the core fix; authentication, multi-user, savepoints') },
        { h2: P('Scheduling errors fell by 40% once generation was rebuilt on it', DS, 'States the measured result') },
        { p: P('With the workflow persistent, the generation steps could be reworked too, and scheduling errors came down by 40%. The university’s records live in [[t:peoplesoft|Oracle PeopleSoft]], so the last piece was automating the import and export between it and the new system.', DS, 'adapted from experience.json: improved the generation workflow, 40% fewer scheduling errors; PeopleSoft integration') },
        { p: P('It’s the oldest build here and the plainest: Python and MySQL, with no model anywhere in it.', DS, 'Honest framing beside the newer builds') },
      ],
      endingKind: 'do',
      ending: P('Make the savepoint the unit of everything: write each change as an event, so undo, an audit trail and two people editing at once all come from one table. The caveat: the 40% is the project’s own count from the time, and I can’t rerun it from here.', DS + ', the ending', 'In his voice; says what the number rests on'),
    },
  });
})();
