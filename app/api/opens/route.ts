import { NextResponse } from 'next/server'

import { apps, externalApps } from '@/content/apps'
import { allow, bucketFor, recordOpens } from '@/lib/store'

/**
 * Records which cards get opened, and where visitors arrived from.
 *
 * Write-only on purpose. There is no GET: the numbers are for deciding what belongs on the site,
 * and "nobody opens this project" is useful to know and embarrassing to publish. Reading happens
 * on /stats, behind a token.
 *
 * Everything here is treated as hostile, because anyone can post to it. Card ids are checked
 * against the real set rather than trusted, so the hash cannot be filled with junk keys, and the
 * referrer is length-capped and shape-checked before it becomes a Redis field name.
 */

export const dynamic = 'force-dynamic'

/** Ids that are not dock cards but are still real, spawned cards worth counting. */
const SPAWNED = /^(project|job|shot|archive|game):[a-z0-9-]{1,40}$/

const DOCK_IDS = new Set([...apps, ...externalApps].map((a) => a.id))

/** One person cannot contribute more than this many opens an hour. */
const MAX_BATCHES_PER_HOUR = 20
const MAX_IDS = 30
const MAX_HOST = 80

const isCard = (id: string) => DOCK_IDS.has(id) || SPAWNED.test(id)

/** A hostname, not a URL and not a path — this becomes a field name in a hash. */
const isHost = (h: string) => h.length <= MAX_HOST && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(h)

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const { opens, ref } = (body ?? {}) as Record<string, unknown>

  const ids = Array.isArray(opens)
    ? [...new Set(opens.filter((x): x is string => typeof x === 'string').filter(isCard))].slice(0, MAX_IDS)
    : []
  const host = typeof ref === 'string' && isHost(ref) ? ref.toLowerCase() : null

  if (!ids.length && !host) return NextResponse.json({ counted: false })

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (!(await allow(`opens:${await bucketFor(ip)}`, MAX_BATCHES_PER_HOUR, 3600))) {
    return NextResponse.json({ counted: false })
  }

  await recordOpens(ids, host)
  return NextResponse.json({ counted: true })
}
