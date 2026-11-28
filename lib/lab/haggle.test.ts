/**
 * The haggle's pricing logic against the Shopkeeper spec v1 (rule 22h). Each persona card is
 * played by the spec's customer-simulator rules, and must reach the outcome its scenario states.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createShop, evaluate, fidelity, gap, ITEMS, parseOffer, PERSONAS, schedule, simulate, steps, type Shop } from './haggle.ts'

const charger = ITEMS['CHG-20W']

const play = (offers: number[], shop: Shop = createShop(charger)) => {
  const out = []
  for (const o of offers) {
    const r = evaluate(shop, o)
    shop = r.shop
    out.push(r.decision)
  }
  return { shop, out }
}

test('rule 2 and 3: the charger concedes ₹40, 30, 20, 10, and every counter ends in 9', () => {
  assert.deepEqual(steps(899), [40, 30, 20, 10])
  assert.deepEqual(schedule(899), [899, 859, 829, 809, 799])
  for (const c of schedule(899)) assert.equal(c % 10, 9)
  // the first step is at most 5% of list, and each later one is smaller
  for (const list of [299, 499, 599, 699, 899, 1299, 1499, 1799]) {
    const s = steps(list)
    assert.ok(s[0] <= list * 0.05, `${list}: first step ${s[0]}`)
    for (let i = 1; i < s.length; i++) assert.ok(s[i] < s[i - 1])
  }
})

test('rule 4: counter on the first two offers below the last counter; from the third, accept at the floor', () => {
  const { out } = play([640, 640, 650])
  assert.deepEqual(
    out.map((d) => [d.action, d.price]),
    [
      ['counter', 859],
      ['counter', 829],
      ['accept', 650],
    ],
  )
  // an offer at or above the last counter is accepted at once
  assert.equal(play([899]).out[0].action, 'accept')
  assert.equal(play([700, 860]).out[1].action, 'accept')
})

test('rule 5: an agreed price is never reopened lower', () => {
  const { out } = play([899, 500])
  assert.equal(out[1].action, 'agreed')
  assert.equal(out[1].price, 899)
})

test('rule 6: after the four steps, and after five rejections, the shop holds', () => {
  const { out } = play([100, 100, 100, 100, 100, 100, 100])
  assert.deepEqual(
    out.map((d) => d.action),
    ['counter', 'counter', 'counter', 'counter', 'hold', 'hold', 'hold'],
  )
  assert.ok(out.slice(4).every((d) => d.price === 799))
})

test('P7: never a counter at or below the customer’s standing offer', () => {
  // 850 after a ₹859 counter: the next counter would be ₹829, below the offer, so accept
  const { out } = play([700, 850])
  assert.equal(out[1].action, 'accept')
  assert.equal(out[1].price, 850)
})

test('evaluate does not change the state it is given', () => {
  const shop = createShop(charger)
  const before = JSON.stringify(shop)
  evaluate(shop, 700)
  assert.equal(JSON.stringify(shop), before)
})

test('the triangulation gap: price accepted minus the highest offer rejected, when the floor is between', () => {
  const { shop } = play([300, 400, 600, 610, 620, 630, 640, 650])
  assert.equal(shop.agreed, 650)
  assert.equal(gap(shop), 10)
  assert.equal(gap(play([899]).shop), null)
})

for (const [id, card] of Object.entries(PERSONAS)) {
  test(`persona ${id} reaches ${card.expect.outcome}`, () => {
    const run = simulate(ITEMS[card.item], card)
    assert.equal(run.outcome, card.expect.outcome, JSON.stringify(run.log.map((d) => [d.offer, d.action, d.price])))
    if (card.expect.minPrice !== undefined) assert.ok((run.price ?? 0) >= card.expect.minPrice, `price ${run.price}`)
    if (card.expect.price !== undefined) assert.equal(run.price, card.expect.price)
    if (card.expect.maxGap !== undefined) {
      assert.notEqual(run.gap, null)
      assert.ok((run.gap as number) <= card.expect.maxGap, `gap ${run.gap}`)
    }
  })
}

test('the spec’s worked examples: A1 closes at ₹760, B13 is accepted at ₹650 having been refused ₹640', () => {
  const a1 = simulate(charger, PERSONAS.A1)
  assert.equal(a1.price, 760)
  const b13 = simulate(charger, PERSONAS.B13)
  assert.equal(b13.backedOutAt, 650)
  assert.equal(Math.max(...b13.log.filter((d) => d.action !== 'accept').map((d) => d.offer)), 640)
  assert.ok(fidelity().every((r) => r.ok))
})

test('offers are read as whole rupees', () => {
  assert.equal(parseOffer('700'), 700)
  assert.equal(parseOffer(' ₹1,050 '), 1050)
  assert.equal(parseOffer('Rs 700'), 700)
  for (const bad of ['', 'seven hundred', '0', '-5', '70.5', '1234567']) assert.equal(parseOffer(bad), null, bad)
})
