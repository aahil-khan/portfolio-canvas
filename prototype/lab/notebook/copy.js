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
    labLabel: 'The Lab',
    canvas: '← canvas',
    canvasLabel: 'Back to the canvas (~)',
    menu: '☰',
    menuLabel: 'Open the notes (b)',
    menuClose: 'Close the notes',
    pathLabel: 'Where this note is',
    treeLabel: 'Notes',
    search: '⌕', searchWord: 'search', searchKey: '/', searchLabel: 'Search notes (/ or Ctrl+K)',
    graph: '◎', graphWord: 'map', graphLabel: 'The map of every note (g)',
    listen: '▶', listenWord: 'listen', listenLabel: 'Listen to this note (l)', listenTour: (w) => `Listen to all of ${w}`,
    sndWord: (on) => `Interface sounds: ${on ? 'on' : 'off'}`, sndLabel: (on) => `Interface sounds ${on ? 'on' : 'off'}, press to change`,
    // the Aa panel (round 4): text size, theme, line width, focus, sounds. One cell in the bar.
    aa: 'Aa', aaLabel: 'Reading settings: text size, theme, line width (a)', aaKey: 'a',
    panel: {
      label: 'Reading settings',
      size: 'Text size', sizeStep: (px) => `${px} px`, sizeDown: 'A−', sizeUp: 'A+', sizeDownLabel: 'Smaller text (−)', sizeUpLabel: 'Larger text (+)',
      theme: 'Theme', modes: { auto: 'Auto', night: 'Night', paper: 'Paper' }, autoHint: 'follows your device',
      width: 'Line width', widths: { narrow: 'Narrow', medium: 'Medium', wide: 'Wide' },
      focus: (on) => `Focus mode: ${on ? 'on' : 'off'}`, focusLabel: (on) => `Focus mode ${on ? 'on' : 'off'}: hides the notes and the outline (f)`, focusKey: 'f',
      sounds: 'Interface sounds',
      close: 'Done',
    },
    // reading progress (Q4): the kicker's clock as you scroll, and the hairline's name
    minLeft: (n) => `${n} min`, leftUnit: ' left', endUnit: 'at the end', progressLabel: 'Reading progress',
    // links and sharing (Q8), back to top (Q12), resume (Q10)
    headLink: (t) => `Copy a link to “${t}”`,
    share: 'Share this note', shareLabel: (t) => `Share “${t}”`, top: '↑ top', topLabel: 'Back to the top',
    copied: 'Link copied', copyFailed: 'Could not copy: the link is in the address bar',
    toTop: '↑ back to the top', toTopLabel: 'Back to the top of this note',
    continueTour: (id, step) => `Continue ${id} at step ${step}`, continueNote: (t) => `Continue “${t}”`,
    // the glossary (Q5) and hover previews (Q9)
    more: 'more →', glossLabel: (t) => `${t}: what it means`, idPrefix: (p, what) => `${p}: ${what}`,
    previewOpen: 'open →',
    keysHint: '? keys',
    on: 'on', off: 'off',
    help: '?', helpLabel: 'Keys (?)',
    focus: '◫', focusWord: 'focus', focusKey: 'f', focusLabel: 'Focus mode: hide the notes and the outline (f)',
    palettes: { night: 'night', paper: 'paper', green: 'green', amber: 'amber' },

    // the status column: one glyph, one meaning, always with words beside it for a screen reader
    status: {
      done: ['✓', 'done'], final: ['✓', 'final'], live: ['●', 'live'], progress: ['◐', 'in progress'], planned: ['○', 'planned'],
      parked: ['◌', 'parked'], published: ['¶', 'published'], stub: ['⋯', 'stub, to fill'],
    },
    types: { hub: 'hub', doc: 'doc', topic: 'topic', stage: 'stage', build: 'build', post: 'post', walkthrough: 'walkthrough', log: 'log' },
    visibility: { public: 'public', hidden: 'hidden' },
    visibilityLabel: (v) => `Visibility: ${v}. Every note and tracker item carries this switch; the React build's /edit sets it`,
    proposal: 'PROPOSAL',
    proposalLabel: 'A draft line for Aahil to rewrite',
    stub: 'stub, to fill',
    stubSlot: 'empty: to fill',
    // a stub shown to the public is one honest line; the slots are the author view's
    stubPublic: 'Write-up coming.',
    updated: (d) => `updated ${d}`,
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    // the words a reader sees for a section and for the folders that have no hub of their own
    sections: { root: 'Lab', 'agent-reliability': 'Agent reliability', builds: 'Builds', writing: 'Writing', tours: 'Guided tours' },
    folderNames: { walkthroughs: 'Guided tours' },
    crumbSep: '›',
    crumbUp: (t) => `‹ ${t}`,
    crumbUpLabel: (t) => `Up to ${t}`,
    tagsHead: 'tags',
    ledeSlot: 'TL;DR to write: one sentence on what this note says.',
    ledeSlotWhy: { missing: 'no summary yet', headings: 'the summary is a list of headings', repeat: 'the summary repeats the first lines' },
    tableCue: 'scroll →',
    showRows: (n) => `show all ${n} rows`,
    fewerRows: 'show fewer rows',
    minRead: (n) => `${n} min read`,
    minShort: (n) => `${n} min`, readUnit: ' read',
    minListen: (n) => `${n} min listen`,
    meta: { type: 'type', status: 'status', updated: 'updated', read: 'read', tags: 'tags', vis: 'visibility' },

    // the reading column's furniture
    onPage: 'on this page',
    // the note's end: where this fits (round 3: no local graph; an empty list is not shown)
    linksHead: 'where this fits',
    fits: {
      partOf: 'Part of', next: 'Next', linksTo: 'Links to', linkedFrom: 'Linked from',
      step: (i, n) => `step ${i} of ${n} in`,
      onMap: 'see on the map →', onMapLabel: (t) => `${t} on the map of the Lab`,
    },
    prev: '←', next: '→', up: '↑',
    prevLabel: (t) => `Previous: ${t}`, nextLabel: (t) => `Next: ${t}`, upLabel: (t) => `Up: ${t}`,
    tourBanner: (w, title, i, n) => `${w} ${title} · ${i} of ${n}`,
    tourOf: (i, n) => `${i} of ${n}`,
    totals: (n, r, l) => `${n} notes · ~${r} min read · ~${l} min listen`,
    stepLine: (r, l) => `~${r} min read · ~${l} min listen`,
    figure: (n) => `fig ${n}`,
    figClose: 'Close the figure',
    figOpen: (n) => `Enlarge figure ${n}`,
    tableScroll: 'scrolls sideways',
    sourceLine: (s) => `source: ${s}`,
    external: '↗',
    readOn: (host) => `read it on ${host}`,
    noEntry: 'points to no Lab entry yet',

    // the six parts of an entry, by type: number → heading. A stub shows every part as a slot.
    parts: {
      build: { 1: 'clip', 2: 'what it is', 3: 'try it', 4: 'what broke, what I measured', 5: "how it's built", 6: 'code' },
      stage: { 2: 'what it ships', 4: 'results', 5: 'its topics', 6: 'code' },
      topic: { 2: 'what to learn', 4: 'hours and log', 5: 'resource and proof' },
      post: { 2: 'what it is', 5: 'the post' },
    },
    // the part's number is kept in the data (the schema), never shown
    partHead: (n, h) => h,
    noRuns: 'no runs yet: results appear here once this stage runs.',
    hours: (spent, est) => `${spent} h logged of ${est} h planned`,
    finishedOn: (d) => `finished ${d}`,
    window: (a, b) => `planned ${a} → ${b}`,
    noPhase: 'not scheduled in a public phase',
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
      ledeProposal: "Notes on what I'm studying and building in agent reliability, written as I go.",
      entriesLabel: 'Where to start',
      tour: 'Read the Shopkeeper tour', tourMeta: (min) => `${min} min`,
      study: "What I'm studying now", studyMeta: (phase, done, of) => `${phase}, ${done} of ${of}`,
      builds: "Things I've built", buildsMeta: (names) => names.join(', '),
      mapLabel: 'The map of the Lab: its three sections',
      count: (n) => `${n} ${n === 1 ? 'note' : 'notes'}`,
      shop: (spec, done, of) => `spec ${spec}, ${done} of ${of} stages`,
      studyKey: (phase, done, of) => `${phase}, ${done} of ${of} topics`,
      allOf: (s) => `all of ${s} →`,
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
    fitLabel: 'Fit every note in view',
    nodeOpen: 'open →',
    graphHint: 'drag to pan · scroll to zoom · click a dot',
    shapes: { hub: 'overview', doc: 'spec', stage: 'project stage', topic: 'study topic', track: 'study track (click to show its topics)', build: 'build', post: 'post', walkthrough: 'guided tour', log: 'study log' },
    legend: 'key',
    key: {
      dot: 'Each dot is a note.', line: 'A line means one note links to the other.', dotted: 'Dotted lines are the steps of a tour.',
      colours: 'Colour is the section', shapesHead: 'Shape is the kind of note',
    },
    track: { done: (done, of) => `${done}/${of} done`, label: (name, done, of) => `${name}, a study track: ${done} of ${of} topics done`, expand: (n) => `show its ${n} topics`, collapse: 'hide its topics' },
    card: { label: 'The selected note', close: 'close' },
    list: { title: 'Map of the Lab', filter: 'Filter the map', placeholder: 'a title or an ID (T02)', none: 'nothing matches.', count: (n) => `${n}` },

    // the quick switcher
    switcher: {
      label: 'Go to a note',
      placeholder: 'a note, an ID (T02), #tag, or > a command',
      none: 'no note matches.',
      hint: '↑↓ move · ↵ open · esc close',
      commands: [
        { cmd: 'graph', label: 'open the graph' },
        { cmd: 'voice ai', label: "your device's voice" }, { cmd: 'voice sam', label: 'sam, live' }, { cmd: 'voice synth', label: 'sam through effects' },
        { cmd: 'palette night', label: 'night: light text on a soft dark' }, { cmd: 'palette paper', label: 'paper: dark text on warm white' }, { cmd: 'palette green', label: 'green phosphor' }, { cmd: 'palette amber', label: 'amber phosphor' },
        { cmd: 'sound on', label: 'interface sounds on' }, { cmd: 'sound off', label: 'interface sounds off' },
        { cmd: 'canvas', label: 'back to the canvas' }, { cmd: 'help', label: 'the keys' },
      ],
      ran: (c) => `ran: ${c}`,
      unknown: (c) => `no command "${c}"`,
    },

    // the keys sheet
    helpTitle: 'keys',
    keys: [
      ['/ or Ctrl+K', 'search notes'], ['g', 'graph'], ['b', 'sidebar or drawer'], ['[ ]', 'previous, next (tour or folder)'], ['u', 'up to the hub'],
      ['~', '← canvas'], ['f', 'focus mode'], ['+ −', 'larger, smaller text'], ['a', 'Aa: text size, theme, line width'], ['l', 'listen'], ['space', 'play / pause while listening'], [', .', 'seek'], ['↑↓ ← →', 'move in the tree, fold'], ['esc', 'close the top layer'], ['?', 'this sheet'],
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
      follow: '↓ back to narration', followLabel: 'Scroll back to the word being read',
      speed: 'speed', voice: 'voice', wave: 'level',
      part: (i, n) => `¶${i}/${n}`,
      tour: (w, i, n, t) => `${w} · ${i}/${n} · ${t}`,
      resume: (w) => `resume ${w} ↩`,
      resumeLabel: (w) => `Resume ${w} where it stopped`,
      rendering: 'rendering…',
      noTimings: "your device's voice: no word timings here",
    },
    voices: {
      ai: { name: 'ai', note: "your device's voice" },
      me: { name: 'me', note: 'a clone of my voice; soon' },
      synth: { name: 'synth', note: 'sam, through web audio effects' },
      sam: { name: 'sam', note: 'the 1982 Software Automatic Mouth, rendered live' },
    },
    voiceSoon: (v) => `${v} — soon`,
    voicePending: (v) => `${v} — not loaded`,
    voiceNone: 'no voice on this device: the text follows a clock, silently',
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
      clip: 'placeholder: a 15–60 s clip goes here',
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

    trip: { tile: 'Lab', tileLabel: 'Open the Lab' },
    proof: { round: 'Round trip, About dragged', back: 'Back on the desk', trip: (a, b) => `desk → lab ${a} ms · lab → desk ${b} ms`, add: (med, max) => `+1 note · relayout warm · median move ${med} px · max ${max} px` },
    title: (t) => `${t} · lab`,
    home: 'start here',
  }
  NIGHT.copy = C
  ;(root_.NB = root_.NB || {}).copy = C
})()
