import { notFound } from 'next/navigation'

import { EntryPage } from '@/components/lab/entry/entry'
import { entryByPath, routes } from '@/lib/lab/content'
import { labEntryMetadata, labJsonLd, labMetadata } from '@/lib/lab/seo'
import { jsonLd } from '@/lib/seo/json-ld'

/**
 * A child entry: a chapter under its series, a note under its study (API.md §3),
 * `/lab/<section>/<parent>/<slug>`. The parent's segment is named `entry` because Next allows one
 * name per dynamic segment at a level, and `[section]/[entry]` is the top-level entry's route.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return routes()
    .filter((r) => r.kind === 'entry')
    .map((r) => r.path.split('/').slice(2))
    .filter((s) => s.length === 3)
    .map(([section, entry, child]) => ({ section, entry, child }))
}

type Params = Promise<{ section: string; entry: string; child: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { section, entry, child } = await params
  const e = entryByPath([section, entry, child])
  if (!e) return labMetadata()
  return labEntryMetadata(e)
}

export default async function Page({ params }: { params: Params }) {
  const { section, entry, child } = await params
  const e = entryByPath([section, entry, child])
  if (!e) notFound()
  return (
    <>
      {/* an Article and its breadcrumbs; jsonLd() escapes <, so no field can close the script */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(labJsonLd(e)) }} />
      <EntryPage entry={e} />
    </>
  )
}
