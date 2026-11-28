/**
 * pass@k and pass^k (note T02's figure), as arithmetic: for runs that succeed independently with
 * chance p, pass@k = 1 − (1 − p)^k (at least one of k succeeds) and pass^k = p^k (all k succeed).
 * Plain TypeScript with no imports, so Node runs it with `--experimental-strip-types`.
 */

export const passAt = (p: number, k: number): number => 1 - Math.pow(1 - p, k)
export const passHat = (p: number, k: number): number => Math.pow(p, k)

/** A share as the figure prints it: one decimal, three just under 100%, so 99.995% never reads as 100%. */
export function pct(v: number): string {
  const x = v * 100
  const s = x >= 99.95 && x < 100 ? x.toFixed(3) : x.toFixed(1)
  return `${s.replace(/\.0+$|(\.\d*?)0+$/, '$1')}%`
}
