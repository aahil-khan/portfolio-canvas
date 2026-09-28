import { test } from 'node:test'
import assert from 'node:assert/strict'

import { sniff } from './sniff.ts'

const bytes = (...xs: (number | string)[]) =>
  Uint8Array.from(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])))

test('sniff recognises the four accepted types by their magic bytes', () => {
  assert.equal(sniff(bytes(0x89, 'PNG\r\n', 0x1a, '\n', 0, 0)), 'png')
  assert.equal(sniff(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)), 'jpeg')
  assert.equal(sniff(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 ')), 'webp')
  assert.equal(sniff(bytes('%PDF-1.7\n')), 'pdf')
})

test('sniff refuses SVG, HTML and a RIFF that is not WebP', () => {
  assert.equal(sniff(bytes('<svg xmlns="http://www.w3.org/2000/svg">')), null)
  assert.equal(sniff(bytes('<!doctype html><script>')), null)
  assert.equal(sniff(bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt ')), null)
  assert.equal(sniff(bytes()), null)
})
