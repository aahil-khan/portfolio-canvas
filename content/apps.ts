import type { AppDef } from './types'

/**
 * The dock, in order. This is also the card registry — each entry defines the colour and
 * geometry of the card it opens.
 *
 * To reorder the dock, reorder this array. To add a card you also need a renderer in
 * `components/apps/`, keyed by the same `id`.
 *
 * Heights are deliberately absent: they're measured from real content at runtime, because
 * every hand-picked height in the prototype turned out to be wrong (one by 243px).
 */
export const apps: readonly AppDef[] = [
  { id: 'about', label: 'About', icon: 'about', colour: '#FACC00', tint: '#FEF3BF', width: 520, rotate: -1.0 },
  { id: 'work', label: 'Work', icon: 'work', colour: '#A8E6A1', tint: '#E4F7E1', width: 600, rotate: 0.7 },
  { id: 'experience', label: 'Experience', icon: 'experience', colour: '#FFB4A2', tint: '#FFE6DF', width: 560, rotate: -1.2 },
  { id: 'stack', label: 'Stack', icon: 'stack', colour: '#A9D6FF', tint: '#E3F1FF', width: 650, rotate: 0.3 },
  { id: 'writing', label: 'Writing', icon: 'writing', colour: '#D9C2FF', tint: '#F0E8FF', width: 520, rotate: -0.8 },
  { id: 'archive', label: 'Archive', icon: 'archive', colour: '#FFD9A8', tint: '#FFF0DC', width: 560, rotate: 0.8 },
  { id: 'resume', label: 'Résumé', icon: 'resume', colour: '#FFE0A3', tint: '#FFF3DC', width: 470, rotate: 0.9 },
  { id: 'themes', label: 'Themes', icon: 'themes', colour: '#FFC2E2', tint: '#FFE7F3', width: 600, rotate: -0.4 },
  { id: 'contact', label: 'Contact', icon: 'contact', colour: '#B8F2E6', tint: '#E6FBF7', width: 480, rotate: 0.6 },
]

/** Rendered after a divider at the end of the dock. These leave the site. */
export const externalApps: readonly AppDef[] = [
  {
    id: 'github', label: 'GitHub', icon: 'github', colour: '#E8E6DE', tint: '#F4F2EA',
    width: 0, rotate: 0, href: 'https://github.com/aahil-khan',
  },
  {
    id: 'linkedin', label: 'LinkedIn', icon: 'linkedin', colour: '#E8E6DE', tint: '#F4F2EA',
    width: 0, rotate: 0, href: 'https://www.linkedin.com/in/aahil-khan77/',
  },
]

/** Colours for cards that are spawned rather than docked (project/job details, screenshots). */
export const detailPalette = {
  project: { colour: '#A8E6A1', tint: '#E4F7E1' },
  job: { colour: '#FFB4A2', tint: '#FFE6DF' },
} as const

/** Card ids are also used for spawned cards (`project:slug`, `shot:slug`), so this stays open. */
export type AppId = string
