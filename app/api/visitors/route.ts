import { NextResponse } from 'next/server'

import { isBotUA, parsePing, pingBuckets } from '@/lib/ping'
import { allow, getVisitors, noteRejected, recordVisit, visitorId } from '@/lib/store'

/**
 * Visitor stats for the Visitors card.
 *
 * GET reads; POST records one visit. `<VisitPing/>` sends it once per page load, when the site's
 * admission gate (`lib/admission.ts`) decides: after the first trusted input and a short dwell,
 * so a browser that loads the page, grabs it and leaves is not counted. The body is a `Ping`: a handful of coarse facts about the session that
 * become aggregate counters, so the stats page can show what the traffic looks like.
 *
 * This is analytics with nothing to opt out of: no cookie is set, no address is stored, and the
 * only per-person value that ever reaches Redis is a truncated hash that goes straight into a
 * HyperLogLog. What comes back out is a count and nothing else. That is a deliberate ceiling on
 * what the card can ever say, not a first version of something more invasive.
 */

export const dynamic = 'force-dynamic'

/** 30 page loads an hour is already a lot of reloading; past that it is a script. */
const MAX_LOADS_PER_HOUR = 30

export async function GET() {
  return NextResponse.json(await getVisitors())
}

export async function POST(request: Request) {
  const ua = request.headers.get('user-agent') ?? ''
  // the bot filter every counter shares (lib/ping.ts); an absent UA is refused too
  if (isBotUA(ua)) return rejected('ua')

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    /* no body, or not JSON: parsePing turns that into null below */
  }
  const ping = parsePing(body)
  if (!ping) return rejected('body')
  // a browser that says it is automated is believed
  if (ping.webdriver) return rejected('webdriver')

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const id = await visitorId(ip, ua)

  if (!(await allow(`visit:${id}`, MAX_LOADS_PER_HOUR, 3600))) return rejected('rate')

  // Vercel resolves this at the edge; it is absent locally and on other hosts, which is fine —
  // the countries row simply stays empty rather than the card breaking.
  const cc = (request.headers.get('x-vercel-ip-country') ?? '').toUpperCase()
  await recordVisit(id, /^[A-Z]{2}$/.test(cc) ? cc : null, pingBuckets(ping))

  return NextResponse.json({ counted: true })
}

async function rejected(reason: Parameters<typeof noteRejected>[0]) {
  await noteRejected(reason)
  return NextResponse.json({ counted: false })
}
