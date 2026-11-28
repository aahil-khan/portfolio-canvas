/*
 * prototype/lab/notebook/author.js: who wrote the Lab, as data (round 6). The author card at each
 * note's end and the byline read it; the words round it are copy.js's (C.author, C.byline).
 *
 * Mirrors content/data/profile.json (name, role, links). check.mjs §9 keeps them equal. X is
 * added HERE ONLY, for the mockup: in the React build it belongs in profile.json's `links`. This
 * round doesn't edit repo content.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NB = (root_.NB = root_.NB || {})
  NB.author = {
    name: 'Aahil Khan',
    role: { prefix: 'Full stack engineer,', emphasis: 'AI retrieval & agents' },
    x: 'aahil_khan77',
    links: [
      { id: 'github', label: 'GitHub', href: 'https://github.com/aahil-khan' },
      { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/aahil-khan77/' },
      { id: 'x', label: 'X', href: 'https://x.com/aahil_khan77', mockupOnly: true },
      { id: 'email', label: 'Email', href: 'mailto:aahilminookhan@gmail.com' },
    ],
    // "follow for the next one": where new notes are announced
    follow: ['linkedin', 'x'],
  }
})()
