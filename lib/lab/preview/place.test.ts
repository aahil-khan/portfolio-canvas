import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Rect } from './intent.ts'
import { EDGE, GAP, intersects, place, STEP } from './place.ts'

const vp = { width: 1440, height: 900 }
const line = (left: number, top: number, w = 120, h = 24): Rect => ({ left, top, right: left + w, bottom: top + h })
const box = (p: ReturnType<typeof place>, h: number): Rect => ({ left: p.x, top: p.y, right: p.x + p.width, bottom: p.y + (p.maxHeight ?? h) })

test('below the link when it fits, starting at its left edge', () => {
  const p = place({ rects: [line(300, 200)], height: 300, width: 360, viewport: vp, roof: 64 })
  assert.equal(p.side, 'below')
  assert.equal(p.y, 224 + GAP)
  assert.equal(p.x, 300)
  assert.equal(p.maxHeight, null)
})

test('above when below has no room; never over the link', () => {
  const r = line(300, 800)
  const p = place({ rects: [r], height: 400, width: 460, viewport: vp, roof: 64 })
  assert.equal(p.side, 'above')
  assert.equal(p.y + 400, 800 - GAP)
  assert.ok(!intersects(box(p, 400), r))
})

test('neither side fits: the roomier one, height capped to its room', () => {
  const small = { width: 1024, height: 500 }
  const r = line(300, 200)
  const p = place({ rects: [r], height: 480, width: 460, viewport: small, roof: 64 })
  assert.equal(p.side, 'below')
  assert.equal(p.maxHeight, 500 - 8 - (224 + GAP))
  const q = place({ rects: [line(300, 330)], height: 480, width: 460, viewport: small, roof: 64 })
  assert.equal(q.side, 'above')
  assert.equal(q.maxHeight, 330 - GAP - 64)
  assert.equal(q.y, 64)
})

test('a link that wraps: clear of every line, starting at the hovered one', () => {
  const rects = [line(900, 400, 400), line(80, 426, 200)]
  const p = place({ rects, anchor: rects[1], height: 300, width: 360, viewport: vp, roof: 64 })
  assert.equal(p.x, 80)
  for (const r of rects) assert.ok(!intersects(box(p, 300), r))
  const up = place({ rects: [line(900, 700, 400), line(80, 726, 200)], height: 300, width: 360, viewport: vp, roof: 64 })
  for (const r of [line(900, 700, 400), line(80, 726, 200)]) assert.ok(!intersects(box(up, 300), r))
})

test('kept inside the viewport at either edge, and narrower than a phone', () => {
  assert.equal(place({ rects: [line(1400, 200, 30)], height: 200, width: 360, viewport: vp, roof: 64 }).x, 1440 - EDGE - 360)
  assert.equal(place({ rects: [line(2, 200)], height: 200, width: 360, viewport: vp, roof: 64 }).x, EDGE)
  const phone = place({ rects: [line(20, 200)], height: 200, width: 360, viewport: { width: 375, height: 700 }, roof: 64 })
  assert.equal(phone.width, 375 - 2 * EDGE)
})

test('a cascaded window steps right of its parent, or left where the right has no room', () => {
  const parent: Rect = { left: 300, top: 232, right: 760, bottom: 732 }
  const p = place({ rects: [line(320, 400)], height: 300, width: 460, viewport: vp, roof: 64, parent })
  assert.equal(p.step, 'right')
  assert.ok(p.x >= 300 + STEP)
  const farRight: Rect = { left: 960, top: 232, right: 1420, bottom: 732 }
  const q = place({ rects: [line(980, 400)], height: 300, width: 460, viewport: vp, roof: 64, parent: farRight })
  assert.equal(q.step, 'left')
  assert.equal(q.x, 960 - STEP)
})

test('every edge, every width: never over the link', () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    const spots = [
      line(4, 60),
      line(viewport.width - 124, 60),
      line(4, viewport.height - 30),
      line(viewport.width - 124, viewport.height - 30),
      line(viewport.width / 2, viewport.height / 2),
    ]
    for (const r of spots)
      for (const [width, height] of [
        [360, 260],
        [460, Math.min(viewport.height * 0.6, 500)],
      ]) {
        const p = place({ rects: [r], height, width, viewport, roof: 64 })
        assert.ok(!intersects(box(p, height), r), `${viewport.width}: ${JSON.stringify(r)} covered by ${JSON.stringify(p)}`)
        assert.ok(p.x >= EDGE - 0.5 && p.x + p.width <= viewport.width - EDGE + 0.5)
      }
  }
})
