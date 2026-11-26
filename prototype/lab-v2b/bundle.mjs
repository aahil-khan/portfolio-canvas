// Builds one self-contained HTML file: CSS, scripts, fonts and images inlined, so it opens from
// disk with no network. Usage:
//   node bundle.mjs              ->  ~/projects/scratch/lab-mockups/lab-v2b.html  (+ .build/lab-v2b.html)
//   node bundle.mjs --check      ->  also .build/lab-v2b-check.html, with the ?fixture=kinds overlay
//   node bundle.mjs --copy       ->  rewrites COPY.md from content/copy.js
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const MIME = { '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif' };
const dataUri = (path) => `data:${MIME[extname(path)]};base64,${readFileSync(path).toString('base64')}`;
const read = (p) => readFileSync(join(here, p), 'utf8');

function build({ fixture }) {
  let html = read('index.html');
  // CSS, with every url() inlined
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (_, href) => {
    const css = read(href).replace(/url\(([^)'"]+)\)/g, (m, u) => (u.startsWith('data:') ? m : `url(${dataUri(join(here, u))})`));
    return `<style>\n${css}\n</style>`;
  });
  // scripts, in order; the fixture only in the check build
  html = html.replace(/<script src="([^"]+)"( data-fixture)?><\/script>/g, (_, src, isFixture) => {
    if (isFixture && !fixture) return '';
    let js = read(src).replace(/<\/script/gi, '<\\/script');
    if (src === 'lab.js') js = assetsScript() + '\n' + js;
    return `<script>\n${js}\n</script>`;
  });
  return html;
}

// Every assets/... path the data or copy names becomes a data: URI in Lab.assets.
function assetsScript() {
  const text = read('content/lab-data.js') + read('content/copy.js');
  const paths = [...new Set(text.match(/assets\/[\w.-]+\.(?:webp|png|jpg|gif)/g) || [])];
  const map = Object.fromEntries(paths.map((p) => [p, dataUri(join(here, p))]));
  return `Lab.assets = ${JSON.stringify(map)};`;
}

function copyMd() {
  const sandbox = { window: {} };
  vm.runInNewContext(read('content/copy.js'), sandbox);
  const L = sandbox.window.Lab;
  const rows = [];
  for (const [key, c] of Object.entries(L.copy)) if (c.proposal) rows.push([key, c.where, c.text, c.reason]);
  for (const [id, b] of Object.entries(L.bodies)) b.blocks.forEach((blk, i) => {
    const c = blk.h2 || blk.p;
    if (c && c.proposal) rows.push([`${id} #${i + 1}`, c.where, c.text, c.reason]);
  });
  const cell = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return `# Proposed copy, for veto\n\nEvery line below was written for the mockup rather than taken from a source. Veto or rewrite any of them;\n` +
    `the text lives in \`content/copy.js\`. Lines taken from a source (the spec, the tracker, \`content/data\`, his brand line)\n` +
    `are marked there with their source and aren't listed here. Regenerate with \`node bundle.mjs --copy\`.\n\n` +
    `| Key | Where it shows | Proposed line | Reason |\n|---|---|---|---|\n` +
    rows.map((r) => `| \`${cell(r[0])}\` | ${cell(r[1])} | ${cell(r[2])} | ${cell(r[3])} |`).join('\n') + '\n';
}

mkdirSync(join(here, '.build'), { recursive: true });
if (args.has('--copy')) { writeFileSync(join(here, 'COPY.md'), copyMd()); console.log('COPY.md written'); }
const out = build({ fixture: false });
writeFileSync(join(here, '.build/lab-v2b.html'), out);
const deliver = join(homedir(), 'projects/scratch/lab-mockups');
if (existsSync(deliver)) writeFileSync(join(deliver, 'lab-v2b.html'), out);
console.log(`lab-v2b.html: ${(out.length / 1048576).toFixed(2)} MB${existsSync(deliver) ? ` -> ${join(deliver, 'lab-v2b.html')}` : ''}`);
if (args.has('--check')) {
  const chk = build({ fixture: true });
  writeFileSync(join(here, '.build/lab-v2b-check.html'), chk);
  console.log(`lab-v2b-check.html: ${(chk.length / 1048576).toFixed(2)} MB (with the fixture overlay)`);
}
export { copyMd };
