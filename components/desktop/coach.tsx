'use client'

import { type ReactNode, useCallback, useState, useSyncExternalStore } from 'react'

/**
 * First-run coaching, and the one-off tips that come later.
 *
 * This replaces a line of 12px muted text in the bottom-left corner. That hint failed twice
 * over: it was quiet enough to miss entirely, and having no surface of its own it tangled
 * illegibly with whatever card happened to be underneath it. Anything that has to be read over
 * an infinite canvas of opaque cards needs to be opaque itself.
 *
 * It sits above the dock rather than in a corner. The dock's band is the one strip of screen
 * already given over to chrome, so a panel there buries the least content — and most of what
 * there is to explain is down there anyway.
 */

/* ------------------------------------------------------------------ memory */

/**
 * Dismissals, keyed, in localStorage.
 *
 * Same external-store shape as lib/theme.ts and lib/best.ts, and for the same reason: reading
 * localStorage during render is a hydration mismatch, and copying it into state in an effect
 * cascades a second render on every mount. Keyed because each tip has its own memory —
 * finishing the tour must not also swallow a nudge the visitor has never seen.
 *
 * The per-key `subscribe`/`read` pair is cached: `useSyncExternalStore` re-subscribes whenever
 * the identity of `subscribe` changes, and a fresh closure every render would do exactly that.
 */

export const COACH_TOUR = 'canvas.coach-tour'
export const COACH_ARRANGE = 'canvas.coach-arrange'

interface Store {
  subscribe: (fn: () => void) => () => void
  read: () => boolean
}

const stores = new Map<string, Store>()
const caches = new Map<string, boolean>()
const listeners = new Map<string, Set<() => void>>()

function storeFor(key: string): Store {
  const existing = stores.get(key)
  if (existing) return existing
  const set = new Set<() => void>()
  listeners.set(key, set)
  const store: Store = {
    subscribe: (fn) => {
      set.add(fn)
      return () => set.delete(fn)
    },
    read: () => {
      const cached = caches.get(key)
      if (cached !== undefined) return cached
      let off = false
      if (typeof localStorage !== 'undefined') {
        try {
          off = localStorage.getItem(key) === 'off'
        } catch {
          off = false
        }
      }
      caches.set(key, off)
      return off
    },
  }
  stores.set(key, store)
  return store
}

/**
 * Retire a tip from anywhere.
 *
 * Exported because a nudge should stop the moment its advice is taken: running any arrangement
 * retires the one suggesting you try them, which is politer than making someone dismiss a tip
 * they have already acted on.
 */
export function dismissCoach(key: string): void {
  if (caches.get(key) === true) return
  caches.set(key, true)
  try {
    localStorage.setItem(key, 'off')
  } catch {
    // private mode: it stays hidden for this session, which is the whole ask
  }
  for (const fn of listeners.get(key) ?? []) fn()
}

/** Has this tip been seen off? Exported so callers can sequence one panel behind another. */
export function useCoachDone(key: string): boolean {
  const store = storeFor(key)
  // the server always renders it; the client hides it after hydration if it has been seen
  return useSyncExternalStore(store.subscribe, store.read, () => false)
}

/* ------------------------------------------------------------------- panel */

function Panel({
  badge,
  title,
  children,
  onDismiss,
  dismissLabel,
  tail,
  foot,
}: {
  badge: string
  title: string
  children: ReactNode
  onDismiss: () => void
  dismissLabel: string
  tail?: boolean
  foot?: ReactNode
}) {
  return (
    <aside id="coach" data-tail={tail || undefined} role="note">
      <div className="coach__top">
        <span className="coach__badge">{badge}</span>
        <button type="button" className="coach__skip" onClick={onDismiss}>
          {dismissLabel}
        </button>
      </div>
      <p className="coach__title">{title}</p>
      <p className="coach__body">{children}</p>
      {foot}
    </aside>
  )
}

export interface CoachStep {
  title: string
  body: string
  /** Point the panel's tail at the dock, for the steps that are about it. */
  tail?: boolean
}

/**
 * The first-run tour. Four steps, then it never appears again.
 *
 * The step lives in component state rather than storage: only "finished" is worth remembering,
 * and a visitor who reloads halfway through a four-step tour has told you they were not reading
 * it. Restarting is kinder than resuming into the middle of something forgotten.
 */
export function CoachTour({
  steps,
  nextLabel,
  doneLabel,
  skipLabel,
  stepLabel,
}: {
  steps: readonly CoachStep[]
  nextLabel: string
  doneLabel: string
  skipLabel: string
  /** Given (n, total), returns the badge text — the copy owns the wording. */
  stepLabel: (n: number, total: number) => string
}) {
  const done = useCoachDone(COACH_TOUR)
  const [i, setI] = useState(0)
  const finish = useCallback(() => dismissCoach(COACH_TOUR), [])
  const next = useCallback(() => {
    setI((n) => {
      if (n + 1 >= steps.length) {
        finish()
        return n
      }
      return n + 1
    })
  }, [steps.length, finish])

  if (done || !steps.length) return null
  const step = steps[Math.min(i, steps.length - 1)]
  const last = i >= steps.length - 1

  return (
    <Panel
      badge={stepLabel(i + 1, steps.length)}
      title={step.title}
      onDismiss={finish}
      dismissLabel={skipLabel}
      tail={step.tail}
      foot={
        <div className="coach__foot">
          <div className="coach__dots" aria-hidden>
            {steps.map((s, n) => (
              <i key={s.title} className={n === i ? 'is-on' : undefined} />
            ))}
          </div>
          <button type="button" className="coach__next" onClick={next}>
            {last ? doneLabel : nextLabel}
          </button>
        </div>
      }
    >
      {step.body}
    </Panel>
  )
}

/** A single contextual tip, on the same surface, shown when something makes it relevant. */
export function CoachTip({
  storageKey,
  badge,
  title,
  children,
  dismissLabel,
}: {
  storageKey: string
  badge: string
  title: string
  children: ReactNode
  dismissLabel: string
}) {
  const done = useCoachDone(storageKey)
  const dismiss = useCallback(() => dismissCoach(storageKey), [storageKey])
  if (done) return null
  return (
    <Panel badge={badge} title={title} onDismiss={dismiss} dismissLabel={dismissLabel}>
      {children}
    </Panel>
  )
}
