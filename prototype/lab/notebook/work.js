/*
 * prototype/lab/night-mode/work.js: the project facts the Lab's work pane needs, which the
 * shared kit's pieces.js does not carry (it has the write-up, not the project record).
 *
 * TRANSCRIBED VERBATIM from content/data/projects.json (kind, stack, award, links). check.mjs
 * compares every field against that file, so this cannot drift without failing. Portana and
 * This site have no projects.json entry: their specimens show only what pieces.js has.
 * In the React build this is not a copy at all: the work pane reads projects.json directly.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  NIGHT.facts = {
    holt: {
      kind: 'Product',
      stack: ['Python', 'FastAPI', 'Next.js', 'TypeScript', 'PostgreSQL', 'Redis'],
      award: 'Most Useful Real World Workflow Award',
      links: [{ label: 'Site', href: 'https://githolt.com' }, { label: 'Github', href: 'https://github.com/holt-oss/holt' }],
    },
    'sop-opera': {
      kind: 'System',
      stack: ['Python', 'TypeScript', 'FastAPI', 'LangGraph', 'PostgreSQL', 'Next.js', 'Docker'],
      award: 'Winner — Economic Times 2.0 Hackathon',
      links: [{ label: 'Demo', href: 'https://sop-opera.vercel.app' }, { label: 'Repo', href: 'https://github.com/aahil-khan/SOP-Opera' }],
    },
    flowsync: {
      kind: 'System',
      stack: ['TypeScript', 'Python', 'AWS', 'DynamoDB', 'S3'],
      links: [{ label: 'Demo', href: 'https://flowsync.aahil-khan.xyz/' }, { label: 'Repo', href: 'https://github.com/anoushkawasthi/flowsync' }],
    },
    konta: {
      kind: 'Product',
      stack: ['React', 'TypeScript'],
      award: 'Winner — Samsung PRISM Web Agent Hackathon',
      links: [{ label: 'Releases', href: 'https://github.com/konta-oss/konta/releases' }, { label: 'Repo', href: 'https://github.com/konta-oss/konta' }],
    },
  }
})()
