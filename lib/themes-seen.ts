'use client'

import { themes } from '@/content/themes'

/**
 * Which themes this visitor has actually applied.
 *
 * Kept apart from `lib/eggs.ts` because it is a tally rather than a trophy: eighteen themes is
 * more than anyone flips through in one sitting, so the count has to survive reloads for the egg
 * at the end of it to be reachable at all. Same external-store reasoning as everywhere else —
 * localStorage read lazily and cached, never during render.
 */

const KEY = 'canvas.themes-seen'

let cache: Set<string> | null = null

function read(): Set<string> {
  if (cache) return cache
  cache = new Set()
  if (typeof localStorage === 'undefined') return cache
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (Array.isArray(parsed)) {
      for (const v of parsed) if (typeof v === 'string') cache.add(v)
    }
  } catch {
    /* private mode: this session's tally still counts, it just won't outlive the tab */
  }
  return cache
}

/** Records `id`, and returns true once every theme has been worn at least once. */
export function seeTheme(id: string): boolean {
  const seen = read()
  if (!seen.has(id)) {
    seen.add(id)
    try {
      localStorage.setItem(KEY, JSON.stringify([...seen]))
    } catch {
      /* as above */
    }
  }
  return themes.every((t) => seen.has(t.id))
}
