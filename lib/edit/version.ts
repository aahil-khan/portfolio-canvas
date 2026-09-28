/**
 * Which commit the running site was built from — what `/api/version` reports, and what the editor
 * waits for after a save before it says "Live".
 *
 * Vercel provides it as an environment variable. On aahil-server the deploy watcher writes it to
 * `.build-sha` before building. Anywhere else there is no commit to report.
 */
export function buildSha(env: Record<string, string | undefined>, readBuildSha: () => string): string {
  if (env.VERCEL_GIT_COMMIT_SHA) return env.VERCEL_GIT_COMMIT_SHA
  try {
    return readBuildSha().trim() || 'dev'
  } catch {
    return 'dev'
  }
}
