// The Lab v2B checklist (plan lab-v2-b-a, "The check command"). Builds the bundle, then checks it at
// file:// in the cached Chromium. Prints every failed assertion, then LAB-V2B OK (exit 0) or
// LAB-V2B FAIL n (exit 1). Routes and entries come from the mockup's own data (Lab.routes()).
//   cx heavy -- node prototype/lab-v2b/check.mjs
// Task 1 scope: checks 1-26 where they apply to the home and chapter 05. Check 22's per-template
// part waits for task 2's pages; its sections part and the haggle fidelity run here.
// Revision (27 Nov): the home is evergreen (rules H1-H3), and every link previews, Wikipedia-style
// (rules N, T, P, R, U, D). The Featured slot and its ?feature= check are gone with the slot.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../..');
const require = createRequire(import.meta.url);
const fails = [];
const fail = (id, msg) => { fails.push(`[${id}] ${msg}`); };
const note = (s) => process.stdout.write(s + '\n');

// ---------- build ----------
execFileSync(process.execPath, [join(here, 'bundle.mjs'), '--check'], { stdio: 'inherit' });
const BUNDLE = join(here, '.build/lab-v2b.html');
const CHECK = join(here, '.build/lab-v2b-check.html');
const bundleText = readFileSync(BUNDLE, 'utf8');

// ---------- static: 1-4 ----------
const PRIVACY = [/bolna/i, /cekura/i, /increff/i, /intern(?!al)/i, /interview/i, /role evidence/i, /starting point/i,
  /why it matters for the role/i, /what you.ll show/i, /\bT4[3-7]\b/, /phase 5/i, /recruit/i];
const BANNED = ['welcome to', 'dive', 'journey', 'unlock', 'seamless', 'explore', 'in this post', 'let\'s', 'let’s', 'passionate',
  'showcase', 'delve', 'robust', 'cutting-edge', 'game-changer', 'stay tuned', 'coming soon', 'without opening a repo', 'the place where people'];
const TRACKER = [/\d+(\.\d+)?\s?h(ours)?\s+(logged|planned|spent)/i, /est\.?\s?hrs/i];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const contentFiles = walk(join(here, 'content')).filter((f) => f.endsWith('.js'));
// 1. privacy, in the bundle and in content/ (the mockup's and the site's)
for (const [name, text] of [['bundle', bundleText], ...contentFiles.map((f) => [f.slice(here.length + 1), readFileSync(f, 'utf8')]),
  ...walk(join(repo, 'content/data')).map((f) => ['content/data/' + f.split('/').pop(), readFileSync(f, 'utf8')])]) {
  if (name.startsWith('content/data/')) continue; // the site's own data is checked by its own rules; the Lab only imports allowlisted fields
  for (const re of PRIVACY) { const m = text.match(re); if (m) fail(1, `${name}: private term "${m[0]}"`); }
}
// 2. banned phrases in everything a reader can see: the copy, the generated data, the fixture
const sandbox = { window: {} };
for (const f of ['content/lab-data.js', 'content/copy.js', 'content/terms.js']) vm.runInNewContext(readFileSync(join(here, f), 'utf8'), sandbox);
const L = sandbox.window.Lab;
const visibleCopy = JSON.stringify([L.copy, L.bodies, L.compare, L.data.entries, L.data.sections, L.terms]);
for (const p of BANNED) { const re = new RegExp(`(^|[^a-z])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'); if (re.test(visibleCopy)) fail(2, `banned phrase "${p}" in copy or data`); }
for (const re of TRACKER) if (re.test(visibleCopy)) fail(2, `tracker-output pattern ${re}`);
// 3. every proposal is in COPY.md
const copyMd = readFileSync(join(here, 'COPY.md'), 'utf8');
const props = [...Object.values(L.copy), ...Object.values(L.bodies).flatMap((b) => b.blocks.map((x) => x.h2 || x.p).filter(Boolean))].filter((c) => c.proposal);
for (const c of props) if (!copyMd.includes(c.text.replace(/\|/g, '\\|'))) fail(3, `proposed line not in COPY.md: "${c.text.slice(0, 60)}"`);
for (const x of L.terms) if (!copyMd.includes(x.def.replace(/\|/g, '\\|'))) fail(3, `term definition not in COPY.md: ${x.id}`);
// T (static): every term is data, complete, and every [[t:id|...]] in the copy names one
const termIds = new Set(L.terms.map((x) => x.id));
for (const x of L.terms) if (x.kind !== 'term' || !x.name || !x.def || !x.source) fail('T', `term ${x.id} is missing kind, name, def or source`);
for (const m of JSON.stringify([L.copy, L.bodies]).matchAll(/\[\[t:([\w-]+)\|/g)) if (!termIds.has(m[1])) fail('T', `unknown term "${m[1]}" in the copy`);
// 4. no reference to the old Lab; ≤ 3 font families; budget; the fixture stays out of the default bundle
for (const f of walk(here).filter((f) => /\.(js|mjs|css|html)$/.test(f) && !f.includes('/.build/') && !f.endsWith('check.mjs'))) {
  if (/prototype\/lab\/|\.\.\/lab\//.test(readFileSync(f, 'utf8'))) fail(4, `${f.slice(here.length + 1)} references prototype/lab/`);
}
const families = new Set([...bundleText.matchAll(/@font-face\s*{[^}]*font-family:\s*'([^']+)'/g)].map((m) => m[1]));
if (families.size > 3) fail(4, `${families.size} @font-face families`);
if (bundleText.length > 8 * 1048576) fail(4, `bundle is ${(bundleText.length / 1048576).toFixed(1)} MB (budget 8)`);
if (/Lab\.fixture\s*=/.test(bundleText) || /fx-experiment/.test(bundleText)) fail(4, 'fixture-kinds.js is in the default bundle');

// 22 (part). haggle fidelity: A1, A9, A10, B1, B13 through the pure module
const core = require(join(here, 'instruments/haggle-core.js'));
for (const r of core.fidelity(L.data.items)) if (!r.ok) fail(22, `haggle fidelity ${r.id}: ${JSON.stringify(r.result)}`);

// ---------- browser ----------
const { chromium } = require(join(homedir(), '.local/share/cx-tools/node_modules/playwright-core'));
function exe() {
  if (process.env.CX_CHROMIUM) return process.env.CX_CHROMIUM;
  const cache = join(homedir(), '.cache/ms-playwright');
  const ds = existsSync(cache) ? readdirSync(cache).sort().reverse() : [];
  return ds.flatMap((d) => ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/headless_shell', 'chrome-linux64/chrome'].map((r) => join(cache, d, r))).find(existsSync);
}
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const LOOKS = [
  { name: 'paper/cream', q: 'look=paper&theme=cream' }, { name: 'paper/tokyo-night', q: 'look=paper&theme=tokyo-night' },
  { name: 'premium/day', q: 'look=premium&mode=light' }, { name: 'premium/night', q: 'look=premium&mode=dark' },
];
const url = (file, q, hash) => `file://${file}${q ? '?' + q : ''}${hash}`;
const STATION_RE = /^https?:\/\//;

// a short silent WAV, for stubbing the radio stations
function silentWav(seconds = 30, rate = 8000) {
  const n = seconds * rate, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

// Instruments Web Audio and media before the page's own scripts run (checks 20, 23, 25, 26).
const INSTRUMENT = () => {
  const A = (window.__audio = { contexts: 0, media: 0, sched: [], connects: [], ramps: [] });
  const AC = window.AudioContext;
  window.AudioContext = class extends AC { constructor(...a) { super(...a); A.contexts += 1; } };
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) {
    const orig = AudioParam.prototype[m];
    AudioParam.prototype[m] = function (v, t) { A.sched.push({ m, v }); if (m === 'linearRampToValueAtTime') A.ramps.push({ v, dt: t - (A.ctxNow ? A.ctxNow() : 0) }); return orig.apply(this, arguments); };
  }
  const conn = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target) { A.connects.push(target); return conn.apply(this, arguments); };
  // the name card: count every utterance (a stand-in synthesiser where the browser has none)
  A.speak = 0;
  if (!('speechSynthesis' in window)) {
    window.speechSynthesis = { speak() {}, cancel() {}, getVoices() { return []; } };
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  }
  const speak = window.speechSynthesis.speak.bind(window.speechSynthesis);
  window.speechSynthesis.speak = (u) => { A.speak += 1; try { speak(u); } catch { /* no voice */ } };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { A.media += 1; return play.apply(this, arguments); };
};

// In-page measurements for one screen (checks 5-14).
const MEASURE = (opts) => {
  const vh = innerHeight, vw = innerWidth;
  const parse = (c) => {
    let m = c.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; }
    m = c.match(/color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] == null ? 1 : p[3]]; }
    return [0, 0, 0, 0];
  };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const bgOf = (el) => {
    const stack = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) stack.push(parse(getComputedStyle(e).backgroundColor));
    let c = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i][3] > 0) c = over(stack[i], c);
    return c;
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const folded = (el) => { const d = el.closest('details'); return !!(d && !d.open && !el.closest('summary')); };
  const visible = (el) => { if (folded(el) || el.closest('.sr')) return false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; if (e.hasAttribute('hidden')) return false; } return true; };
  const texts = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style,.player[hidden],.pop[hidden]')) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const rects = [...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0);
    if (!rects.length || !visible(el)) continue;
    const top = Math.min(...rects.map((x) => x.top)), bottom = Math.max(...rects.map((x) => x.bottom));
    texts.push({ n, el, text: n.data, top, bottom, first: top < vh && bottom > 0 });
  }
  const out = { controls: 0, small: [], glyphs: 0, arrows: 0, chrome: 0, body: 0, sizes: {}, contrast: [], mono: [], hand: [], colour: [] };
  // 5, 14: controls in the first screen
  const ctlSel = 'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])';
  for (const c of document.querySelectorAll(ctlSel)) {
    if (c.closest('.player,.pop,.preview') || !visible(c)) continue;
    if (c.closest('p,li') && getComputedStyle(c).display === 'inline' && c.closest('main')) continue;   // an inline link in running text is reading, not chrome
    const r = c.getBoundingClientRect();
    if (r.width === 0 || r.bottom <= 0 || r.top >= vh) continue;
    if (c.tagName === 'INPUT' && c.closest('label')) { /* the field's label is the control */ }
    out.controls += 1;
    const inline = getComputedStyle(c).display === 'inline' || (!!c.closest('p') && getComputedStyle(c).display.startsWith('inline'));   // controls inside a line of text
    if (opts.phone && !inline && (r.width < 43.5 || r.height < 43.5)) out.small.push(`${c.tagName.toLowerCase()}.${c.className || ''} "${(c.textContent || c.getAttribute('aria-label') || '').trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const GLYPHS = /[◐○●✓✔▶◀▸▾±◇◆⌕◎◫⇄★☆]/g, ARROWS = /[→←↗]/g;
  const accent = parse(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgb(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)})`));
  const tokens = ['--ink', '--ink-muted', '--ink-subtle', '--accent', '--accent-ink', '--border', '--surface', '--canvas-base', '--mark-ink'].map((k) => {
    const d = document.createElement('i'); d.style.color = `var(${k})`; document.body.appendChild(d); const c = parse(getComputedStyle(d).color); d.remove(); return c;
  });
  const near = (a, b, tol = 14) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < tol;
  const sat = (c) => { const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); };
  for (const t of texts) {
    const s = getComputedStyle(t.el);
    const fs = parseFloat(s.fontSize);
    const decorative = t.el.closest('.num');
    if (t.first) {
      out.glyphs += (t.text.match(GLYPHS) || []).length;
      out.arrows += (t.text.match(ARROWS) || []).length;
      const len = t.text.trim().length;
      const inlineLink = t.el.closest('main p a, main p button.term, main li a') && getComputedStyle(t.el.closest('a,button')).display === 'inline';
      if (t.el.closest('a,button,nav,header,aside,footer') && !inlineLink) out.chrome += len; else out.body += len;
      const k = Math.round(fs * 2) / 2; out.sizes[k] = (out.sizes[k] || 0) + 1;
    }
    // 9
    if (/Space Mono/.test(s.fontFamily) && !t.el.closest('pre,code,kbd,[data-tool-log],[data-num]')) out.mono.push(t.text.trim().slice(0, 30));
    if (/Caveat/.test(s.fontFamily)) {
      const host = t.el.closest('time,[data-annot],[data-dot]');
      if (!host) out.hand.push('outside time: ' + t.text.trim().slice(0, 30));
      else if (host.textContent.trim().split(/\s+/).length > 8) out.hand.push('over 8 words: ' + host.textContent.trim().slice(0, 30));
    }
    // 16/17 contrast, whole page
    if (opts.contrast && !decorative) {
      const bg = bgOf(t.el), fg = over(parse(s.color), bg);
      const need = fs >= 24 || (fs >= 18.66 && +s.fontWeight >= 700) ? 3 : 4.5;
      const cr = ratio(fg, bg);
      if (cr < need) out.contrast.push(`${cr.toFixed(2)} "${t.text.trim().slice(0, 32)}" (${t.el.className || t.el.tagName})`);
    }
    // 12 colour coding: outside leads, figures and code
    if (opts.colour && !t.el.closest('[data-lead],[data-featured-lead],figure,pre,code,.frame')) {
      const c = parse(s.color);
      if (sat(c) >= 0.15 && !tokens.some((k) => near(c, k))) out.colour.push(`text ${s.color} "${t.text.trim().slice(0, 24)}"`);
    }
  }
  if (opts.colour) for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[data-lead],[data-featured-lead],figure,pre,code,.frame,svg') || !visible(el)) continue;
    const s = getComputedStyle(el);
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(s[`border${side}Width`]) === 0 || s[`border${side}Style`] === 'none') continue;
      const c = parse(s[`border${side}Color`]);
      if (c[3] > 0 && sat(c) >= 0.15 && !tokens.some((k) => near(c, k))) { out.colour.push(`border ${s[`border${side}Color`]} on ${el.className || el.tagName}`); break; }
    }
  }
  out.accent = accent;
  // U: every inline link is underlined (never a colour wash), and the underline holds 3:1 against its ground
  out.underline = [];
  for (const a of document.querySelectorAll('main a, main button.term')) {
    if (!visible(a) || getComputedStyle(a).display !== 'inline' || !a.closest('p,li')) continue;
    const s = getComputedStyle(a), bg = bgOf(a.parentElement);
    if (!/underline/.test(s.textDecorationLine)) { if (!a.matches('.quiet')) out.underline.push(`no underline: "${a.textContent.slice(0, 24)}"`); continue; }
    if (parse(s.backgroundColor)[3] > 0) out.underline.push(`colour wash behind "${a.textContent.slice(0, 24)}"`);
    const dc = over(parse(s.textDecorationColor), bg);
    if (ratio(dc, bg) < 3) out.underline.push(`underline ${ratio(dc, bg).toFixed(2)}:1 on "${a.textContent.slice(0, 24)}"`);
  }
  // D: a handwritten date never splits across lines
  out.splitDates = [...document.querySelectorAll('time')].filter((x) => visible(x) && x.getClientRects().length > 1).map((x) => x.textContent);
  // 13: no empty vertical strip > 240px inside the content block, over the whole first screen
  const block = document.querySelector('.page');
  if (block) {
    const br = block.getBoundingClientRect();
    const cs = getComputedStyle(block);
    const left = br.left + parseFloat(cs.paddingLeft), right = br.right - parseFloat(cs.paddingRight) + (vw >= 1440 && !document.documentElement.classList.contains('player-pushed') ? 0 : 0);
    const spans = [...block.querySelectorAll('*')].filter((e) => visible(e) && e.children.length === 0 || e.matches('.box,.panel,.frame,img'))
      .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.bottom > 56 && r.top < vh).map((r) => [r.left, r.right]).sort((a, b) => a[0] - b[0]);
    let x = left, gap = 0;
    const edge = Math.max(right, ...spans.map((s) => s[1]));
    for (const [a, b] of spans) { if (a > x) gap = Math.max(gap, a - x); x = Math.max(x, b); }
    gap = Math.max(gap, edge - x);
    out.strip = Math.round(gap);
  }
  // 14: horizontal overflow
  out.overflow = document.documentElement.scrollWidth - vw;
  return out;
};

const browser = await chromium.launch({ executablePath: exe() });
let pagesLoaded = 0;
async function open(file, q, hash, size, { reduced = false, stubStations = false, storage = null } = {}) {
  const ctx = await browser.newContext({ viewport: SIZES[size] || size, deviceScaleFactor: 1, isMobile: size === 'phone', hasTouch: size === 'phone', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(INSTRUMENT);
  if (storage) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, storage);
  const page = await ctx.newPage();
  const errors = [], net = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!/^(data|blob|file):/.test(r.url())) net.push(r.url()); });
  if (stubStations) await page.route(STATION_RE, (r) => r.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() }));
  await page.goto(url(file, q, hash));
  await page.waitForFunction(() => document.documentElement.getAttribute('data-ready') === '1');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  pagesLoaded += 1;
  return { ctx, page, errors, net, close: () => ctx.close() };
}

try {
  const probe = await open(BUNDLE, '', '#/', 'desktop');
  const routes = await probe.page.evaluate(() => Lab.routes());
  await probe.close();
  const isEntry = (r) => r.entry;
  const headings = {};

  // ---------- per route, size and look: 5-12, 14, 17, 21, 23 ----------
  for (const r of routes) for (const size of ['desktop', 'phone']) for (const look of LOOKS) {
    const tag = `${r.name} ${size} ${look.name}`;
    const o = await open(BUNDLE, look.q, r.hash, size);
    const { page } = o;
    const m = await page.evaluate(MEASURE, { phone: size === 'phone', contrast: look.name.startsWith('premium'), colour: true });
    const limits = isEntry(r) ? { d: 15, p: 11, chrome: 0.5 } : { d: 21, p: 13, chrome: 1.0 };
    if (m.controls > (size === 'phone' ? limits.p : limits.d)) fail(5, `${tag}: ${m.controls} controls on the first screen`);
    if (m.glyphs) fail(6, `${tag}: ${m.glyphs} symbol glyphs`);
    if (m.arrows > 4) fail(6, `${tag}: ${m.arrows} text arrows`);
    if (m.body && m.chrome / m.body > limits.chrome) fail(7, `${tag}: chrome:body ${(m.chrome / m.body).toFixed(2)}`);
    const sizes = Object.keys(m.sizes).map(Number);
    if (sizes.length > 6) fail(8, `${tag}: ${sizes.length} font sizes (${sizes.join(', ')})`);
    if (Math.max(...sizes) / Math.min(...sizes) < 3) fail(8, `${tag}: largest ÷ smallest ${(Math.max(...sizes) / Math.min(...sizes)).toFixed(2)}`);
    if (Math.min(...sizes) < 13) fail(8, `${tag}: smallest size ${Math.min(...sizes)}px`);
    if (sizes.filter((s) => s >= 13 && s <= 17).length > 2) fail(8, `${tag}: ${sizes.filter((s) => s >= 13 && s <= 17).join(', ')} in the 13-17px band`);
    m.mono.forEach((x) => fail(9, `${tag}: Space Mono outside code: "${x}"`));
    m.hand.forEach((x) => fail(9, `${tag}: handwriting ${x}`));
    if (isEntry(r)) {
      const lead = await page.evaluate(() => [...document.querySelectorAll('[data-lead]')].map((e) => e.getBoundingClientRect().top));
      if (lead.length !== 1) fail(10, `${tag}: ${lead.length} [data-lead]`);
      else if (lead[0] >= SIZES[size].height) fail(10, `${tag}: lead starts at ${Math.round(lead[0])}px`);
    }
    // 11: accent share of screenshot pixels
    const png = (await page.screenshot()).toString('base64');
    const share = await page.evaluate(async ([b64, acc]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - acc[0]) + Math.abs(d[i + 1] - acc[1]) + Math.abs(d[i + 2] - acc[2]) < 40) n++;
      return n / (d.length / 4);
    }, [png, m.accent]);
    if (share > 0.05) fail(11, `${tag}: accent is ${(share * 100).toFixed(1)}% of pixels`);
    m.colour.slice(0, 3).forEach((x) => fail(12, `${tag}: colour outside the tokens: ${x}`));
    if (m.overflow > 0) fail(14, `${tag}: horizontal overflow ${m.overflow}px`);
    m.small.forEach((x) => fail(14, `${tag}: control under 44×44: ${x}`));
    m.contrast.slice(0, 4).forEach((x) => fail(17, `${tag}: contrast ${x}`));
    if (size === 'desktop' && (m.strip || 0) > 240) fail(13, `${tag}: empty strip ${m.strip}px inside the content block`);
    // 14: the last paragraph and the footer aren't covered by a fixed element
    const covered = await page.evaluate(async () => {
      scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 350));
      const bad = [];
      for (const el of [...document.querySelectorAll('main p')].slice(-1).concat([document.querySelector('.foot-line')])) {
        const r = el.getBoundingClientRect(); const x = r.left + Math.min(20, r.width / 2), y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        if (hit && !el.contains(hit) && !hit.contains(el)) bad.push(`${el.className || el.tagName} under ${hit.className || hit.tagName}`);
      }
      return bad;
    });
    covered.forEach((x) => fail(14, `${tag}: ${x}`));
    // 15: headings, by route
    if (size === 'desktop' && look.name === 'paper/cream') headings[r.name] = await page.evaluate(() => [...document.querySelectorAll('main h2, main h3')].map((h) => h.textContent.trim().toLowerCase()));
    // 23: collapsed, silent on arrival
    const a = await page.evaluate(() => ({ ...window.__audio, panel: !document.getElementById('player').hidden, el: !!document.querySelector('audio,video') }));
    if (a.contexts || a.media || a.el) fail(20, `${tag}: audio on load (contexts ${a.contexts}, media ${a.media})`);
    if (a.panel) fail(23, `${tag}: side player open on arrival`);
    if (o.errors.length) fail(21, `${tag}: ${o.errors.slice(0, 2).join(' | ')}`);
    if (o.net.length) fail(21, `${tag}: network ${o.net.slice(0, 2).join(' ')}`);
    m.underline.slice(0, 3).forEach((x) => fail('U', `${tag}: ${x}`));
    m.splitDates.forEach((x) => fail('D', `${tag}: the date "${x}" splits across lines`));
    // (b): at 390×844 the haggle input is above the fold on chapter 05; on the home, the intro comes
    // first and the top of "New here?" or Latest is on the first screen
    if (size === 'phone') {
      const fold = await page.evaluate(() => {
        const i = document.querySelector('[data-lead] .haggle-form input');
        const top = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect().top : null; };
        return { input: i && i.getBoundingClientRect().bottom, intro: top('.intro'), next: Math.min(...['.newhere', '.latest'].map(top).filter((v) => v != null)) };
      });
      if (isEntry(r) && fold.input != null && fold.input > 844) fail('b', `${tag}: haggle input ends at ${Math.round(fold.input)}px`);
      if (!isEntry(r) && !(fold.intro < fold.next && fold.next < 844)) fail('b', `${tag}: intro at ${Math.round(fold.intro)}px, "New here?"/Latest at ${Math.round(fold.next)}px`);
    }
    await o.close();
  }
  note(`per-route checks: ${pagesLoaded} page loads`);

  // ---------- 13: measure ----------
  const entry = routes.find(isEntry);
  for (const [size, q, lo, hi] of [[{ width: 1440, height: 900 }, '', 85, 100], [{ width: 1280, height: 800 }, '', 78, 100], [{ width: 1440, height: 900 }, 'aa', 66, 76], ['phone', '', 32, 999], [{ width: 1920, height: 1080 }, '', 85, 100]]) {
    const o = await open(BUNDLE, 'look=paper', entry.hash, size, { storage: q === 'aa' ? { 'lab.aa': '{"measure":"comfortable"}' } : null });
    const r = await o.page.evaluate(() => {
      const ps = [...document.querySelectorAll('.entry-body > p:not(.lede)')];
      const counts = [];
      for (const p of ps) {
        const lines = new Map();
        const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        for (let n; (n = tw.nextNode());) for (let i = 0; i < n.data.length; i++) {
          const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
          const rc = rg.getClientRects()[0]; if (!rc) continue;
          const k = Math.round(rc.top / 4); lines.set(k, (lines.get(k) || 0) + 1);
        }
        const v = [...lines.values()]; v.pop();   // the last line of a paragraph is short by nature
        counts.push(...v);
      }
      const s = getComputedStyle(ps[0]);
      return { avg: counts.reduce((a, b) => a + b, 0) / counts.length, lh: parseFloat(s.lineHeight) / parseFloat(s.fontSize) };
    });
    const label = `${typeof size === 'string' ? size : size.width}${q ? ' comfortable' : ''}`;
    if (!(r.avg >= lo && r.avg <= hi)) fail(13, `measure at ${label}: ${r.avg.toFixed(1)} characters a line (want ${lo}-${hi})`);
    if (typeof size !== 'string' && r.lh < 1.7) fail(13, `line height at ${label}: ${r.lh.toFixed(2)}`);
    if (typeof size !== 'string' && size.width === 1920) {
      const m = await o.page.evaluate(MEASURE, {});
      if (m.strip > 240) fail(13, `1920: empty strip ${m.strip}px inside the content block`);
    }
    note(`measure ${label}: ${r.avg.toFixed(1)} chars/line, lh ${r.lh.toFixed(2)}`);
    await o.close();
  }

  // ---------- 15: headings across routes ----------
  const SLOTS = ['what it is', 'try it', 'how it\'s built', 'how it’s built', 'code', 'what broke', 'what i measured', 'overview', 'summary', 'introduction', 'conclusion', 'key takeaways', 'where this fits'];
  const seen = {};
  for (const [rname, hs] of Object.entries(headings)) for (const h of new Set(hs)) { (seen[h] = seen[h] || []).push(rname); if (SLOTS.includes(h)) fail(15, `slot-name heading "${h}" on ${rname}`); }
  for (const [h, rs] of Object.entries(seen)) if (rs.length >= 3) fail(15, `heading "${h}" on ${rs.length} pages`);

  // ---------- 16: Paper, all 18 themes, every route, desktop ----------
  const themes = L.data.themes.map((t) => t.id);
  for (const th of themes) for (const r of routes) {
    const o = await open(BUNDLE, `look=paper&theme=${th}`, r.hash, 'desktop');
    await o.page.evaluate(() => { const a = document.querySelector('[data-ab="A"]'); if (a) a.click(); const d = document.querySelector('details.series'); if (d) d.open = true; });
    // open a preview, so its window is checked too
    const link = await o.page.$('main a[data-preview]');
    if (link) { await link.hover(); await o.page.waitForTimeout(650); }
    const m = await o.page.evaluate(MEASURE, { contrast: true });
    m.contrast.slice(0, 3).forEach((x) => fail(16, `${th} ${r.name}: contrast ${x}`));
    if (o.errors.length) fail(21, `${th} ${r.name}: ${o.errors[0]}`);
    await o.close();
  }
  note(`contrast: ${themes.length} Paper themes × ${routes.length} routes`);
  // 17 extra: Premium with the preview and A open
  for (const look of LOOKS.slice(2)) for (const size of ['desktop', 'phone']) {
    const o = await open(BUNDLE, look.q, entry.hash, size);
    await o.page.evaluate(() => { const d = document.querySelector('details.log'); if (d) d.open = true; document.querySelector('[data-ab="A"]').click(); });
    const m = await o.page.evaluate(MEASURE, { contrast: true });
    m.contrast.slice(0, 3).forEach((x) => fail(17, `${look.name} ${size} with A open: ${x}`));
    await o.close();
  }

  // ---------- 18: the Look switch ----------
  for (const r of routes) for (const size of ['desktop', 'phone']) {
    const o = await open(BUNDLE, '', r.hash, size);
    const p = o.page;
    if (await p.evaluate(() => document.documentElement.dataset.look) !== 'paper') fail(18, `${r.name} ${size}: default look isn't Paper`);
    const sel = size === 'phone' ? '[data-look-toggle]' : '.look [data-look="premium"]';
    if (!(await p.isVisible(sel))) { fail(18, `${r.name} ${size}: no visible Look switch`); await o.close(); continue; }
    const rects = () => p.evaluate(() => [...document.querySelectorAll('main [data-lead], main h1, main p')].map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }));
    const before = await rects();
    await p.click(sel);
    await p.waitForTimeout(420);
    if (await p.evaluate(() => document.documentElement.dataset.look) !== 'premium') fail(18, `${r.name} ${size}: switch didn't set data-look`);
    const after = await rects();
    const moved = before.reduce((mx, b, i) => Math.max(mx, ...b.map((v, j) => Math.abs(v - after[i][j]))), 0);
    if (moved > 1) fail(18, `${r.name} ${size}: switching look moved an element ${moved.toFixed(1)}px`);
    await p.reload(); await p.waitForFunction(() => document.documentElement.getAttribute('data-ready') === '1');
    if (await p.evaluate(() => document.documentElement.dataset.look + '|' + localStorage.getItem('lab.look')) !== 'premium|premium') fail(18, `${r.name} ${size}: look not remembered across reload`);
    await o.close();
  }

  // ---------- 19: motion ----------
  for (const r of routes) {
    const o = await open(BUNDLE, '', r.hash, 'desktop', { reduced: true });
    const res = await o.page.evaluate(async () => {
      const dot = document.querySelector('.dot');
      const t0 = getComputedStyle(dot).transform;
      scrollTo(0, 600); await new Promise((x) => setTimeout(x, 400));
      const bad = document.getAnimations().filter((a) => {
        const kf = a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : [];
        const props = new Set(kf.flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))));
        const onlyOpacity = [...props].every((p) => p === 'opacity');
        return !onlyOpacity && (a.effect.getTiming().duration > 120);
      }).map((a) => a.animationName || a.transitionProperty || 'waapi');
      return { bad, moved: getComputedStyle(dot).transform !== t0 };
    });
    res.bad.forEach((x) => fail(19, `${r.name} reduced motion: animation "${x}" isn't opacity-only or ≤ 120ms`));
    if (res.moved) fail(19, `${r.name} reduced motion: the dot moved`);
    await o.close();
    const o2 = await open(BUNDLE, '', r.hash, 'desktop');
    const easings = await o2.page.evaluate(() => {
      const ok = (e) => /cubic-bezier\(0\.16, 1, 0\.3, 1\)|^linear$/.test(e.trim());
      const bad = new Set();
      for (const el of document.querySelectorAll('*')) {
        const s = getComputedStyle(el);
        const durs = s.transitionDuration.split(','), fns = s.transitionTimingFunction.split(/,(?![^(]*\))/);
        durs.forEach((d, i) => { if (parseFloat(d) > 0 && !ok(fns[i % fns.length])) bad.add('transition ' + fns[i % fns.length] + ' on ' + (el.className || el.tagName)); });
        if (s.animationName !== 'none' && !s.animationTimingFunction.split(/,(?![^(]*\))/).every(ok)) bad.add('animation ' + s.animationName + ' ' + s.animationTimingFunction);
      }
      return [...bad];
    });
    easings.slice(0, 4).forEach((x) => fail(19, `${r.name}: ${x}`));
    await o2.close();
  }

  // ---------- 20: cue peaks ----------
  {
    const o = await open(BUNDLE, '', '#/', 'desktop');
    const peaks = await o.page.evaluate(async () => {
      Lab.audio.setInterface(true);
      const out = {};
      for (const name of Lab.audio.cueNames) { window.__audio.sched = []; Lab.audio.cue(name); out[name] = Math.max(0, ...window.__audio.sched.map((s) => s.v)); }
      return out;
    });
    for (const [k, v] of Object.entries(peaks)) if (!(v > 0 && v <= 0.08)) fail(20, `cue ${k}: peak ${v}`);
    await o.close();
  }

  // ---------- 22 (part): sections come from data ----------
  {
    const o = await open(CHECK, 'fixture=kinds', '#/', 'desktop');
    const secs = await o.page.evaluate(() => [...document.querySelectorAll('.sections h3')].map((h) => h.textContent));
    if (!secs.includes('Fixture section')) fail(22, 'the fixture\'s new section is missing from the home');
    if (!secs.includes('Experiments')) fail(22, 'Experiments didn\'t appear once it had an entry');
    await o.close();
    const o2 = await open(BUNDLE, '', '#/', 'desktop');
    const secs2 = await o2.page.evaluate(() => [...document.querySelectorAll('.sections h3')].map((h) => h.textContent));
    if (secs2.includes('Experiments')) fail(22, 'an empty section (Experiments) rendered');
    await o2.close();
  }

  // ---------- H: the home is evergreen ----------
  // H1 no entry title (or entry link) outside Latest; H2 no time words and nothing that counts
  // progress; checked in both looks at both sizes, in the default and the fixture data.
  const TIME_WORDS = /\b(now|currently|current|this (week|month|year)|latest work|just|ago|today|tonight|yesterday|recently|lately|so far|streak|in progress|still going|newest|up to date|soon)\b/i;
  for (const [file, q0] of [[BUNDLE, ''], [CHECK, 'fixture=kinds&']]) for (const size of ['desktop', 'phone']) for (const look of [LOOKS[0], LOOKS[3]]) {
    const tag = `home ${size} ${look.name}${file === CHECK ? ' fixture' : ''}`;
    const o = await open(file, q0 + look.q, '#/', size);
    const h = await o.page.evaluate(() => {
      const titles = Lab.data.entries.map((e) => e.title);
      const latest = document.querySelector('[data-latest]');
      const outside = [];
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let copy = '';
      for (let n; (n = tw.nextNode());) {
        const el = n.parentElement;
        if (!el || el.closest('script,style,#player,.pop,.preview')) continue;
        if (!(latest && latest.contains(el))) for (const t of titles) if (n.data.includes(t)) outside.push(t);
        if (!el.closest('.row-title')) copy += ' ' + n.data;
      }
      for (const el of document.querySelectorAll('main [aria-label], .bar [aria-label]')) copy += ' ' + el.getAttribute('aria-label');
      const links = [...document.querySelectorAll('[data-preview]')].filter((a) => Lab.entry(a.dataset.preview) && !(latest && latest.contains(a))).map((a) => a.dataset.preview);
      return { outside, links, copy, latestRows: latest ? latest.children.length : 0, ticks: document.querySelectorAll('main .ticks, main progress, main [role="progressbar"]').length };
    });
    h.outside.forEach((x) => fail('H1', `${tag}: entry title "${x}" outside Latest`));
    h.links.forEach((x) => fail('H1', `${tag}: a link to entry "${x}" outside Latest`));
    if (!h.latestRows) fail('H1', `${tag}: Latest is empty`);
    const tw = h.copy.match(TIME_WORDS);
    if (tw) fail('H2', `${tag}: time word "${tw[0]}" in the home's copy`);
    if (/\b\d+ of \d+\b/.test(h.copy) || h.ticks) fail('H2', `${tag}: something counts progress`);
    if (o.errors.length) fail(21, `${tag}: ${o.errors[0]}`);
    await o.close();
  }
  note('home: evergreen rules checked');

  // ---------- N: the name card plays only on an explicit action ----------
  {
    const o = await open(BUNDLE, '', '#/', 'desktop');
    const p = o.page;
    const st = () => p.evaluate(() => ({ open: !!document.querySelector('.preview.is-open[data-for="name"]'), speak: window.__audio.speak, ctx: window.__audio.contexts }));
    if (await p.$('.say')) fail('N', 'the old "(say it)" trigger is still on the home');
    const style = await p.evaluate(() => { const b = document.querySelector('main button.name'); return b && { line: getComputedStyle(b).textDecorationLine, style: getComputedStyle(b).textDecorationStyle, text: b.textContent }; });
    if (!style || !/underline/.test(style.line) || style.style !== 'dotted') fail('N', `his name isn't a dotted underline (${JSON.stringify(style)})`);
    await p.hover('main button.name'); await p.waitForTimeout(900);
    let s1 = await st();
    if (!s1.open) fail('N', 'hovering the name opened no card');
    const card = await p.evaluate(() => { const c = document.querySelector('.preview'); return { text: c.textContent, play: !!c.querySelector('[data-say]') }; });
    if (!/AH-hil KHAN/.test(card.text) || !card.play) fail('N', 'the card lacks the pronunciation or the play control');
    await p.mouse.move(700, 160); await p.waitForTimeout(150); await p.hover('main button.name'); await p.waitForTimeout(2000);
    s1 = await st();
    if (s1.speak) fail('N', `hover spoke the name ${s1.speak} times`);
    await p.click('.preview [data-say]'); await p.waitForTimeout(100);
    if ((await st()).speak !== 1) fail('N', 'clicking play didn\'t say the name once');
    await p.keyboard.press('Escape');
    if ((await st()).open) fail('N', 'Esc didn\'t close the name card');
    // keyboard: Enter on the name opens the card and moves focus to play; Enter on play says it
    await p.focus('main button.name'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
    const focused = await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-say'));
    if (!(await st()).open || !focused) fail('N', 'Enter on the name didn\'t open the card with focus on play');
    if ((await st()).speak !== 1) fail('N', 'opening the card by keyboard spoke the name');
    await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    if ((await st()).speak !== 2) fail('N', 'Enter on play didn\'t say the name');
    if (o.errors.length) fail(21, `name card: ${o.errors[0]}`);
    await o.close();
    // phone: a tap opens the sheet, says nothing; a tap on play says it
    const o2 = await open(BUNDLE, '', '#/', 'phone');
    await o2.page.tap('main button.name'); await o2.page.waitForTimeout(400);
    const ph = await o2.page.evaluate(() => ({ open: !!document.querySelector('.preview.is-sheet.is-open[data-for="name"]'), speak: window.__audio.speak }));
    if (!ph.open || ph.speak) fail('N', `phone: tap on the name (sheet open ${ph.open}, spoke ${ph.speak})`);
    await o2.page.tap('.preview [data-say]'); await o2.page.waitForTimeout(100);
    if ((await o2.page.evaluate(() => window.__audio.speak)) !== 1) fail('N', 'phone: tapping play didn\'t say the name');
    await o2.close();
  }

  // ---------- P: chapter 05's term links and references, each with a preview ----------
  for (const look of [LOOKS[0], LOOKS[3]]) {
    const o = await open(BUNDLE, look.q, entry.hash, 'desktop');
    const p = o.page;
    const keys = await p.evaluate(() => {
      const t = [...new Set([...document.querySelectorAll('.entry-body [data-preview^="term:"]')].map((a) => a.dataset.preview))];
      const r = [...new Set([...document.querySelectorAll('.entry-body sup.ref a')].map((a) => a.dataset.preview))];
      return { t, r, listed: document.querySelectorAll('ol.refs li').length, entries: [...new Set([...document.querySelectorAll('.entry-body a[data-preview]')].map((a) => a.dataset.preview).filter((k) => Lab.entry(k)))] };
    });
    if (keys.t.length < 8) fail('P', `${look.name}: ${keys.t.length} distinct term links on chapter 05 (want 8+)`);
    if (keys.r.length < 3) fail('P', `${look.name}: ${keys.r.length} references (want 3+)`);
    if (keys.listed !== keys.r.length) fail('P', `${look.name}: ${keys.listed} References entries for ${keys.r.length} citations`);
    if (!keys.entries.length) fail('P', `${look.name}: no inline entry links in the text`);
    const badHref = await p.evaluate(() => [...document.querySelectorAll('a[data-preview]')].filter((a) => !/^(#\/|#ref-|https:\/\/)/.test(a.getAttribute('href') || '') || a.attributes.length > 5).map((a) => a.outerHTML.slice(0, 80)));
    badHref.slice(0, 3).forEach((x) => fail('P', `${look.name}: a link with a broken href: ${x}`));
    for (const k of [...keys.t, ...keys.r, ...keys.entries]) {
      const sel = `.entry-body [data-preview="${k}"]`;
      await p.mouse.move(5, 300); await p.waitForTimeout(400);   // past the last card's dismiss delay
      await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(80);
      // aim at the first line box: a link that wraps has a gap between its lines at its centre
      const pt = await p.evaluate((sel) => { const r = document.querySelector(sel).getClientRects()[0]; return [r.left + Math.min(8, r.width / 2), r.top + r.height / 2]; }, sel);
      await p.mouse.move(pt[0], pt[1], { steps: 2 }); await p.waitForTimeout(650);
      const c = await p.evaluate((k) => { const v = document.querySelector('.preview'); return v && { open: v.classList.contains('is-open') && v.dataset.for === k, h3: (v.querySelector('h3') || {}).textContent, more: !!v.querySelector('.card-more a') }; }, k);
      if (!c || !c.open || !c.h3) fail('P', `${look.name}: hovering ${k} showed no preview`);
      else if (!c.more) fail('P', `${look.name}: the ${k} card has no link to go further`);
    }
    // hover intent: sweeping across a paragraph's links opens nothing
    const sweep = await p.evaluate(async () => {
      const links = [...document.querySelectorAll('.entry-body [data-preview]')].slice(0, 6);
      links[0].scrollIntoView({ block: 'center' }); await new Promise((r) => setTimeout(r, 300));
      return links.map((a) => { const r = a.getBoundingClientRect(); return [r.left + 4, r.top + r.height / 2]; });
    });
    await p.mouse.move(5, 5); await p.waitForTimeout(400);
    let flashed = 0;
    for (const [x, y] of sweep) { await p.mouse.move(x, y, { steps: 2 }); await p.waitForTimeout(90); if (await p.evaluate(() => { const v = document.querySelector('.preview'); return !!v && !v.hidden; })) flashed += 1; }
    await p.mouse.move(5, 5); await p.waitForTimeout(400);
    if (flashed) fail('P', `${look.name}: a quick sweep across links opened ${flashed} previews (hover intent)`);
    // dismiss delay: off the link for less than the delay and back keeps the card; off it for longer closes it
    const [x0, y0] = sweep[0];
    await p.mouse.move(x0, y0); await p.waitForTimeout(650);
    await p.mouse.move(x0, y0 - 40); await p.waitForTimeout(100); await p.mouse.move(x0, y0); await p.waitForTimeout(300);
    const kept = await p.evaluate(() => { const v = document.querySelector('.preview'); return !!v && !v.hidden; });
    await p.mouse.move(5, 5); await p.waitForTimeout(500);
    const gone = await p.evaluate(() => { const v = document.querySelector('.preview'); return !v || v.hidden; });
    if (!kept) fail('P', `${look.name}: the card closed at once when the pointer slipped off (no dismiss delay)`);
    if (!gone) fail('P', `${look.name}: the card stayed open after the pointer left`);
    // R: Related renders, with linked entries and also-related by shared tags
    const rel = await p.evaluate(() => ({ box: !!document.querySelector('[data-related]'), linked: document.querySelectorAll('[data-linked] li').length, also: document.querySelectorAll('[data-also] li').length }));
    if (!rel.box || !rel.linked || !rel.also) fail('R', `${look.name}: Related on chapter 05 (linked ${rel.linked}, also ${rel.also})`);
    if (o.errors.length) fail(21, `previews ${look.name}: ${o.errors[0]}`);
    await o.close();
  }
  // phones: the first tap opens a sheet with a way further and a Close, never over the tapped words;
  // an outside tap and Esc close it; a second tap on the same words follows the link
  for (const look of [LOOKS[0], LOOKS[3]]) {
    const o = await open(BUNDLE, look.q, entry.hash, 'phone');
    const p = o.page;
    const keys = await p.evaluate(() => [...new Set([...document.querySelectorAll('.entry-body [data-preview^="term:"], .entry-body sup.ref a')].map((a) => a.dataset.preview))].slice(0, 6));
    for (const k of keys) {
      const sel = `.entry-body [data-preview="${k}"]`;
      await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
      const hash0 = await p.evaluate(() => location.hash);
      await p.locator(sel).first().tap(); await p.waitForTimeout(450);
      const c = await p.evaluate(([sel, k]) => {
        const v = document.querySelector('.preview'), a = document.querySelector(sel);
        if (!v || v.hidden) return null;
        const vr = v.getBoundingClientRect(), ar = a.getBoundingClientRect(), x = v.querySelector('[data-card-close]').getBoundingClientRect();
        return { sheet: v.classList.contains('is-sheet') && v.dataset.for === k, covered: ar.bottom > vr.top + 1, more: !!v.querySelector('.card-more a'), close: x.width >= 44 && x.height >= 44, hash: location.hash };
      }, [sel, k]);
      if (!c) { fail('P', `${look.name} phone: tapping ${k} opened nothing`); continue; }
      if (!c.sheet) fail('P', `${look.name} phone: ${k} didn't open as a sheet`);
      if (c.covered) fail('P', `${look.name} phone: the ${k} card covers the tapped words`);
      if (!c.more || !c.close) fail('P', `${look.name} phone: the ${k} card lacks a way further or a 44px Close`);
      if (c.hash !== hash0) fail('P', `${look.name} phone: the first tap on ${k} navigated`);
      await p.touchscreen.tap(6, 200); await p.waitForTimeout(250);
      if (await p.evaluate(() => { const v = document.querySelector('.preview'); return !!v && !v.hidden; })) fail('P', `${look.name} phone: an outside tap didn't close the ${k} card`);
    }
    // Esc, then the second tap
    const k0 = keys[0], sel0 = `.entry-body [data-preview="${k0}"]`;
    await p.locator(sel0).first().scrollIntoViewIfNeeded(); await p.locator(sel0).first().tap(); await p.waitForTimeout(350);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    if (await p.evaluate(() => { const v = document.querySelector('.preview'); return !!v && !v.hidden; })) fail('P', `${look.name} phone: Esc didn't close the card`);
    const term = keys.find((k) => k.startsWith('term:')), selT = `.entry-body [data-preview="${term}"]`;
    await p.locator(selT).first().scrollIntoViewIfNeeded(); await p.locator(selT).first().tap(); await p.waitForTimeout(350);
    const want = await p.evaluate((sel) => document.querySelector(sel).getAttribute('href'), selT);
    await p.locator(selT).first().tap(); await p.waitForTimeout(450);
    const after = await p.evaluate(() => location.hash);
    if (after !== want) fail('P', `${look.name} phone: a second tap on ${term} went to "${after}", not its link "${want}"`);
    if (o.errors.length) fail(21, `phone previews ${look.name}: ${o.errors[0]}`);
    await o.close();
  }
  note('previews: hover, intent, dismiss, phone taps and Related checked');

  // ---------- 23-26: the side player ----------
  // 23: a stored "on" and station never auto-resume
  {
    const o = await open(BUNDLE, '', '#/', 'desktop', { storage: { 'canvas.ambience': 'on', 'canvas.station': 'chillhop', 'canvas.sound': 'on' } });
    await o.page.waitForTimeout(400);
    const a = await o.page.evaluate(() => ({ ...window.__audio, el: !!document.querySelector('audio') }));
    if (a.contexts || a.media || a.el) fail(23, `stored "on" auto-resumed (contexts ${a.contexts}, media ${a.media})`);
    await o.close();
  }
  // 24 + 25 + mute, desktop
  for (const w of [1280, 1440, 1920]) {
    const o = await open(BUNDLE, '', entry.hash, { width: w, height: 900 }, { stubStations: true });
    const p = o.page;
    await p.click('[data-sound]');
    await p.click('[data-station="lofi"]');
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const pr = document.querySelector('#player').getBoundingClientRect(), b = document.querySelector('.entry-body').getBoundingClientRect();
      return { open: !document.querySelector('#player').hidden, hit: pr.left < b.right && pr.right > b.left && pr.top < b.bottom && pr.bottom > b.top, music: Lab.player.music };
    });
    if (!r.open) fail(24, `${w}: panel closed itself after a pick on desktop`);
    if (r.hit) fail(24, `${w}: the open panel covers the prose column`);
    if (r.music !== 'playing') fail(25, `${w}: station didn't start with the stub (${r.music})`);
    if (w === 1440) {
      // 24: panel closed, music playing: nothing fixed but the bar crosses the prose
      await p.keyboard.press('Escape');
      const cover = await p.evaluate(() => {
        const b = document.querySelector('.entry-body').getBoundingClientRect();
        return [...document.querySelectorAll('body *')].filter((e) => { const s = getComputedStyle(e); return (s.position === 'fixed' || s.position === 'sticky') && !e.closest('.bar') && s.display !== 'none' && !e.hidden; })
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top; }).map((e) => e.className || e.tagName);
      });
      cover.forEach((c) => fail(24, `1440: ${c} crosses the prose while music plays`));
      // 25: a noise under the music, then three internal links
      await p.click('[data-sound]');
      await p.click('#tab-noise');
      if ((await p.getAttribute('[data-sw="under"]', 'aria-checked')) !== 'true') await p.click('[data-sw="under"]');
      await p.click('[data-noise="rain"]');
      await p.keyboard.press('Escape');
      await p.evaluate(() => { window.__el = document.querySelector('audio[data-lab-player]'); window.__ctx = Lab.audio.context(); });
      for (const sel of ['.bar-lab', '[data-latest] a[data-preview="shopkeeper-05"]', '.bar-lab']) { await p.click(sel); await p.waitForTimeout(450); }
      const s = await p.evaluate(() => ({ same: document.querySelector('audio[data-lab-player]') === window.__el, playing: !window.__el.paused, noise: Lab.noise.playing(), ctx: Lab.audio.context() === window.__ctx, contexts: window.__audio.contexts, route: location.hash }));
      if (!s.same || !s.playing) fail(25, `music didn't survive navigation (same element ${s.same}, playing ${s.playing})`);
      if (s.noise !== 'rain' || !s.ctx || s.contexts !== 1) fail(25, `noise didn't survive navigation (noise ${s.noise}, same context ${s.ctx}, contexts ${s.contexts})`);
      // 23: mute silences everything
      const mute = await p.evaluate(() => { Lab.audio.setMuted(true); return { master: Lab.audio.nodes.master.gain.value, el: window.__el.muted || window.__el.volume === 0 }; });
      if (mute.master !== 0 || !mute.el) fail(23, 'mute left something audible');
    }
    if (o.errors.length) fail(21, `player ${w}: ${o.errors[0]}`);
    if (o.net.some((u) => !STATION_RE.test(u))) fail(21, `player ${w}: unexpected request`);
    await o.close();
  }
  // 24: on a phone the open panel closes on a pick, a page scroll, Esc and a tap outside
  {
    const o = await open(BUNDLE, '', entry.hash, 'phone', { stubStations: true });
    const p = o.page;
    const isOpen = () => p.evaluate(() => !document.getElementById('player').hidden);
    const steps = [
      ['a pick', async () => p.click('[data-station="chillhop"]')],
      ['a scroll', async () => p.evaluate(() => scrollBy(0, 200))],
      ['Esc', async () => p.keyboard.press('Escape')],
      ['a tap outside', async () => p.touchscreen.tap(195, 800)],
    ];
    for (const [what, act] of steps) {
      await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(150);
      await p.click('[data-sound]'); await p.waitForTimeout(100);
      if (!(await isOpen())) { fail(24, `phone: panel didn't open before ${what}`); continue; }
      await act(); await p.waitForTimeout(250);
      if (await isOpen()) fail(24, `phone: panel stayed open after ${what}`);
    }
    await o.close();
  }
  // 26: noise peaks, limiter, fades, routing
  {
    const o = await open(BUNDLE, '', '#/', 'desktop');
    const res = await o.page.evaluate(async () => {
      Lab.audio.setLevel('noise', 1);
      const c = Lab.audio.context();
      window.__audio.ctxNow = () => c.currentTime;
      await c.resume();
      const an = c.createAnalyser(); an.fftSize = 2048; Lab.audio.nodes.noise.connect(an);
      const buf = new Float32Array(an.fftSize);
      const out = {};
      for (const id of Object.keys(Lab.noise.textures)) {
        window.__audio.connects = []; window.__audio.ramps = [];
        Lab.noise.start(id);
        const cueHit = window.__audio.connects.includes(Lab.audio.nodes.cue);
        const fade = Math.min(...window.__audio.ramps.filter((r) => r.v >= 0.2).map((r) => r.dt));
        await new Promise((r) => setTimeout(r, 900));
        let peak = 0;
        for (let i = 0; i < 25; i++) { an.getFloatTimeDomainData(buf); for (const v of buf) peak = Math.max(peak, Math.abs(v)); await new Promise((r) => setTimeout(r, 80)); }
        out[id] = { peak, cueHit, fade, state: c.state };
        Lab.noise.stop();
        await new Promise((r) => setTimeout(r, 900));
      }
      return { out, limiter: [Lab.audio.nodes.limiter.threshold.value, Lab.audio.nodes.limiter.ratio.value] };
    });
    for (const [id, r] of Object.entries(res.out)) {
      if (r.peak > 0.25) fail(26, `noise ${id}: peak ${r.peak.toFixed(3)} at full level`);
      if (r.peak === 0 && r.state === 'running') fail(26, `noise ${id}: produced no signal`);
      if (r.cueHit) fail(26, `noise ${id} routes through the interface cue bus`);
      if (!(r.fade >= 0.5)) fail(26, `noise ${id}: fade-in ${r.fade}s`);
      note(`noise ${id}: peak ${r.peak.toFixed(3)}, fade ${r.fade.toFixed(2)}s (${r.state})`);
    }
    if (res.limiter[0] !== -12 || res.limiter[1] !== 8) fail(26, `limiter is ${res.limiter}`);
    await o.close();
  }
} finally {
  await browser.close();
}

for (const f of fails) note(f);
note(fails.length ? `LAB-V2B FAIL ${fails.length}` : 'LAB-V2B OK');
process.exit(fails.length ? 1 : 0);
