#!/usr/bin/env node
// Waits for the live site to serve a commit, then smoke-checks it. The project's deploy command.
//
//   node scripts/wait-live.mjs [sha]        # default: git rev-parse HEAD
//   LIVE_URL=https://… node scripts/wait-live.mjs
//
// Vercel deploys `main` by itself on every push (a merge or an /edit save). This only watches:
// it polls /api/version every 10s for up to 10 minutes until the sha matches, then checks that
// /, /canvas, /edit and /api/version each return 200 (after redirects) with a marker proving
// the page really rendered. One line per check; exits non-zero on timeout or any failure.
//
// GET requests only. Never POST to /api/edit/* from here: a save commits to main.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const BASE = (process.env.LIVE_URL || 'https://www.aahil-khan.xyz').replace(/\/+$/, '')
const POLL_MS = 10_000
const TIMEOUT_MS = 10 * 60_000

const expected = (process.argv[2] || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })).trim()
if (!/^[0-9a-f]{7,40}$/i.test(expected)) {
  console.error(`not a commit sha: ${expected}`)
  process.exit(2)
}
const matches = (sha) => typeof sha === 'string' && sha.length >= 7 && (sha.startsWith(expected) || expected.startsWith(sha))

const name = JSON.parse(readFileSync(new URL('../content/data/profile.json', import.meta.url), 'utf8')).name

async function get(path) {
  const res = await fetch(BASE + path, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(20_000),
  })
  return { status: res.status, url: res.url, body: await res.text() }
}

async function liveSha() {
  try {
    const { status, body } = await get(`/api/version?t=${Date.now()}`)
    if (status !== 200) return `HTTP ${status}`
    return JSON.parse(body).sha
  } catch (err) {
    return `error: ${err.message}`
  }
}

// ── 1. wait for the commit ─────────────────────────────────────────────────────────────────
console.log(`waiting for ${BASE} to serve ${expected.slice(0, 12)}`)
const start = Date.now()
let seen
for (;;) {
  const sha = await liveSha()
  if (matches(sha)) {
    console.log(`ok    live sha ${String(sha).slice(0, 12)} after ${Math.round((Date.now() - start) / 1000)}s`)
    break
  }
  if (sha !== seen) console.log(`...   live is ${String(sha).slice(0, 12)}`)
  seen = sha
  if (Date.now() - start + POLL_MS > TIMEOUT_MS) {
    console.log(`FAIL  still ${String(sha).slice(0, 12)} after 10 minutes — check the deployments on Vercel`)
    process.exit(1)
  }
  await new Promise((r) => setTimeout(r, POLL_MS))
}

// ── 2. smoke-check ─────────────────────────────────────────────────────────────────────────
// Each marker is something only a real render of that page contains.
const checks = [
  { path: '/', marker: name, what: 'profile name' },
  { path: '/canvas', marker: '<nav id="dock"', what: 'the dock' },
  // The editor 404s when its EDIT_* variables are missing; signed out, it renders the sign-in button.
  { path: '/edit', marker: 'href="/api/edit/auth/login"', what: 'sign-in button' },
  { path: '/api/version', what: 'sha', test: (body) => matches(JSON.parse(body).sha) },
]

let failed = 0
for (const c of checks) {
  let line
  try {
    const { status, url, body } = await get(c.path)
    const ok = status === 200 && (c.test ? c.test(body) : body.includes(c.marker))
    const where = url !== BASE + c.path ? ` (→ ${url})` : ''
    line = `${ok ? 'ok  ' : 'FAIL'}  ${c.path.padEnd(13)} ${status}  ${c.what}${ok ? '' : ' missing'}${where}`
    if (!ok) failed++
  } catch (err) {
    line = `FAIL  ${c.path.padEnd(13)} ${err.message}`
    failed++
  }
  console.log(line)
}

if (failed) {
  console.log(`${failed} check(s) failed`)
  process.exit(1)
}
console.log(`live: ${BASE} serves ${expected.slice(0, 12)}, all checks pass`)
