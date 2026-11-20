/*
 * prototype/lab/night-mode/copy.js: every word the Lab's own UI says, in one object.
 *
 * Nothing in menu.js, intro.js, reader.js or night.js types a sentence: they read NIGHT.copy.
 * In the React build this moves to content/ (content/lab.ts, or a `lab` block in site.json if
 * the owner wants to edit it at /edit), exactly as CLAUDE.md asks of every string.
 *
 * PROPOSAL FOR AAHIL: the welcome lines are a draft, in the voice of content/data/profile.json
 * (lower case, plain, a smiley at the end). Rewrite them freely; the intro types whatever is here.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  NIGHT.copy = {
    // ── the welcome (PROPOSAL) ──
    welcome: [
      'welcome to the lab.',
      "this is the serious end of the desk: the things i've shipped, the experiments still on the bench, and the write-ups about both.",
      'pick something on the left, or press ~ to go back to the canvas :)',
    ],
    // on a phone there is no "left" and no ~ key: the last line says so
    welcomeTouch: 'tap anything below, or ← canvas at the top to go back :)',
    skip: 'press any key to skip',
    skipTouch: 'tap to skip',

    // ── the top bar ──
    user: 'aahil@lab',
    root: '~/lab',
    entries: (n) => `${n} entries`,
    canvas: 'canvas',
    canvasKey: '~',
    canvasLabel: 'Back to the canvas',
    barLabel: 'The Lab',
    palette: 'Palette (mockup)',
    palettes: { white: 'white', green: 'green', amber: 'amber' },
    palShort: { white: 'w', green: 'g', amber: 'a' },

    // ── the dock ──
    dockLabel: 'Lab dock',
    dock: { work: 'work', experiments: 'experiments', writing: 'writing' },
    dockShort: { work: 'work', experiments: 'exp', writing: 'writing' },

    // ── the menu ──
    treeLabel: 'Lab contents',
    preview: 'preview',
    back: 'back',
    backLabel: 'Back to the list',
    keys: [['↑↓', 'move'], ['↵', 'open'], ['esc', 'back'], ['~', 'canvas']],
    keysMore: [['1 2 3', 'sections']],
    keysTouch: [['tap', 'open'], ['← back', 'list']],
    sections: {
      work: { blurb: 'things i built, start to finish. each one has the stack, how it went, and where to see it.', unit: (n) => `${n} projects` },
      experiments: { blurb: 'the bench: hardware, hacks and half-finished ideas, in the order i started them.', unit: (n) => `${n} logs` },
      writing: { blurb: 'write-ups about the projects, and a couple of essays that live on medium.', unit: (n) => `${n} posts` },
    },
    enter: 'go in',
    open: 'open',
    read: 'read',
    readOn: (host) => `read on ${host}`,
    kv: { stack: 'stack', status: 'status', award: 'award', topic: 'topic', log: 'log' },
    mins: (n) => `${n} min`,
    minsRead: (n) => `${n} min read`,
    out: (host) => `${host} ↗`,
    noPreview: 'nothing more to show yet.',

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
    proof: { back: 'Back on the desk', round: 'Round trip, About dragged' },
  }
})()
