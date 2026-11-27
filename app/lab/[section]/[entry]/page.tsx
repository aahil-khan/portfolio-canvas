import { notFound } from 'next/navigation'

import { EntryPage } from '@/components/lab/entry/entry'
import { entryByPath, pathOf, routes } from '@/lib/lab/content'
import { plainInline } from '@/lib/lab/text'
import { labMetadata } from '@/lib/lab/seo'

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
  return labMetadata({ title: e.title, description: plainInline(e.lede ?? ('opening' in e ? e.opening : '')), path: pathOf(e) })
}

export default async function Page({ params }: { params: Params }) {
  const { section, entry } = await params
  const e = entryByPath([section, entry])
  if (!e) notFound()
  return <EntryPage entry={e} />
}
