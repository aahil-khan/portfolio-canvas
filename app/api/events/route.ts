import { eventFields, parseBatch } from '@/lib/events'
import { isBotUA } from '@/lib/ping'
import { allow, bucketFor, noteEventRejected, recordEvents, type EventRejection } from '@/lib/store'

/**
 * Records analytics events (`lib/events.ts`, contract `content/lab/API.md` §9) as counters.
 *
 * Write-only, like `/api/opens`: there is no GET, and the numbers are read on /stats behind a
 * token. The browser only sends here once the site's admission gate has let the tab in, but
 * anyone can post to a URL, so everything below treats the request as hostile:
 *
 *   - the same bot filter as every other counter (`isBotUA`), and a browser's own cross-site
 *     marker (`Sec-Fetch-Site`, `Origin`) refused, since the site only ever posts to itself;
 *   - `application/json` only, and at most `MAX_BYTES`, read before anything is parsed;
 *   - a strict parse: one unknown name, one extra key, one value outside its bucket, and the whole
 *     batch is refused, because the browser runs the same parser and never sends one;
 *   - a fixed-window rate limit per hashed address;
 *   - nothing echoed back. Every answer is a status with an empty body, so a probe learns which
 *     rule it hit and nothing about the data.
 *
 * No cookie is read or set, and the address only ever becomes a truncated hash for the limiter.
 */

export const dynamic = 'force-dynamic'

/** 40 events of the longest shape is under 5 KB; this leaves room and refuses anything silly. */
const MAX_BYTES = 8 * 1024
/** A reader sends a batch on admission, then one per few seconds of activity at most. */
const MAX_BATCHES_PER_HOUR = 120

const empty = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

async function refuse(reason: EventRejection, status: number) {
  await noteEventRejected(reason)
  return empty(status)
}

function crossSite(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true
  const origin = request.headers.get('origin')
  if (!origin) return false
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

export async function POST(request: Request) {
  if (isBotUA(request.headers.get('user-agent'))) return refuse('ua', 403)
  if (crossSite(request)) return refuse('origin', 403)

  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (type !== 'application/json') return refuse('type', 415)

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) return refuse('size', 413)
  let text: string
  try {
    text = await request.text()
  } catch {
    return refuse('body', 400)
  }
  // a chunked body has no Content-Length, so the length is checked again once it is read
  if (new TextEncoder().encode(text).length > MAX_BYTES) return refuse('size', 413)

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return refuse('body', 400)
  }
  const events = parseBatch(body)
  if (!events) return refuse('body', 400)

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (!(await allow(`events:${await bucketFor(ip)}`, MAX_BATCHES_PER_HOUR, 3600))) return refuse('rate', 429)

  const counts: string[] = []
  const open: string[] = []
  for (const e of events) {
    const f = eventFields(e)
    counts.push(...f.counts)
    open.push(...f.open)
  }
  await recordEvents(counts, open)
  return empty(204)
}
