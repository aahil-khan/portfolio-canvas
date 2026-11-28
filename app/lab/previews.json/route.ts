import { bodyOf, getLab, pathOf } from '@/lib/lab/content'
import { buildPreviewData } from '@/lib/lab/preview/build'
import { bareillyToday } from '@/lib/lab/view'

/**
 * `/lab/previews.json`: what the previews' cards are made of (terms, tags, the entries' window
 * heads, unfurls), built once at `next build` from the active set and served as a static file.
 * The preview controller fetches it on a reader's first intent, never on load (plan PR 10;
 * `lib/lab/preview/data.ts`). It lives under `/lab`, so while the Lab is hidden it carries the
 * same `X-Robots-Tag: noindex` as every other Lab response (`next.config.ts`).
 */
export const dynamic = 'force-static'

export function GET() {
  return Response.json(buildPreviewData({ lab: getLab(), pathOf, bodyOf, today: bareillyToday() }))
}
