import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createLab, loadSet } from '../content.ts'
import type { Entry, Lab } from '../types.ts'
import { buildPreviewData, TAG_CARD_ENTRIES } from './build.ts'
import { CARD_COPY } from './data.ts'

function build(lab: Lab, bodies: Record<string, string>) {
  const api = createLab(lab, bodies)
  return buildPreviewData({ lab, pathOf: api.pathOf, bodyOf: api.bodyOf, today: '2026-11-28' })
}

test('the demo set: every term, every used tag, and the cards’ own words', () => {
  const { lab, bodies } = loadSet('demo')
  const d = build(lab, bodies)
  assert.equal(Object.keys(d.terms).length, lab.terms.length)
  for (const k of CARD_COPY) assert.ok(d.copy[k], `copy.${k} is missing from lab.json`)
  // only the card keys: the rest of the chrome's copy stays on the pages
  assert.deepEqual(Object.keys(d.copy).sort(), [...CARD_COPY].sort())
  for (const t of Object.values(d.terms)) assert.ok(!('source' in t), 'a term’s source is never rendered, so never sent')
  for (const g of Object.values(d.tags)) assert.ok(g.entries.length >= 1 && g.entries.length <= TAG_CARD_ENTRIES)
  // a term that leads on to an entry previews that entry
  const toEntry = Object.values(d.terms).find((t) => t.more?.preview?.startsWith('entry:'))
  assert.ok(toEntry && toEntry.more!.href.startsWith('/lab/'))
  // every unfurl is a same-origin file
  for (const u of Object.values(d.unfurls)) {
    if (u.img) assert.match(u.img.src, /^\/(?!\/)/)
    if (u.icon) assert.match(u.icon, /^\/(?!\/)/)
  }
})

test('drafts never reach the cards, nor the unfurls only a draft links to', () => {
  const { lab, bodies } = loadSet('demo')
  const url = Object.keys(lab.unfurls)[0]
  const tag = lab.tags[0].id
  const draft = { ...lab.entries[0], id: 'pv-draft', slug: 'pv-draft', title: 'A draft', draft: true, published: null, tags: [tag], refs: { k: { title: 'x', site: 'y', url: 'https://only-in-a-draft.example/' } } } as Entry
  const unfurls = { ...lab.unfurls, 'https://only-in-a-draft.example/': { title: 'x', site: 'x', domain: 'only-in-a-draft.example' } }
  const d = build({ ...lab, entries: [...lab.entries, draft], unfurls }, bodies)
  assert.ok(!d.entries['pv-draft'])
  assert.ok(!Object.values(d.tags).some((g) => g.entries.some((e) => e.title === 'A draft')))
  assert.ok(!d.unfurls['https://only-in-a-draft.example/'])
  assert.ok(url in d.unfurls || !Object.keys(d.unfurls).length)
})

test('the empty Lab builds an empty card set', () => {
  const { lab, bodies } = loadSet('real')
  const d = build(lab, bodies)
  assert.deepEqual([d.terms, d.tags, d.entries, d.unfurls], [{}, {}, {}, {}])
})
