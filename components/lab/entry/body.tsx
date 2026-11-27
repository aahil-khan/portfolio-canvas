import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'

import { Figure } from '@/components/lab/instruments'
import { getLab, pathOf } from '@/lib/lab/content'
import { bodyLinks, parseBody, renderBody, slugOf } from '@/lib/lab/markdown/pipeline'
import type { Entry } from '@/lib/lab/types'

/**
 * An entry's words, Markdown to React on the server (API.md §4 and §5), in one pass so references
 * are numbered by first use across the lede, the body and "What I'd do now" together. The three
 * parts are rendered as one document with a marker between them, then split, so each lands in its
 * own place on the page with the numbering intact.
 */

/** A figure id no entry can take (ids are `[\w-]+`; this has a colon), used only to split the parts. */
const SPLIT = 'lab:split'

export interface TocItem {
  id: string
  text: string
}

export interface EntryText {
  lede: ReactNode[] | null
  body: ReactNode[]
  ending: ReactNode[] | null
  /** Ref keys in order of first use: References' order. */
  refOrder: string[]
  /** The body's h2s, with the ids the renderer gives them. */
  toc: TocItem[]
}

const hrefs = () => {
  const lab = getLab()
  const byId = new Map(lab.entries.map((e) => [e.id, e]))
  const terms = new Set(lab.terms.map((t) => t.id))
  const tags = new Set(lab.tags.map((t) => t.id))
  return {
    entryHref: (id: string) => {
      const e = byId.get(id)
      return e && !e.draft && e.published ? pathOf(e) : null
    },
    termHref: (id: string) => (terms.has(id) ? `/lab/glossary#t-${id}` : null),
    tagHref: (id: string) => (tags.has(id) ? `/lab/tags/${id}` : null),
  }
}

/** A heading's words as the renderer reads them: links and marks to their words, references to nothing. */
function words(n: unknown): string {
  const node = n as { type: string; value?: string; children?: unknown[] }
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? ''
  if (node.type === 'labRef') return ''
  if (node.type === 'break') return ' '
  return (node.children ?? []).map(words).join('')
}

/** The body's h2s, with the same ids `renderBody` gives (`s-<slug>`, numbered when repeated). */
export function tocOf(md: string): TocItem[] {
  const used = new Map<string, number>()
  const out: TocItem[] = []
  const visit = (n: { type: string; depth?: number; children?: unknown[] }) => {
    if (n.type === 'heading') {
      const text = words(n)
      let id = `s-${slugOf(text)}`
      const seen = used.get(id) ?? 0
      used.set(id, seen + 1)
      if (seen) id = `${id}-${seen + 1}`
      if (n.depth === 2) out.push({ id, text })
      return
    }
    // sidenotes' contents are not headings of the page
    if (n.type === 'labSide') return
    for (const c of n.children ?? []) visit(c as typeof n)
  }
  visit(parseBody(md) as unknown as { type: string; children?: unknown[] })
  return out
}

export async function entryText(e: Entry, body: string, { lede }: { lede: boolean }): Promise<EntryText> {
  const ending = 'ending' in e ? e.ending.text : ''
  const ledeMd = lede && e.lede ? e.lede : ''
  const marker = `::figure{of="${SPLIT}"}`
  const md = [ledeMd, marker, body, marker, ending].join('\n\n')
  const lab = getLab()
  const tree = await renderBody(md, {
    ...hrefs(),
    refs: e.refs ?? {},
    components: { figure: ({ of }) => (of === SPLIT ? <span data-split="" /> : <Figure of={of} figure={lab.figures[of]} />) },
  })
  const kids = Children.toArray(isValidElement(tree) ? (tree as ReactElement<{ children?: ReactNode }>).props.children : tree)
  const parts: ReactNode[][] = [[]]
  for (const k of kids) {
    if (isValidElement(k) && (k.props as { 'data-figure'?: string })['data-figure'] === SPLIT) parts.push([])
    else if (!(typeof k === 'string' && !k.trim())) parts[parts.length - 1].push(k)
  }
  const [l = [], b = [], end = []] = parts
  return {
    lede: l.length ? l : null,
    body: b,
    ending: end.length ? end : null,
    refOrder: bodyLinks(md).refs,
    toc: tocOf(body),
  }
}

/** The words inside a rendered node. */
function textOf(n: ReactNode): string {
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(textOf).join('')
  if (isValidElement(n)) return textOf((n.props as { children?: ReactNode }).children)
  return ''
}

/**
 * Where the pull-quote goes (mockup README, "Body blocks"): after the first paragraph of the first
 * section, or after the second paragraph when the body has no headings. If the paragraph right
 * after that spot is the one it quotes, it goes after that paragraph instead, so the quote never
 * reads as the next line said twice.
 */
export function withPull(body: ReactNode[], pull: ReactNode, sentence: string): ReactNode[] {
  const type = (n: ReactNode) => (isValidElement(n) ? n.type : null)
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  const quoted = norm(sentence)
  let heads = 0
  let paras = 0
  for (let i = 0; i < body.length; i++) {
    const t = type(body[i])
    if (t === 'h2') heads++
    if (t === 'p') {
      paras++
      if (heads === 1 || (heads === 0 && paras === 2)) {
        let at = i + 1
        const nextP = body.findIndex((n, j) => j > i && type(n) === 'p')
        if (nextP > i && norm(textOf(body[nextP])).includes(quoted)) at = nextP + 1
        return [...body.slice(0, at), pull, ...body.slice(at)]
      }
    }
  }
  return [...body, pull]
}
