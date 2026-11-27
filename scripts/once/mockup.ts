/**
 * Reads the approved mockup's content (`prototype/lab-v2b/content/*.js`) without a browser: the
 * same scripts, in index.html's order, in one sandbox. Shared by the one-off converter
 * (`lab-from-mockup.ts`) and the demo set's tests, which compare the converted set with the
 * mockup itself, not with a snapshot of it. Deleted with the converter in PR 14.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

import { DEMO_CONTENT } from '../../lib/lab/visibility.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = Record<string, any>

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const MOCK = path.join(ROOT, 'prototype/lab-v2b')

export function loadMockup(withFixture = false): Any {
  const html = fs.readFileSync(path.join(MOCK, 'index.html'), 'utf8')
  const files = [...html.matchAll(/<script src="(content\/[^"]+)"( data-fixture)?><\/script>/g)]
    .filter((m) => withFixture || !m[2])
    .map((m) => m[1])
  const sandbox: Any = { window: {} }
  for (const f of files) vm.runInNewContext(fs.readFileSync(path.join(MOCK, f), 'utf8'), sandbox, { filename: f })
  return sandbox.window.Lab
}

/**
 * Three of the mockup's ids are words the rest of the site already uses as names: a section that
 * shares the `Lab` type's own `studies` field and `content/data/studies/`, one that shares the
 * canvas's Writing app, and a tag that shares `components/desktop/`. Check-lab rule 4 refuses any
 * code outside the demo set that names a demo id, quoted or between slashes, so the demo set takes
 * other ids for them. Titles are unchanged. The map lives in the demo directory, the one place
 * that may name a demo id, and the real set is free to use the words.
 */
export const DEMO_RENAMES: { sections: Record<string, string>; tags: Record<string, string> } = JSON.parse(
  fs.readFileSync(path.join(ROOT, DEMO_CONTENT, 'renames.json'), 'utf8'),
)

/** A mockup `/lab/...` path with the renames applied: its first segment, and a tag's id. */
export function renamedPath(p: string): string {
  const seg = p.split('/')
  if (seg[2] === 'tags' && seg[3]) seg[3] = DEMO_RENAMES.tags[seg[3]] ?? seg[3]
  else if (seg[2]) seg[2] = DEMO_RENAMES.sections[seg[2]] ?? seg[2]
  return seg.join('/')
}

/** `{ text, proposal | source }` → its text; anything else as it is. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const txt = (v: unknown): any => (v && typeof v === 'object' && 'text' in (v as Any) ? (v as Any).text : v)

/** The words a mockup body shows, block by block, inline markup and all. */
export function mockupBodyText(blocks: Any[]): string[] {
  return blocks.flatMap((b): string[] => {
    if (b.h2) return [txt(b.h2)]
    if (b.h3) return [txt(b.h3)]
    if (b.p) return [txt(b.p)]
    if (b.list) return b.list.map(txt)
    if (b.quote) return [txt(b.quote)]
    if (b.code) return [b.code]
    if (b.side) return [b.sideHead ? txt(b.sideHead) : null, txt(b.side)].filter(Boolean)
    if (b.img) return b.img.caption ? [txt(b.img.caption)] : []
    return []
  })
}

/** The mockup's `Lab.routes()` as `/lab` paths: the same rules on the same data (lab.js, top). */
export function mockupRoutes(L: Any): string[] {
  const D = L.data
  const bodies = L.bodies as Any
  const entries: Any[] = D.entries.map((e: Any) => ({ ...e, ...(bodies[e.id]?.meta?.published ? { draft: false } : {}) }))
  const byId = new Map(entries.map((e) => [e.id, e]))
  const pub = entries.filter((e) => !e.draft)
  const pathOf = (e: Any) => {
    const parent: Any | undefined = e.parent && byId.get(e.parent)
    return '/' + e.section + '/' + (parent ? parent.slug + '/' : '') + e.slug
  }
  const tags = [...new Set(pub.flatMap((e) => (e.tags ?? []) as string[]))].sort()
  return [
    '/lab',
    ...D.sections.filter((s: Any) => pub.some((e) => e.section === s.id)).map((s: Any) => `/lab/${s.id}`),
    '/lab/index',
    '/lab/glossary',
    ...tags.map((t) => `/lab/tags/${t}`),
    ...pub.map((e) => '/lab' + pathOf(e)),
  ]
}
