// The Lab extras check (plan plan-the-real-lab, PR 3). Bundles the page into one self-contained file,
// then opens it at file:// in the cached Chromium, every view in every look it applies to, at 390×844
// and 1440×900. Prints each failed assertion, then EXTRAS OK (exit 0) or EXTRAS FAIL n (exit 1).
//   cx heavy -- node prototype/lab-v2b-extras/check.mjs
//   node prototype/lab-v2b-extras/check.mjs --bundle     bundle only, no browser
// Rules:
//   O  no overflow: nothing scrolls sideways, no box clips its text, every card's content fits its frame
//   C  contrast: every visible text node ≥ 4.5:1 (3:1 when large) on its real ground, in cream, tokyo-night, Day and Night
//   A  accent ≤ 5% of the screen's pixels
//   G  every share card is exactly 1200 × 630, and there are 15 (5 kinds × 3 looks)
//   P  every name take decodes, is 0.5–2 s long, and plays
//   N  no network request on load, and no script error
//   S  the bundle is under 8 MB
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, extname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const fails = [];
const fail = (id, msg) => fails.push(`[${id}] ${msg}`);
const note = (s) => process.stdout.write(s + '\n');

// ---------- bundle ----------
const MIME = { '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.opus': 'audio/ogg; codecs=opus' };
const dataUri = (p) => {
  if (!existsSync(p)) throw new Error(`missing asset ${p}`);
  return `data:${MIME[extname(p)]};base64,${readFileSync(p).toString('base64')}`;
};
function bundle() {
  let html = readFileSync(join(here, 'index.html'), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
    const base = dirname(resolve(here, href));
    const css = readFileSync(resolve(here, href), 'utf8').replace(/url\(([^)'"]+)\)/g, (m, u) => (u.startsWith('data:') ? m : `url(${dataUri(resolve(base, u))})`));
    return `<style>\n${css}\n</style>`;
  });
  // only the asset template holds file paths; the scripts read them from there
  html = html.replace(/<template id="assets">[\s\S]*?<\/template>/, (tpl) =>
    tpl.replace(/(\ssrc=")([^"]+)(")/g, (m, a, src, b) => (src.startsWith('data:') ? m : a + dataUri(resolve(here, src)) + b)));
  return html;
}
const out = bundle();
mkdirSync(join(here, '.build'), { recursive: true });
const BUNDLE = join(here, '.build/lab-extras.html');
writeFileSync(BUNDLE, out);
const deliver = join(homedir(), 'projects/scratch/lab-mockups');
if (existsSync(deliver)) writeFileSync(join(deliver, 'lab-extras.html'), out);
const mb = Buffer.byteLength(out) / 1048576;
note(`lab-extras.html: ${mb.toFixed(2)} MB${existsSync(deliver) ? ` -> ${join(deliver, 'lab-extras.html')}` : ''}`);
if (mb >= 8) fail('S', `the bundle is ${mb.toFixed(2)} MB`);
if (/(?:src|href)="(?:\.\.\/|audio\/)|url\((?!data:)[^)]*\.(?:woff2|webp|png|svg|opus)/.test(out)) fail('S', 'the bundle still points at a local file');
if (process.argv.includes('--bundle')) process.exit(fails.length ? 1 : 0);

// ---------- browser ----------
const { chromium } = require(join(homedir(), '.local/share/cx-tools/node_modules/playwright-core'));
function exe() {
  if (process.env.CX_CHROMIUM) return process.env.CX_CHROMIUM;
  const cache = join(homedir(), '.cache/ms-playwright');
  const ds = existsSync(cache) ? readdirSync(cache).sort().reverse() : [];
  return ds.flatMap((d) => ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/headless_shell', 'chrome-linux64/chrome'].map((r) => join(cache, d, r))).find(existsSync);
}
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const SITE = ['theme=cream', 'theme=tokyo-night'];
const LAB = ['look=paper&theme=cream', 'look=paper&theme=tokyo-night', 'look=premium&mode=day', 'look=premium&mode=night'];
const RUNS = [
  ['site-nav', SITE], ['site-band', SITE], ['site-contrib', SITE], ['canvas-lab', SITE],
  ['back-desk', LAB], ['colophon', LAB], ['agents', LAB], ['voices', LAB],
  ['cards', ['']], ['index', ['']],
];

// In-page: overflow, contrast and the cards, for one screen of one view.
const MEASURE = () => {
  const parse = (c) => {
    let m = c.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; }
    m = c.match(/color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] == null ? 1 : p[3]]; }
    return [0, 0, 0, 0];
  };
  const over = (t, b) => { const a = t[3]; return [t[0] * a + b[0] * (1 - a), t[1] * a + b[1] * (1 - a), t[2] * a + b[2] * (1 - a), 1]; };
  const rootBg = parse(getComputedStyle(document.body).backgroundColor);
  const bgOf = (el) => {
    const stack = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) stack.push(parse(getComputedStyle(e).backgroundColor));
    let c = rootBg[3] ? rootBg : [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i][3] > 0) c = over(stack[i], c);
    return c;
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const visible = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || e.hidden) return false; } return true; };
  const out = { overflow: [], contrast: [], cards: [], accents: [], texts: 0 };
  // O: sideways scroll, and boxes that clip their content
  const sw = document.documentElement.scrollWidth - innerWidth;
  if (sw > 0) out.overflow.push(`the page scrolls sideways by ${sw}px`);
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('[data-scroll-x], .og-fit, .mock-tag')) continue;
    const s = getComputedStyle(el);
    if (!/hidden|clip|auto|scroll/.test(s.overflowX)) continue;
    if (el.classList.contains('desk')) continue;   // the canvas: off-screen cards are its nature
    if (el.scrollWidth > el.clientWidth + 1) out.overflow.push(`${el.className || el.tagName} clips ${el.scrollWidth - el.clientWidth}px sideways`);
  }
  // text that runs out of its own box sideways (a long word, a code line)
  for (const el of document.querySelectorAll('h1,h2,h3,p,li,a,button,code,pre,span,b')) {
    if (!visible(el) || el.closest('[data-scroll-x], .og, .mock-tag, .desk #pill')) continue;
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > innerWidth + 0.5 || r.left < -0.5) && !el.closest('.desk')) out.overflow.push(`"${(el.textContent || '').trim().slice(0, 30)}" runs off the screen`);
  }
  // G and O for cards: the frame is exact, and its content fits inside
  for (const og of document.querySelectorAll('.og')) {
    out.cards.push([og.dataset.og, og.offsetWidth, og.offsetHeight]);
    const main = og.querySelector('.og-main'), title = og.querySelector('.og-title'), lede = og.querySelector('.og-lede');
    if (main.scrollHeight > main.clientHeight + 1) out.overflow.push(`card ${og.dataset.og}: content is ${main.scrollHeight - main.clientHeight}px taller than its window`);
    // a clamped line that is lost hides a whole line; descender ink below a tight line box is not one
    for (const t of [title, lede]) if (t && t.scrollHeight > t.clientHeight + parseFloat(getComputedStyle(t).lineHeight) / 2) out.overflow.push(`card ${og.dataset.og}: "${t.textContent.slice(0, 30)}" is cut off`);
    const path = og.querySelector('.og-path'); if (path.scrollWidth > path.clientWidth + 1) out.overflow.push(`card ${og.dataset.og}: the address is cut off`);
    out.accents.push(getComputedStyle(og).getPropertyValue('--accent').trim());
  }
  out.accents.push(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  // C: every text node on screen, against what it is drawn on (skipping text something else covers)
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style,template,.mock-tag,[aria-hidden="true"]') || !visible(el)) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const rect = [...r.getClientRects()].find((x) => x.width > 0 && x.height > 0);
    if (!rect || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) continue;
    const cx = Math.min(Math.max(rect.left + rect.width / 2, 0), innerWidth - 1), cy = Math.min(Math.max(rect.top + rect.height / 2, 0), innerHeight - 1);
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== el && !el.contains(top) && !top.contains(el)) continue;   // covered (the drawer's scrim, a window above)
    const s = getComputedStyle(el), col = parse(s.color);
    if (col[3] === 0) continue;   // outlined numerals: stroke only, decorative
    const fs = parseFloat(s.fontSize), bg = bgOf(el), fg = over(col, bg);   // cards are judged at their real 1200px size
    const need = fs >= 24 || (fs >= 18.66 && +s.fontWeight >= 700) ? 3 : 4.5;
    const cr = ratio(fg, bg);
    out.texts += 1;
    if (cr < need) out.contrast.push(`${cr.toFixed(2)}:1 "${n.data.trim().slice(0, 32)}" (${el.className || el.tagName})`);
  }
  return out;
};

const hex = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const browser = await chromium.launch({ executablePath: exe(), args: ['--autoplay-policy=no-user-gesture-required'] });
let loads = 0, texts = 0;
async function open(q, size) {
  const ctx = await browser.newContext({ viewport: SIZES[size], deviceScaleFactor: 1, isMobile: size === 'phone', hasTouch: size === 'phone' });
  const page = await ctx.newPage();
  const errors = [], net = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!/^(data|blob|file):/.test(r.url())) net.push(r.url()); });
  await page.goto(`file://${BUNDLE}?${q}`);
  await page.waitForFunction(() => document.documentElement.getAttribute('data-ready') === '1');
  await page.waitForTimeout(200);
  loads += 1;
  return { ctx, page, errors, net };
}

for (const [view, looks] of RUNS) {
  for (const look of looks) {
    for (const size of ['phone', 'desktop']) {
      const q = `${view === 'index' ? '' : `view=${view}&`}${look ? look + '&' : ''}bare`;
      const tag = `${view} ${look || 'default'} ${size}`;
      const { ctx, page, errors, net } = await open(q, size);
      const m = await page.evaluate(MEASURE);
      texts += m.texts;
      m.overflow.slice(0, 4).forEach((x) => fail('O', `${tag}: ${x}`));
      m.contrast.slice(0, 4).forEach((x) => fail('C', `${tag}: ${x}`));
      net.forEach((u) => fail('N', `${tag}: network request ${u}`));
      errors.forEach((e) => fail('N', `${tag}: ${e}`));
      if (view === 'cards') {
        if (m.cards.length !== 15) fail('G', `${tag}: ${m.cards.length} cards, not 15`);
        m.cards.forEach(([k, w, h]) => { if (w !== 1200 || h !== 630) fail('G', `${tag}: card ${k} is ${w}×${h}`); });
      }
      // A: accent share of the screen
      const accents = [...new Set(m.accents.filter(Boolean))].map(hex);
      const png = (await page.screenshot()).toString('base64');
      const share = await page.evaluate(async ([b64, accs]) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, img.width, img.height).data; let n = 0;
        for (let i = 0; i < d.length; i += 4) if (accs.some((a) => Math.abs(d[i] - a[0]) + Math.abs(d[i + 1] - a[1]) + Math.abs(d[i + 2] - a[2]) < 40)) n++;
        return n / (d.length / 4);
      }, [png, accents]);
      if (share > 0.05) fail('A', `${tag}: accent is ${(share * 100).toFixed(1)}% of pixels`);
      // P: every take decodes and plays
      if (view === 'voices' && size === 'desktop' && look === LAB[0]) {
        const res = await page.evaluate(async () => {
          const out = [];
          const ac = new AudioContext();
          for (const li of document.querySelectorAll('.take')) {
            const a = li.querySelector('audio'), k = li.dataset.take;
            try {
              const buf = await ac.decodeAudioData(await (await fetch(a.src)).arrayBuffer());
              if (a.readyState < 1) await new Promise((r) => a.addEventListener('loadedmetadata', r, { once: true }));
              li.querySelector('.play').click();
              const t0 = performance.now();
              while (a.currentTime < 0.25 && !a.ended && performance.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 50));
              out.push({ k, dur: buf.duration, played: a.currentTime >= 0.25 || a.ended, ui: li.classList.contains('is-playing') || a.ended });
              a.pause(); li.classList.remove('is-playing');
            } catch (e) { out.push({ k, error: String(e) }); }
          }
          return out;
        });
        if (res.length !== 6) fail('P', `${res.length} takes, not 6`);
        for (const r of res) {
          if (r.error) fail('P', `take ${r.k}: ${r.error}`);
          else {
            if (r.dur < 0.5 || r.dur > 2) fail('P', `take ${r.k}: ${r.dur.toFixed(2)} s long`);
            if (!r.played) fail('P', `take ${r.k} did not play`);
            if (!r.ui) fail('P', `take ${r.k}: its button didn't show it playing`);
          }
        }
        note(`samples: ${res.filter((r) => !r.error && r.played).length}/6 decoded and played (${res.map((r) => r.dur ? r.dur.toFixed(2) + 's' : 'x').join(', ')})`);
      }
      await ctx.close();
    }
  }
}
await browser.close();
note(`checked ${loads} screens, ${texts} text runs for contrast`);
for (const f of fails) note(f);
note(fails.length ? `EXTRAS FAIL ${fails.length}` : 'EXTRAS OK');
process.exit(fails.length ? 1 : 0);
