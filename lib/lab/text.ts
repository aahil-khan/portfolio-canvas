/**
 * What the loaders and the rules need to know about a body without rendering it: the links it
 * makes, and its words. Contract: `content/lab/API.md` §4.
 *
 * A plain scanner, not the unified pipeline (`lib/lab/markdown/**`), on purpose: the pipeline is
 * `server-only`, so Node's `content:check` and the tests could not load it, and `validateLab`
 * runs in both. The pipeline renders; this reads. The demo set's round-trip test holds the two
 * to the same words (`content/lab/demo/bodies.test.ts`).
 *
 * Plain TypeScript with no imports, so Node runs it with `--experimental-strip-types`.
 */

export interface BodyScan {
  /** `[[id|…]]`, in order of first appearance. */
  entries: string[]
  /** `[[t:id|…]]`. */
  terms: string[]
  /** `[[tag:id|…]]`. */
  tags: string[]
  /** `[^key]`, in order of first use: the order references are numbered in. */
  refs: string[]
  /** `::figure{of="id"}`. */
  figures: string[]
  /** `![alt](src "w=… h=… | caption")`; `w`/`h` are null when the title does not declare them. */
  images: { src: string; alt: string; w: number | null; h: number | null; caption?: string }[]
  /** `http(s)://` URLs a reader can follow: Markdown links and bare autolinks. */
  outs: string[]
  /** `##` and `###` headings' words. */
  headings: string[]
}

const LINK = /\[\[(?:(t|tag):)?([\w-]+)\|([^\]]+)\]\]/g
const REF = /\[\^([\w-]+)\]/g
const FIGURE = /^::figure\{of="([^"]*)"\}\s*$/
const IMAGE = /!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"([^"]*)")?\s*\)/g
const MDLINK = /(?<!!)\[[^\]]*\]\((https?:\/\/[^\s)]+)[^)]*\)/g
const AUTOLINK = /<?(https?:\/\/[^\s<>)\]]+)>?/g

const uniq = (xs: string[]) => [...new Set(xs)]

/** Fenced code blocks, which are code and not prose: no links, no words that count as text. */
function splitFences(md: string): { prose: string; code: string[] } {
  const code: string[] = []
  const prose = md.replace(/^(```|~~~)[^\n]*\n([\s\S]*?)^\1\s*$/gm, (_, _f: string, body: string) => {
    code.push(body.replace(/\n$/, ''))
    return '\n'
  })
  return { prose, code }
}
/** Inline code spans, which never hold markup. */
const noCode = (s: string) => s.replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length))

/** Reads the image title's declared size and caption: `w=800 h=455 | caption`. */
export function imageTitle(title: string | undefined): { w: number | null; h: number | null; caption?: string } {
  const [dims, ...rest] = (title ?? '').split(' | ')
  const w = /(?:^|\s)w=(\d+)(?:\s|$)/.exec(dims)?.[1]
  const h = /(?:^|\s)h=(\d+)(?:\s|$)/.exec(dims)?.[1]
  const caption = rest.join(' | ').trim()
  return { w: w ? Number(w) : null, h: h ? Number(h) : null, ...(caption ? { caption } : {}) }
}

export function scanBody(md: string): BodyScan {
  const { prose } = splitFences(md)
  const text = noCode(prose)
  const out: BodyScan = { entries: [], terms: [], tags: [], refs: [], figures: [], images: [], outs: [], headings: [] }
  // inline links may wrap inline code (`[[t:x|`code`]]`), so links are read from the text with the
  // code left in, and everything else from the text with it blanked
  for (const m of prose.matchAll(LINK)) (m[1] === 't' ? out.terms : m[1] === 'tag' ? out.tags : out.entries).push(m[2])
  for (const m of text.matchAll(REF)) out.refs.push(m[1])
  for (const line of text.split('\n')) {
    const f = FIGURE.exec(line.trim())
    if (f) out.figures.push(f[1])
    const h = /^(#{2,3})\s+(.*)$/.exec(line)
    if (h) out.headings.push(plainInline(h[2]))
  }
  for (const m of text.matchAll(IMAGE)) out.images.push({ alt: m[1], src: m[2], ...imageTitle(m[3]) })
  const noImages = text.replace(IMAGE, ' ')
  for (const m of noImages.matchAll(MDLINK)) out.outs.push(m[1])
  for (const m of noImages.replace(MDLINK, ' ').matchAll(AUTOLINK)) out.outs.push(m[1].replace(/[.,;:!?]+$/, ''))
  return {
    ...out,
    entries: uniq(out.entries),
    terms: uniq(out.terms),
    tags: uniq(out.tags),
    refs: uniq(out.refs),
    figures: uniq(out.figures),
    outs: uniq(out.outs),
  }
}

/** Every `[[…]]` and `[^key]` in a line of entry text (a lede, a key line, an ending). */
export function scanInline(s: string): Pick<BodyScan, 'entries' | 'terms' | 'tags' | 'refs'> {
  const r = scanBody(s)
  return { entries: r.entries, terms: r.terms, tags: r.tags, refs: r.refs }
}

/** A line of inline markup reduced to the words a reader sees. */
export function plainInline(s: string): string {
  return s
    .replace(LINK, '$3')
    .replace(REF, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/(?<!!)\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/==|`/g, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])[*_](\S(?:.*?\S)?)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!>|~=])/g, '$1')
}

/**
 * The body's prose, block by block, as plain words: headings, paragraphs, list items, quotes, a
 * sidenote's heading and text, image captions. Code and figures are left out.
 */
export function plainBlocks(md: string): string[] {
  const { prose } = splitFences(md)
  const blocks: string[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push(plainInline(para.join(' ')).trim())
    para = []
  }
  for (const raw of prose.split('\n')) {
    const line = raw.trim()
    if (!line || line === ':::' || FIGURE.test(line)) {
      flush()
      continue
    }
    const side = /^:::side(?:\[(.*)\])?\s*$/.exec(line)
    if (side) {
      flush()
      if (side[1]) blocks.push(plainInline(side[1]).trim())
      continue
    }
    const head = /^#{1,6}\s+(.*)$/.exec(line)
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line)
    const img = /^!\[[^\]]*\]\(\s*\S+?(?:\s+"([^"]*)")?\s*\)$/.exec(line)
    if (head || item || img) {
      flush()
      const words = head ? head[1] : item ? item[1] : imageTitle(img![1]).caption
      if (words) blocks.push(plainInline(words).trim())
      continue
    }
    para.push(line.replace(/^>\s?/, ''))
  }
  flush()
  return blocks.filter(Boolean)
}

/** The body's prose as one string, for the pull-quote rule. */
export const plainText = (md: string) => plainBlocks(md).join(' ').replace(/\s+/g, ' ')

/** Words in a string of plain text. */
export const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length
