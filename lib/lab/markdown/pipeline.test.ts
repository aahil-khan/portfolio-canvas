/**
 * The Markdown pipeline: each piece of the Lab's syntax renders to the DOM API.md §5 names, and
 * what a body cannot do (raw HTML, unknown ids, unsized images) is refused or shown as text.
 * The pipeline is server-only, so it runs in a child (`child.ts`).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { inChild } from './child.ts'

interface Rendered {
  html?: string
  error?: string
}

/** Renders each body in one child, with a small context: one entry, any term or tag, two refs. */
function render(bodies: string[]): Rendered[] {
  return inChild<Rendered[]>(`
    const { renderBody } = await import(pipeline)
    const { renderToStaticMarkup } = await import('react-dom/server')
    const React = await import('react')
    const ctx = {
      entryHref: (id) => (id === 'tool' ? '/lab/bench/tool' : null),
      termHref: (id) => (id === 'nope' ? null : '/lab/glossary#' + id),
      tagHref: (id) => '/lab/tags/' + id,
      refs: { a: { title: 'A', site: 'a.com', url: null }, b: { title: 'B', site: 'b.com', url: 'https://b.com' } },
      components: { figure: ({ of }) => React.createElement('div', { 'data-fig': of }) },
    }
    const res = []
    for (const md of ${JSON.stringify(bodies)}) {
      try { res.push({ html: renderToStaticMarkup(await renderBody(md, ctx)) }) }
      catch (e) { res.push({ error: String(e.message) }) }
    }
    out(res)
  `)
}
const one = (md: string) => render([md])[0]
const html = (md: string) => {
  const r = one(md)
  assert.equal(r.error, undefined, r.error)
  return r.html!
}

test('entry, term and tag links are plain anchors with data-preview', () => {
  const h = html('See [[tool|Tool]], [[t:gauge|Gauge]] and [[tag:one|one]].')
  assert.match(h, /<a href="\/lab\/bench\/tool" data-preview="entry:tool">Tool<\/a>/)
  assert.match(h, /<a href="\/lab\/glossary#gauge" data-preview="term:gauge">Gauge<\/a>/)
  assert.match(h, /<a href="\/lab\/tags\/one" data-preview="tag:one">one<\/a>/)
})

test('a link’s words may cross nodes: inline code, emphasis, a mark around a link', () => {
  const h = html('A [[t:ask-price|`evaluate_offer`]] call, [[tool|*the* tool]], and ==a mark with [[tool|Tool]]==.')
  assert.match(h, /<a href="\/lab\/glossary#ask-price" data-preview="term:ask-price"><code>evaluate_offer<\/code><\/a>/)
  assert.match(h, /<a [^>]*data-preview="entry:tool"><em>the<\/em> tool<\/a>/)
  assert.match(h, /<mark>a mark with <a [^>]*>Tool<\/a><\/mark>/)
})

test('references are numbered by first use, and the same key keeps its number', () => {
  const h = html('One[^b] two[^a] three[^b].')
  const marks = [...h.matchAll(/<sup><a href="#ref-(\w+)" data-preview="ref:\1" aria-label="Reference (\d)">(\d)<\/a><\/sup>/g)].map((m) => `${m[1]}${m[2]}`)
  assert.deepEqual(marks, ['b1', 'a2', 'b1'])
})

test('unknown ids and keys are refused, by name', () => {
  const [entry, term, ref, open] = render(['[[nowhere|x]]', '[[t:nope|x]]', 'x[^zzz]', '[[tool|never closed'])
  assert.match(entry.error ?? '', /entry "nowhere"/)
  assert.match(term.error ?? '', /term "nope"/)
  assert.match(ref.error ?? '', /\[\^zzz\]/)
  assert.match(open.error ?? '', /never closed/)
})

test('text directives are not a thing: `word:word` and `[[t:…]]` stay text', () => {
  const h = html('At 10:30 the ratio was a:b, and [[t:gauge|Gauge]] still links.')
  assert.match(h, /At 10:30 the ratio was a:b, and <a [^>]*data-preview="term:gauge">Gauge<\/a>/)
})

test('a link may go to the web, a page here or a heading; any other scheme is refused', () => {
  const [js, data, ok] = render(['[x](javascript:alert(1))', '[x](data:text/html,hi)', '[a](https://example.com/) [b](/lab) [c](#s-x) [d](mailto:a@b.c)'])
  assert.match(js.error ?? '', /not http\(s\)/)
  assert.match(data.error ?? '', /not http\(s\)/)
  assert.equal(ok.error, undefined)
})

test('raw HTML renders as text, inline and as a block', () => {
  const h = html('Bold <b>this</b>.\n\n<script>alert(1)</script>\n')
  assert.match(h, /Bold &lt;b&gt;this&lt;\/b&gt;\./)
  assert.match(h, /<p>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/p>/)
  assert.doesNotMatch(h, /<script|<b>/)
})

test('links out carry data-preview="out:<url>"; autolinks too', () => {
  const h = html('[Tool](https://example.org) and https://example.com/x')
  assert.match(h, /<a href="https:\/\/example.org" data-preview="out:https:\/\/example.org">Tool<\/a>/)
  assert.match(h, /<a href="https:\/\/example.com\/x" data-preview="out:https:\/\/example.com\/x">/)
})

test('headings get the mockup’s slug ids; a body has no h1', () => {
  const h = html('## It still leaks, one accepted offer at a time\n\n### Why A’s run\n\n## It still leaks, one accepted offer at a time')
  assert.match(h, /<h2 id="s-it-still-leaks-one-accepted-offer-at-a-time">/)
  assert.match(h, /<h3 id="s-why-as-run">/)
  assert.match(h, /<h2 id="s-it-still-leaks-one-accepted-offer-at-a-time-2">/)
  assert.match(one('# Title').error ?? '', /h1/)
})

test('side notes, figures and images', () => {
  const h = html(':::side[Where this ran.]\nOn Medium[^a].\n:::\n\n::figure{of="fig-one"}\n\n![A dashboard](/lab/pic/a.webp "w=800 h=455 | My [[tool|server]] dashboard")')
  assert.match(h, /<aside class="side" data-side=""><p><strong>Where this ran\.<\/strong> On Medium<sup>/)
  assert.match(h, /<div data-fig="fig-one"><\/div>/)
  assert.match(h, /<figure><img src="\/lab\/pic\/a.webp" width="800" height="455" alt="A dashboard" loading="lazy" decoding="async" data-zoom=""\/><figcaption>My <a [^>]*data-preview="entry:tool">server<\/a> dashboard<\/figcaption><\/figure>/)
})

test('an image without its size, or beside text, is refused; so is an unknown directive', () => {
  const [unsized, inline, unknown, figureNoOf] = render(['![x](/a.webp)', 'Text ![x](/a.webp "w=1 h=1") more', '::chart{of="x"}', '::figure'])
  assert.match(unsized.error ?? '', /size declared/)
  assert.match(inline.error ?? '', /alone in its paragraph/)
  assert.match(unknown.error ?? '', /unknown directive ::chart/)
  assert.match(figureNoOf.error ?? '', /of=/)
})

test('fenced code is highlighted by shiki on CSS variables, unknown languages as plain text', () => {
  const h = html('```ts\nconst x: number = 1\n```\n\n```nonsense\nplain <b>\n```')
  assert.match(h, /<pre class="shiki lab"[^>]*data-language="ts"><code data-language="ts">/)
  assert.match(h, /style="color:var\(--shiki-token-keyword\)">const<\/span>/)
  assert.match(h, /data-language="text"/)
  assert.match(h, /plain &lt;b&gt;/)
})

test('GFM tables and strikethrough are on; footnote definitions are not', () => {
  const h = html('| a | b |\n|---|---|\n| 1 | ~~2~~ |\n\nCite[^a].')
  assert.match(h, /<table>/)
  assert.match(h, /<del>2<\/del>/)
  assert.match(h, /<sup><a href="#ref-a"/)
})

test('bodyText and bodyLinks read a body without rendering it', () => {
  const r = inChild<{ text: string[]; links: Record<string, unknown> }>(`
    const { bodyText, bodyLinks } = await import(pipeline)
    const md = '## Head [[tool|Tool]]\\n\\nA ==mark== and [[t:gauge|\`Gauge\`]][^a] https://x.com\\n\\n- one\\n- two [[tag:one|tag]]\\n\\n:::side[Side head]\\nSide text.\\n:::\\n\\n![alt](/a.webp "w=2 h=1 | Cap")\\n\\n::figure{of="f1"}\\n\\n\`\`\`text\\ncode line\\n\`\`\`'
    out({ text: bodyText(md), links: bodyLinks(md) })
  `)
  assert.deepEqual(r.text, ['Head Tool', 'A mark and Gauge https://x.com', 'one', 'two tag', 'Side head', 'Side text.', 'Cap', 'code line'])
  assert.deepEqual(r.links, {
    entries: ['tool'],
    terms: ['gauge'],
    tags: ['one'],
    refs: ['a'],
    figures: ['f1'],
    images: [{ src: '/a.webp', w: 2, h: 1, alt: 'alt' }],
    outs: ['https://x.com'],
  })
})
