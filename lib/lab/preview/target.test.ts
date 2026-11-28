import assert from 'node:assert/strict'
import { test } from 'node:test'

import { domainOf, isWindow, parseTarget } from './target.ts'

test('every kind parses; a URL keeps its colons', () => {
  assert.deepEqual(parseTarget('entry:shop-05'), { kind: 'entry', id: 'shop-05' })
  assert.deepEqual(parseTarget('term:floor-price'), { kind: 'term', id: 'floor-price' })
  assert.deepEqual(parseTarget('tag:a-tag'), { kind: 'tag', id: 'a-tag' })
  assert.deepEqual(parseTarget('ref:spec'), { kind: 'ref', id: 'spec' })
  assert.deepEqual(parseTarget('out:https://example.com:8080/a?b=c#d'), { kind: 'out', id: 'https://example.com:8080/a?b=c#d' })
  assert.ok(isWindow(parseTarget('entry:x')!))
  assert.ok(!isWindow(parseTarget('term:x')!))
})

test('anything else is no preview', () => {
  for (const v of [null, '', 'entry:', ':x', 'section:x', 'out:javascript:alert(1)', 'out:/lab']) assert.equal(parseTarget(v), null, String(v))
})

test('domainOf drops www. and survives a bad URL', () => {
  assert.equal(domainOf('https://www.anthropic.com/engineering/x'), 'anthropic.com')
  assert.equal(domainOf('https://github.com/a/b'), 'github.com')
  assert.equal(domainOf('not a url'), 'not a url')
})
