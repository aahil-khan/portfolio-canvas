import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { bigEnough, direction, px, swipeStep, VIEWER_KEYS, viewerCopy, wrap } from './viewer.ts'

test('paging wraps both ways', () => {
  assert.equal(wrap(5, 5), 0)
  assert.equal(wrap(-1, 5), 4)
  assert.equal(wrap(2, 5), 2)
  assert.equal(wrap(3, 0), 0)
})

test('direction takes the shorter way round', () => {
  assert.equal(direction(0, 1, 5), 1)
  assert.equal(direction(1, 0, 5), -1)
  assert.equal(direction(4, 0, 5), 1, 'next from the last wraps forward')
  assert.equal(direction(0, 4, 5), -1, 'previous from the first wraps back')
  assert.equal(direction(2, 2, 5), 0)
  assert.equal(direction(0, 1, 1), 0)
})

test('a swipe pages only for one finger, sideways, at scale 1', () => {
  assert.equal(swipeStep({ dx: -80, dy: 10, fingers: 1, scale: 1 }), 1, 'left is next')
  assert.equal(swipeStep({ dx: 80, dy: 10, fingers: 1, scale: 1 }), -1, 'right is previous')
  assert.equal(swipeStep({ dx: -30, dy: 0, fingers: 1, scale: 1 }), 0, 'too short')
  assert.equal(swipeStep({ dx: -80, dy: 70, fingers: 1, scale: 1 }), 0, 'too diagonal')
  assert.equal(swipeStep({ dx: -120, dy: 0, fingers: 2, scale: 1 }), 0, 'a pinch never pages')
  assert.equal(swipeStep({ dx: -120, dy: 0, fingers: 1, scale: 2 }), 0, 'panning a zoomed page never pages')
})

test('sizes', () => {
  assert.equal(bigEnough(32, 32), false)
  assert.equal(bigEnough(640, 336), true)
  assert.equal(px('800', 1), 800)
  assert.equal(px(null, 7), 7)
  assert.equal(px('-3', 7), 7)
  assert.equal(px('abc', 7), 7)
})

test('every viewer copy key is in lab.json, as one block', () => {
  const copy = JSON.parse(fs.readFileSync(new URL('../../content/data/lab.json', import.meta.url), 'utf8')).copy as Record<string, string>
  const keys = Object.keys(copy)
  const want = Object.values(VIEWER_KEYS)
  for (const k of want) assert.equal(typeof copy[k], 'string', `copy.${k}`)
  const at = keys.indexOf(want[0])
  assert.deepEqual(keys.slice(at, at + want.length), want, 'the viewer keys sit together, in order')
  const v = viewerCopy(copy)
  assert.match(v.open, /\{alt\}/)
  assert.match(v.count, /\{i\}.*\{n\}/)
  assert.match(v.pos, /\{i\}.*\{n\}/)
})
