import { test } from 'node:test'
import assert from 'node:assert/strict'

import { inputBand, parsePing, pingBuckets } from './ping.ts'

const good = { via: 'wheel', input: 2400.7, webdriver: false, width: 1512.5, focus: true }

test('parsePing accepts a well-formed body and rounds its numbers', () => {
  assert.deepEqual(parsePing(good), {
    via: 'wheel',
    input: 2401,
    webdriver: false,
    width: 1513,
    focus: true,
  })
})

test('parsePing refuses anything that is not a ping', () => {
  assert.equal(parsePing(undefined), null)
  assert.equal(parsePing(null), null)
  assert.equal(parsePing('wheel'), null)
  assert.equal(parsePing({}), null)
  assert.equal(parsePing({ ...good, via: 'scroll' }), null)
  assert.equal(parsePing({ ...good, via: 'click' }), null)
  assert.equal(parsePing({ ...good, input: -1 }), null)
  assert.equal(parsePing({ ...good, input: Infinity }), null)
  assert.equal(parsePing({ ...good, input: '2400' }), null)
  assert.equal(parsePing({ ...good, webdriver: 'false' }), null)
  assert.equal(parsePing({ ...good, width: 99_999 }), null)
  assert.equal(parsePing({ ...good, focus: undefined }), null)
})

test('inputBand splits time-to-first-input into four bands', () => {
  assert.equal(inputBand(0), '<1s')
  assert.equal(inputBand(999), '<1s')
  assert.equal(inputBand(1000), '1-3s')
  assert.equal(inputBand(2999), '1-3s')
  assert.equal(inputBand(3000), '3-10s')
  assert.equal(inputBand(9999), '3-10s')
  assert.equal(inputBand(10_000), '10s+')
})

test('pingBuckets names the four counters a counted ping bumps', () => {
  assert.deepEqual(pingBuckets(parsePing(good)!), [
    'via:wheel',
    'input:1-3s',
    'width:1500',
    'focus:yes',
  ])
  assert.deepEqual(
    pingBuckets({ via: 'touchstart', input: 120, webdriver: false, width: 390, focus: false }),
    ['via:touchstart', 'input:<1s', 'width:400', 'focus:no'],
  )
})
