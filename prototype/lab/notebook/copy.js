/*
 * prototype/lab/notebook/copy.js: every word the notebook's own UI says, in one object.
 *
 * Nothing in shell.js, reader.js, switcher.js, embeds.js, trip.js or model.js types a sentence:
 * they read NB.copy (also NIGHT.copy, for the modules carried over from #21). The notes' own
 * words live in notes/**.md and study.js, never here. In the React build this moves to content/.
 *
 * PROPOSAL FOR AAHIL: the section hubs' one-liners are in the notes, flagged `proposal: true`, and
 * the page shows a quiet PROPOSAL mark on them. Rewrite them in your voice.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  const C = {
    lab: 'lab',
    labLabel: "Aahil's Lab",
    canvas: '← desk',
    canvasLabel: 'Back to my desk, the rest of the site (~)',
    menu: '☰',
    menuLabel: 'All the notes (b)',
    menuClose: 'Hide the notes',
    pathLabel: 'You are here',
    treeLabel: 'Notes',
    search: '⌕', searchWord: 'find', searchKey: '/', searchLabel: 'Find a note (/ or Ctrl+K)',
    graph: '◎', graphWord: 'map', graphLabel: 'The map of everything (g)',
    listen: '▶', listenWord: 'listen', listenLabel: 'Read it to me (l)', listenTour: (w) => `Read all of ${w} to me`,
    sndWord: (on) => `Clicky sounds: ${on ? 'on' : 'off'}`, sndLabel: (on) => `Clicky sounds ${on ? 'on' : 'off'}, tap to switch`,
    // the Aa panel (round 4): text size, theme, line width, focus, sounds. One cell in the bar.
    aa: 'Aa', aaLabel: 'How it looks: text size, theme, line width (a)', aaKey: 'a',
    panel: {
      label: 'How it looks',
      size: 'Text size', sizeStep: (px) => `${px} px`, sizeDown: 'A−', sizeUp: 'A+', sizeDownLabel: 'Smaller text (−)', sizeUpLabel: 'Larger text (+)',
      theme: 'Theme', modes: { auto: 'Auto', night: 'Night', paper: 'Paper' }, autoHint: 'matches your device',
      width: 'Line width', widths: { narrow: 'Narrow', medium: 'Medium', wide: 'Wide' },
      focus: (on) => `Focus: ${on ? 'on' : 'off'}`, focusLabel: (on) => `Focus ${on ? 'on' : 'off'}: just the text, nothing else (f)`, focusKey: 'f',
      sounds: 'Clicky sounds',
      close: 'Done',
    },
    // reading progress (Q4): the kicker's clock as you scroll, and the hairline's name
    minLeft: (n) => `${n} min`, leftUnit: ' left', endUnit: 'the end', progressLabel: 'Reading progress',
    // links and sharing (Q8), back to top (Q12), resume (Q10)
    headLink: (t) => `Copy a link to “${t}”, straight to this bit`,
    share: 'Share', shareLabel: (t) => `Share “${t}”`, top: '↑ top', topLabel: 'Back to the top',
    copied: 'Link copied. Paste away.', copyFailed: "Couldn't copy. Grab it from the address bar.",
    toTop: 'Back where you left off · ↑ top', toTopLabel: 'You were here last time. Go to the top instead',
    continueTour: (id, step) => `Pick up ${id} at step ${step}`, continueNote: (t) => `Pick up “${t}”`,
    // the glossary (Q5) and hover previews (Q9)
    more: 'more →', glossLabel: (t) => `${t}: what it means`, idPrefix: (p, what) => `${p}: ${what}`,
    previewOpen: 'open →',
    keysHint: '? shortcuts',
    on: 'on', off: 'off',
    help: '?', helpLabel: 'Keyboard shortcuts (?)',
    focus: '◫', focusWord: 'focus', focusKey: 'f', focusLabel: 'Focus: hide everything but the text (f)',
    palettes: { night: 'night', paper: 'paper', green: 'green', amber: 'amber' },

    // the status column: one glyph, one meaning, always with words beside it for a screen reader
    status: {
      done: ['✓', 'done'], final: ['✓', 'final'], live: ['●', 'live'], progress: ['◐', 'in progress'], planned: ['○', 'planned'],
      parked: ['◌', 'parked for now'], published: ['¶', 'published'], stub: ['⋯', 'coming soon'],
    },
    types: { hub: 'hub', doc: 'doc', topic: 'topic', stage: 'stage', build: 'build', post: 'post', walkthrough: 'walkthrough', log: 'log' },
    visibility: { public: 'public', hidden: 'hidden' },
    visibilityLabel: (v) => `Visibility: ${v}. Every note and tracker item carries this switch; the React build's /edit sets it`,
    proposal: 'PROPOSAL',
    proposalLabel: 'A draft line for Aahil to rewrite',
    stub: 'stub, to fill',
    stubSlot: 'empty: to fill',
    // a stub shown to the public is one honest line; the slots are the author view's
    stubPublic: 'Still writing this one. Check back soon.',
    updated: (d) => `updated ${d}`,
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    // the words a reader sees for a section and for the folders that have no hub of their own
    sections: { root: 'Lab', 'agent-reliability': 'Agent reliability', builds: 'Builds', writing: 'Writing', tours: 'Tours' },
    folderNames: { walkthroughs: 'Tours' },
    crumbSep: '›',
    crumbUp: (t) => `‹ ${t}`,
    crumbUpLabel: (t) => `Back to ${t}`,
    // the bar's first crumb, and "‹ …" from a top-level note: whose Lab this is, for a visitor
    crumbRoot: "Aahil's Lab",
    tagsHead: 'tagged',
    ledeSlot: 'TL;DR to write: one sentence on what this note says.',
    ledeSlotWhy: { missing: 'no summary yet', headings: 'the summary is a list of headings', repeat: 'the summary repeats the first lines' },
    tableCue: 'scroll →',
    showRows: (n) => `all ${n} rows ↓`,
    fewerRows: 'fewer rows ↑',
    minRead: (n) => `${n} min read`,
    minShort: (n) => `${n} min`, readUnit: ' read',
    minListen: (n) => `${n} min listen`,
    meta: { type: 'type', status: 'status', updated: 'updated', read: 'read', tags: 'tags', vis: 'visibility' },

    // the reading column's furniture
    onPage: 'on this page',
    // the note's end: where this fits (round 3: no local graph; an empty list is not shown)
    linksHead: "what's nearby",
    fits: {
      partOf: 'Lives in', next: 'Up next', linksTo: 'This note points to', linkedFrom: 'Mentioned in',
      step: (i, n) => `step ${i} of ${n} in`,
      onMap: 'find it on the map →', onMapLabel: (t) => `${t} on the map of the Lab`,
    },
    prev: '←', next: '→', up: '↑',
    prevLabel: (t) => `Previous: ${t}`, nextLabel: (t) => `Next: ${t}`, upLabel: (t) => `Up: ${t}`,
    tourBanner: (w, title, i, n) => `${w} ${title} · ${i} of ${n}`,
    tourOf: (i, n) => `${i} of ${n}`,
    totals: (n, r, l) => `${n} notes · ~${r} min read · ~${l} min listen`,
    stepLine: (r, l) => `~${r} min read · ~${l} min listen`,
    figure: (n) => `fig ${n}`,
    figClose: 'Close',
    figOpen: (n) => `Zoom in on fig ${n}`,
    tableScroll: 'scrolls sideways',
    sourceLine: (s) => `source: ${s}`,
    external: '↗',
    readOn: (host) => `read it on ${host}`,
    noEntry: 'no Lab note for this one yet',

    // the six parts of an entry, by type: number → heading. A stub shows every part as a slot.
    parts: {
      build: { 1: 'clip', 2: 'what it is', 3: 'try it', 4: 'what broke, what I measured', 5: "how it's built", 6: 'code' },
      stage: { 2: 'what it ships', 4: 'results', 5: 'its topics', 6: 'code' },
      topic: { 2: 'what to learn', 4: 'hours and log', 5: 'resource and proof' },
      post: { 2: 'what it is', 5: 'the post' },
    },
    // the part's number is kept in the data (the schema), never shown
    partHead: (n, h) => h,
    noRuns: "hasn't run yet. The numbers land here when it does.",
    hours: (spent, est) => `${spent} h logged of ${est} h planned`,
    finishedOn: (d) => `finished ${d}`,
    window: (a, b) => `planned ${a} → ${b}`,
    noPhase: 'not on the public schedule yet',
    resource: 'resource',
    proofOf: 'proof of work',
    usedBy: 'stages that use it',
    logHead: ['date', 'topic', 'hours', 'what I did'],
    logRowsNone: 'nothing logged yet.',
    myNotes: 'my notes',

    // computed blocks
    blocks: {
      studyingNow: (phase, done, of, h, last) => `**${phase}** · ${done} of ${of} topics done · ${h} h logged · last logged ${last}`,
      inProgress: 'in progress',
      tourLine: (n, r, l) => `${n} notes · ~${r} min read · ~${l} min listen`,
      progress: (active, done, prog, parked, h) => `${active} active topics · ${done} done · ${prog} in progress · ${parked} parked · ${h} h logged`,
      phasesHead: ['phase', 'dates', 'topics', 'done', 'planned h', 'logged h'],
      stagesHead: ['stage', 'what', 'phase', 'target', 'status'],
      tracksHead: ['track', 'topics', 'done', 'folder'],
      gallery: (name, i, n) => `${name}, screenshot ${i} of ${n}`,
      unscheduled: 'unscheduled',
      // W1's intro names its stages before using them (O7): an author-view proposal
      stagesGloss: "(the project's five stages)",
    },

    // start-here: the way in, then the map of the Lab (round 3: no graph on start-here)
    start: {
      ledeProposal: "I'm learning how to build AI agents that don't fall over. These are my notes, written as I go, plus the things I build along the way.",
      entriesLabel: 'Where to start',
      tour: 'Take the Shopkeeper tour', tourMeta: (min) => `${min} min`,
      study: "What I'm learning right now", studyMeta: (phase, done, of) => `${phase}, ${done} of ${of}`,
      builds: "Things I've built", buildsMeta: (names) => names.join(', '),
      mapLabel: 'The map of the Lab: its three sections',
      count: (n) => `${n} ${n === 1 ? 'note' : 'notes'}`,
      shop: (spec, done, of) => `spec ${spec}, ${done} of ${of} stages`,
      studyKey: (phase, done, of) => `${phase}, ${done} of ${of} topics`,
      allOf: (s) => `everything in ${s} →`,
    },
    // the study hub: progress lists, not a chart (G6)
    progress: {
      phasesLabel: 'Phases, with topics done and hours logged',
      tracksLabel: 'Tracks, with topics done',
      dates: (a, b) => `${a} – ${b}`,
      topics: (done, of) => `${done} of ${of} topics`,
      hours: (logged, planned) => `${logged} of ${planned} h`,
      done: (done, of) => `${done} of ${of} done`,
      now: 'now',
      bar: (done, of) => `${done} of ${of} topics done`,
    },

    // the graph (desktop, ≥ 900 px) and the map as a list (phone)
    graphTitle: 'map',
    graphLabel2: 'The map of the Lab: every note, with study topics grouped by track',
    filters: { 'agent-reliability': 'Agent reliability', builds: 'Builds', writing: 'Writing' },
    filterLabel: (s, on) => `${s}: ${on ? 'shown' : 'dimmed'}`,
    fit: 'fit',
    fitLabel: 'Show everything at once',
    nodeOpen: 'open →',
    graphHint: 'drag to pan · scroll to zoom · click a dot',
    shapes: { hub: 'overview', doc: 'spec', stage: 'project stage', topic: 'study topic', track: 'study track (click to show its topics)', build: 'build', post: 'post', walkthrough: 'guided tour', log: 'study log' },
    legend: 'key',
    key: {
      dot: 'Each dot is a note.', line: 'A line means one links to the other.', dotted: 'Dotted lines are the steps of a tour.',
      colours: 'Colour is the section', shapesHead: 'Shape is the kind of note',
    },
    track: { done: (done, of) => `${done}/${of} done`, label: (name, done, of) => `${name}, a study track: ${done} of ${of} topics done`, expand: (n) => `show its ${n} topics`, collapse: 'hide its topics' },
    card: { label: 'The selected note', close: 'close' },
    list: { title: 'Map of the Lab', filter: 'Filter the map', placeholder: 'a title, an ID (T02) or #tag', none: 'Nothing here. Try fewer letters?', count: (n) => `${n}` },

    // the quick switcher
    switcher: {
      label: 'Find a note',
      tagsHead: 'Filter by tag',
      placeholder: 'a title, T02, #evals, or > a command',
      none: 'Nothing matches. Try fewer letters?',
      hint: '↑↓ move · ↵ open · esc close',
      commands: [
        { cmd: 'graph', label: 'open the map' },
        { cmd: 'voice ai', label: "your device's voice" }, { cmd: 'voice sam', label: 'sam, live' }, { cmd: 'voice synth', label: 'sam through effects' },
        { cmd: 'palette night', label: 'night: light text on a soft dark' }, { cmd: 'palette paper', label: 'paper: dark text on warm white' }, { cmd: 'palette green', label: 'green phosphor' }, { cmd: 'palette amber', label: 'amber phosphor' },
        { cmd: 'sound on', label: 'interface sounds on' }, { cmd: 'sound off', label: 'interface sounds off' },
        { cmd: 'canvas', label: 'back to the canvas' }, { cmd: 'help', label: 'the keys' },
      ],
      ran: (c) => `ran: ${c}`,
      unknown: (c) => `I don't know "${c}" yet`,
    },

    // the keys sheet
    helpTitle: 'shortcuts',
    keys: [
      ['/ or Ctrl+K', 'find a note'], ['g', 'the map'], ['b', 'sidebar or drawer'], ['[ ]', 'previous, next (tour or folder)'], ['u', 'up to the hub'],
      ['~', '← canvas'], ['f', 'focus mode'], ['+ −', 'larger, smaller text'], ['a', 'Aa: text size, theme, line width'], ['l', 'read it to me'], ['space', 'play / pause while listening'], [', .', 'seek'], ['↑↓ ← →', 'move in the tree, fold'], ['esc', 'close the top layer'], ['?', 'this sheet'],
    ],
    close: 'close',

    // the player strip
    strip: {
      label: 'Narration',
      play: '▶', pause: '❚❚', back: '◂◂', fwd: '▸▸',
      playLabel: 'Play', pauseLabel: 'Pause', backLabel: 'Back 10 seconds (,)', fwdLabel: 'Forward 10 seconds (.)',
      rateLabel: (r) => `Speed ${r}×, press to change`,
      voiceLabel: (v) => `Voice: ${v}, press to change`,
      stop: '✕', stopLabel: 'Stop (esc)',
      more: '⋯', moreLabel: 'Speed, voice and seeking',
      left: (t) => `${t} left`,
      leftLabel: (t) => `${t} left in this note`,
      follow: '↓ follow along', followLabel: 'Scroll back to the word being read',
      speed: 'speed', voice: 'voice', wave: 'level',
      part: (i, n) => `¶${i}/${n}`,
      tour: (w, i, n, t) => `${w} · ${i}/${n} · ${t}`,
      resume: (w) => `carry on with ${w} ↩`,
      resumeLabel: (w) => `Resume ${w} where it stopped`,
      rendering: 'rendering…',
      noTimings: "your device's voice can't tell me where it is, so no word highlight",
    },
    voices: {
      ai: { name: 'ai', note: "your device's voice" },
      me: { name: 'me', note: 'my actual voice, cloned. Soon.' },
      synth: { name: 'synth', note: 'sam, through web audio effects' },
      sam: { name: 'sam', note: 'a talking robot from 1982, running live in your browser' },
    },
    voiceSoon: (v) => `${v} — soon`,
    voicePending: (v) => `${v} — not loaded`,
    voiceNone: 'no voice on this device, so the words light up on a timer, silently',
    synthLive: 'synth runs on a live sam render',
    knobs: {
      tape: ['tape', 'speed and pitch together'], pitch: ['pitch', 'semitones, speed unchanged'], robot: ['robot', 'ring modulation, Hz'],
      mono: ['monotone', 'vocoder mix'], crush: ['crush', 'bits'], reset: 'reset',
    },
    // narration's one line for what it does not read aloud
    say: {
      table: (n) => `a table of ${n} rows, on the page.`,
      figure: (c) => `a figure: ${c}.`,
      formula: () => 'a formula, on the page.',
      code: () => 'a code block, on the page.',
    },

    // embeds
    embeds: {
      clip: 'clip coming: 15–60 s of it actually working',
      clipPlay: (d) => `▶ ${d}`,
      replay: '▶ replay', speed: (s) => `${s}×`, copy: 'copy', copied: 'copied',
      replayLabel: 'Replay the commands', speedLabel: (s) => `Typing speed ${s}×, press to change`, copyLabel: 'Copy the commands',
      tryFields: { unit: 'unit price', floor: 'floor', list: 'list', reservation: 'reservation' },
      tryOut: { margin: 'margin capture', surplus: 'surplus captured', warn: 'below 0.1: a soft warning', ok: 'above the 0.1 line' },
      tryPreset: 'preset CHG-20W',
      chartHead: ['phase', 'planned h', 'logged h'],
      chartTracks: ['track', 'done', 'topics'],
      chartLegend: { planned: 'planned', logged: 'logged' },
      chartTable: 'the numbers',
      diagramTimeout: 'timeout',
    },

    // ── round 6: a visitor arriving from a link ─────────────────────────────────────────
    // the one line above every note's kicker: whose Lab this is, and the way to the front door
    byline: { home: "Aahil's Lab", line: 'notes on making AI agents behave', label: "Aahil's Lab: start here" },
    notFound: (r) => `Couldn't find “${r}”. It may have moved, so here's the front door.`,

    // tags (tags.js holds the vocabulary; these are its words)
    tags: {
      label: (t) => `Everything tagged ${t}`,
      names: { evals: 'evals', tracing: 'tracing', reliability: 'reliability', latency: 'latency', voice: 'voice', guardrails: 'guardrails', negotiation: 'negotiation', 'agent-design': 'agent design', shipping: 'shipping', infra: 'infra', 'open-source': 'open source', hackathons: 'hackathons' },
      lines: {
        evals: 'How I check an agent actually works, not just that it ran.',
        tracing: 'Seeing what an agent did, step by step, after the fact.',
        reliability: 'Making it work on the hundredth try, not just the first.',
        latency: 'Where the seconds go, and how to get them back.',
        voice: 'Agents you talk to, and everything that goes wrong when you do.',
        guardrails: 'What an agent must never do, and how to make sure it doesn’t.',
        negotiation: 'The shopkeeper haggles. These are the rules it haggles by.',
        'agent-design': 'How the agent is put together: tools, context, who sees what.',
        shipping: 'Getting things out the door, and what broke on the way.',
        infra: 'Servers, deploys and plumbing.',
        'open-source': 'Code in the open, and contributing to other people’s.',
        hackathons: 'Things built in a weekend, mostly on caffeine.',
      },
      kicker: 'tag',
      count: (n) => `${n} ${n === 1 ? 'note' : 'notes'}`,
      onMap: 'see them on the map →',
      all: 'Every tag',
      none: (t) => `There's no tag called “${t}”. These are the real ones:`,
      filter: 'Tag', any: 'any tag', filterLabel: 'Show only notes with this tag',
      switcherHead: 'Jump to a tag',
      title: (t) => `#${t}`,
    },

    // sharing: one button at the top and one at the end; the native sheet where there is one
    share2: {
      menuLabel: 'Share this note',
      copy: 'Copy link', copied: 'Copied ✓',
      linkedin: 'LinkedIn', x: 'X', email: 'Email',
      targetLabel: (where) => `Share on ${where} (opens a new tab)`,
      emailSubject: (t) => `${t}, from Aahil's Lab`,
      emailBody: (t, u) => `Thought you'd like this one: ${t}\n\n${u}`,
    },
    // the nudge: once per note, near the end, after a real read. PROPOSAL: it speaks for Aahil
    nudge: {
      label: 'If you liked this',
      lines: {
        'agent-reliability': "If this was useful, send it to someone who's building agents.",
        builds: "Know someone who'd use this? Send it their way.",
        writing: 'Enjoyed it? Pass it to one person who would too.',
        tours: "If this was useful, send it to someone who's building agents.",
        root: 'If this helped, pass it on. That’s the whole ask.',
      },
      dismiss: 'Not now', dismissLabel: 'Hide this, it won’t come back on this note',
    },
    // the author card at every note's end (name and links: author.js, from profile.json)
    author: {
      label: 'Who wrote this',
      // PROPOSAL: his brand line, as the one playful line
      line: "I don't take myself seriously, but I take my projects very seriously.",
      linksLabel: 'Find me on',
      follow: 'Follow for the next one:',
      nextUp: 'Up next', fromStart: 'New here? Start from the beginning',
      startHere: 'Start here', linkLabel: (where) => `Aahil on ${where}`,
    },

    trip: { tile: 'Lab', tileLabel: 'Open the Lab' },
    proof: { round: 'Round trip, About dragged', back: 'Back on the desk', trip: (a, b) => `desk → lab ${a} ms · lab → desk ${b} ms`, add: (med, max) => `+1 note · relayout warm · median move ${med} px · max ${max} px` },
    title: (t) => (t && t !== "Aahil's Lab" ? `${t} · Aahil's Lab` : "Aahil's Lab"),
    home: 'start here',
  }
  NIGHT.copy = C
  ;(root_.NB = root_.NB || {}).copy = C
})()
