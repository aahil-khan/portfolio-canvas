/*
 * prototype/lab/night-mode/copy.js: every word the Lab's own UI says, in one object.
 *
 * Nothing in menu.js, intro.js, reader.js or night.js types a sentence: they read NIGHT.copy.
 * In the React build this moves to content/ (content/lab.ts, or a `lab` block in site.json if
 * the owner wants to edit it at /edit), exactly as CLAUDE.md asks of every string.
 *
 * PROPOSAL FOR AAHIL: the welcome lines, the four categories' one-line descriptions and the ask
 * answers are drafts, in the voice of content/data/profile.json (lower case, plain, a smiley at
 * the end). Rewrite them freely; the screen shows whatever is here.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  NIGHT.copy = {
    // ── the welcome (PROPOSAL), short enough to sit beside the toy ──
    welcome: [
      'welcome to the lab.',
      "the serious end of the desk: things i've shipped, experiments still on the bench, studies in chapters, and the write-ups about all of it.",
      'press ~ to go back to the canvas :)',
    ],
    // on a phone there is no ~ key: the last line says so
    welcomeTouch: '← in the deck, bottom right, goes back :)',

    root: '~/lab',
    entries: (n) => `${n} entries`,
    canvas: 'canvas',
    canvasKey: '~',
    canvasLabel: 'Back to the canvas',
    labLabel: 'The Lab',
    palettes: { white: 'white', green: 'green', amber: 'amber' },
    palShort: { white: 'w', green: 'g', amber: 'a' },

    // ── the home: an ls-style directory (PROPOSAL: the descriptions) ──
    dirLabel: 'Lab directory',
    updated: (m) => `updated ${m}`,
    sections: {
      work: { blurb: 'things that shipped and people use', unit: (n) => `${n} projects` },
      experiments: { blurb: 'on the bench: half-built, and honest about it', unit: (n) => `${n} logs` },
      research: { blurb: 'studies in chapters: long, measured, slow', unit: (n, ch) => `${n} series, ${ch} chapters`, short: (n, ch) => `${n} · ${ch}ch` },
      writing: { blurb: 'essays, and the write-ups behind the projects', unit: (n) => `${n} posts` },
    },
    start: 'not sure where to start?',
    picks: [['work', 'holt'], ['research', 'reliability-study'], ['writing', 'old-laptop-cloud']],
    keys: [['1–4', 'open'], ['↑↓', 'move'], ['↵', 'expand'], ['/', 'command'], ['?', 'keys']],

    // ── the compass (experimental: ?home=radial, or radial:on in the deck) ──
    radial: {
      label: 'Compass: point at a category, click to open it',
      hint: 'point, then click · 1–4 · esc for the list',
      touch: 'the compass needs a pointer; on touch it is the list',
      back: 'compass',
      backLabel: 'Back to the compass',
    },

    // ── the series ──
    series: {
      sample: 'sample content: placeholder',
      sampleLong: 'sample content: placeholder. none of this is real writing or real data; it is here so the series can be judged with something in it.',
      of: (n, planned) => `${n} of ~${planned}`,
      chapters: 'Chapters',
      planned: (t) => `planned: ${t}`,
      label: 'research series',
      status: 'status', started: 'started', updatedK: 'updated', total: 'total', progress: 'you',
      totals: (m, l) => `~${m} min read · ~${l} listen`,
      yours: (n, of) => `${n}/${of} read`,
      partOf: (n, title) => `part ${n} of ${title}`,
      up: 'study',
      upLabel: 'Back to the study',
      read: '✓ read',
      started_: '½ started',
      mine: 'kept in this browser only',
      chMeta: (status, date, mins, listen) => `status: ${status} · published ${date} · ${mins} min · listen ${listen}`,
    },

    // ── the deck: a status line, not navigation ──
    deck: {
      label: 'Lab deck',
      modes: { lab: 'LAB', narrate: 'NARRATE', ask: 'ASK', cmd: 'CMD', radial: 'RADIAL' },
      modeLabel: (m) => `Mode: ${m}`,
      prev: 'Back 15 seconds', play: 'Play narration', pause: 'Pause narration', next: 'Forward 15 seconds',
      rate: 'Speed', rateLabel: (r) => `Speed ${r}×, press to change`,
      idle: 'nothing loaded',
      section: (i, n) => `¶${String(i).padStart(2, '0')}/${String(n).padStart(2, '0')}`,
      voice: 'voice', voiceLabel: (v) => `Voice: ${v}. Choose a voice`,
      knobs: 'knobs', knobsLabel: 'Synth knobs',
      snd: 'snd', sndLabel: (on) => `Interface sounds ${on ? 'on' : 'off'}`,
      pal: 'pal', palLabel: (p) => `Palette: ${p}, press to change`,
      radial: 'radial', radialLabel: (on) => `Experimental compass home ${on ? 'on' : 'off'}`,
      on: 'on', off: 'off',
      toy: 'toy', toyNext: 'next',
      ask: 'ask', askLabel: 'Ask the Lab',
      cmd: 'cmd', cmdLabel: 'Command line',
      help: 'keys', helpLabel: 'Keyboard keys',
      more: 'More controls',
      moreClose: 'Close',
      canvasShort: '←',
    },
    voices: {
      ai: { name: 'ai', note: "your browser's own voice for now; the real build pre-renders a free-tier voice (e.g. Google Chirp)" },
      me: { name: 'me', note: 'a clone of my voice; how it gets made is not decided yet' },
      synth: { name: 'synth', note: 'a pre-rendered file through web audio effects; turn the knobs' },
      sam: { name: 'sam', note: 'the 1982 Software Automatic Mouth, rendered live' },
    },
    voiceSoon: (v) => `${v} — soon`,
    voicePending: (v) => `${v} — not loaded`,
    voiceNone: 'no voice on this device: the text types out on its own',
    synthLive: 'outside the one pre-rendered section, synth runs on a live sam render',
    knobs: {
      tape: ['tape', 'speed and pitch together'], pitch: ['pitch', 'semitones, speed unchanged'], robot: ['robot', 'ring modulation, Hz'],
      mono: ['monotone', 'vocoder mix'], crush: ['crush', 'bits'], reset: 'reset',
    },
    narrated: 'narrated',
    listen: 'listen',
    listenLabel: 'Listen to this section',

    // ── ?ask ──
    ask: {
      title: 'ask',
      prompts: [
        { id: 'now', q: 'what am i working on?' },
        { id: 'interesting', q: 'tell me something interesting' },
        { id: 'joke', q: 'tell me a joke' },
      ],
      now: {
        mark: 'sample: the real one is written by a model from my own posts, server-side, after every content change',
        text: 'right now: a lab for this site, with a directory home, a deck that reads posts aloud, and a reliability study of the old laptop that runs everything at home. before that, holt shipped, a tool that tells you whether a repo is worth contributing to.',
      },
      authored: 'Aahil writes these',
      interesting: [
        'the laptop serving this lab has been running in a closet for months, and the thing that worries me most about it is the battery, not the disks.',
        'the 1982 voice in the deck fits in about twenty kilobytes. it predates every phone, and still says most words well enough.',
        'the toy in the corner is a few hundred characters of text redrawn about thirty times a second; nothing in it is an image.',
      ],
      joke: [
        "i tried to make my home server highly available. now it's highly available to the power cuts.",
        'there are 10 kinds of people: the ones who read binary, and the ones who wait for the narration.',
        "my experiments folder is called 'bench' because that's where things sit for a very long time.",
      ],
      again: 'again',
      close: 'close',
      closeLabel: 'Close the answer',
    },

    // ── / the command line ──
    cmd: {
      prompt: '/',
      label: 'Command',
      empty: 'no match',
      hint: '↑↓ choose · ↵ run · esc close',
      list: {
        open: (t) => `open ${t}`, voice: (v) => `voice ${v}`, pal: (p) => `pal ${p}`, toy: (t) => `toy ${t}`, ask: (a) => `ask ${a}`,
        snd: 'snd', radial: 'radial', play: 'play', keys: 'keys', canvas: 'canvas',
      },
      what: { open: 'read it', voice: 'narration voice', pal: 'palette', toy: 'corner toy', ask: 'ask the lab', snd: 'sounds on / off', radial: 'compass on / off', play: 'play / pause', keys: 'keyboard keys', canvas: 'back to the canvas' },
    },
    help: {
      title: 'keys',
      rows: [['1–4', 'open a category'], ['↑ ↓', 'move'], ['↵', 'expand / open'], ['esc', 'back, close'], ['space', 'play / pause (when loaded)'], [', .', '−15 s / +15 s'], ['[ ]', 'slower / faster'], ['v', 'voice'], ['n', 'next toy'], ['/', 'command line'], ['?', 'this list'], ['~', 'back to the canvas']],
      close: 'close',
    },

    // ── the toy ──
    toy: {
      next: 'next',
      nextLabel: 'Next toy',
      label: (name, keys) => `${name}, an ASCII toy. ${keys}`,
      hints: {
        donut: { mouse: 'drag to spin', touch: 'drag to spin', keys: 'Drag it, or use the arrow keys, to spin it.' },
        warp: { mouse: 'point to steer', touch: 'drag to steer', keys: 'Point at it, or use the arrow keys, to steer.' },
        life: { mouse: 'click cells · r reseeds', touch: 'tap cells to flip', keys: 'Click a cell, or move with the arrow keys and press space, to flip it; r reseeds.' },
        nebula: { mouse: 'move to stir', touch: 'drag to stir', keys: 'Move over it, or use the arrow keys, to stir it.' },
        moon: { mouse: 'drag for the phase', touch: 'drag for the phase', keys: 'Drag sideways, or use the left and right keys, to change the phase.' },
      },
    },

    // ── the directory's rows ──
    treeLabel: 'Lab contents',
    expand: 'Show more',
    back: 'back',
    backLabel: 'Back to the list',
    enter: 'go in',
    open: 'open',
    read: 'read',
    readOn: (host) => `read on ${host}`,
    kv: { stack: 'stack', status: 'status', award: 'award', topic: 'topic', log: 'log' },
    mins: (n) => `${n} min`,
    minsRead: (n) => `${n} min read`,
    out: (host) => `${host} ↗`,
    noPreview: 'nothing more to show yet.',
    home: 'home',

    // ── the reader ──
    close: 'close',
    closeLabel: 'Close the post',
    file: (section, slug) => `~/lab/${section}/${slug}.md`,
    meta: { source: 'source', file: 'file', date: 'date', read: 'read', project: 'project', log: 'log', status: 'status', tags: 'tags' },
    contents: 'contents',
    // a write-up's parts, as its sections (the React build's `md` field can name its own with ##)
    sec: { story: 'the story', what: 'what it is', highlights: 'highlights' },
    figs: 'figures',
    fig: (n) => `fig.${n}`,
    enlarge: (n) => `Enlarge figure ${n}`,
    figClose: 'Close the figure',
    figOf: (i, n) => `${i} / ${n}`,
    prev: 'prev',
    next: 'next',
    progress: 'Reading progress',
    links: 'Links',
    eof: 'EOF',

    // ── the throwaway proof readouts ──
    proof: { back: 'Back on the desk', round: 'Round trip, About dragged', trip: (a, b) => `desk → lab ${a} ms · lab → desk ${b} ms` },
  }
})()
