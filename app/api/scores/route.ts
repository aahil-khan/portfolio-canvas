import { NextResponse } from 'next/server'

import { addScore, allow, bucketFor, topScores, type Score } from '@/lib/store'

/**
 * The typing-test leaderboard.
 *
 * A client can claim any number, so this is a scoreboard for fun rather than a competition:
 * the ceiling below throws out the obviously-fabricated, and the store keeps one row per name
 * so nobody can flood the board by replaying. Anything more would need the test itself to be
 * server-timed, which is a lot of machinery for a toy.
 */

export const dynamic = 'force-dynamic'

const GAMES = new Set(['typing'])
/** Comfortably above the human world record (~300), so only nonsense trips it. */
const MAX_WPM = 400
const MAX_NAME = 24

export async function GET(request: Request) {
  const game = new URL(request.url).searchParams.get('game') ?? 'typing'
  if (!GAMES.has(game)) {
    return NextResponse.json({ error: 'unknown game' }, { status: 400 })
  }
  return NextResponse.json({ scores: await topScores(game) })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const { game, name, wpm } = (body ?? {}) as Record<string, unknown>

  if (typeof game !== 'string' || !GAMES.has(game)) {
    return NextResponse.json({ error: 'unknown game' }, { status: 400 })
  }
  if (typeof wpm !== 'number' || !Number.isFinite(wpm) || wpm <= 0 || wpm > MAX_WPM) {
    return NextResponse.json({ error: 'bad score' }, { status: 400 })
  }

  const who =
    typeof name === 'string' && name.trim() ? name.trim().slice(0, MAX_NAME) : 'anon'

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (!(await allow(`score:${await bucketFor(ip)}`, 10))) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const score: Score = { name: who, wpm: Math.round(wpm), at: Date.now() }
  await addScore(game, score)
  return NextResponse.json({ ok: true, scores: await topScores(game) })
}
