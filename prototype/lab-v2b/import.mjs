// Builds content/lab-data.js from the real sources. Run: node --experimental-strip-types import.mjs
//
// Sources (nothing here is invented; written copy lives in content/copy.js and content/bodies.js):
//   ~/projects/scratch/lab-sources/agent-reliability-study-tracker.xlsx   the study (allowlisted columns)
//   ~/projects/scratch/lab-sources/shopkeeper-spec-v1.md                  item prices for the haggle toy
//   ~/projects/scratch/medium-export/posts/*.html                         the two essays (drafts skipped)
//   sources/drag-to-workspace.README.md                                   snapshot of the repo README
//   ../../content/data/*.json, ../../content/themes.ts                    the site's own data and themes
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readXlsx } from './tools/xlsx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../..');
const scratch = join(homedir(), 'projects/scratch');
const json = (p) => JSON.parse(readFileSync(join(repo, 'content/data', p), 'utf8'));

// ---------- the study, by column allowlist (never by position) ----------
// Allowed: ID, Track, Topic, What to learn, Phase, Est. hrs, Hours spent, Status, Finished on.
// Everything else on the sheet (the role column, the starting point, Level, Priority, Notes,
// Resource, Proof of work) and every other sheet but Log and Portfolio stays out.
const ALLOW = { id: 'ID', track: 'Track', topic: 'Topic', learn: 'What to learn', phase: 'Phase',
  est: 'Est. hrs', spent: 'Hours spent', status: 'Status', finished: 'Finished on' };
const HIDDEN_TRACKS = new Set(['Interview prep']);
const HIDDEN_IDS = new Set(['T43', 'T44', 'T45', 'T46', 'T47']);
// Relabelled pending open question 3. Phase 5 topics show as "later".
const PHASE = (p) => p.replace(/^Phase 4 · .*/, 'Phase 4 · Hardening').replace(/^Phase 5 · .*/, 'later');
const TRACK = (t) => (t === 'FDE & deployment' ? 'Deployment' : t);
const excelDate = (n) => (n ? new Date(Date.UTC(1899, 11, 30) + Number(n) * 864e5).toISOString().slice(0, 10) : null);

const book = readXlsx(join(scratch, 'lab-sources/agent-reliability-study-tracker.xlsx'));
const sheet = book.Topics;
const head = sheet.findIndex((r) => r.includes('ID') && r.includes('Topic'));
const col = Object.fromEntries(Object.entries(ALLOW).map(([k, name]) => {
  const i = sheet[head].indexOf(name);
  if (i < 0) throw new Error(`tracker column missing: ${name}`);
  return [k, i];
}));
const topics = sheet.slice(head + 1).filter((r) => /^T\d+$/.test(r[col.id] || ''))
  .map((r) => Object.fromEntries(Object.keys(ALLOW).map((k) => [k, r[col[k]]])))
  .filter((t) => !HIDDEN_IDS.has(t.id) && !HIDDEN_TRACKS.has(t.track))
  .map((t) => ({
    id: t.id, track: TRACK(t.track), topic: t.topic, learn: t.learn, phase: PHASE(t.phase),
    est: Number(t.est) || 0, spent: Number(t.spent) || 0,
    status: t.status === 'Done' ? 'done' : t.status === 'In progress' ? 'doing' : /^Parked/.test(t.phase) ? 'parked' : PHASE(t.phase) === 'later' ? 'later' : 'todo',
    finished: excelDate(t.finished),
  }));
const tracks = [...new Set(topics.map((t) => t.track))];
const logSheet = book.Log;
const lh = logSheet.findIndex((r) => r[0] === 'Date');
const log = logSheet.slice(lh + 1).filter((r) => r[1]).map((r) => ({ date: excelDate(r[0]), topic: r[1], did: r[4] }));
const lastLog = log.map((l) => l.date).sort().at(-1);

// ---------- the spec's inventory (the toy's prices) ----------
const spec = readFileSync(join(scratch, 'lab-sources/shopkeeper-spec-v1.md'), 'utf8');
const item = (id) => {
  const row = spec.split('\n').find((l) => l.startsWith(`| ${id} |`));
  const c = row.split('|').map((s) => s.trim());
  return { id, name: c[2], list: Number(c[4].replace(/,/g, '')), floor: Number(c[5].replace(/,/g, '')) };
};

// ---------- essays ----------
const postsDir = join(scratch, 'medium-export/posts');
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;| /g, ' ').replace(/&amp;/g, '&')
  .replace(/&#39;|&#x27;/g, '’').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const essays = readdirSync(postsDir).filter((f) => /^\d{4}-\d\d-\d\d_.*\.html$/.test(f)).map((f) => {
  const html = readFileSync(join(postsDir, f), 'utf8');
  const body = html.match(/<section data-field="body"[\s\S]*?<\/footer>|<section data-field="body"[\s\S]*$/)?.[0] ?? html;
  const paras = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1])).filter(Boolean);
  const words = strip(body).split(' ').length;
  // The opening: his first paragraph, plus the next one when the first ends on a colon that the
  // second completes. Stops before a paragraph that introduces a list.
  const take = [paras[0]];
  while (take.length < paras.length && take.at(-1).endsWith(':') && !paras[take.length].endsWith(':')) take.push(paras[take.length]);
  const opening = take.join(' ');
  return { file: f, date: f.slice(0, 10), title: strip(html.match(/<title>([\s\S]*?)<\/title>/)[1]), opening, words };
});

// ---------- builds ----------
const projects = json('projects.json');
const holt = projects.find((p) => p.slug === 'holt');
const experience = json('experience.json');
const datesheet = experience.jobs.find((e) => e.slug === 'datesheet');
const readme = readFileSync(join(here, 'sources/drag-to-workspace.README.md'), 'utf8');
const dtwTagline = strip(readme.match(/<b>([\s\S]*?)<\/b>/)[1]);
const dtwSub = strip(readme.match(/<\/b><br>\s*([\s\S]*?)<\/p>/)[1]);
const dtwInstall = readme.match(/```sh\n\s*(curl [^\n]+)\n/)[1].trim();
const writing = json('writing.json');

// ---------- radio stations (the canvas's own list) ----------
const amb = readFileSync(join(repo, 'lib/ambience.ts'), 'utf8');
const stations = [...amb.matchAll(/\{ id: '([^']+)', label: '([^']+)', blurb: '([^']+)', url: '([^']+)' \}/g)]
  .map(([, id, label, blurb, url]) => ({ id, label, blurb, url }));
if (stations.length !== 6) throw new Error(`expected 6 stations in lib/ambience.ts, found ${stations.length}`);

// ---------- themes ----------
const { themes } = await import(join(repo, 'content/themes.ts'));

// ---------- entries ----------
const ch = (order, slug, title, published = null) => ({ id: `shopkeeper-${String(order).padStart(2, '0')}`, slug, section: 'studies',
  kind: 'chapter', parent: 'shopkeeper', order, title, published, draft: !published });
const done = topics.filter((t) => t.status === 'done').length;
const doing = topics.filter((t) => t.status === 'doing').length;
const laptop = essays.find((e) => /Laptop/.test(e.title));
const chrome = essays.find((e) => /Chrome/.test(e.title));


const entries = [
  { id: 'agent-reliability', slug: 'agent-reliability', section: 'studies', kind: 'study', title: 'Agent reliability',
    ledeKey: 'study.lede', published: topics.find((t) => t.id === 'T01').finished, updated: lastLog,
    lead: { instrument: 'board' }, progress: { done, doing, total: topics.length }, mentions: ['shopkeeper-05'] },
  { id: 'shopkeeper', slug: 'shopkeeper', section: 'studies', kind: 'series', title: 'The Shopkeeper', study: 'agent-reliability',
    ledeKey: 'series.lede', published: '2026-11-20', updated: '2026-11-26', mentions: ['shopkeeper-05'] },
  ch(1, 'what-changed', 'What changed from v0'),
  ch(2, 'shop-and-stock', 'The shop and its stock'),
  ch(3, 'thirteen-rules', 'Thirteen rules'),
  ch(4, 'how-it-haggles', 'How it haggles'),
  { ...ch(5, 'price-it-never-sees', 'An agent can’t leak a price it never sees', '2026-11-26'), updated: '2026-11-26',
    lead: { instrument: 'haggle' }, ledeKey: 'ch05.lede', read: '6 min' },
  ch(6, 'ten-tools', 'Ten tools, and none returns a floor'),
  ch(7, 'thirty-five-ways', 'Thirty-five ways to try to break it'),
  ch(8, 'how-a-run-is-graded', 'How a run is graded'),
  { id: 't01', slug: 'eval-anatomy', section: 'studies', kind: 'note', parent: 'agent-reliability', title: 'Eval anatomy',
    published: topics.find((t) => t.id === 'T01').finished, keyLineKey: 't01.key', ledeKey: 't01.lede', read: '3 min' },
  { id: 't02', slug: 'pass-k', section: 'studies', kind: 'note', parent: 'agent-reliability', title: 'pass@k, pass^k, and why one run isn’t a result',
    published: topics.find((t) => t.id === 'T02').finished, keyLineKey: 't02.key', ledeKey: 't02.lede', read: '4 min' },
  { id: 'drag-to-workspace', slug: 'drag-to-workspace', section: 'builds', kind: 'build', title: 'Drag to Workspace',
    lede: `${dtwTagline} ${dtwSub}`, published: '2026-11-12',
    lead: { demo: { src: 'assets/dtw-demo.webp', poster: 'assets/dtw-poster.webp', alt: 'Dragging windows to the screen edge to move them between workspaces', w: 720, h: 450 } },
    install: dtwInstall, repo: 'https://github.com/aahil-khan/drag-to-workspace' },
  { id: 'holt', slug: 'holt', section: 'builds', kind: 'build', title: 'Holt', lede: holt.lede + '.', published: '2026-10-12',
    lead: { images: [1, 2, 3].map((i) => ({ src: `assets/holt-${i}.webp`, w: 1200, h: 675 })) }, imagesAltKey: 'holt.alt',
    result: { value: 'MCC 0.61–0.63', baseline: '0.32 for a single-prompt LLM' } },
  { id: 'datesheet', slug: 'datesheet', section: 'builds', kind: 'build', title: 'Datesheet generator', lede: datesheet.lede, published: '2025-07-31',
    lead: { figure: 'datesheet' } },
  { id: 'old-laptop', slug: 'old-laptop-cloud', section: 'writing', kind: 'essay', title: writing.find((w) => w.slug === 'old-laptop-cloud').title,
    published: laptop.date, opening: laptop.opening, read: writing.find((w) => w.slug === 'old-laptop-cloud').readingTime },
  { id: 'chrome-hackathon', slug: 'chrome-hackathon', section: 'writing', kind: 'essay', title: chrome.title.replace(/\s+/g, ' '),
    published: chrome.date, opening: chrome.opening, read: writing.find((w) => w.slug === 'chrome-hackathon').readingTime },
];

// Tags: at most eight across the Lab (plan, Routes). Proposed; listed in README for veto.
const TAGS = { 'agent-reliability': ['evals', 'agents'], shopkeeper: ['agents', 'evals'], 'shopkeeper-05': ['agents', 'evals', 'security'],
  t01: ['evals'], t02: ['evals'], 'drag-to-workspace': ['desktop', 'open-source'], holt: ['open-source', 'evals'], datesheet: ['web'],
  'old-laptop': ['self-hosting'], 'chrome-hackathon': ['web', 'hackathons'] };
for (const e of entries) if (TAGS[e.id]) e.tags = TAGS[e.id];
if (new Set(Object.values(TAGS).flat()).size > 8) throw new Error('more than eight tags');

const data = {
  build: execSync('git rev-parse --short HEAD', { cwd: repo }).toString().trim(),
  owner: { name: 'Aahil Khan', short: 'Aahil', initials: 'AK', city: 'Bareilly', tz: 'Asia/Kolkata', tzLabel: 'IST' },
  sections: [
    { id: 'studies', title: 'Studies', thesisKey: 'sec.studies' },
    { id: 'builds', title: 'Builds', thesisKey: 'sec.builds' },
    { id: 'experiments', title: 'Experiments', thesisKey: 'sec.experiments' },
    { id: 'writing', title: 'Writing', thesisKey: 'sec.writing' },
  ],
  entries,
  study: { id: 'agent-reliability', tracks, topics: topics.map(({ learn, ...t }) => (['T01', 'T02'].includes(t.id) ? { ...t, learn } : t)), log },
  stations,
  items: { 'CHG-20W': item('CHG-20W'), 'PD-64': item('PD-64') },
  themes: themes.map((t) => ({ id: t.id, label: t.label, dark: t.dark, tokens: t.tokens })),
};

const out = `// Generated by import.mjs on ${new Date().toISOString().slice(0, 10)}. Do not edit; edit the sources and rerun.\n`
  + `var Lab = window.Lab = window.Lab || {};\nLab.data = ${JSON.stringify(data, null, 1)};\n`;
writeFileSync(join(here, 'content/lab-data.js'), out);
console.log(`lab-data.js: ${entries.length} entries, ${topics.length} topics in ${tracks.length} tracks (${done} done, ${doing} under way), ${log.length} log rows, ${themes.length} themes, build ${data.build}`);
for (const e of essays) console.log(`  essay ${e.date}: ${e.title.slice(0, 50)} · ${e.words} words · opening ${e.opening ? e.opening.length : 'MISSING'} chars`);
