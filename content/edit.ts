/**
 * Copy for the content editor at `/edit`.
 *
 * Per CLAUDE.md, nothing in `components/edit/` or the editor's routes contains a sentence. Field
 * labels and help live with the fields, in `content/schema/`.
 */
export const editCopy = {
  title: 'Content editor',
  viewSite: 'View site ↗',
  signedInAs: 'Signed in as',
  signOut: 'Sign out',
  devMode: 'Dev mode — saves go to an in-memory copy and vanish on restart.',
  sectionsLabel: 'Sections',
  history: 'History',
  unsaved: 'Unsaved changes',
  loading: 'Loading your content from GitHub…',
  loadFailed: 'Could not load the content.',
  retry: 'Try again',

  signIn: {
    title: 'Content editor',
    body: 'Sign in with GitHub to edit the site. Only the owner gets in.',
    action: 'Sign in with GitHub',
  },

  /** Anyone who signs in with a GitHub account that isn't the owner's. */
  denied: {
    title: "You're not supposed to be here.",
    body: 'Go away. Nothing here is for you, and your sign-in has already been thrown out.',
    home: 'Back to the site',
  },

  list: {
    add: 'Add',
    up: 'Move up',
    down: 'Move down',
    duplicate: 'Duplicate',
    remove: 'Remove',
    expand: 'Open',
    collapse: 'Close',
    confirmRemove: 'Remove',
    keep: 'Keep it',
    untitled: 'Untitled',
    empty: 'Nothing here yet.',
  },

  picker: {
    addTool: '+ Add tool…',
    choose: 'Choose a file…',
    none: 'None',
    upload: '+ Upload',
    uploading: 'Uploading…',
    imageHint: 'PNG, JPEG or WebP, up to 5 MB. Uploading commits the file right away.',
    pdfHint: 'PDF, up to 10 MB. Replaces the current one.',
    caption: 'Caption',
  },

  save: {
    message: 'What changed? (optional)',
    action: 'Save',
    saving: 'Saving…',
    issues: (n: number) => (n === 1 ? '1 thing to fix' : `${n} things to fix`),
    nothing: 'No changes',
    reload: 'Reload',
    leave: 'You have unsaved changes. Leave anyway?',
  },

  status: {
    lastSave: 'Last save:',
    saved: 'Saved',
    building: 'Building',
    live: 'Live',
    failed: 'Still not live after 10 minutes — check the deploy log on the server.',
    dev: 'Saved (dev mode, nothing deploys)',
  },

  historyPage: {
    title: 'History',
    lede: 'The last 20 changes to content and uploads. Revert undoes one change with a new commit.',
    revert: 'Revert',
    confirm: 'Undo this change?',
    reverted: 'Reverted. It will be live in a few minutes.',
    empty: 'No changes yet.',
  },
} as const
