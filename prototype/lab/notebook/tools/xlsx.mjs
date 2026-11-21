// prototype/lab/notebook/tools/xlsx.mjs: read an .xlsx with no dependency.
//
//   readBook(path) → { [sheetName]: [[cell, …], …] }   rows and columns 0-based, cells as strings
//                                                      or numbers, empty cells as ''
//
// An .xlsx is a zip of XML. The zip is read from its central directory and each member inflated
// with node:zlib; the sheet XML is read with regular expressions, which is enough for the cells a
// spreadsheet app writes (shared strings, inline strings, formula results, numbers). The same code
// becomes scripts/lab-study.mjs in the React build.
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

function unzip(buf) {
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('xlsx: not a zip')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = {}
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('xlsx: bad central directory')
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(start, start + size)
    files[name] = method === 0 ? raw : inflateRawSync(raw)
    p += 46 + nameLen + extra + comment
  }
  return files
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const unxml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m)
const textOf = (xml) => unxml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''))
const col = (ref) => { let n = 0; for (const ch of ref.match(/^[A-Z]+/)[0]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1 }

export function readBook(path) {
  const z = unzip(readFileSync(path))
  const str = (n) => (z[n] ? z[n].toString('utf8') : '')
  const shared = [...str('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
  const rels = Object.fromEntries([...str('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*>/g)].map((m) => [m[0].match(/Id="([^"]+)"/)[1], m[0].match(/Target="([^"]+)"/)[1]]))
  const book = {}
  for (const m of str('xl/workbook.xml').matchAll(/<sheet [^>]*>/g)) {
    const name = unxml(m[0].match(/name="([^"]+)"/)[1]), rid = m[0].match(/r:id="([^"]+)"/)[1]
    const target = rels[rid].replace(/^\/?(xl\/)?/, 'xl/')
    const rows = []
    for (const c of str(target).matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const r = +c[2] - 1, k = col(c[1]), attrs = c[3], body = c[4] || ''
      const t = (attrs.match(/t="([^"]+)"/) || [])[1]
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]
      let val = ''
      if (t === 's') val = shared[+v] ?? ''
      else if (t === 'inlineStr') val = textOf(body)
      else if (t === 'str' || t === 'e') val = v != null ? unxml(v) : ''
      else if (t === 'b') val = v === '1'
      else if (v != null) val = +v
      ;(rows[r] = rows[r] || [])[k] = val
    }
    book[name] = Array.from(rows, (row) => Array.from(row || [], (x) => x ?? ''))
  }
  return book
}

// a spreadsheet serial date → YYYY-MM-DD (1900 system, which every sheet here uses)
export const isoDate = (n) => (typeof n === 'number' && n > 20000 ? new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10) : '')
