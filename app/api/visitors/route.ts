import { NextResponse } from 'next/server'

import { allow, getVisitors, recordVisit, visitorId } from '@/lib/store'

/**
 * Visitor stats for the Visitors card.
 *
 * GET reads; POST records one page load and is fired once per load by `<VisitPing/>`.
 *
 * This is analytics with nothing to opt out of: no cookie is set, no address is stored, and the
 * only per-person value that ever reaches Redis is a truncated hash that goes straight into a
 * HyperLogLog. What comes back out is a count and nothing else. That is a deliberate ceiling on
 * what the card can ever say, not a first version of something more invasive.
 */

export const dynamic = 'force-dynamic'

/**
 * Crawlers, uptime pingers and link unfurlers are not visitors.
 *
 * A UA test is easy to spoof, which does not matter: nobody gains anything by inflating a
 * portfolio's counter, and the cost of missing one is a number that is slightly too high. The
 * point is to keep Googlebot and Vercel's own checks out of a number a human will read.
 */
const BOT =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|probe|scan|fetch|curl|wget|python-requests|node-fetch|axios|facebookexternalhit|embedly|quora link preview|whatsapp|telegram|discord|slack/i

/** 30 page loads an hour is already a lot of reloading; past that it is a script. */
const MAX_LOADS_PER_HOUR = 30

export async function GET() {
  return NextResponse.json(await getVisitors())
}

export async function POST(request: Request) {
  const ua = request.headers.get('user-agent') ?? ''
  // an absent UA is a client that isn't a browser, so it isn't a visitor either
  if (!ua || BOT.test(ua)) return NextResponse.json({ counted: false })

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const id = await visitorId(ip, ua)

  if (!(await allow(`visit:${id}`, MAX_LOADS_PER_HOUR, 3600))) {
    return NextResponse.json({ counted: false })
  }

  // Vercel resolves this at the edge; it is absent locally and on other hosts, which is fine —
  // the countries row simply stays empty rather than the card breaking.
  const cc = (request.headers.get('x-vercel-ip-country') ?? '').toUpperCase()
  await recordVisit(id, /^[A-Z]{2}$/.test(cc) ? cc : null)

  return NextResponse.json({ counted: true })
}
