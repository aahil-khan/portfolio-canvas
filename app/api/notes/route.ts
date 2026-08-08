import { NextResponse } from 'next/server'

import { addNote, allow, bucketFor, listNotes, type Note } from '@/lib/store'

/**
 * The notes wall.
 *
 * This is the only endpoint on the site that accepts writes from anyone, so everything it takes
 * is treated as hostile: capped, trimmed, stored as plain text, and rate limited per address.
 * Notes are rendered as text nodes on the client — there is no `dangerouslySetInnerHTML`
 * anywhere in this project, which is what actually makes stored XSS a non-issue.
 */

export const dynamic = 'force-dynamic'

const MAX_TEXT = 180
const MAX_NAME = 24

export async function GET() {
  const notes = await listNotes()
  return NextResponse.json({ notes })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const { text, name, website } = (body ?? {}) as Record<string, unknown>

  /*
   * Honeypot. A field that is off-screen and `aria-hidden`, so a person never fills it in and a
   * naive bot fills in everything. Answer 200 rather than 400 — telling a bot it was detected
   * just teaches it to stop filling the field in.
   */
  if (typeof website === 'string' && website.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  if (typeof text !== 'string') {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }
  const clean = text.trim().slice(0, MAX_TEXT)
  if (!clean) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  const who =
    typeof name === 'string' && name.trim() ? name.trim().slice(0, MAX_NAME) : 'anon'

  // x-forwarded-for is a comma-separated chain; the client is the first entry
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (!(await allow(await bucketFor(ip)))) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const note: Note = { id: crypto.randomUUID(), text: clean, name: who, at: Date.now() }
  await addNote(note)
  return NextResponse.json({ ok: true, note })
}
