// A small .xlsx reader: zip central directory + inflateRaw, shared strings, sheets.
// No dependencies. Enough for a tracker spreadsheet, not a general parser.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30);
    const comment = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(lStart, lStart + size);
    files.set(name, method === 8 ? inflateRawSync(raw) : raw);
    p += 46 + nameLen + extra + comment;
  }
  return files;
}

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');

function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Returns { [sheetName]: string[][] } — every cell as text. */
export function readXlsx(path) {
  const files = unzip(readFileSync(path));
  const text = (n) => files.get(n)?.toString('utf8') ?? '';
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
  const rels = Object.fromEntries([...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*>/g)]
    .map((m) => [m[0].match(/Id="([^"]+)"/)[1], m[0].match(/Target="([^"]+)"/)[1]]));
  const out = {};
  for (const m of text('xl/workbook.xml').matchAll(/<sheet [^>]*>/g)) {
    const name = decode(m[0].match(/name="([^"]+)"/)[1]);
    const rid = m[0].match(/r:id="([^"]+)"/)[1];
    const target = rels[rid].replace(/^\/?(xl\/)?/, 'xl/');
    const rows = [];
    for (const r of text(target).matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const ref = attrs.match(/r="([A-Z]+\d+)"/)[1];
        const type = attrs.match(/t="([^"]+)"/)?.[1];
        const body = c[2] ?? '';
        let v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        if (type === 's') v = shared[+v];
        else if (type === 'inlineStr') v = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decode(t[1])).join('');
        else if (v != null) v = decode(v);
        row[colIndex(ref)] = v ?? '';
      }
      rows.push(Array.from(row, (x) => x ?? ''));
    }
    out[name] = rows;
  }
  return out;
}
