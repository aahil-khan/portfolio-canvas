/**
 * Copy for the content editor at `/edit`.
 *
 * Per CLAUDE.md, nothing in `components/edit/` or the editor's routes contains a sentence.
 */
export const editCopy = {
  /** Anyone who signs in with a GitHub account that isn't the owner's. */
  denied: {
    title: "You're not supposed to be here.",
    body: 'Go away. Nothing here is for you, and your sign-in has already been thrown out.',
    home: 'Back to the site',
  },
} as const
