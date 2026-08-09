/**
 * Single import point for all site content.
 *
 *   import { profile, projects } from '@/content'
 *
 * Nothing in `components/` should hardcode copy — if you find yourself typing a sentence
 * into a component, it belongs in one of these files instead.
 */
export * from './types'
export { profile, headlineStats } from './profile'
export { projects } from './projects'
export { jobs, education, awards } from './experience'
export { posts } from './writing'
export { archive, ARCHIVE_KINDS } from './archive'
export type { ArchiveItem, ArchiveKind, ArchiveShot } from './archive'
export { toolGroups, toolsByName } from './stack'
export { apps, externalApps, detailPalette, dockLayout } from './apps'
export type { DockNode } from './apps'
export type { AppId } from './apps'
export { mobile } from './mobile'
