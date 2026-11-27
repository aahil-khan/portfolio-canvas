// Test-only overlay, loaded with ?fixture=kinds. One synthetic entry of every kind plus a new
// section, to prove the templates are general. Never part of the delivered bundle's data.
var Lab = window.Lab = window.Lab || {};
Lab.fixture = {
  sections: [{ id: 'fx-voice', title: 'Fixture section', thesis: 'A section that exists only in the test overlay.' }],
  entries: [
    { id: 'fx-study', slug: 'fx-study', section: 'fx-voice', kind: 'study', title: 'Fixture study', lede: 'A synthetic study with no board, so its lead falls back to its latest log line.',
      published: '2026-11-22', log: [{ date: '2026-11-22', did: 'Fixture log line: read one paper, wrote one note.' }], progress: { done: 1, doing: 1, total: 4 } },
    { id: 'fx-note', slug: 'fx-note', section: 'fx-voice', kind: 'note', parent: 'fx-study', title: 'Fixture note', lede: 'A synthetic note.', keyLine: 'A fixture note leads with its key line when it has no figure.', published: '2026-11-22' },
    { id: 'fx-series', slug: 'fx-series', section: 'fx-voice', kind: 'series', title: 'Fixture series', lede: 'A synthetic series of two chapters.', premise: 'A fixture series leads with its premise when it has no chapters out.', published: '2026-11-22' },
    { id: 'fx-chapter', slug: 'fx-chapter', section: 'fx-voice', kind: 'chapter', parent: 'fx-series', order: 1, title: 'Fixture chapter', lede: 'A synthetic chapter.', keyLine: 'A fixture chapter with no instrument leads with its key line.', published: '2026-11-22' },
    { id: 'fx-build', slug: 'fx-build', section: 'fx-voice', kind: 'build', title: 'Fixture build', lede: 'A synthetic build with only an install line.', install: 'npm i fixture-build', published: '2026-11-22' },
    { id: 'fx-experiment', slug: 'fx-experiment', section: 'experiments', kind: 'experiment', title: 'Does retrying hide tool-call failures?', lede: 'A synthetic experiment, to prove the result card.',
      result: { question: 'Does retrying hide tool-call failures?', setup: 'Fixture: 50 runs of one task, a tool that fails 1 time in 5, with and without one retry.', value: '0.94 pass rate', baseline: '0.81 without the retry' }, published: '2026-11-23' },
    { id: 'fx-essay', slug: 'fx-essay', section: 'fx-voice', kind: 'essay', title: 'Fixture essay', opening: 'A fixture essay leads with its opening paragraph, set at lede size, so the first screen is its first words.', published: '2026-11-22', read: '2 min' },
  ],
};
