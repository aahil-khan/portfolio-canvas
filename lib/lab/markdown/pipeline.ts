import 'server-only'

import type { Element, ElementContent, Properties } from 'hast'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { Code, Heading, Link, Nodes, PhrasingContent, Root } from 'mdast'
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal'
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table'
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import { gfmTable } from 'micromark-extension-gfm-table'
import type { ReactNode } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import remarkDirective from 'remark-directive'
import remarkParse from 'remark-parse'
import remarkRehype, { type Options as RehypeOptions } from 'remark-rehype'
import { unified, type Processor } from 'unified'

import type { Ref } from '../types.ts'
import { labBlocks, type LabFigure, type LabImage, type LabSide } from './directives.ts'
import { labInline, type LabLink, type LabMark, type LabRef, type LinkTarget } from './links.ts'
import { highlight } from './shiki.ts'

/**
 * A Lab body, Markdown to React, on the server (API.md §4 and §5). Never MDX and never raw HTML:
 * bodies are edited at `/edit` and every save commits to `main`, so a body can hold no code.
 *
 *   parseBody(md)        the mdast, after the Lab's own syntax is read (links.ts, directives.ts)
 *   bodyText(md)         the words of each block, as a reader sees them, for tests and read time
 *   bodyLinks(md)        every id, key, figure, image and URL a body names, in order of first use
 *   renderBody(md, ctx)  React elements, through hast-util-to-jsx-runtime (no innerHTML)
 *
 * Plain Markdown is CommonMark plus GFM tables, strikethrough and autolinks. GFM footnotes stay
 * off: `[^key]` is the Lab's own citation, numbered by first use from the entry's `refs`.
 */

/** GFM's tables, strikethrough and autolinks, without its footnotes (there is no remark-gfm here). */
function remarkGfmLite(this: Processor) {
  const data = this.data() as {
    micromarkExtensions?: unknown[]
    fromMarkdownExtensions?: unknown[]
  }
  ;(data.micromarkExtensions ??= []).push(gfmTable(), gfmStrikethrough({ singleTilde: false }), gfmAutolinkLiteral())
  ;(data.fromMarkdownExtensions ??= []).push(gfmTableFromMarkdown(), gfmStrikethroughFromMarkdown(), gfmAutolinkLiteralFromMarkdown())
}

const parser = unified().use(remarkParse).use(remarkGfmLite).use(remarkDirective)

type LabNode = Nodes | LabLink | LabRef | LabMark | LabFigure | LabSide | LabImage

export function parseBody(md: string): Root {
  const tree = parser.parse(md)
  labInline(tree, md)
  labBlocks(tree)
  return tree
}

// ---------- plain text ----------

const kids = (n: LabNode): LabNode[] => ('children' in n ? (n.children as LabNode[]) : [])

/** A node's words: links and marks reduced to their words, references to nothing. */
function plain(n: LabNode | LabNode[]): string {
  if (Array.isArray(n)) return n.map(plain).join('')
  switch (n.type) {
    case 'text':
    case 'inlineCode':
      return n.value
    case 'labRef':
      return ''
    case 'break':
      return ' '
    case 'image':
      return n.alt ?? ''
    default:
      return plain(kids(n))
  }
}

function blockTexts(nodes: LabNode[], out: string[]): void {
  for (const n of nodes) {
    switch (n.type) {
      case 'heading':
      case 'paragraph':
        out.push(plain(n))
        break
      case 'list':
        for (const item of kids(n)) {
          const at = out.push('') - 1
          const words: string[] = []
          for (const c of kids(item)) {
            if (c.type === 'list') blockTexts([c], out)
            else words.push(plain(c))
          }
          out[at] = words.join(' ')
        }
        break
      case 'blockquote':
        blockTexts(kids(n), out)
        break
      case 'code':
        out.push(n.value)
        break
      case 'labSide':
        if (n.heading) out.push(plain(n.heading as LabNode[]))
        blockTexts(kids(n), out)
        break
      case 'labImage':
        if (n.caption) out.push(plain(n.caption as LabNode[]))
        break
      case 'table':
        for (const row of kids(n)) out.push(kids(row).map(plain).join(' '))
        break
      default:
        break
    }
  }
}

/** The words of each block, in document order: what a reader reads, without the markup. */
export function bodyText(md: string): string[] {
  const out: string[] = []
  blockTexts(parseBody(md).children as LabNode[], out)
  return out
}

// ---------- what a body names ----------

export interface BodyLinks {
  entries: string[]
  terms: string[]
  tags: string[]
  refs: string[]
  figures: string[]
  images: { src: string; w: number; h: number; alt: string }[]
  /** Links out: every `http(s)` URL the body links to. */
  outs: string[]
}

export function bodyLinks(md: string): BodyLinks {
  const out: BodyLinks = { entries: [], terms: [], tags: [], refs: [], figures: [], images: [], outs: [] }
  const add = (list: string[], v: string) => {
    if (!list.includes(v)) list.push(v)
  }
  const lists: Record<LinkTarget, string[]> = { entry: out.entries, term: out.terms, tag: out.tags }
  const visit = (n: LabNode) => {
    if (n.type === 'labLink') add(lists[n.target], n.id)
    else if (n.type === 'labRef') add(out.refs, n.key)
    else if (n.type === 'labFigure') add(out.figures, n.of)
    else if (n.type === 'labImage') {
      out.images.push({ src: n.src, w: n.w, h: n.h, alt: n.alt })
      n.caption?.forEach((c) => visit(c as LabNode))
    } else if (n.type === 'link' && /^https?:\/\//.test(n.url)) add(out.outs, n.url)
    if (n.type === 'labSide') n.heading?.forEach((c) => visit(c as LabNode))
    kids(n).forEach(visit)
  }
  visit(parseBody(md))
  return out
}

// ---------- rendering ----------

export interface BodyContext {
  /** The `href` of an entry by id, or `null` when there is no such published entry. */
  entryHref(id: string): string | null
  termHref(id: string): string | null
  tagHref(id: string): string | null
  /** The entry's references, by the key the body cites. */
  refs: Record<string, Ref>
  components?: {
    /** Renders `::figure{of}`; without it, an empty `figure[data-figure]` stands in. */
    figure?: (props: { of: string }) => ReactNode
  }
}

/** The mockup's heading slug (lab.js, `slugOf`), so `#s-…` anchors carry over. */
export const slugOf = (x: string) =>
  String(x)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)

/** What remark-rehype's handlers get; only `all` is used. */
interface State {
  all(node: unknown): ElementContent[]
}
const el = (tagName: string, properties: Properties, children: ElementContent[]): Element => ({ type: 'element', tagName, properties, children })
const text = (value: string): ElementContent => ({ type: 'text', value })

export async function renderBody(md: string, ctx: BodyContext): Promise<ReactNode> {
  const tree = parseBody(md)

  // highlight every fence first: the handlers below are synchronous
  const code = new Map<Code, Element>()
  const fences: Code[] = []
  const collect = (n: LabNode) => (n.type === 'code' ? fences.push(n) : kids(n).forEach(collect))
  collect(tree)
  for (const f of fences) code.set(f, await highlight(f.value, f.lang))

  const order: string[] = []
  const usedIds = new Map<string, number>()
  const hrefOf: Record<LinkTarget, (id: string) => string | null> = {
    entry: (id) => ctx.entryHref(id),
    term: (id) => ctx.termHref(id),
    tag: (id) => ctx.tagHref(id),
  }

  const handlers = {
    labLink(state: State, node: LabLink) {
      const href = hrefOf[node.target](node.id)
      if (href === null) throw new Error(`the body links to ${node.target} "${node.id}", which does not exist`)
      return el('a', { href, dataPreview: `${node.target}:${node.id}` }, state.all(node))
    },
    labRef(_: State, node: LabRef) {
      if (!Object.hasOwn(ctx.refs, node.key)) throw new Error(`the body cites [^${node.key}], which is not in the entry's refs`)
      if (!order.includes(node.key)) order.push(node.key)
      const n = String(order.indexOf(node.key) + 1)
      return el('sup', {}, [el('a', { href: `#ref-${node.key}`, dataPreview: `ref:${node.key}`, ariaLabel: `Reference ${n}` }, [text(n)])])
    },
    labMark(state: State, node: LabMark) {
      return el('mark', {}, state.all(node))
    },
    link(state: State, node: Link) {
      const out = /^https?:\/\//.test(node.url)
      return el('a', { href: node.url, ...(node.title ? { title: node.title } : {}), ...(out ? { dataPreview: `out:${node.url}` } : {}) }, state.all(node))
    },
    heading(state: State, node: Heading) {
      if (node.depth === 1) throw new Error('a body starts at ## : the entry’s title is the page’s only h1')
      let id = `s-${slugOf(plain(node))}`
      const seen = usedIds.get(id) ?? 0
      usedIds.set(id, seen + 1)
      if (seen) id = `${id}-${seen + 1}`
      return el(`h${node.depth}`, { id }, state.all(node))
    },
    code(_: State, node: Code) {
      return code.get(node)!
    },
    labSide(state: State, node: LabSide) {
      const children = state.all(node).filter((c) => !(c.type === 'text' && !c.value.trim()))
      if (node.heading) {
        const strong = el('strong', {}, state.all({ type: 'paragraph', children: node.heading }))
        const first = children[0]
        if (first?.type === 'element' && first.tagName === 'p') first.children.unshift(strong, text(' '))
        else children.unshift(el('p', {}, [strong]))
      }
      return el('aside', { className: ['side'], dataSide: '' }, children)
    },
    labImage(state: State, node: LabImage) {
      const img = el('img', { src: node.src, width: node.w, height: node.h, alt: node.alt, loading: 'lazy', decoding: 'async' }, [])
      const caption = node.caption ? [el('figcaption', {}, state.all({ type: 'paragraph', children: node.caption as PhrasingContent[] }))] : []
      return el('figure', {}, [img, ...caption])
    },
    labFigure(_: State, node: LabFigure) {
      return el('lab-figure', { dataFigure: node.of }, [])
    },
  }

  const toHast = unified().use(remarkRehype, { handlers } as unknown as RehypeOptions)
  const hast = await toHast.run(tree as Root)

  const Figure = (props: { 'data-figure': string }) =>
    ctx.components?.figure ? ctx.components.figure({ of: props['data-figure'] }) : jsx('figure', { 'data-figure': props['data-figure'] })

  return toJsxRuntime(hast, {
    Fragment,
    jsx,
    jsxs,
    components: { 'lab-figure': Figure } as never,
  })
}
