import { test } from 'node:test'
import assert from 'node:assert/strict'

import { articleLd, itemListLd, jsonLd, personLd, projectLd } from './json-ld.ts'

const origin = 'https://example.test'
const owner = { name: 'A Person', origin }
/** schema-dts types are unions too wide to index; the tests read the plain JSON shape. */
const rec = (x: object) => x as Record<string, unknown>

test('jsonLd escapes anything that could end the script, and reads back unchanged', () => {
  const nasty = 'a </script><script>alert(1)</script> <!-- & \u2028 \u2029 b'
  const out = jsonLd({ name: nasty })
  assert.ok(!out.includes('<'), 'no raw <')
  assert.ok(!out.includes('>'), 'no raw >')
  assert.ok(!out.includes('&'), 'no raw &')
  assert.ok(!/[\u2028\u2029]/.test(out), 'no raw line separators')
  assert.ok(!/<\/script/i.test(out))
  assert.deepEqual(JSON.parse(out), { name: nasty })
})

test('personLd names the owner, keeps only web profiles, and has an @id the others point at', () => {
  const p = rec(personLd({
    name: 'A Person',
    url: origin,
    jobTitle: 'Builder',
    location: 'Somewhere',
    sameAs: ['https://github.com/a', 'mailto:a@example.test', 'https://linkedin.com/in/a'],
  }))
  assert.equal(p['@type'], 'Person')
  assert.equal(p['@id'], `${origin}/#person`)
  assert.deepEqual(p.sameAs, ['https://github.com/a', 'https://linkedin.com/in/a'])
  assert.deepEqual(p.homeLocation, { '@type': 'Place', name: 'Somewhere' })

  const bare = personLd({ name: 'A Person', url: origin, sameAs: ['mailto:a@example.test'] })
  assert.ok(!('sameAs' in bare) && !('jobTitle' in bare) && !('homeLocation' in bare), 'empty fields are left out')
})

test('projectLd and articleLd credit the owner by @id', () => {
  const w = rec(projectLd({ name: 'P', tagline: 't', lede: 'l', year: 2025, stack: ['A', 'B'], url: `${origin}/work/p`, author: owner }))
  assert.equal(w['@type'], 'CreativeWork')
  assert.equal(w.keywords, 'A, B')
  assert.deepEqual(w.author, { '@type': 'Person', '@id': `${origin}/#person`, name: 'A Person', url: origin })
  assert.ok(!('award' in w) && !('image' in w))

  const a = rec(articleLd({ title: 'T', url: `${origin}/x`, published: '2026-11-01', author: owner }))
  assert.equal(a['@type'], 'Article')
  assert.equal(a.dateModified, '2026-11-01', 'modified falls back to published')
  assert.equal(rec(articleLd({ title: 'T', url: `${origin}/x`, published: '2026-11-01', updated: '2026-11-20', author: owner })).dateModified, '2026-11-20')
})

test('itemListLd numbers from 1, in the given order', () => {
  const l = rec(itemListLd([{ name: 'a', url: `${origin}/a` }, { name: 'b', url: `${origin}/b` }]))
  assert.deepEqual(
    (l.itemListElement as { position: number; name: string }[]).map((x) => [x.position, x.name]),
    [[1, 'a'], [2, 'b']],
  )
})
