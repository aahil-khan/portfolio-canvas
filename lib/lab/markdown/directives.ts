import 'server-only'

import type { ContainerDirective, LeafDirective } from 'mdast-util-directive'
import type { BlockContent, Image, Paragraph, Parent, PhrasingContent, Root, RootContent } from 'mdast'

import { inlineText } from './links.ts'

/**
 * The Lab's block syntax beyond CommonMark (API.md §4), as a remark transform:
 *
 *   ::figure{of="id"}          → `labFigure { of }`, a figure from `lab-figures.json`
 *   :::side[Heading] … :::     → `labSide { heading }`, a sidenote; the heading is optional
 *   ![alt](src "w=W h=H")      → `labImage`, alone in its paragraph, size declared so nothing
 *   ![alt](src "w=W h=H | caption")   shifts as it loads; anything after ` | ` is its caption
 *
 * Run it after the links transform (`labInline`), which has already read the side's heading.
 * Any other directive is an error, and so is an image without its size or one that shares a
 * paragraph with text: a `<figure>` cannot sit inside a `<p>`.
 */

export interface LabFigure {
  type: 'labFigure'
  of: string
}
export interface LabSide extends Parent {
  type: 'labSide'
  heading: PhrasingContent[] | null
  children: BlockContent[]
}
export interface LabImage {
  type: 'labImage'
  src: string
  w: number
  h: number
  alt: string
  /** The caption's text, Lab inline syntax and all; the links transform runs over it. */
  caption: PhrasingContent[] | null
}
export type LabBlock = LabFigure | LabSide | LabImage

const SIZE = /^w=(\d+) h=(\d+)(?: \| ([\s\S]+))?$/

export function labBlocks(tree: Root): void {
  walk(tree)
}

function walk(parent: Parent): void {
  parent.children = parent.children.map((node) => convert(node as RootContent)) as RootContent[]
  for (const c of parent.children as { type: string }[]) if ('children' in c && c.type !== 'labSide') walk(c as Parent)
}

function convert(node: RootContent): RootContent {
  if (node.type === 'leafDirective') return figure(node)
  if (node.type === 'containerDirective') return side(node)
  if (node.type === 'paragraph') return image(node)
  return node
}

function figure(node: LeafDirective): RootContent {
  if (node.name !== 'figure') throw new Error(`unknown directive ::${node.name}; the Lab has ::figure{of="…"} and :::side`)
  const of = node.attributes?.of
  if (!of) throw new Error('::figure needs of="<figure id>"')
  const extra = Object.keys(node.attributes ?? {}).filter((k) => k !== 'of')
  if (extra.length || node.children.length) throw new Error(`::figure{of="${of}"} takes only of="…"`)
  return { type: 'labFigure', of } as unknown as RootContent
}

function side(node: ContainerDirective): RootContent {
  if (node.name !== 'side') throw new Error(`unknown directive :::${node.name}; the Lab has ::figure{of="…"} and :::side`)
  if (Object.keys(node.attributes ?? {}).length) throw new Error(':::side takes no attributes')
  let heading: PhrasingContent[] | null = null
  const children = node.children.filter((c) => {
    if (c.type === 'paragraph' && c.data && 'directiveLabel' in c.data && c.data.directiveLabel) {
      heading = c.children
      return false
    }
    return true
  })
  const out = { type: 'labSide', heading, children } as unknown as LabSide
  walk(out)
  return out as unknown as RootContent
}

function image(p: Paragraph): RootContent {
  const imgs = p.children.filter((c): c is Image => c.type === 'image')
  if (!imgs.length) return p
  const rest = p.children.filter((c) => c.type !== 'image' && !(c.type === 'text' && !c.value.trim()))
  if (imgs.length > 1 || rest.length) throw new Error(`an image must stand alone in its paragraph (${imgs[0].url})`)
  const img = imgs[0]
  const m = SIZE.exec(img.title ?? '')
  if (!m) throw new Error(`image ${img.url} needs its size declared: ![alt](src "w=1200 h=675")`)
  const caption = m[3] ? inlineText(m[3].trim()) : null
  return { type: 'labImage', src: img.url, w: Number(m[1]), h: Number(m[2]), alt: img.alt ?? '', caption } as unknown as RootContent
}
