import assert from 'node:assert/strict'
import { test } from 'node:test'

import { INTENT } from '../../motion/tokens.ts'
import { inSafeTriangle, inTriangle, Intent, MAX_STACK, type Opened, type Rect } from './intent.ts'

/** A fake clock and timer queue, and a host that records what the machine asked for. */
function rig(rects: Record<number, Rect> = {}) {
  let now = 0
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  const log: string[] = []
  const opened: Opened<string>[] = []
  const machine = new Intent<string>({
    now: () => now,
    schedule: (fn, ms) => {
      const id = ++seq
      timers.set(id, { at: now + ms, fn })
      return id
    },
    cancel: (h) => {
      timers.delete(h as number)
    },
    open: (o) => {
      opened.length = o.level
      opened.push({ ...o })
      log.push(`${now} open ${o.trigger}@${o.level} ${o.via}`)
    },
    close: (level) => {
      opened.length = level
      log.push(`${now} close ${level}`)
    },
    rectOf: (level) => rects[level] ?? null,
  })
  /** Advances the clock to `t`, firing every timer due on the way, in order. */
  const to = (t: number) => {
    for (;;) {
      const due = [...timers.entries()].filter(([, x]) => x.at <= t).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      now = due[1].at
      due[1].fn()
    }
    now = t
  }
  return { machine, log, opened, to, get now() { return now } }
}

test('a first open waits 300ms of hover; leaving before that opens nothing', () => {
  const r = rig()
  r.machine.enter('a', 0, 'hover')
  r.to(299)
  assert.deepEqual(r.log, [])
  r.to(300)
  assert.deepEqual(r.log, ['300 open a@0 hover'])

  const q = rig()
  q.machine.enter('a', 0, 'hover')
  q.to(200)
  q.machine.leave('a', { x: 0, y: 0 })
  q.machine.at(-1, { x: 50, y: 50 })
  q.to(1000)
  assert.deepEqual(q.log, [])
})

test('the next link opens at 90ms while a window is open, and within 600ms of one closing', () => {
  const r = rig()
  r.machine.enter('a', 0, 'hover')
  r.to(300)
  r.machine.leave('a', null)
  r.machine.at(-1, null)
  r.machine.enter('b', 0, 'hover')
  r.to(390)
  assert.deepEqual(r.log, ['300 open a@0 hover', '390 close 0', '390 open b@0 hover'])
  assert.equal(r.machine.delayAt(r.now), INTENT.openInGrace)

  // b closes 220ms after the pointer leaves it; a link entered 599ms later still opens at 90ms
  r.machine.leave('b', null)
  r.machine.at(-1, null)
  r.to(390 + 220)
  assert.equal(r.log.at(-1), '610 close 0')
  r.to(610 + 599)
  r.machine.enter('c', 0, 'hover')
  r.to(610 + 599 + 89)
  assert.equal(r.opened.length, 0)
  r.to(610 + 599 + 90)
  assert.equal(r.log.at(-1), `${610 + 599 + 90} open c@0 hover`)

  // past the grace, it is 300ms again
  r.machine.closeAll()
  const t = r.now
  r.to(t + 601)
  assert.equal(r.machine.delayAt(r.now), INTENT.open)
})

test('closing takes 220ms, and re-entry cancels it', () => {
  const r = rig()
  r.machine.enter('a', 0, 'hover')
  r.to(300)
  r.machine.leave('a', null)
  r.machine.at(-1, null)
  r.to(500)
  r.machine.at(0, null) // onto the window
  r.to(2000)
  assert.equal(r.opened.length, 1)
  r.machine.at(-1, null) // off it again
  r.to(2219)
  assert.equal(r.opened.length, 1)
  r.to(2220)
  assert.equal(r.opened.length, 0)

  // back onto the link itself also cancels
  const q = rig()
  q.machine.enter('a', 0, 'hover')
  q.to(300)
  q.machine.leave('a', null)
  q.machine.at(-1, null)
  q.to(400)
  q.machine.enter('a', 0, 'hover')
  q.machine.at(0, null)
  q.to(5000)
  assert.equal(q.opened.length, 1)
})

test('moving through the safe triangle keeps the window; stopping in it closes 220ms after the last move', () => {
  // the link's bottom at y=100, the window below it from y=108
  const win: Rect = { left: 100, top: 108, right: 560, bottom: 500 }
  const r = rig({ 0: win })
  r.machine.enter('a', 0, 'hover')
  r.to(300)
  r.machine.leave('a', { x: 120, y: 100 })
  // the diagonal toward the window's far corner, one move every 100ms, over 2s of slow travel
  for (let i = 1; i <= 20; i++) {
    r.to(300 + i * 100)
    // y stays above the window's top until the last step: still in the gap, never on the window
    r.machine.at(-1, { x: 120 + i * 2, y: 100 + i * 0.35 })
  }
  assert.equal(r.opened.length, 1, 'a slow move through the triangle never closes')
  r.machine.at(0, { x: 160, y: 120 }) // arrived
  r.to(10_000)
  assert.equal(r.opened.length, 1)

  // a move out of the triangle (back up and away) lets it close
  const q = rig({ 0: win })
  q.machine.enter('a', 0, 'hover')
  q.to(300)
  q.machine.leave('a', { x: 120, y: 100 })
  q.machine.at(-1, { x: 121, y: 101 })
  q.to(350)
  q.machine.at(-1, { x: 120, y: 40 })
  q.to(350 + 219)
  q.to(301 + 220 + 50)
  assert.equal(q.opened.length, 0)
})

test('the triangle geometry', () => {
  assert.ok(inTriangle({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }))
  assert.ok(!inTriangle({ x: 3, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }))
  const win = { left: 100, top: 200, right: 500, bottom: 600 }
  // below the point: the triangle to the window's top corners
  assert.ok(inSafeTriangle({ x: 300, y: 150 }, { x: 300, y: 100 }, win))
  assert.ok(!inSafeTriangle({ x: 50, y: 110 }, { x: 300, y: 100 }, win))
  // above the point (a window placed above its link)
  assert.ok(inSafeTriangle({ x: 300, y: 650 }, { x: 300, y: 700 }, win))
  assert.ok(!inSafeTriangle({ x: 300, y: 750 }, { x: 300, y: 700 }, win))
  // jitter at the point itself counts
  assert.ok(inSafeTriangle({ x: 302, y: 97 }, { x: 300, y: 100 }, win))
  // the bridge: the strip between the link and the window, as wide as the window
  const under = { left: 100, top: 108, right: 560, bottom: 500 }
  assert.ok(inSafeTriangle({ x: 540, y: 103 }, { x: 110, y: 100 }, under))
  assert.ok(!inSafeTriangle({ x: 580, y: 103 }, { x: 110, y: 100 }, under))
  assert.ok(!inSafeTriangle({ x: 300, y: 90 }, { x: 110, y: 100 }, under))
})

test('a stack of three: a link inside window i opens i + 1; no fourth; Esc closes the top only', () => {
  const r = rig()
  r.machine.enter('a', 0, 'hover')
  r.to(300)
  r.machine.at(0, null)
  r.machine.enter('b', 1, 'hover')
  r.to(390)
  r.machine.at(1, null)
  r.machine.enter('c', 2, 'hover')
  r.to(480)
  r.machine.at(2, null)
  assert.deepEqual(r.opened.map((o) => `${o.trigger}@${o.level}`), ['a@0', 'b@1', 'c@2'])
  r.machine.enter('d', MAX_STACK, 'hover')
  r.to(2000)
  assert.equal(r.opened.length, 3)

  assert.equal(r.machine.escape()?.trigger, 'c')
  assert.deepEqual(r.opened.map((o) => o.trigger), ['a', 'b'])
  assert.equal(r.machine.escape()?.trigger, 'b')
  assert.equal(r.machine.escape()?.trigger, 'a')
  assert.equal(r.machine.escape(), null)
})

test('a press inside a lower window closes the ones above it; on the page, all of them', () => {
  const r = rig()
  r.machine.press('a', 0, 'click')
  r.machine.press('b', 1, 'click')
  r.machine.press('c', 2, 'click')
  r.machine.down(0)
  assert.deepEqual(r.opened.map((o) => o.trigger), ['a'])
  r.machine.down(-1)
  assert.equal(r.opened.length, 0)
})

test('hovering the page leaves tap-, click- and focus-opened windows alone', () => {
  const r = rig()
  r.machine.press('a', 0, 'tap')
  r.machine.at(-1, null)
  r.to(5000)
  assert.equal(r.opened.length, 1)

  const q = rig()
  q.machine.enter('a', 0, 'focus')
  q.to(300)
  q.machine.at(-1, null)
  q.to(5000)
  assert.equal(q.opened.length, 1)
  q.machine.blur()
  q.to(5219)
  assert.equal(q.opened.length, 1)
  q.to(5220)
  assert.equal(q.opened.length, 0)
})

test('focus coming back into the stack cancels a focus close', () => {
  const r = rig()
  r.machine.enter('a', 0, 'focus')
  r.to(300)
  r.machine.blur()
  r.to(400)
  r.machine.focusKept()
  r.to(5000)
  assert.equal(r.opened.length, 1)
})

test('a hover-opened window above a pinned one closes alone when the pointer goes back down', () => {
  const r = rig()
  r.machine.press('a', 0, 'click')
  r.machine.enter('b', 1, 'hover')
  r.to(90)
  assert.equal(r.opened.length, 2)
  r.machine.leave('b', null)
  r.machine.at(0, null)
  r.to(90 + 220)
  assert.deepEqual(r.opened.map((o) => o.trigger), ['a'])
})

test('a pending open for a window whose parent has closed is dropped', () => {
  const r = rig()
  r.machine.press('a', 0, 'click')
  r.machine.enter('b', 1, 'hover')
  r.machine.closeFrom(0)
  r.to(1000)
  assert.equal(r.opened.length, 0)
})

test('links crossed on the way through the triangle do not open', () => {
  const win: Rect = { left: 100, top: 108, right: 560, bottom: 500 }
  const r = rig({ 0: win })
  r.machine.enter('a', 0, 'hover')
  r.to(300)
  r.machine.leave('a', { x: 120, y: 100 })
  // over another link on the way, inside the triangle, for longer than the grace delay
  r.machine.at(-1, { x: 140, y: 104 })
  r.machine.enter('b', 0, 'hover')
  r.to(300 + 200)
  r.machine.at(-1, { x: 141, y: 105 })
  r.to(300 + 400)
  assert.deepEqual(r.opened.map((o) => o.trigger), ['a'])
  // off the triangle, the same link opens as usual
  r.machine.at(-1, { x: 140, y: 20 })
  r.machine.enter('b', 0, 'hover')
  r.to(300 + 400 + 90)
  assert.deepEqual(r.opened.map((o) => o.trigger), ['b'])
})

test('focus landing on a link keeps that link’s own pending open', () => {
  const r = rig()
  r.machine.enter('a', 0, 'focus')
  r.machine.blur('a')
  r.to(300)
  assert.deepEqual(r.opened.map((o) => o.trigger), ['a'])
  const q = rig()
  q.machine.enter('a', 0, 'focus')
  q.machine.blur()
  q.to(1000)
  assert.equal(q.opened.length, 0)
})
