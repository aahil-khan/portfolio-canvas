import { test } from 'node:test'
import assert from 'node:assert/strict'

import { guard } from './guard.ts'
import { COOKIE, seal } from './session.ts'

const SECRET = 's'.repeat(40)
const ENV = {
  EDIT_GITHUB_APP_CLIENT_ID: 'Iv1.abc',
  EDIT_GITHUB_APP_CLIENT_SECRET: 'shh',
  EDIT_SESSION_SECRET: SECRET,
  EDIT_ALLOWED_USER_ID: '42',
  EDIT_ORIGIN: 'https://site.example',
}
const NOW = 1_800_000_000_000

async function req(opts: { method?: string; origin?: string; userId?: number; exp?: number; cookie?: boolean } = {}) {
  const headers = new Headers()
  if (opts.origin) headers.set('origin', opts.origin)
  if (opts.cookie !== false) {
    const v = await seal({ token: 't', userId: opts.userId ?? 42, login: 'a', exp: opts.exp ?? NOW + 1000 }, SECRET)
    headers.set('cookie', `other=1; ${COOKIE}=${v}`)
  }
  return new Request('https://site.example/api/edit/content', { method: opts.method ?? 'GET', headers })
}

const status = async (g: ReturnType<typeof guard>) => {
  const r = await g
  return r.ok ? 200 : r.res.status
}

test('missing env is a 404', async () => {
  assert.equal(await status(guard(await req(), { mutate: false }, {}, NOW)), 404)
})

test('a signed-in GET passes', async () => {
  const r = await guard(await req(), { mutate: false }, ENV, NOW)
  assert.ok(r.ok)
  assert.equal(r.ok && r.session.userId, 42)
})

test('no cookie is a 401', async () => {
  assert.equal(await status(guard(await req({ cookie: false }), { mutate: false }, ENV, NOW)), 401)
})

test('an expired session is a 401', async () => {
  assert.equal(await status(guard(await req({ exp: NOW - 1 }), { mutate: false }, ENV, NOW)), 401)
})

test('a session for another user id is a 403', async () => {
  assert.equal(await status(guard(await req({ userId: 7 }), { mutate: false }, ENV, NOW)), 403)
})

test('a mutation from a foreign origin is a 403', async () => {
  const r = await req({ method: 'POST', origin: 'https://evil.example' })
  assert.equal(await status(guard(r, { mutate: true }, ENV, NOW)), 403)
})

test('a mutation with no Origin header is a 403', async () => {
  assert.equal(await status(guard(await req({ method: 'PUT' }), { mutate: true }, ENV, NOW)), 403)
})

test('a mutation from our own origin passes', async () => {
  const r = await req({ method: 'PUT', origin: 'https://site.example' })
  assert.ok((await guard(r, { mutate: true }, ENV, NOW)).ok)
})

test('refusals are never cached', async () => {
  const r = await guard(await req({ cookie: false }), { mutate: false }, ENV, NOW)
  assert.equal(!r.ok && r.res.headers.get('cache-control'), 'no-store')
})

test('EDIT_DEV_FAKE is ignored in production', async () => {
  const env = { EDIT_DEV_FAKE: '1', NODE_ENV: 'production' }
  assert.equal(await status(guard(await req({ cookie: false }), { mutate: false }, env, NOW)), 404)
})

test('EDIT_DEV_FAKE signs you in as a dev user outside production', async () => {
  const env = { EDIT_DEV_FAKE: '1', NODE_ENV: 'development' }
  const r = await guard(await req({ cookie: false }), { mutate: false }, env, NOW)
  assert.ok(r.ok)
  assert.equal(r.ok && r.session.token, 'dev-fake')
})

test('EDIT_DEV_FAKE still refuses a foreign-origin mutation', async () => {
  const env = { EDIT_DEV_FAKE: '1', NODE_ENV: 'development' }
  const r = await req({ method: 'PUT', origin: 'https://evil.example', cookie: false })
  assert.equal(await status(guard(r, { mutate: true }, env, NOW)), 403)
})
