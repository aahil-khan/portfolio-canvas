import { NextResponse } from 'next/server'

import { boards, type BoardId } from '@/content/arcade'
import { addScore, allow, bucketFor, topScores, type Score } from '@/lib/store'

/**
 * The arcade leaderboards — one per game, listed in `content/arcade.ts`.
 *
 * A client can claim any number, so these are scoreboards for fun rather than competitions: the
 * per-game ceiling throws out the obviously-fabricated, and the store keeps one row per name so
 * nobody can flood a board by replaying. Anything more would need the games themselves to be
 * server-simulated, which is a lot of machinery for four toys.
 *
 * Minesweeper ranks a completion time, where the smallest number wins. The sorted set only knows
 * how to keep the largest, so a `lowerWins` board is negated on the way in and flipped back on
 * the way out — the two `signed` calls below are the only place that ever happens, and no
 * negative score escapes this file.
 */

export const dynamic = 'force-dynamic'

const MAX_NAME = 24

const isBoard = (v: unknown): v is BoardId =>
  typeof v === 'string' && Object.hasOwn(boards, v)

/** Between the caller's number and the sorted set's ordering, in both directions. */
const signed = (game: BoardId, value: number) => (boards[game].lowerWins ? -value : value)

export async function GET(request: Request) {
  const game = new URL(request.url).searchParams.get('game') ?? 'typing'
  if (!isBoard(game)) {
    return NextResponse.json({ error: 'unknown game' }, { status: 400 })
  }
  return NextResponse.json({ scores: await read(game) })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const { game, name, value } = (body ?? {}) as Record<string, unknown>

  if (!isBoard(game)) {
    return NextResponse.json({ error: 'unknown game' }, { status: 400 })
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > boards[game].max
  ) {
    return NextResponse.json({ error: 'bad score' }, { status: 400 })
  }

  const who =
    typeof name === 'string' && name.trim() ? name.trim().slice(0, MAX_NAME) : 'anon'

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (!(await allow(`score:${await bucketFor(ip)}`, 10))) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const score: Score = { name: who, value: signed(game, Math.round(value)) }
  await addScore(game, score)
  return NextResponse.json({ ok: true, scores: await read(game) })
}

/** Top rows for `game`, with lower-wins values flipped back to what the player actually scored. */
async function read(game: BoardId): Promise<Score[]> {
  const rows = await topScores(game)
  return boards[game].lowerWins
    ? rows.map((s) => ({ ...s, value: signed(game, s.value) }))
    : rows
}
