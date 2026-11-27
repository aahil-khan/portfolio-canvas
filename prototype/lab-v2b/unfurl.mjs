// Real link previews, the way a chat app unfurls a link: each link out's own OG image, title,
// description, site name and favicon, fetched once here and committed, so the page itself makes no
// network request on load. Usage:
//   node unfurl.mjs            fetch every link out the content names -> content/unfurls.js + assets/og-*.webp, assets/fav-*.png
//   node unfurl.mjs --keep     only fetch links not already in content/unfurls.js
// A site with no OG image gets title, description and domain only; a site that won't answer keeps the
// card built from the content (README, "Link previews").
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'content/unfurls.js');
// One honest name, the way a chat app's unfurler names itself. A site that refuses it keeps the card from the content.
const BOT = 'lab-unfurl/1.0 (link previews for a static page, fetched once at build time)';
const keep = process.argv.includes('--keep');
/** Content files in load order, as index.html lists them (the fixture overlay excluded). */
const contentScripts = () => [...readFileSync(join(here, 'index.html'), 'utf8').matchAll(/<script src="(content\/[^"]+)"(?! data-fixture)><\/script>/g)].map((m) => m[1]);

let LAB = null;
/** Every link out the content names: references, the builds' repo and live links, term sources. */
function linksOut() {
  const sb = { window: {} };
  for (const f of contentScripts().filter((f) => !f.endsWith('unfurls.js'))) vm.runInNewContext(readFileSync(join(here, f), 'utf8'), sb);
  const L = sb.window.Lab, u = new Set();
  LAB = L;
  for (const b of Object.values(L.bodies)) for (const r of Object.values(b.refs || {})) if (r.url) u.add(r.url.trim());
  for (const e of L.data.entries) { if (e.repo) u.add(e.repo); if (e.live) u.add(e.live); }
  for (const t of L.terms || []) if (t.link && /^https:/.test(t.link)) u.add(t.link.trim());
  return [...u];
}

const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/\s+/g, ' ').trim();
function meta(html, ...names) {
  for (const n of names) {
    const tags = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*>`, 'i')) || [];
    for (const tag of tags) { const c = tag.match(/content=["']([^"']*)["']/i) || tag.match(/content=([^\s>]+)/i); if (c && c[1].trim()) return decode(c[1]); }
  }
  return '';
}
function icon(html, base) {
  const links = html.match(/<link[^>]+>/gi) || [];
  const pick = (re) => links.find((l) => re.test((l.match(/rel=["']([^"']+)["']/i) || [])[1] || ''));
  const l = pick(/apple-touch-icon/i) || pick(/^(shortcut )?icon$/i) || pick(/icon/i);
  const href = l && (l.match(/href=["']([^"']+)["']/i) || [])[1];
  return new URL(href ? decode(href) : '/favicon.ico', base).href;
}
async function get(url, accept) {
  const r = await fetch(url, { headers: { 'user-agent': BOT, accept }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}
const short = (s) => createHash('sha1').update(s).digest('hex').slice(0, 10);
/** Download an image and re-encode it with ImageMagick: OG images to 640px WebP, favicons to a 32px PNG. */
async function image(url, out, kind) {
  const r = await get(url, 'image/*');
  const tmp = mkdtempSync(join(tmpdir(), 'unfurl-'));
  try {
    const src = join(tmp, 'in');
    writeFileSync(src, Buffer.from(await r.arrayBuffer()));
    const input = /\.ico(\?|$)/i.test(url) || /icon/.test(r.headers.get('content-type') || '') ? `ico:${src}[0]` : `${src}[0]`;
    const args = kind === 'og' ? [input, '-resize', '640x336^', '-gravity', 'center', '-extent', '640x336', '-strip', '-quality', '62', out]
      : [input, '-background', 'none', '-resize', '32x32', '-strip', out];
    execFileSync('convert', args, { stdio: 'pipe' });
    return true;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

/** A site that refuses (medium.com answers 403 to any script) but whose page is one of his own entries:
 *  the card is built from that entry, with its first picture, and marked standIn (README lists them). */
function standIn(url) {
  for (const [id, b] of Object.entries(LAB.bodies)) for (const r of Object.values(b.refs || {})) {
    if ((r.url || '').trim() !== url) continue;
    const e = LAB.data.entries.find((x) => x.id === id), img = (b.blocks.find((x) => x.img) || {}).img;
    const lede = (b.meta && b.meta.lede && (b.meta.lede.text || b.meta.lede)) || (e && (e.lede || e.opening)) || '';
    if (!e || !/medium\.com/.test(url)) return null;
    return { title: r.title, description: String(lede).replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]|\[\^[^\]]*\]/g, '$1'), site: 'Medium', domain: 'medium.com', img: img && img.src, standIn: true };
  }
  return null;
}
const old = existsSync(OUT) ? (() => { const sb = { window: {} }; vm.runInNewContext(readFileSync(OUT, 'utf8'), sb); return sb.window.Lab.unfurls || {}; })() : {};
const result = {};
for (const url of linksOut()) {
  if (keep && old[url]) { result[url] = old[url]; continue; }
  if (/wikipedia\.org/.test(url)) await new Promise((ok) => setTimeout(ok, 4000));   // Wikipedia answers 429 to a burst
  try {
    const r = await get(url, 'text/html');
    const html = (await r.text()).slice(0, 400000);
    const base = r.url;
    const u = {
      title: meta(html, 'og:title', 'twitter:title') || decode((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]),
      description: meta(html, 'og:description', 'twitter:description', 'description'),
      site: meta(html, 'og:site_name') || new URL(base).hostname.replace(/^www\./, ''),
      domain: new URL(url).hostname.replace(/^www\./, ''),
    };
    const img = meta(html, 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src');
    if (img) {
      const p = `assets/og-${short(url)}.webp`;
      try { await image(new URL(img, base).href, join(here, p), 'og'); u.img = p; } catch (e) { console.log(`  no image (${e.message})`); }
    }
    const fp = `assets/fav-${short(new URL(url).hostname)}.png`;
    try { if (existsSync(join(here, fp)) || await image(icon(html, base), join(here, fp), 'fav')) u.icon = fp; } catch (e) { console.log(`  no favicon (${e.message})`); }
    if (u.description.length > 220) u.description = u.description.slice(0, 217).replace(/\s+\S*$/, '') + '…';
    result[url] = u;
    console.log(`ok   ${url}${u.img ? '' : '  (no OG image)'}`);
  } catch (e) {
    if (old[url]) result[url] = old[url];
    else if (standIn(url)) result[url] = standIn(url);
    console.log(`FAIL ${url}: ${e.message}${old[url] ? ' (kept the last unfurl)' : result[url] ? ' (stand-in from his own copy of the page)' : ' (falls back to the card from the content)'}`);
  }
}
writeFileSync(OUT, `// Generated by unfurl.mjs on ${new Date().toISOString().slice(0, 10)}; don't edit. Each link out's own preview:\n` +
  `// its OG title, description, site, domain, image (re-encoded, inlined by the bundle) and favicon.\nvar Lab = window.Lab = window.Lab || {};\nLab.unfurls = ${JSON.stringify(result, null, 1)};\n`);
console.log(`${Object.keys(result).length} unfurls -> content/unfurls.js`);
