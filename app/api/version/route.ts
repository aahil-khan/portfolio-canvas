import { readFileSync } from 'node:fs'
import path from 'node:path'

export const dynamic = 'force-dynamic'

/*
 * The commit this build was made from. The deploy watcher writes `.build-sha` before it builds;
 * the editor polls this after a save and calls the change live once it reads the new commit.
 * Public on purpose: the repo is public, and a commit id says nothing the repo doesn't.
 */
let sha: string | null = null

export function GET() {
  if (sha === null) {
    try {
      sha = readFileSync(path.join(process.cwd(), '.build-sha'), 'utf8').trim() || 'dev'
    } catch {
      sha = 'dev'
    }
  }
  return Response.json({ sha }, { headers: { 'Cache-Control': 'no-store' } })
}
