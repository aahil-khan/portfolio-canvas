import data from './data/archive.json' with { type: 'json' }

/*
 * The data lives in `content/data/archive.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
 */

/**
 * The archive — a scrapbook.
 *
 * Deliberately the loosest content type on the site: anything you want to keep. Things you
 * built, things you're watching, links you found funny, a passing thought. Every field except
 * `kind`, `title` and `when` is optional, so an entry can be one line of text or a linked image
 * with a note — and the card renders whatever is there without you configuring anything.
 *
 * Order in the data is the order shown, so the newest thing goes first.
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

export const archive: readonly ArchiveItem[] = data as ArchiveItem[]
