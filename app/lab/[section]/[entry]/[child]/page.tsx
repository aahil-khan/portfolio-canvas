import { notFound } from 'next/navigation'

import { EntryPage } from '@/components/lab/entry/entry'
import { entryByPath, pathOf, routes } from '@/lib/lab/content'
import { plainInline } from '@/lib/lab/text'
import { labMetadata } from '@/lib/lab/seo'

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
  return labMetadata({ title: e.title, description: plainInline(e.lede ?? ('keyLine' in e ? (e.keyLine ?? '') : '')), path: pathOf(e) })
}

export default async function Page({ params }: { params: Params }) {
  const { section, entry, child } = await params
  const e = entryByPath([section, entry, child])
  if (!e) notFound()
  return <EntryPage entry={e} />
}
