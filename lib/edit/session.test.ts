import { test } from 'node:test'
import assert from 'node:assert/strict'

import { editConfig } from './config.ts'
import { seal, unseal, type Session } from './session.ts'

const SECRET = 'x'.repeat(40)
const NOW = 1_800_000_000_000
const s: Session = { token: 'ghu_abc', userId: 42, login: 'aahil', exp: NOW + 60_000 }

test('seal then unseal returns the session', async () => {
  assert.deepEqual(await unseal(await seal(s, SECRET), SECRET, NOW), s)
})

test('a sealed session does not contain the token in the clear', async () => {
  const v = await seal(s, SECRET)
  assert.ok(!v.includes('ghu_abc'))
  assert.ok(!Buffer.from(v, 'base64url').toString('latin1').includes('ghu_abc'))
})

test('one flipped byte is rejected', async () => {
  const raw = Buffer.from(await seal(s, SECRET), 'base64url')
  raw[raw.length - 5] ^= 1
  assert.equal(await unseal(raw.toString('base64url'), SECRET, NOW), null)
})

test('the wrong secret is rejected', async () => {
  assert.equal(await unseal(await seal(s, SECRET), 'y'.repeat(40), NOW), null)
})

test('an expired session is rejected', async () => {
  assert.equal(await unseal(await seal(s, SECRET), SECRET, s.exp + 1), null)
})

test('garbage and absence are rejected, not thrown', async () => {
  assert.equal(await unseal(undefined, SECRET, NOW), null)
  assert.equal(await unseal('not-a-cookie', SECRET, NOW), null)
  assert.equal(await unseal('', SECRET, NOW), null)
})

const ENV = {
  EDIT_GITHUB_APP_CLIENT_ID: 'Iv1.abc',
  EDIT_GITHUB_APP_CLIENT_SECRET: 'shh',
  EDIT_SESSION_SECRET: SECRET,
  EDIT_ALLOWED_USER_ID: '42',
  EDIT_ORIGIN: 'https://site.example/',
}

test('a complete environment gives a config, origin without a trailing slash', () => {
  const cfg = editConfig(ENV)
  assert.equal(cfg?.allowedUserId, 42)
  assert.equal(cfg?.origin, 'https://site.example')
})

for (const key of Object.keys(ENV)) {
  test(`missing ${key} turns the editor off`, () => {
    assert.equal(editConfig({ ...ENV, [key]: '' }), null)
  })
}

test('a non-numeric user id turns the editor off', () => {
  assert.equal(editConfig({ ...ENV, EDIT_ALLOWED_USER_ID: 'aahil-khan' }), null)
})

test('a short session secret turns the editor off', () => {
  assert.equal(editConfig({ ...ENV, EDIT_SESSION_SECRET: 'short' }), null)
})

test('a plain-http origin turns the editor off, except localhost', () => {
  assert.equal(editConfig({ ...ENV, EDIT_ORIGIN: 'http://site.example' }), null)
  assert.equal(editConfig({ ...ENV, EDIT_ORIGIN: 'http://localhost:3000' })?.origin, 'http://localhost:3000')
})
