/**
 * The site's one admission gate. Every counter waits on it: the visit ping, card opens and
 * analytics events. Nothing is sent to any of them until a browser has been admitted.
 *
 * A page load is admitted when all three hold:
 *
 *   1. a **trusted** physical input arrives (`pointerdown`, `keydown`, `wheel` or `touchstart`
 *      with `isTrusted`), so `dispatchEvent` from a script can never unlock it;
 *   2. the browser does not admit to automation (`navigator.webdriver` is not true);
 *   3. the page is still open `DWELL_MS` after the gate armed. A script grabs a page and leaves in
 *      a second or two; a person who leaves inside eight seconds was not reading either.
 *
 * This is the rule `<VisitPing/>` has used since 28e257f. What changed is that it is now shared:
 * `/api/opens` used to count from the first card open with no gate at all, so the scraper fleet
 * the visit gate was built against still filled the opens table and the referrers. One gate for
 * every counter is the fix.
 *
 * **One admission per tab session.** Once a tab is admitted, a flag in `sessionStorage` says so,
 * and a later full page load in the same tab is admitted at once (unless it says it is automated),
 * so events from a reload or a hard navigation are not held back for another eight seconds. The
 * flag is a boolean, never sent anywhere, and dies with the tab: it identifies nobody.
 *
 * Each page load still makes its own **decision** from its own input and dwell. That is what the
 * visit ping reports, so "views" keeps meaning what it always has: page loads that passed the
 * gate. Queues ask `whenAdmitted`, which is the session-wide answer.
 *
 * `scroll` is deliberately not an input: `window.scrollTo` for lazy content fires it, and a wheel
 * never does. The listeners are on `window`, capture phase, so nothing that stops propagation (the
 * smooth scroller takes wheel events) can starve them.
 *
 * Pure apart from `browserGate()`, which binds it to the real window; `createGate` takes its
 * environment so `lib/admission.test.ts` can drive it with a fake clock and fake events.
 */

import { INPUT_TYPES, type InputType } from './ping.ts'

/** How long someone has to stay before they count. */
export const DWELL_MS = 8000

/** `sessionStorage`: set once this tab has been admitted. */
export const SESSION_KEY = 'canvas.admitted'

/** What one page load's gate concluded. */
export interface Decision {
  /** True when this page load passed: trusted input, no webdriver, the dwell. */
  admitted: boolean
  /** Which kind of physical input it was. */
  via: InputType
  /** Milliseconds from the gate arming to that input. */
  input: number
  /** `navigator.webdriver` when the decision was made. */
  webdriver: boolean
}

type Listener = (e: { type: string; isTrusted: boolean }) => void

export interface GateEnv {
  now(): number
  listen(type: InputType, fn: Listener): void
  unlisten(type: InputType, fn: Listener): void
  later(fn: () => void, ms: number): void
  webdriver(): boolean
  /** Whether this tab was admitted before, and a way to say it now has been. Both may throw. */
  sessionGet(): boolean
  sessionSet(): void
}

export interface Gate {
  /** This page load's own decision, once it has one. Never called if no trusted input arrives. */
  onDecision(cb: (d: Decision) => void): void
  /** Called once the tab is admitted: at once if it already is. Never called for a refused one. */
  whenAdmitted(cb: () => void): void
  /** Whether the tab is admitted right now. Arms the gate if it is not armed yet. */
  isAdmitted(): boolean
}

export function createGate(env: GateEnv): Gate {
  let armed = false
  let t0 = 0
  let admitted = false
  let decision: Decision | null = null
  const decided: ((d: Decision) => void)[] = []
  const waiting: (() => void)[] = []

  const admit = () => {
    if (admitted) return
    admitted = true
    for (const cb of waiting.splice(0)) cb()
  }

  const fire: Listener = (e) => {
    if (!e.isTrusted) return
    for (const type of INPUT_TYPES) env.unlisten(type, fire)
    const input = Math.max(0, Math.round(env.now() - t0))
    const via = e.type as InputType

    const decide = () => {
      const webdriver = env.webdriver()
      decision = { admitted: !webdriver, via, input, webdriver }
      if (decision.admitted) {
        try {
          env.sessionSet()
        } catch {
          /* storage disabled: admitted for this page load only */
        }
        admit()
      }
      for (const cb of decided.splice(0)) cb(decision)
    }

    const left = DWELL_MS - (env.now() - t0)
    if (left <= 0) decide()
    else env.later(decide, left)
  }

  const arm = () => {
    if (armed) return
    armed = true
    t0 = env.now()
    let before = false
    try {
      before = env.sessionGet()
    } catch {
      /* private mode, or storage disabled outright */
    }
    // a forged flag still cannot admit a browser that says it is automated
    if (before && !env.webdriver()) admitted = true
    for (const type of INPUT_TYPES) env.listen(type, fire)
  }

  return {
    onDecision(cb) {
      arm()
      if (decision) cb(decision)
      else decided.push(cb)
    },
    whenAdmitted(cb) {
      arm()
      if (admitted) cb()
      else waiting.push(cb)
    },
    isAdmitted() {
      arm()
      return admitted
    },
  }
}

let gate: Gate | null = null

/**
 * The gate for this window, created on first use. A module-level singleton, so React's dev
 * StrictMode running every effect twice, or a client navigation remounting a component, never
 * arms it twice. On the server there is no window, and nothing ever admits.
 */
export function browserGate(): Gate | null {
  if (typeof window === 'undefined') return null
  if (gate) return gate
  const opts = { capture: true, passive: true } as const
  gate = createGate({
    now: () => performance.now(),
    listen: (type, fn) => addEventListener(type, fn, opts),
    unlisten: (type, fn) => removeEventListener(type, fn, opts),
    later: (fn, ms) => void setTimeout(fn, ms),
    webdriver: () => navigator.webdriver === true,
    sessionGet: () => sessionStorage.getItem(SESSION_KEY) === '1',
    sessionSet: () => sessionStorage.setItem(SESSION_KEY, '1'),
  })
  return gate
}

export function onDecision(cb: (d: Decision) => void): void {
  browserGate()?.onDecision(cb)
}

export function whenAdmitted(cb: () => void): void {
  browserGate()?.whenAdmitted(cb)
}

export function isAdmitted(): boolean {
  return browserGate()?.isAdmitted() ?? false
}
