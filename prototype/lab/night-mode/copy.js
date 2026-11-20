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
    // ── the welcome (PROPOSAL), short enough to sit beside the toy ──
    welcome: [
      'welcome to the lab.',
      "the serious end of the desk: things i've shipped, experiments still on the bench, and the write-ups about both.",
      'press ~ to go back to the canvas :)',
    ],
    // on a phone there is no ~ key: the last line says so
    welcomeTouch: '← canvas, top left, goes back :)',
    welcomeTouchDock: '← canvas, in the dock, goes back :)',

    // ── the corner: the one way back, and the mockup's switches ──
    root: '~/lab',
    entries: (n) => `${n} entries`,
    canvas: 'canvas',
    canvasKey: '~',
    canvasLabel: 'Back to the canvas',
    labLabel: 'The Lab',
    palette: 'palette',
    paletteLabel: 'Palette (mockup)',
    palettes: { white: 'white', green: 'green', amber: 'amber' },
    palShort: { white: 'w', green: 'g', amber: 'a' },
    layout: 'layout',
    layoutLabel: 'Layout (mockup)',
    layouts: { index: 'index', dock: 'dock', page: 'page' },

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

    // ── the dock ──
    dockLabel: 'Lab dock',
    dock: { work: 'work', experiments: 'experiments', writing: 'writing' },
    dockShort: { work: 'work', experiments: 'exp', writing: 'writing' },

    // ── the layouts ──
    treeLabel: 'Lab contents',
    jumpLabel: 'Sections',
    expand: 'Show more',
    preview: 'preview',
    back: 'back',
    backLabel: 'Back to the list',
    keys: [['↑↓', 'move'], ['↵', 'open'], ['1 2 3', 'sections'], ['~', 'canvas']],
    sections: {
      work: { blurb: 'things i built, start to finish. each one has the stack, how it went, and where to see it.', unit: (n) => `${n} projects` },
      experiments: { blurb: 'the bench: hardware, hacks and half-finished ideas, in the order i started them.', unit: (n) => `${n} logs` },
      writing: { blurb: 'write-ups about the projects, and a couple of longer essays, first posted on medium.', unit: (n) => `${n} posts` },
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
