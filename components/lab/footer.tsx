import { readFileSync } from 'node:fs'
import path from 'node:path'
import Link from 'next/link'

import { Clock } from '@/components/lab/clock'

/**
 * The commit this build was made from: the same answer `/api/version` gives (Vercel's variable,
 * or `.build-sha` written before a self-hosted build), so rule F can hold the two equal.
 */
function buildSha(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  try {
    return readFileSync(path.join(process.cwd(), '.build-sha'), 'utf8').trim() || 'dev'
  } catch {
    return 'dev'
  }
}

/**
 * The footer: the Bareilly clock, links only to pages that exist (the front page, the Lab, the
 * desk; the colophon and "For AI agents" join with PR 15), and the build hash. Leaving the Lab is
 * a full page load (`<a>`), so the Lab's look never follows a reader onto the canvas.
 */
export function Footer({ copy }: { copy: Record<string, string> }) {
  const sha = buildSha()
  return (
    <footer className="lab-foot lab-page" data-footer>
      <p className="lab-foot-line" data-foot-line>
        <Clock city={copy.footCity} />
        {/* a full page load: leaving the Lab must not carry its look onto the rest of the site */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">{copy.footHome}</a>
        <Link href="/lab">{copy.footLab}</Link>
        <a href="/canvas">{copy.footDesk}</a>
        <span className="lab-foot-build">
          {copy.footBuild} <code data-build={sha}>{sha.slice(0, 7)}</code>
        </span>
      </p>
    </footer>
  )
}
