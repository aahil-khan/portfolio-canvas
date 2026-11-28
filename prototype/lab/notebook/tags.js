/*
 * prototype/lab/notebook/tags.js: the Lab's tags (round 6). A small, fixed vocabulary, about the
 * subject, not the place: the tree already says "shopkeeper" and "builds", so tags never repeat it.
 *
 *   NB.tags.list            the tags, in display order: { id, glyph, tone }
 *   NB.tags.get(id)         one tag, or null
 *   NB.tags.forTopic(t)     a study topic's tags: its track's tag, plus a few per-ID extras
 *   NB.tags.forStage(s)     a project stage's tags (PW1–PW6)
 *   NB.tags.group(v, id)    a tag page: the notes carrying it, grouped by section, in tree order
 *
 * A tag's GLYPH is its own and never changes. Its TONE is one of the theme's text tokens
 * (--lab-ar, --lab-builds, --lab-writing), so contrast holds in every theme by construction:
 * check.mjs §7 already proves those tokens ≥ 4.5:1 on every surface. Tag names and one-liners are
 * words, so they live in copy.js (C.tags). The notes' own tags are in their frontmatter.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NB = (root_.NB = root_.NB || {})
  const list = [
    { id: 'evals', glyph: '±', tone: 'ar' },
    { id: 'tracing', glyph: '≡', tone: 'ar' },
    { id: 'reliability', glyph: '◆', tone: 'ar' },
    { id: 'latency', glyph: '»', tone: 'ar' },
    { id: 'voice', glyph: '∿', tone: 'ar' },
    { id: 'guardrails', glyph: '▣', tone: 'ar' },
    { id: 'negotiation', glyph: '⇄', tone: 'ar' },
    { id: 'agent-design', glyph: '◇', tone: 'ar' },
    { id: 'shipping', glyph: '▲', tone: 'builds' },
    { id: 'infra', glyph: '▤', tone: 'builds' },
    { id: 'open-source', glyph: '⊕', tone: 'builds' },
    { id: 'hackathons', glyph: '★', tone: 'writing' },
  ]
  const by = new Map(list.map((t) => [t.id, t]))
  // a study track → its tag
  const TRACK = { evals: 'evals', observability: 'tracing', reliability: 'reliability', latency: 'latency', voice: 'voice', guardrails: 'guardrails', fde: 'infra', 'open-source': 'open-source' }
  const EXTRA = { T07: ['shipping'], T09: ['agent-design'], T18: ['agent-design'], T21: ['agent-design'], T22: ['agent-design'] }
  const STAGE = { PW1: ['evals', 'shipping'], PW2: ['tracing', 'evals'], PW3: ['latency', 'evals'], PW4: ['voice', 'reliability'], PW5: ['reliability'], PW6: ['open-source'] }
  const SECTION_ORDER = ['root', 'agent-reliability', 'builds', 'writing', 'tours']

  const forTopic = (t) => [...new Set([TRACK[t.track], ...(EXTRA[t.id] || [])].filter(Boolean))]
  const forStage = (s) => (STAGE[s.id] || []).slice()
  function group(v, id) {
    const notes = v.notes.filter((n) => n.tags.includes(id))
    const out = []
    for (const sec of SECTION_ORDER) {
      const ns = notes.filter((n) => n.section === sec)
      if (ns.length) out.push({ section: sec, notes: ns })
    }
    return { tag: by.get(id) || null, n: notes.length, groups: out }
  }
  NB.tags = { list, get: (id) => by.get(String(id || '').toLowerCase()) || null, forTopic, forStage, group, TRACK }
})()
