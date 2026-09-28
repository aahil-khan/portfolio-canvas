import { readFileSync } from 'node:fs'
import path from 'node:path'

import { buildSha } from '@/lib/edit/version'

export const dynamic = 'force-dynamic'

/*
 * The commit this build was made from. The editor polls this after a save and calls the change
 * live once it reads the new commit. Public on purpose: the repo is public, and a commit id says
 * nothing the repo doesn't.
 */
let sha: string | null = null

export function GET() {
  sha ??= buildSha(process.env, () => readFileSync(path.join(process.cwd(), '.build-sha'), 'utf8'))
  return Response.json({ sha }, { headers: { 'Cache-Control': 'no-store' } })
}
