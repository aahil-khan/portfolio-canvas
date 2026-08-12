/**
 * Copy for the scrolling front page at `/`.
 *
 * Only what this surface needs and no other has. Every fact — roles, projects, tools, awards —
 * still comes from `profile.ts`, `experience.ts`, `projects.ts` and `stack.ts`, so the front
 * page and the canvas can never disagree about anything true. What lives here is the framing
 * around those facts: section headings, button labels, and the two paragraphs that only exist
 * because this page has room for them.
 *
 * Per CLAUDE.md, nothing in `components/site/` contains a sentence. If a component needs words,
 * they belong in this file.
 */

export const site = {
  /** Under the top bar, beside the name. Appended to `profile.location`. */
  openTo: '',

  /**
   * The hero line. `lead` and `tail` sit either side of `emphasis`, which is the only part set
   * in bold — it is split into words and revealed one at a time, so keep it short enough that
   * the stagger reads as a flourish rather than a wait.
   */
  headline: {
    lead: 'Full-stack engineer building',
    emphasis: 'AI retrieval and agent systems',
    tail: 'that hold up in production.',
  },

  /** Hero buttons. The second is the only prominent way into the canvas from the top of the page. */
  seeWork: 'See the work',
  /*
   * The hero's second action jumps DOWN to the closer, not out to `/canvas`. "Interactive desk"
   * meant nothing to someone who has not seen it yet; sending them to the paragraph that explains
   * what it actually is converts far better than dropping them into an infinite canvas cold.
   */
  toDesk: 'There’s a far more fun version of this',
  /** Rides on that link. The desk is the good bit; the hero should say so. */
  toDeskBadge: 'highly recommended',

  nav: {
    about: 'About',
    skills: 'Skills',
    experience: 'Experience',
    work: 'Work',
    contact: 'Contact',
    desk: 'The desk',
    /** Screen-reader name for the phone-only section nav. */
    sectionsLabel: 'Sections',
    /** Screen-reader name for the mark that returns to the top. */
    topLabel: 'Top of page',
    /** The drawer toggle. Named for what pressing it does, not for its current state. */
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    /** The floating control that appears once you are a long way down. */
    backToTop: 'Back to top',
  },

  resume: { short: 'Résumé', long: ' PDF ↓' },

  /**
   * The light/dark button in the bar. Each label names what pressing it *does*, which is what a
   * screen reader should announce — not which mode is currently showing.
   */
  theme: {
    toDark: 'Switch to dark',
    toLight: 'Switch to light',
  },

  about: {
    eyebrow: 'About',
    title: "Hi there!",
    /** Shown in the portrait frame until a real photo exists. */
    portraitPending: 'Portrait goes here',
    portraitAlt: 'Aahil Khan',
  },

  /**
   * The portrait's easter egg. Ten taps on the photo asks a question; one particular answer
   * flips the card over.
   *
   * Kept here rather than in `eggs.ts` — that file is the canvas's terminal and deep-space
   * secrets, and this one belongs to the front page.
   */
  portraitEgg: {
    taps: 10,
    question: "What's 2 + 2?",
    inputLabel: 'Your answer',
    submit: 'Answer',
    wrong: 'Nope. Try again.',
    dismiss: 'Never mind',
    /**
     * Accepted answers, as ordinary spellings.
     *
     * Matching is fuzzy on purpose — the component lowercases, drops anything that is not a
     * letter, and collapses repeated letters before comparing, on both sides. So these two
     * entries between them accept aloo, aaloo, alu, aalu, allu, aalloo, "ALOO!", and so on:
     * everything a person might reasonably type for आलू. Add a spelling here only if it
     * collapses to something genuinely different.
     */
    answers: ['aloo', 'aalu'],
    caption: 'sher bacha',
    hiddenAlt: 'Aahil Khan, off duty',
    flipBack: 'Flip back',
  },

  skills: {
    eyebrow: 'Toolbox',
    title: 'What I build with',
  },

  experience: {
    eyebrow: 'Experience',
    title: "Where I've been",
    /** Screen-reader name for the sticky role index. */
    indexLabel: 'Roles',
    /** Appended to the toggle's accessible name on phones, where the cards collapse. */
    expand: 'Show details',
    collapse: 'Hide details',
  },

  work: {
    eyebrow: 'Selected work',
    title: 'Four things worth opening',
    lede: 'Each of these has a full write-up — highlights, stack, screenshots and links.',
    readMore: 'Read the write-up',
    /** Frame label for a project with no screenshot yet. */
    shotPending: 'No screenshot yet',
  },

  credentials: {
    eyebrow: 'The rest of it',
    title: 'Education, awards, writing',
    education: 'Education',
    awards: 'Awards',
    writing: 'Writing',
  },

  closer: {
    eyebrow: 'Contact',
    title: "Let's build\nsomething.",
    body: 'Open for cool builds and interesting problems. The fastest way to reach me is email, I answer all of them.',
    plainVersion: 'Plain text version',
  },

  /**
   * The canvas, sold rather than disclaimed.
   *
   * This used to hedge — "it wants a pointer and room to move" — which read as a warning label on
   * the most interesting thing here. The desktop caveat is still there because it is true, but it
   * comes last and in his own voice, not as a reason to skip it.
   */
  door: {
    title: 'Oh, and this page is the boring half.',
    body: 'The main portfolio is finished. This one is a little less serious. There\'s a canvas, beautiful cards, a few games, lofi, and probably more than there needs to be.',
    scores: "Some of it keeps score. Try not to take that personally.",
    hidden: "There are things here that aren't meant to be obvious. If you find one, you find one.",
    action: 'Open the canvas',
    /** Last, and small — a nudge, not a barrier. */
    note: 'Only Desktops supported. This place has a lot going on.',
  },

  footer: {
    note: 'Thanks for scrolling all the way down :)',
  },

  /**
   * Copy the canvas uses to point back here. It lives with the front page's copy because it
   * names this surface, not the desk.
   */
  desk: {
    exit: 'The site',
    /** Suffix for the canvas's tab title, so the two surfaces are tellable apart in a tab strip. */
    tabSuffix: 'the canvas',
  },

  /** `/work` and `/work/[slug]` — the flat, linkable version of each project. */
  workPage: {
    allWork: 'All work',
    home: 'Home',
    indexTitle: 'Work',
    indexLede:
      'Every project, as its own page — linkable, indexable, and readable without JavaScript.',
    whatItDoes: 'What it does',
    builtWith: 'Built with',
    shots: 'Screenshots',
    /** Foot of a project page, back to the section it came from. */
    backToWork: 'Back to all work',
  },
} as const
