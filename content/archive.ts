/**
 * The archive — a scrapbook.
 *
 * Deliberately the loosest content type on the site: anything you want to keep. Things you
 * built, things you're watching, links you found funny, a passing thought. Every field except
 * `kind`, `title` and `when` is optional, so an entry can be one line of text or a linked image
 * with a note — and the card renders whatever is there without you configuring anything.
 *
 * To add something: paste a block at the TOP of `archive`. Order in the file is the order shown,
 * so the newest thing goes first — no dates to sort, no ids to keep straight.
 *
 * `pinned: true` lifts an entry into "Right now" at the top of the card. That's the spot for
 * what you're currently watching or reading; unpin it when you move on.
 */

export type ArchiveKind =
  | 'built'
  | 'watching'
  | 'reading'
  | 'listening'
  | 'tinkering'
  | 'found'
  | 'random'
  | 'note'

/**
 * One picture in an archive entry: a path, or a path with a line under it.
 *
 * The bare string stays legal so the common case reads as a list of files. Reach for the object
 * form only where a picture needs saying something about — a caption on every one of them turns
 * a feed into a slideshow nobody asked for.
 */
export type ArchiveShot = string | { src: string; caption?: string }

export interface ArchiveItem {
  /** Unique and url-safe. Used as the card id when an entry opens on its own. */
  id: string
  kind: ArchiveKind
  title: string
  /** Free text. As long or short as you like — this is the "why I kept it" line. */
  note?: string
  /** Makes the title a link. */
  href?: string
  /** A file in `public/archive/`. Shown at its own shape, never cropped. */
  image?: string
  /** A line under `image`. For several pictures, caption them individually in `images`. */
  caption?: string
  /**
   * Several files, paged with the same carousel the project cards use. Wins over `image`.
   *
   * The frame takes the FIRST one's shape and the rest are drawn `contain` inside it — order is
   * yours to choose, and nothing gets cropped to match its neighbours.
   */
  images?: readonly ArchiveShot[]
  /**
   * Lets the picture be opened in the big viewer, the way a project screenshot can.
   *
   * Off by default, and deliberately per-entry. Most things here are an aside next to a
   * sentence and are not worth a viewer that covers the screen; a few are the whole point of
   * the entry. Only the second kind should offer it.
   */
  fullscreen?: boolean
  /** Free text, not a date type on purpose: 'Aug 2026', 'last week', 'ongoing'. */
  when: string
  /** Small grey line: 'S2E4', 'dir. Denis Villeneuve', '412 pages'. */
  meta?: string
  /** Lifts this into the "Right now" group. */
  pinned?: boolean
}

/** Label and colour per kind. Add a kind here and it works everywhere. */
export const ARCHIVE_KINDS: Record<ArchiveKind, { label: string; colour: string }> = {
  built: { label: 'Built', colour: '#A8E6A1' },
  watching: { label: 'Watching', colour: '#FFB4A2' },
  reading: { label: 'Reading', colour: '#A9D6FF' },
  listening: { label: 'Listening', colour: '#D9C2FF' },
  tinkering: { label: 'tinkering', colour: '#FFE0A3' },
  found: { label: 'Found', colour: '#FFC2E2' },
  random: { label: 'Random', colour: '#A9D6FF' }, //blue color
  note: { label: 'Note', colour: '#E8E6DE' },
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * REPLACE THESE. They exist to show the shapes — one of each kind, with and
 * without notes, links and images. Delete any you don't want; the card adapts.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const archive: readonly ArchiveItem[] = [
  {
    id: 'this-site',
    kind: 'built',
    title: 'This site',
    note: 'Built it because a scrolling résumé felt like everyone else’s.',
    when: 'Aug 2026',
    meta: 'Next.js · zero runtime dependencies',
  },
  {
    id: 'sop-opera',
    kind: 'built',
    title: 'SOP Opera',
    meta: 'Built for Economic Times 2.0 hackathon',
    note: 'Genuinely the most planning I\'ve ever done for a hackathon project, I dug through existing industrial solutions of the problem statement, downloaded their demo versions to take inspo (they think I\'m a potential customer and send me emails lol), then sat with a pen and paper to think of the best way to build the architecture, used an actual steel plant floor plan in the project and built everything alone in like 3 days. Still waiting on the results so fingers crossed (>_<)',
    when: 'July 2026'
  },
  {
    id: 'cursor-search-providor',
    kind: 'built',
    title: 'Cursor Search Provider',
    meta: 'My very first Gnome Extension!',
    href:'https://extensions.gnome.org/extension/10553/cursor-search-provider',
    note: 'nothing crazy, forked a repo called vscode-search-provider and made it compatible with cursor, it has 12 downloads yay!',
    when: 'July 2026'
  },
  {
    id: 'portana',
    kind: 'built',
    title: 'Portana',
    note: 'The version of this site before this one: a conversational portfolio you interrogated instead of scrolled, with n8n workflows auto-syncing content from GitHub and LinkedIn. Had lots of issues I didn\'t wanna fix, Retired, fondly.',
    when: '2025',
    meta: 'Next.js · Fastify · Qdrant · Docker',
  },
  {
    id: 'modern-family',
    kind: 'watching',
    title: 'Modern Family',
    note: 'Binge watching it lately, pretty funny show, highly recommend.',
    when: 'right now',
    image: "/archive/modern-family.webp",
    meta: 'S1 E20',
    pinned: true,
  },
  {
    id: 'pretext',
    kind: 'found',
    title: 'Pretext',
    note: 'This repo redefines how text is rendered on webpages, its pretty cool, been wanting to check it out and use it somewhere, haven\'t been able to yet.',
    href: 'https://github.com/chenglou/pretext',
    when: 'Jul 2026',
  },
  {
    id: 'chinese-watch',
    kind: 'tinkering',
    title: 'Reverse Engineering a cheap Chinese watch',
    note: 'My dad got us these "smartwatches", they have a whole GSIM module, bluetooth connectivity, touchscreen and even a working camera. I\'m trying to reverse engineer them to dump the firmware and run my own custom software (doom ofc) on it, currently figured out which test pads are +ve, -ve and gnd, need a USB-UART adapter, USB logic analyzer, and maybe a CH341A programmer + SOIC-8 clip to continue, will pick this up when I get some free time (and the money to buy these).',
    images: [{src: '/archive/watch/watch-front.jpeg', caption: 'front of the motherboard'}, {src:'/archive/watch/watch-back.jpeg', caption:'backside, see the round areas? they\'re the test pads'} , {src:'/archive/watch/watch-screen.jpeg', caption: 'watch developer menu'}],
    when: 'July 2026'
  },
  {
    id: 'usb-camera',
    kind: 'tinkering',
    title: 'Turing Laptop camera into a USB Webcam',
    note: 'Had an old Samsung N150 Plus lying around, took out the camera and connected the wires to a standard usb, worked on the first try and has a surprisingly good quality feed. Going to use it for something cool soon.',
    image: '/archive/usb-cam/usb-camera.jpeg',
    fullscreen: true,
    when: 'June 2026'
  },
  {
    id: 'brookie',
    kind: 'random',
    title: 'Baked a Brookie!',
    meta: 'Brookie = Brownie + Cookie',
    note: 'Can you believe this was my first attempt at baking anything ever? It was crazy good, turns out baking isn\'t hard at all, you guys are just noobs.',
    image: '/archive/brookie/brookie.jpeg',
    fullscreen: true,
    when: 'May 2026'
  },
  {
    id: 'landscape',
    kind: 'random',
    title: 'A cool picture I took',
    image: '/archive/landscape/landscape-1.jpeg',
    caption: 'Puranpur, India',
    fullscreen: true,
    when: 'June 2026'
  }
]
