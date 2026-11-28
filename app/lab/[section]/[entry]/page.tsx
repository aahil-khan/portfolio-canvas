import { notFound } from 'next/navigation'

import { EntryPage } from '@/components/lab/entry/entry'
import { entryByPath, routes } from '@/lib/lab/content'
import { labEntryMetadata, labJsonLd, labMetadata } from '@/lib/lab/seo'
import { jsonLd } from '@/lib/seo/json-ld'

/** A top-level entry: `/lab/<section>/<slug>` (API.md §3). Every one is generated at build. */
export const dynamicParams = false

export function generateStaticParams() {
  return routes()
    .filter((r) => r.kind === 'entry')
    .map((r) => r.path.split('/').slice(2))
    .filter((s) => s.length === 2)
    .map(([section, entry]) => ({ section, entry }))
}

type Params = Promise<{ section: string; entry: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { section, entry } = await params
  const e = entryByPath([section, entry])
  if (!e) return labMetadata()
  return labEntryMetadata(e)
}

export default async function Page({ params }: { params: Params }) {
  const { section, entry } = await params
  const e = entryByPath([section, entry])
  if (!e) notFound()
  return (
    <>
      {/* an Article and its breadcrumbs; jsonLd() escapes <, so no field can close the script */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(labJsonLd(e)) }} />
      <EntryPage entry={e} />
    </>
  )
}
