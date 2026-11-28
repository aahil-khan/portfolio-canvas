/**
 * The scenario browser's list keys (components/lab/instruments/scenario-browser.tsx), apart from the
 * DOM so the test can hold them: Up and Down (and Left and Right) step through the group, Home and
 * End go to its ends. Plain TypeScript, so Node runs it with `--experimental-strip-types`.
 */
export function listMove(ids: readonly string[], current: string, key: string): string | null {
  if (!ids.length) return null
  const i = Math.max(0, ids.indexOf(current))
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return ids[Math.min(ids.length - 1, i + 1)]
    case 'ArrowUp':
    case 'ArrowLeft':
      return ids[Math.max(0, i - 1)]
    case 'Home':
      return ids[0]
    case 'End':
      return ids[ids.length - 1]
    default:
      return null
  }
}
