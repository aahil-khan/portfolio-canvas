import assert from 'node:assert/strict'
import { test } from 'node:test'

import { type El, prefixIds, renameHooks } from './prefix-ids.ts'

/** The smallest element that satisfies `El`. */
class Node implements El {
  readonly tagName: string
  readonly children: Node[]
  readonly attrs: Map<string, string>
  constructor(tag: string, attrs: Record<string, string> = {}, children: Node[] = []) {
    this.tagName = tag.toUpperCase()
    this.attrs = new Map(Object.entries(attrs))
    this.children = children
  }
  getAttribute(n: string) {
    return this.attrs.get(n) ?? null
  }
  setAttribute(n: string, v: string) {
    this.attrs.set(n, v)
  }
  removeAttribute(n: string) {
    this.attrs.delete(n)
  }
  hasAttribute(n: string) {
    return this.attrs.has(n)
  }
}
const h = (tag: string, attrs: Record<string, string> = {}, ...children: Node[]) => new Node(tag, attrs, children)

test('ids, jumps and id lists all take the prefix', () => {
  const cite = h('a', { href: '#ref-spec', 'data-preview': 'ref:spec' })
  const refs = h('section', { 'aria-labelledby': 'lab-refs-h' }, h('h2', { id: 'lab-refs-h' }), h('li', { id: 'ref-spec' }))
  const head = h('h2', { id: 's-why' })
  const label = h('label', { for: 'x' })
  const desc = h('div', { 'aria-describedby': 'a  b' })
  const root = h('article', {}, h('p', {}, cite), head, refs, label, desc)
  prefixIds(root, 'w2-')
  assert.equal(cite.getAttribute('href'), '#w2-ref-spec')
  assert.equal(head.getAttribute('id'), 'w2-s-why')
  assert.equal(refs.getAttribute('aria-labelledby'), 'w2-lab-refs-h')
  assert.equal(refs.children[1].getAttribute('id'), 'w2-ref-spec')
  assert.equal(label.getAttribute('for'), 'w2-x')
  assert.equal(desc.getAttribute('aria-describedby'), 'w2-a w2-b')
})

test('links away, bare #, and an already prefixed id are left alone', () => {
  const away = h('a', { href: '/lab/some-section/x#s-y' })
  const out = h('a', { href: 'https://example.com/#top' })
  const bare = h('a', { href: '#' })
  const done = h('p', { id: 'w1-s-a' })
  const root = h('div', {}, away, out, bare, done)
  prefixIds(root, 'w1-')
  assert.equal(away.getAttribute('href'), '/lab/some-section/x#s-y')
  assert.equal(out.getAttribute('href'), 'https://example.com/#top')
  assert.equal(bare.getAttribute('href'), '#')
  assert.equal(done.getAttribute('id'), 'w1-s-a')
})

test('the page’s hooks are renamed in the copy, with their values', () => {
  const lead = h('div', { 'data-lead': 'keyline', class: 'lab-lead' })
  const end = h('div', { 'data-body-end': '' })
  const root = h('article', { 'data-entry': 'e1' }, lead, end, h('span', { 'data-num': 'true' }))
  renameHooks(root)
  assert.equal(root.getAttribute('data-entry'), null)
  assert.equal(root.getAttribute('data-pv-entry'), 'e1')
  assert.equal(lead.getAttribute('data-pv-lead'), 'keyline')
  assert.equal(lead.getAttribute('class'), 'lab-lead')
  assert.ok(end.hasAttribute('data-pv-body-end') && !end.hasAttribute('data-body-end'))
  // type roles stay: they set the fonts
  assert.equal(root.children[2].getAttribute('data-num'), 'true')
})
