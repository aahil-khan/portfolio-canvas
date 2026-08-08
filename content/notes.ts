/**
 * The notes wall — a public guestbook.
 *
 * Copy only. See CLAUDE.md: nothing in `components/` should contain a sentence.
 */

export const notesCopy = {
  lede: 'Leave something behind.',
  placeholder: 'Say something…',
  namePlaceholder: 'Name (optional)',
  submit: 'Pin it',
  submitting: 'Pinning…',
  empty: 'Nothing here yet',
  emptyHint: 'Be the first to pin a note.',
  loading: 'Reading the wall…',
  error: "That didn't post. Try again in a moment.",
  rateLimited: 'Easy — give it a minute before the next one.',
  anon: 'anon',
} as const

/** Matches the server-side cap in app/api/notes/route.ts. Both are enforced; this one is UI. */
export const NOTE_MAX = 180
export const NAME_MAX = 24
