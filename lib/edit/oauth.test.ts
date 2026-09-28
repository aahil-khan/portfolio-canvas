import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { EditConfig } from './config.ts'
import { authorizeUrl, finishLogin, pkcePair } from './oauth.ts'

const cfg: EditConfig = {
  clientId: 'Iv1.abc',
  clientSecret: 'shh',
  secret: 'x'.repeat(40),
  allowedUserId: 42,
  origin: 'https://site.example',
}
const NOW = 1_800_000_000_000

/** A GitHub that hands out a token for any code and says the user is `userId`. */
function fakeGitHub(userId: number, calls: { url: string; init?: RequestInit }[] = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    if (url === 'https://github.com/login/oauth/access_token')
      return Response.json({ access_token: 'ghu_tok', expires_in: 28800, token_type: 'bearer' })
    if (url === 'https://api.github.com/user') return Response.json({ id: userId, login: 'someone' })
    if (url.startsWith('https://api.github.com/applications/')) return new Response(null, { status: 204 })
    return new Response('not found', { status: 404 })
  }) as typeof fetch
}

test('the PKCE challenge is the S256 of the verifier', async () => {
  const { verifier, challenge } = await pkcePair()
  assert.ok(verifier.length >= 43)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  assert.equal(challenge, Buffer.from(digest).toString('base64url'))
})

test('the authorize url carries client, state, challenge and our callback', () => {
  const u = new URL(authorizeUrl(cfg, 'st4te', 'ch4l'))
  assert.equal(u.origin + u.pathname, 'https://github.com/login/oauth/authorize')
  assert.equal(u.searchParams.get('client_id'), 'Iv1.abc')
  assert.equal(u.searchParams.get('state'), 'st4te')
  assert.equal(u.searchParams.get('code_challenge'), 'ch4l')
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(u.searchParams.get('redirect_uri'), 'https://site.example/api/edit/auth/callback')
})

test('callback refuses other user, and revokes the token it was given', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const r = await finishLogin(cfg, 'code', 'verifier', fakeGitHub(999, calls), NOW)
  assert.deepEqual(r.ok, false)
  assert.equal(!r.ok && r.status, 403)
  const revoke = calls.find((c) => c.url.startsWith('https://api.github.com/applications/'))
  assert.equal(revoke?.init?.method, 'DELETE')
})

test('the allowed user gets a session capped at 8 hours', async () => {
  const r = await finishLogin(cfg, 'code', 'verifier', fakeGitHub(42), NOW)
  assert.ok(r.ok)
  assert.equal(r.ok && r.session.token, 'ghu_tok')
  assert.equal(r.ok && r.session.userId, 42)
  assert.equal(r.ok && r.session.exp, NOW + 8 * 3600 * 1000)
})

test('the code exchange sends the PKCE verifier and the client secret', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  await finishLogin(cfg, 'the-code', 'the-verifier', fakeGitHub(42, calls), NOW)
  const body = new URLSearchParams(String(calls[0].init?.body))
  assert.equal(body.get('code'), 'the-code')
  assert.equal(body.get('code_verifier'), 'the-verifier')
  assert.equal(body.get('client_secret'), 'shh')
})

test('a failed code exchange is a 502, not a session', async () => {
  const broken = (async () => Response.json({ error: 'bad_verification_code' })) as unknown as typeof fetch
  const r = await finishLogin(cfg, 'code', 'verifier', broken, NOW)
  assert.equal(!r.ok && r.status, 502)
})
