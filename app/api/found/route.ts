import { NextResponse } from 'next/server'

import { allow, bucketFor, bumpFound, getFound } from '@/lib/store'

/**
 * "I found it" — the counter on the deep-space card.
 *
 * One visitor should count once, which the client enforces with a localStorage flag. That is
 * trivially defeatable, so the rate limit here is the real backstop: the number is a bit of
 * warmth, not a metric anyone should trust.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ found: await getFound() })
}

export async function POST(request: Request) {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (!(await allow(`found:${await bucketFor(ip)}`, 2, 3600))) {
    // already counted recently — hand back the current total rather than an error
    return NextResponse.json({ found: await getFound(), counted: false })
  }
  return NextResponse.json({ found: await bumpFound(), counted: true })
}
