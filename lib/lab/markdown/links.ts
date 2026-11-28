import 'server-only'

import type { Html, Nodes, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast'

/**
 * The Lab's inline syntax, as a remark transform (API.md §4):
 *
 *   [[id|words]]       an entry          → `labLink { target: 'entry', id }`
 *   [[t:id|words]]     a glossary term   → `labLink { target: 'term', id }`
 *   [[tag:id|words]]   a tag             → `labLink { target: 'tag', id }`
 *   [^key]             a numbered ref    → `labRef { key }` (GFM footnotes stay off)
 *   ==words==          a mark            → `labMark`
 *
 * remark-parse leaves all of these as plain text, but the words inside can be any phrasing, so a
 * span may cross sibling nodes: `[[t:evaluate-offer|`evaluate_offer`]]` is text, inline code, text.
 * The transform reads each parent's children as one stream of tokens and nests what lies between.
 *
 * It also undoes two things remark would otherwise do to prose:
 *   - **No raw HTML.** `html` nodes become text, so a tag in a body shows as the characters typed.
 *   - **No text directives.** remark-directive reads `:name` in running text as a directive, which
 *     would swallow the `:mcc` in `[[t:mcc|…]]`. The Lab has only flow directives (`::figure`,
 *     `:::side`), so every text directive goes back to the exact source it came from.
 */

export type LinkTarget = 'entry' | 'term' | 'tag'

export interface LabLink extends Parent {
  type: 'labLink'
  target: LinkTarget
  id: string
  children: PhrasingContent[]
}
export interface LabRef {
  type: 'labRef'
  key: string
}
export interface LabMark extends Parent {
  type: 'labMark'
  children: PhrasingContent[]
}
export type LabInline = LabLink | LabRef | LabMark

const TOKEN = /\[\[(?:(t|tag):)?([\w-]+)\|/y
const REF = /\[\^([\w-]+)\]/y
const TARGETS: Record<string, LinkTarget> = { '': 'entry', t: 'term', tag: 'tag' }

type AnyNode = Nodes | LabInline
type Frame = { node: LabLink | LabMark | null; children: AnyNode[] }

/** The transform. `source` is the body's Markdown, to put text directives back as written. */
export function labInline(tree: Root, source: string): void {
  restore(tree, source)
  walk(tree)
}

/** html → text, textDirective → its source text; then adjacent text nodes merge. */
function restore(node: AnyNode, source: string): void {
  if (!('children' in node)) return
  const parent = node as Parent
  parent.children = parent.children.map((child) => {
    const c = child as AnyNode
    if (c.type === 'html') return htmlAsText(c as Html, parent)
    if (c.type === 'textDirective') {
      const { start, end } = c.position ?? {}
      if (start?.offset === undefined || end?.offset === undefined) throw new Error('a text directive without a position')
      return { type: 'text', value: source.slice(start.offset, end.offset), position: c.position } as Text
    }
    restore(c, source)
    return child
  }) as RootContent[]
  const merged: RootContent[] = []
  for (const c of parent.children) {
    const last = merged[merged.length - 1]
    if (c.type === 'text' && last?.type === 'text') last.value += c.value
    else merged.push(c)
  }
  parent.children = merged
}

function htmlAsText(node: Html, parent: Parent): RootContent {
  const text: Text = { type: 'text', value: node.value, position: node.position }
  // block HTML sits where a paragraph would; inline HTML is already inside one
  return parent.type === 'root' || parent.type === 'blockquote' || parent.type === 'listItem' || parent.type === 'containerDirective'
    ? { type: 'paragraph', children: [text], position: node.position }
    : text
}

/** One string of Lab inline syntax (an image's caption), as phrasing. */
export function inlineText(value: string): PhrasingContent[] {
  const out = tokenize([{ type: 'text', value } as Text])
  for (const c of out) walk(c)
  return out as PhrasingContent[]
}

function walk(node: AnyNode): void {
  // inline code and code blocks have no children, so their text is never read as Lab syntax
  if (!('children' in node)) return
  const parent = node as Parent
  parent.children = tokenize(parent.children as AnyNode[]) as RootContent[]
  for (const c of parent.children) walk(c as AnyNode)
}

/** Splits text by the Lab's delimiters and nests what lies between them. */
function tokenize(children: AnyNode[]): AnyNode[] {
  const root: Frame = { node: null, children: [] }
  const stack: Frame[] = [root]
  const top = () => stack[stack.length - 1]
  const pushText = (value: string) => {
    if (!value) return
    const kids = top().children
    const last = kids[kids.length - 1]
    if (last?.type === 'text') (last as Text).value += value
    else kids.push({ type: 'text', value } as Text)
  }
  const open = (node: LabLink | LabMark) => {
    top().children.push(node)
    stack.push({ node, children: node.children as AnyNode[] })
  }

  for (const child of children) {
    if (child.type !== 'text') {
      top().children.push(child)
      continue
    }
    const s = (child as Text).value
    let i = 0
    let plain = ''
    const flush = () => {
      pushText(plain)
      plain = ''
    }
    while (i < s.length) {
      TOKEN.lastIndex = i
      REF.lastIndex = i
      let m: RegExpExecArray | null
      if (s.startsWith('[[', i) && (m = TOKEN.exec(s))) {
        flush()
        open({ type: 'labLink', target: TARGETS[m[1] ?? ''], id: m[2], children: [] })
        i += m[0].length
      } else if (s.startsWith(']]', i) && stack.some((f) => f.node?.type === 'labLink')) {
        flush()
        if (top().node?.type !== 'labLink') throw new Error(`a ==mark== opened inside a [[link]] is not closed before its "]]"`)
        stack.pop()
        i += 2
      } else if (s.startsWith('[^', i) && (m = REF.exec(s))) {
        flush()
        top().children.push({ type: 'labRef', key: m[1] })
        i += m[0].length
      } else if (s.startsWith('==', i)) {
        flush()
        if (top().node?.type === 'labMark') stack.pop()
        else open({ type: 'labMark', children: [] })
        i += 2
      } else plain += s[i++]
    }
    flush()
  }

  // an unclosed link is a mistake worth stopping for; an unclosed `==` was just two equals signs
  while (stack.length > 1) {
    const f = stack.pop()!
    if (f.node?.type === 'labLink') throw new Error(`[[${f.node.target === 'entry' ? '' : f.node.target + ':'}${f.node.id}|… is never closed with "]]"`)
    const kids = top().children
    kids.splice(kids.indexOf(f.node!), 1, { type: 'text', value: '==' } as Text, ...f.children)
  }
  return root.children
}
