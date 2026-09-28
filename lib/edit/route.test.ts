import { test } from 'node:test'
import assert from 'node:assert/strict'

import { editRoute } from './route.ts'
import { COOKIE, seal } from './session.ts'

const SECRET = 's'.repeat(40)
Object.assign(process.env, {
  EDIT_GITHUB_APP_CLIENT_ID: 'Iv1.abc',
  EDIT_GITHUB_APP_CLIENT_SECRET: 'shh',
  EDIT_SESSION_SECRET: SECRET,
  EDIT_ALLOWED_USER_ID: '42',
  EDIT_ORIGIN: 'https://site.example',
})

test('when GitHub rejects the token, the session cookie is cleared so the page falls back to sign-in', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('{"message":"Bad credentials"}', { status: 401 })) as typeof fetch
  try {
    const cookie = await seal({ token: 'revoked', userId: 42, login: 'a', exp: Date.now() + 60_000 }, SECRET)
    const req = new Request('https://site.example/api/edit/content', { headers: { cookie: `${COOKIE}=${cookie}` } })
    const res = await editRoute(false, async (git) => {
      await git.head()
      return new Response('unreachable')
    })(req, undefined)
    assert.equal(res.status, 401)
    assert.match(res.headers.get('set-cookie') ?? '', new RegExp(`^${COOKIE}=;.*Max-Age=0`))
  } finally {
    globalThis.fetch = realFetch
  }
})
