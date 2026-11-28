import { track } from '@/lib/events'
import { previewData, type PreviewData } from '@/lib/lab/preview/data'
import { entryArticle } from '@/lib/lab/preview/fetch-entry'
import { Intent, MAX_STACK, type Opened, type Point, type Rect } from '@/lib/lab/preview/intent'
import { parseTarget } from '@/lib/lab/preview/target'
import { prefersReducedMotion } from '@/lib/motion/reduced'

import { readRef, type RefLine } from './card'
import { prefixOf, type Win } from './window'

/** An event the root recorded before the controller had loaded, replayed in order with its time. */
export interface Recorded {
  type: 'over' | 'out' | 'focusin' | 'press'
  target: EventTarget | null
  related: EventTarget | null
  t: number
  x: number
  y: number
  pointerType: string
  via?: 'tap' | 'click'
}

const PREVIEW = 'a[data-preview]'
const HOVERS = '(hover: hover) and (pointer: fine)'
const TABBABLE = 'a[href], button:not([disabled]), summary, input, select, textarea, [tabindex]:not([tabindex="-1"])'

const triggerOf = (t: EventTarget | null): HTMLAnchorElement | null => {
  const a = t instanceof Element ? t.closest(PREVIEW) : null
  return a instanceof HTMLAnchorElement && parseTarget(a.getAttribute('data-preview')) ? a : null
}
const hoverable = () => window.matchMedia(HOVERS).matches
const shown = (el: Element) => (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === 'fixed'
const isEntry = (a: HTMLAnchorElement) => parseTarget(a.getAttribute('data-preview'))?.kind === 'entry'

/**
 * The previews' one delegated controller (API.md §5; plan PR 10), as a plain object outside React:
 * every `a[data-preview]` on the page and in every open window is handled by the listeners here.
 * Hover and focus go through the timing machine (`lib/lab/preview/intent.ts`); a first tap on touch
 * opens a sheet; Esc closes the top window; a press closes what is above it; Tab bridges into a
 * window and back out; a jump inside a window scrolls that window. The stack reaches React only
 * through `onWins`, when a window opens or closes.
 */
export class Delegate {
  wins: Win[] = []
  private readonly els = new Map<number, HTMLElement>()
  private seq = 0
  private lastPoint: Point | null = null
  private lastPointer = 'mouse'
  private dataStarted = false
  readonly intent: Intent<HTMLAnchorElement>
  private readonly onWins: (w: Win[]) => void
  private readonly onData: (d: PreviewData) => void

  constructor(onWins: (w: Win[]) => void, onData: (d: PreviewData) => void) {
    this.onWins = onWins
    this.onData = onData
    this.intent = new Intent<HTMLAnchorElement>({
      now: () => performance.now(),
      schedule: (fn, ms) => window.setTimeout(fn, ms),
      cancel: (h) => window.clearTimeout(h as number),
      rectOf: (level) => {
        const r = this.elAt(level)?.getBoundingClientRect()
        return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null
      },
      open: (o) => this.opened(o),
      close: (level) => {
        if (level >= this.wins.length) return
        this.setWins(this.wins.slice(0, level))
      },
    })
  }

  // ---------- the stack ----------

  private setWins(w: Win[]) {
    this.wins = w
    this.onWins(w)
  }

  private opened(o: Opened<HTMLAnchorElement>) {
    const target = parseTarget(o.trigger.getAttribute('data-preview'))
    if (!target || !document.contains(o.trigger)) return
    const rects = [...o.trigger.getClientRects()]
    const pt = o.via === 'hover' ? this.lastPoint : null
    const hit = pt ? rects.find((r) => pt.x >= r.left - 2 && pt.x <= r.right + 2 && pt.y >= r.top - 2 && pt.y <= r.bottom + 2) : undefined
    const a = hit ?? rects[0]
    const anchor: Rect | null = a ? { left: a.left, top: a.top, right: a.right, bottom: a.bottom } : null
    const words = (o.trigger.textContent ?? '').replace(/\s+/g, ' ').trim()
    let ref: RefLine | null = null
    if (target.kind === 'ref') {
      const parent = o.level > 0 ? this.wins[o.level - 1] : undefined
      const scope: ParentNode = (parent && this.els.get(parent.n)) || document
      ref = readRef(scope, parent ? prefixOf(parent) : '', target.id, words)
    }
    const win: Win = { n: ++this.seq, level: o.level, trigger: o.trigger, target, via: o.via, sheet: o.via === 'tap' || !hoverable(), anchor, words, ref }
    this.setWins([...this.wins.slice(0, o.level), win])
    // the sound lane plays its `peek` cue for anything but a hover (API.md §7); never a hover sound
    document.dispatchEvent(new CustomEvent('lab:preview-open', { detail: { via: o.via } }))
    track('preview_open', { via: o.via, target: target.kind })
  }

  readonly elAt = (level: number): HTMLElement | null => {
    const w = this.wins[level]
    return w ? (this.els.get(w.n) ?? null) : null
  }
  readonly register = (n: number, el: HTMLElement | null): void => {
    if (el) this.els.set(n, el)
    else this.els.delete(n)
  }
  /** The Close button. */
  readonly close = (level: number): void => {
    const w = this.wins[level]
    const inside = !!this.elAt(level)?.contains(document.activeElement)
    this.intent.closeFrom(level)
    if (w && (inside || w.sheet) && document.contains(w.trigger)) w.trigger.focus({ preventScroll: true })
  }
  /** A window's link scrolled off the screen. */
  readonly hidden = (level: number): void => {
    if (this.wins[level] && !this.wins[level].sheet) this.intent.closeFrom(level)
  }
  closeAll(): void {
    this.intent.closeAll()
  }
  private path: string | null = null
  /** The page's path: a change of page closes the stack. */
  pageIs(path: string): void {
    if (this.path !== null && this.path !== path) this.intent.closeAll()
    this.path = path
  }

  /** The deepest window the node is in; -1 for the page. */
  private levelOf(node: EventTarget | null): number {
    if (!(node instanceof Node)) return -1
    for (let i = this.wins.length - 1; i >= 0; i--) if (this.elAt(i)?.contains(node)) return i
    return -1
  }
  /** The deepest window the node is in, or whose link it is on; -1 for the page. */
  private keepOf(node: EventTarget | null): number {
    let k = this.levelOf(node)
    if (node instanceof Node) for (let i = this.wins.length - 1; i > k; i--) if (this.wins[i].trigger.contains(node)) k = i
    return k
  }
  private loadData() {
    if (this.dataStarted) return
    this.dataStarted = true
    previewData().then((d) => {
      if (d) this.onData(d)
      else this.dataStarted = false
    })
  }

  // ---------- what the page does ----------

  private over(target: EventTarget | null, x: number, y: number, t: number, pointerType: string) {
    if (pointerType === 'touch' || !hoverable()) return
    const point = { x, y }
    this.lastPoint = point
    this.intent.at(this.keepOf(target), point, t)
    const a = triggerOf(target)
    if (!a) return
    const level = this.levelOf(a) + 1
    if (level >= MAX_STACK) return
    this.loadData()
    if (isEntry(a)) entryArticle(a.href)
    this.intent.enter(a, level, 'hover', t)
  }
  private out(target: EventTarget | null, related: EventTarget | null, x: number, y: number, pointerType: string) {
    if (pointerType === 'touch') return
    const a = triggerOf(target)
    if (!a || (related instanceof Node && a.contains(related))) return
    this.intent.leave(a, { x, y })
  }
  private focusIn(target: EventTarget | null, t: number) {
    const a = triggerOf(target)
    if (a && a.matches(':focus-visible')) {
      const level = this.levelOf(a) + 1
      if (level < MAX_STACK && this.wins[level]?.trigger !== a) {
        this.loadData()
        if (isEntry(a)) entryArticle(a.href)
        this.intent.enter(a, level, 'focus', t)
      }
    }
    if (this.keepOf(target) >= 0) this.intent.focusKept()
    else this.intent.blur()
  }
  private press(a: HTMLAnchorElement, via: 'tap' | 'click') {
    this.loadData()
    if (isEntry(a)) entryArticle(a.href)
    this.intent.press(a, this.levelOf(a) + 1, via)
  }

  // ---------- listeners ----------

  private onOver = (e: PointerEvent) => this.over(e.target, e.clientX, e.clientY, e.timeStamp, e.pointerType)
  private onOut = (e: PointerEvent) => this.out(e.target, e.relatedTarget, e.clientX, e.clientY, e.pointerType)
  private onMove = (e: PointerEvent) => {
    if (!this.wins.length || e.pointerType === 'touch') return
    this.lastPoint = { x: e.clientX, y: e.clientY }
    this.intent.at(this.keepOf(e.target), this.lastPoint, e.timeStamp)
  }
  private onLeaveDoc = () => this.intent.at(-1, null)
  private onFocusIn = (e: FocusEvent) => this.focusIn(e.target, e.timeStamp)
  private onFocusOut = (e: FocusEvent) => {
    if (!e.relatedTarget && this.wins.length) this.intent.blur()
  }
  private onDown = (e: PointerEvent) => {
    this.lastPointer = e.pointerType || 'mouse'
    if (this.wins.length) this.intent.down(this.keepOf(e.target))
  }
  private onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = triggerOf(e.target)
    if (a && (this.lastPointer === 'touch' || !hoverable())) {
      const level = this.levelOf(a) + 1
      // a first tap opens its sheet; a second tap on the same words follows the link
      if (level < MAX_STACK && this.wins[level]?.trigger !== a) {
        e.preventDefault()
        this.press(a, this.lastPointer === 'touch' ? 'tap' : 'click')
        return
      }
    }
    const link = e.target instanceof Element ? e.target.closest('a[href]') : null
    if (!(link instanceof HTMLAnchorElement) || this.levelOf(link) < 0) return
    const href = link.getAttribute('href') ?? ''
    if (href.length > 1 && href.startsWith('#')) {
      // a jump inside a window scrolls that window, never the page behind it
      const to = document.getElementById(decodeURIComponent(href.slice(1)))
      const w = to ? this.levelOf(to) : -1
      if (to && w >= 0) {
        e.preventDefault()
        const body = this.elAt(w)?.querySelector<HTMLElement>('[data-pv-body]')
        if (body) {
          const y = body.scrollTop + to.getBoundingClientRect().top - body.getBoundingClientRect().top - 12
          body.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'instant' : 'smooth' })
        }
        this.intent.closeFrom(w + 1)
        return
      }
    }
    // any other link followed from a window: the stack is done with (a page change closes it anyway)
    this.intent.closeAll()
  }
  private onKey = (e: KeyboardEvent) => {
    const stack = this.wins
    if (!stack.length) return
    if (e.key === 'Escape') {
      const inside = !!this.elAt(stack.length - 1)?.contains(document.activeElement)
      const top = this.intent.escape()
      if (top && (inside || top.via !== 'hover') && document.contains(top.trigger)) top.trigger.focus({ preventScroll: true })
      return
    }
    if (e.key !== 'Tab') return
    // the Tab bridge: from a window's link into its window, and from the window's end back to the
    // page after its link, so a keyboard reader reaches everything a window holds
    const active = document.activeElement
    const i = stack.findIndex((w) => w.trigger === active)
    if (!e.shiftKey && i >= 0 && i === stack.length - 1 && !stack[i].sheet) {
      e.preventDefault()
      this.elAt(i)?.focus({ preventScroll: true })
      return
    }
    const w = this.levelOf(active)
    if (w < 0 || stack[w].sheet) return
    const el = this.elAt(w)!
    const inner = [...el.querySelectorAll<HTMLElement>(TABBABLE)].filter(shown)
    if (e.shiftKey && (active === el || active === inner[0])) {
      e.preventDefault()
      stack[w].trigger.focus({ preventScroll: true })
    } else if (!e.shiftKey && active === inner[inner.length - 1]) {
      e.preventDefault()
      const trigger = stack[w].trigger
      const tl = this.levelOf(trigger)
      const scope = tl >= 0 ? this.elAt(tl)! : document.body
      const all = [...scope.querySelectorAll<HTMLElement>(TABBABLE)].filter((x) => shown(x) && this.levelOf(x) === tl)
      const next = all[all.indexOf(trigger) + 1]
      this.intent.closeFrom(w)
      ;(next ?? trigger).focus()
    }
  }

  /** Starts listening, replays what the root recorded, and returns the way to stop. */
  attach(queue: Recorded[]): () => void {
    const d = document
    d.addEventListener('pointerover', this.onOver, { passive: true })
    d.addEventListener('pointerout', this.onOut, { passive: true })
    d.addEventListener('pointermove', this.onMove, { passive: true })
    d.documentElement.addEventListener('pointerleave', this.onLeaveDoc)
    d.addEventListener('focusin', this.onFocusIn)
    d.addEventListener('focusout', this.onFocusOut)
    d.addEventListener('pointerdown', this.onDown, true)
    // capture: ahead of SoftNav's click listener, which respects defaultPrevented
    d.addEventListener('click', this.onClick, true)
    d.addEventListener('keydown', this.onKey)
    for (const r of queue.splice(0)) {
      if (r.type === 'over') this.over(r.target, r.x, r.y, r.t, r.pointerType)
      else if (r.type === 'out') this.out(r.target, r.related, r.x, r.y, r.pointerType)
      else if (r.type === 'focusin') {
        if (r.target instanceof Element && d.activeElement === r.target) this.focusIn(r.target, r.t)
      } else {
        const a = triggerOf(r.target)
        if (r.pointerType) this.lastPointer = r.pointerType
        if (a && d.contains(a)) this.press(a, r.via ?? 'tap')
      }
    }
    return () => {
      d.removeEventListener('pointerover', this.onOver)
      d.removeEventListener('pointerout', this.onOut)
      d.removeEventListener('pointermove', this.onMove)
      d.documentElement.removeEventListener('pointerleave', this.onLeaveDoc)
      d.removeEventListener('focusin', this.onFocusIn)
      d.removeEventListener('focusout', this.onFocusOut)
      d.removeEventListener('pointerdown', this.onDown, true)
      d.removeEventListener('click', this.onClick, true)
      d.removeEventListener('keydown', this.onKey)
      // nothing closes here: React may detach and attach again (StrictMode), and an open replayed
      // from the queue must survive it; leaving the Lab unmounts the windows with the layout
    }
  }
}
