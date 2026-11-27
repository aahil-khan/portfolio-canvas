/**
 * The demo set's bodies say exactly what the approved mockup's said (plan PR 2, Done when): for
 * every mockup body, the converted Markdown's plain text equals the mockup's, block by block,
 * after whitespace is normalised. The expected side is read from the mockup itself
 * (`prototype/lab-v2b/content`, through `scripts/once/mockup.ts`), not from a snapshot.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { inChild } from '../../../lib/lab/markdown/child.ts'
import { loadMockup, mockupBodyText, type Any } from '../../../scripts/once/mockup.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** The mockup's own plain(): markup out, words in (prototype/lab-v2b/instruments/registry.js). */
const mockPlain = (t: string) =>
  String(t ?? '')
    .replace(/\[\[(?:t:|tag:)?[\w-]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\^[\w-]+\]/g, '')
    .replace(/==|`/g, '')
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

test('every converted body reads exactly as the mockup’s', () => {
  const L = loadMockup()
  const set = JSON.parse(readFileSync(path.join(HERE, 'lab.json'), 'utf8')) as { entries: Any[] }
  const byId = new Map(set.entries.map((e) => [e.id as string, e]))
  const fileOf = (e: Any) => {
    const parent = e.parent ? byId.get(e.parent) : undefined
    return path.join(HERE, e.section, ...(parent ? [parent.slug] : []), `${e.slug}.md`)
  }

  const expected = Object.entries(L.bodies as Any)
    .filter(([, b]) => b.blocks?.length)
    .map(([id, b]) => ({ id, blocks: mockupBodyText(b.blocks).map((t) => norm(mockPlain(t))) }))
  assert.ok(expected.length >= 17, `only ${expected.length} mockup bodies found`)

  const files: Record<string, string> = {}
  for (const { id } of expected) {
    const e = byId.get(id)
    assert.ok(e, `the mockup has a body for ${id}, but the demo set has no such entry`)
    const f = fileOf(e)
    assert.ok(existsSync(f), `${id}: no body at ${path.relative(HERE, f)}`)
    files[id] = readFileSync(f, 'utf8')
  }

  const actual = inChild<Record<string, string[]>>(`
    const { bodyText } = await import(pipeline)
    const files = ${JSON.stringify(files)}
    out(Object.fromEntries(Object.entries(files).map(([id, md]) => [id, bodyText(md)])))
  `)

  const problems: string[] = []
  for (const { id, blocks } of expected) {
    const got = actual[id].map(norm)
    if (norm(got.join(' ')) === norm(blocks.join(' ')) && got.length === blocks.length) continue
    const i = blocks.findIndex((b, n) => b !== got[n])
    problems.push(
      `${id}: ${got.length} blocks, the mockup has ${blocks.length}; first difference at block ${i}:\n` +
        `    mockup: ${JSON.stringify(blocks[i])}\n    demo:   ${JSON.stringify(got[i])}`,
    )
  }
  assert.deepEqual(problems, [], '\n' + problems.join('\n'))
})

/**
 * `lib/lab/text.ts` is the plain scanner the rules and `readTime()` use instead of the pipeline,
 * which Node's `content:check` cannot load. It must read the same prose: every block but code.
 */
test('the rules’ plain scanner reads every demo body’s prose as the mockup wrote it', async () => {
  const { plainBlocks } = await import('../../../lib/lab/text.ts')
  const L = loadMockup()
  const set = JSON.parse(readFileSync(path.join(HERE, 'lab.json'), 'utf8')) as { entries: Any[] }
  const byId = new Map(set.entries.map((e) => [e.id, e]))
  const problems: string[] = []
  for (const [id, b] of Object.entries(L.bodies as Any)) {
    if (!b.blocks?.length) continue
    const e = byId.get(id)!
    const parent = e.parent ? byId.get(e.parent) : undefined
    const md = readFileSync(path.join(HERE, e.section, ...(parent ? [parent.slug] : []), `${e.slug}.md`), 'utf8')
    const want = mockupBodyText(b.blocks.filter((x: Any) => !x.code)).map((t) => norm(mockPlain(t)))
    const got = plainBlocks(md).map(norm)
    if (got.join(' ') !== want.join(' ') || got.length !== want.length) {
      const i = want.findIndex((w, n) => w !== got[n])
      problems.push(`${id}: block ${i}\n    mockup: ${JSON.stringify(want[i])}\n    scanner: ${JSON.stringify(got[i])}`)
    }
  }
  assert.deepEqual(problems, [], '\n' + problems.join('\n'))
})
