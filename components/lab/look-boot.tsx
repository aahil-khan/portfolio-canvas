'use client'

import { lookBootScript } from '@/lib/lab/look'

/**
 * The look's boot script (API.md §8), inline in the server's HTML so it runs before first paint,
 * after the root layout's theme boot script. It is rendered from a client component because
 * `lib/lab/look.ts` imports `lib/motion/reduced.ts`, whose hook cannot load in a Server Component;
 * the HTML is the same either way, and React never runs the script again after hydration.
 */
export function LookBoot() {
  return <script dangerouslySetInnerHTML={{ __html: lookBootScript }} suppressHydrationWarning />
}
