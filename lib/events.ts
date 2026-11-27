/**
 * Analytics events, through the site's own counter. Contract: `content/lab/API.md` §9.
 *
 * PR 1 ships this as a typed no-op so every lane can call `track()` from the start; PR 4 fills
 * in the body (one admission gate shared with the visit counter, a batch queue, `sendBeacon` on
 * `pagehide`, `/api/events`) without changing a single call site.
 *
 * The rules PR 4 keeps: no cookies, no identifiers, no third parties. Every name is on the list
 * below, and every value is a bucket from a closed set, never free text a reader typed. `path` is
 * the page's own pathname, which is already public.
 */

export const EVENT_NAMES = [
  'lab_view',
  'read_depth',
  'lead_use',
  'preview_open',
  'look_switch',
  'name_say',
  'player_start',
  'player_minutes',
  'share',
  'md_view',
  'agents_view',
  'back_to_desk',
] as const
export type EventName = (typeof EVENT_NAMES)[number]

/** Where a Lab visit came from, by referrer. */
export const SOURCES = ['linkedin', 'x', 'desk', 'site', 'direct'] as const
export const READ_DEPTHS = [25, 50, 75, 100] as const
export const MINUTE_BUCKETS = [1, 5, 15, 30, 60] as const
export const PAGE_KINDS = ['home', 'section', 'index', 'tag', 'glossary', 'study', 'series', 'chapter', 'note', 'build', 'experiment', 'essay'] as const

export interface EventProps {
  lab_view: { path: string; kind: (typeof PAGE_KINDS)[number]; source: (typeof SOURCES)[number] }
  read_depth: { path: string; depth: (typeof READ_DEPTHS)[number] }
  lead_use: { path: string; lead: string }
  preview_open: { via: 'hover' | 'focus' | 'tap' | 'click'; target: 'entry' | 'term' | 'tag' | 'ref' | 'out' }
  look_switch: { look: 'paper' | 'premium'; mode?: 'day' | 'night' }
  name_say: Record<string, never>
  player_start: { source: 'station' | 'noise' | 'track' }
  player_minutes: { minutes: (typeof MINUTE_BUCKETS)[number] }
  share: { path: string; via: 'native' | 'copy' | 'x' | 'linkedin' }
  md_view: { path: string }
  agents_view: Record<string, never>
  back_to_desk: Record<string, never>
}

/** Records one event. A no-op until PR 4; safe to call anywhere, on the server too. */
export function track<N extends EventName>(name: N, props: EventProps[N]): void {
  void name
  void props
}
