/**
 * `validateLab`: the empty set passes, a small good set passes, and each kind of break is refused
 * with its path (plan PR 2, Done when). Synthetic data only: the demo set has its own tests in
 * `content/lab/demo/`, the one place allowed to name its ids.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { validateLab, type LabIssue } from './rules.ts'
import type { Entry, Lab } from './types.ts'

const empty = (): Lab => ({ copy: {}, sections: [], tags: [], entries: [], terms: [], figures: {}, unfurls: {}, studies: {} })

/** A small set that passes: one section, two tags, a build, an essay, a term, an unfurl. */
function good(): { lab: Lab; bodies: Record<string, string> } {
  const lab = empty()
  lab.sections.push({ id: 'bench', title: 'Bench', thesis: 'Things on the bench.' })
  lab.tags.push({ id: 'one', title: 'one' }, { id: 'two', title: 'two' })
  lab.terms.push({ id: 'wat', name: 'Wat', def: 'A word.', source: 'test' })
  lab.unfurls['https://example.com/'] = { title: 'Example', site: 'example.com', domain: 'example.com', img: { src: '/x/og.webp', w: 640, h: 336, alt: '' } }
  const build: Entry = {
    id: 'tool',
    slug: 'tool',
    section: 'bench',
    kind: 'build',
    title: 'A tool',
    published: '2026-11-01',
    tags: ['one'],
    install: 'npm i tool',
    repo: 'https://example.com/',
    pull: 'It does one thing.',
    refs: { src: { title: 'Source', site: 'example.com', url: 'https://example.com/' } },
    ending: { text: 'Do the other thing next.' },
    endingKind: 'do',
  }
  const essay: Entry = {
    id: 'words',
    slug: 'words',
    section: 'bench',
    kind: 'essay',
    title: 'Some words',
    published: '2026-11-02',
    tags: ['two'],
    opening: 'The opening paragraph.',
  }
  lab.entries.push(build, essay)
  return {
    lab,
    bodies: {
      tool: '## Why it exists\n\nIt does one thing. A [[t:wat|wat]] and [[words|the essay]] and [[tag:one|one]].[^src]\n\n![A screen](/x/a.webp "w=800 h=450 | A caption")\n',
      words: 'Body text.\n',
    },
  }
}
const files = new Set(['/x/og.webp', '/x/a.webp'])
const exists = (p: string) => files.has(p)
const run = (lab: Lab, bodies: Record<string, string>) => validateLab(lab, bodies, exists)
const has = (issues: LabIssue[], rule: string, path: string, re: RegExp) =>
  assert.ok(
    issues.some((i) => i.rule === rule && i.path === path && re.test(i.message)),
    `expected rule ${rule} at ${path} matching ${re}; got:\n${issues.map((i) => `  ${i.rule} ${i.path}: ${i.message}`).join('\n') || '  nothing'}`,
  )

test('the empty Lab is valid', () => {
  assert.deepEqual(validateLab(empty(), {}, () => false), [])
})

test('a small good set is valid', () => {
  const { lab, bodies } = good()
  assert.deepEqual(run(lab, bodies), [])
})

test('a broken [[link]] is refused, with its path', () => {
  const { lab, bodies } = good()
  bodies.tool += '\nSee [[nowhere|this]].\n'
  has(run(lab, bodies), 'L', 'bodies.tool', /\[\[nowhere\|…\]\] names no entry/)
})

test('a link to a draft is refused: it has no page', () => {
  const { lab, bodies } = good()
  Object.assign(lab.entries[1], { draft: true, published: null })
  has(run(lab, bodies), 'L', 'bodies.tool', /links to a draft/)
})

test('an unknown term, tag or reference is refused', () => {
  const { lab, bodies } = good()
  bodies.tool += '\n[[t:nope|x]] [[tag:nope|y]] z[^nope]\n'
  const issues = run(lab, bodies)
  has(issues, 'T', 'bodies.tool', /names no term/)
  has(issues, 'L', 'bodies.tool', /names no tag/)
  has(issues, 'L', 'bodies.tool', /\[\^nope\] is not one of its references/)
})

test('a reference that is never cited is refused', () => {
  const { lab, bodies } = good()
  bodies.tool = bodies.tool.replace('[^src]', '')
  has(run(lab, bodies), 'L', 'entries.tool.refs.src', /never cited/)
})

test('a pull-quote that is not in its body is refused', () => {
  const { lab, bodies } = good()
  lab.entries[0].pull = 'A sentence it never says.'
  has(run(lab, bodies), 'Q', 'entries.tool.pull', /not a sentence of its body/)
})

test('a long entry with no pull-quote is refused', () => {
  const { lab, bodies } = good()
  delete lab.entries[0].pull
  bodies.tool += '\n' + 'word '.repeat(400) + '\n'
  has(run(lab, bodies), 'Q', 'entries.tool.pull', /words and no pull-quote/)
})

test('Increff in a body is refused, with its path', () => {
  const { lab, bodies } = good()
  bodies.words = 'I spent a summer at Increff.\n'
  has(run(lab, bodies), '1', 'bodies.words', /private term "Increff"/)
})

test('every privacy pattern is caught in data too', () => {
  for (const word of ['Bolna', 'cekura', 'an intern', 'Interview prep', 'Role evidence', 'T44', 'Phase 5', 'recruiter']) {
    const { lab, bodies } = good()
    lab.entries[1].lede = `About ${word}.`
    has(run(lab, bodies), '1', 'entries.words', /private term/)
  }
  const { lab, bodies } = good()
  lab.entries[1].lede = 'An internal tool, and its internals.'
  assert.deepEqual(run(lab, bodies).filter((i) => i.rule === '1'), [])
})

test('a banned phrase is refused', () => {
  const { lab, bodies } = good()
  bodies.words = 'Let’s dive in.\n'
  has(run(lab, bodies), '2', 'bodies.words', /banned phrase/)
})

test('a 9th tag is refused', () => {
  const { lab, bodies } = good()
  for (let i = 3; i <= 9; i++) lab.tags.push({ id: `t${i}`, title: `t${i}` })
  has(run(lab, bodies), 'L', 'tags', /9 tags; the Lab holds at most 8/)
})

test('a section id "index" is refused, and so is every reserved id', () => {
  for (const id of ['index', 'tags', 'glossary', 'demo', 'fixture']) {
    const { lab, bodies } = good()
    lab.sections.push({ id, title: 'x', thesis: 'x' })
    has(run(lab, bodies), 'L', 'sections[1].id', /is reserved/)
  }
})

test('duplicate ids and shared URLs are refused', () => {
  const { lab, bodies } = good()
  lab.entries.push({ ...lab.entries[1], id: 'words' } as Entry)
  const issues = run(lab, bodies)
  has(issues, 'L', 'entries[2].id', /duplicate id "words"/)
  has(issues, 'L', 'entries.words.slug', /share the URL/)
})

test('a link out with neither an unfurl nor a fallback is refused', () => {
  const { lab, bodies } = good()
  ;(lab.entries[0] as Extract<Entry, { kind: 'build' }>).live = 'https://nowhere.example/'
  has(run(lab, bodies), 'O', 'entries.tool.live', /no unfurl and no stated fallback/)
  // a reference states its own fallback with a line
  const g = good()
  g.lab.entries[0].refs!.src = { title: 'Elsewhere', site: 'x', url: 'https://other.example/' }
  has(run(g.lab, g.bodies), 'O', 'entries.tool.refs.src', /no unfurl/)
  g.lab.entries[0].refs!.src.line = 'Why it is cited.'
  assert.deepEqual(run(g.lab, g.bodies).filter((i) => i.rule === 'O'), [])
})

test('an unfurl image must be a same-origin file', () => {
  const { lab, bodies } = good()
  lab.unfurls['https://example.com/'].img!.src = 'https://cdn.example.com/og.png'
  has(run(lab, bodies), 'O', 'unfurls.https://example.com/.img', /file on this site/)
})

test('a build with no lead is refused: nothing ships as a stub', () => {
  const { lab, bodies } = good()
  delete (lab.entries[0] as Extract<Entry, { kind: 'build' }>).install
  has(run(lab, bodies), 'R', 'entries.tool.lead', /needs a lead: one of demo, screens, figure, install/)
})

test('a build with no ending is refused', () => {
  const { lab, bodies } = good()
  ;(lab.entries[0] as Extract<Entry, { kind: 'build' }>).ending = { text: ' ' }
  has(run(lab, bodies), 'E', 'entries.tool.ending', /What I’d do now/)
})

test('an image path with no file, or no declared size, is refused', () => {
  const { lab, bodies } = good()
  bodies.tool += '\n![Gone](/x/gone.webp "w=1 h=1")\n\n![Sizeless](/x/a.webp)\n'
  const issues = run(lab, bodies)
  has(issues, 'I', 'bodies.tool', /\/x\/gone\.webp: no such file/)
  has(issues, 'I', 'bodies.tool', /does not declare its size/)
})

test('a slot heading is refused', () => {
  const { lab, bodies } = good()
  bodies.words = '## Overview\n\nText.\n'
  has(run(lab, bodies), 'L', 'bodies.words', /names a slot/)
})

test('an incomplete term is refused', () => {
  const { lab, bodies } = good()
  lab.terms[0].source = ''
  has(run(lab, bodies), 'T', 'terms.wat.source', /no source/)
})

test('schema: unknown fields, wrong kinds, a published date on nothing', () => {
  const { lab, bodies } = good()
  ;(lab.entries[1] as unknown as Record<string, unknown>).pinned = true
  Object.assign(lab.entries[0], { published: null })
  const issues = run(lab, bodies)
  has(issues, 'S', 'entries.words.pinned', /unknown field/)
  has(issues, 'S', 'entries.tool.published', /must be a draft/)
})
