'use client'

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import {
  type Camera,
  type Rect,
  findFreeSpot,
  findFreeSpotInRect,
  makeRandom,
} from '@/lib/canvas/geometry'
import { arrangements } from '@/lib/canvas/arrange'
import { clearCardParam, readCardParam, writeCardParam } from '@/lib/deep-link'
import { noteOpen } from '@/lib/opens'
import { clearSession, loadSession, saveSession } from '@/lib/canvas/session'
import { useCanvas } from '@/lib/canvas/use-canvas'
import { useIsMobile } from '@/lib/use-mobile'
import {
  getShellModeSnapshot,
  getShellModeServerSnapshot,
  setShellMode,
  subscribeShellMode,
} from '@/lib/shell-mode'
import { useDragObject } from '@/lib/canvas/use-drag-object'
import { resumeAmbienceOnFirstGesture } from '@/lib/ambience'
import { play } from '@/lib/audio'
import { findEgg } from '@/lib/eggs'

import { Card, type CardDef } from './card'
import { Cursor } from './cursor'
import { ArrangeMenu } from './arrange-menu'
import { GotoMenu, type GotoItem } from './goto-menu'
import { ThemeMenu } from './theme-menu'
import { SoundMenu } from './sound-menu'
import { Dock, type DockEntry, type DockItem } from './dock'
import { MeasureRig } from './measure-rig'
import { Hint } from './hint'
import { CommandPalette, type PaletteActions } from './command-palette'
import { MobileShell } from './mobile-shell'
import { EnterInteractiveContext } from './mobile-mode'
import { OpenCardContext } from './open-context'

interface Placed {
  x: number
  y: number
  z: number
  /** Set by an arrangement to override the card's own resting tilt. */
  rot?: number
  origin?: DOMRect | null
}

interface Props {
  cards: readonly CardDef[]
  /** Flat, every dock app — used by the completionist egg, Random, and the phone shell. */
  dock: readonly DockItem[]
  /** The same apps, grouped into folders, which is only how the dock draws itself. */
  dockEntries: readonly DockEntry[]
  externals: readonly DockItem[]
  /** Which cards are on screen when someone arrives. */
  bootIds: readonly string[]
  hero: ReactNode
  heroWidth: number
  /**
   * The plain résumé, server-rendered. What a phone sees before it asks for anything else; the
   * canvas never renders it, so it costs a desktop nothing but the element.
   */
  resume: ReactNode
}

const HERO = '__hero'

/** The code. Compared case-insensitively so caps lock doesn't ruin it. */
const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
] as const

/**
 * Picks a shell.
 *
 * Two entirely separate trees rather than one tree with breakpoints: the canvas needs a camera,
 * pointer capture, a rAF loop and drag handlers that a phone has no use for, and none of that
 * should be mounted — let alone listening — on a device that can't drive it. Splitting here
 * also keeps the rules of hooks intact, since neither shell's hooks are ever conditional.
 */
export function Desktop(props: Props) {
  const mobile = useIsMobile()
  const mode = useSyncExternalStore(
    subscribeShellMode,
    getShellModeSnapshot,
    getShellModeServerSnapshot,
  )

  const enter = useCallback(() => {
    setShellMode('phone')
    // the résumé may be scrolled halfway down, and the shell is fixed — it would open mid-page
    window.scrollTo(0, 0)
  }, [])

  const leave = useCallback(() => setShellMode('resume'), [])

  if (!mobile) return <CanvasDesktop {...props} />

  /*
   * A phone gets the résumé first. The canvas is the better version of this site and also the one
   * a thumb cannot drive, so it is offered rather than imposed — and the offer says so.
   */
  if (mode !== 'phone') {
    return (
      <EnterInteractiveContext.Provider value={enter}>{props.resume}</EnterInteractiveContext.Provider>
    )
  }

  return (
    <MobileShell
      cards={props.cards}
      dock={props.dock}
      externals={props.externals}
      hero={props.hero}
      onLeave={leave}
    />
  )
}

/*
 * The konami detector, the pinned-card handling and the arcade's keyboard guard all live in this
 * shell rather than in `Desktop` above: they are canvas concerns, and the mobile shell has no
 * camera to hijack or arrangement to run.
 */
function CanvasDesktop({ cards, dock, dockEntries, externals, bootIds, hero, heroWidth }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<HTMLDivElement>(null)

  const byId = useRef(new Map(cards.map((c) => [c.id, c])))
  const heights = useRef(new Map<string, number>())
  const zTop = useRef(10)
  /** Latest `placed`, readable from callbacks that must not re-create on every position change. */
  const placedRef = useRef<Record<string, Placed>>({})
  const heroPosRef = useRef({ x: 0, y: 0 })
  const timers = useRef<number[]>([])

  const [placed, setPlaced] = useState<Record<string, Placed>>({})
  const [measured, setMeasured] = useState(false)
  /** Cards playing their exit animation. They stay mounted until it finishes. */
  const [closing, setClosing] = useState<ReadonlySet<string>>(new Set())
  const [heroPos, setHeroPos] = useState({ x: -heroWidth / 2, y: -150 })
  /** True only while an arrangement animates, so the CSS transition can't fight dragging. */
  const [arranging, setArranging] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    placedRef.current = placed
  }, [placed])

  useEffect(() => {
    heroPosRef.current = heroPos
  }, [heroPos])

  // staggered actions schedule timeouts; drop them if the component goes away mid-sequence
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // if ambience was playing last visit, start it again at the first gesture
  useEffect(() => resumeAmbienceOnFirstGesture(), [])

  const canvas = useCanvas({
    viewportRef,
    worldRef,
    gridRef,
    onScale: useCallback((s: number) => {
      if (zoomRef.current) zoomRef.current.textContent = `${Math.round(s * 100)}%`
    }, []),
  })

  /** Stable getter for the live camera scale, so Card's callbacks don't churn. */
  const scaleOf = useCallback(() => canvas.get().s, [canvas])

  const camBefore = useRef<Camera | null>(null)
  /** Rolling buffer of the last few keys, for the konami detector. */
  const konami = useRef<string[]>([])
  /** Which arrangements have been run this session, for the "tried every arrangement" egg. */
  const ranArrangements = useRef(new Set<string>())
  const focusedOn = useRef<string | null>(null)

  /* --- geometry helpers --- */
  const rectOf = useCallback(
    (id: string): Rect | null => {
      const p = id === HERO ? heroPos : placed[id]
      if (!p) return null
      const w = id === HERO ? heroWidth : (byId.current.get(id)?.width ?? 0)
      const h = heights.current.get(id) ?? 0
      return { x: p.x, y: p.y, w, h }
    },
    [placed, heroPos, heroWidth],
  )

  /**
   * A pinned card sits far outside the normal camera bounds on purpose, so it is excluded from
   * every layout algorithm: framing it would shrink everything else to nothing, and packing
   * around it would push new cards halfway across the world to avoid a box nobody can see.
   */
  const isPinned = useCallback((id: string) => byId.current.get(id)?.pinned === true, [])

  const takenRects = useCallback((): Rect[] => {
    const out: Rect[] = []
    const hero = rectOf(HERO)
    if (hero) out.push(hero)
    for (const id of Object.keys(placed)) {
      if (isPinned(id)) continue
      const r = rectOf(id)
      if (r && r.x > -50000) out.push(r)
    }
    return out
  }, [placed, rectOf, isPinned])

  const onMeasure = useCallback((id: string, h: number) => {
    heights.current.set(id, h)
  }, [])

  const onMeasured = useCallback((all: Map<string, number>) => {
    for (const [id, h] of all) heights.current.set(id, h)
    setMeasured(true)
  }, [])

  /* --- opening layout: random every visit, never overlapping, never clipped --- */
  useLayoutEffect(() => {
    if (ready || !measured) return
    if (heroRef.current) heights.current.set(HERO, heroRef.current.offsetHeight)

    /*
     * A returning visitor gets their own desktop back, not a fresh random deal. Only fall
     * through to the opening layout when there is no usable session — which also covers a
     * first visit, a version bump, and content edits that invalidated every saved card.
     */
    /*
     * Cards with a fixed home go down on every boot, and win over anything a saved session says
     * about them — otherwise closing the deep-space card would retire the easter egg for good.
     */
    const pinned: Record<string, Placed> = {}
    for (const def of byId.current.values()) {
      if (def.at) pinned[def.id] = { x: def.at.x, y: def.at.y, z: 1 }
    }

    const saved = loadSession(new Set(byId.current.keys()))
    if (saved && saved.cards.length) {
      const restored: Record<string, Placed> = {}
      for (const c of saved.cards) {
        restored[c.id] = { x: c.x, y: c.y, z: c.z, rot: c.rot }
        zTop.current = Math.max(zTop.current, c.z)
      }
      canvas.set(saved.cam)
      setHeroPos(saved.hero)
      setPlaced({ ...restored, ...pinned })
      setReady(true)
      return
    }

    // seeded after mount, never during SSR — Math.random() on the server is a hydration bug
    const rand = makeRandom((Date.now() ^ 0x9e3779b9) >>> 0)
    const vp = canvas.viewport()
    const PAD = 34

    /*
     * Legibility beats card count. Rather than cramming every card in at any zoom, drop one
     * (then another) so the type stays readable on a small viewport — a 48% opening layout is
     * a valid packing and practically unreadable.
     */
    const plans = [
      { n: bootIds.length, floor: 0.68 },
      { n: Math.max(1, bootIds.length - 1), floor: 0.6 },
      { n: 1, floor: 0.45 },
    ]

    for (const plan of plans) {
      const ids = bootIds.slice(0, plan.n)
      for (let s = 0.88; s >= plan.floor; s -= 0.04) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const viewW = vp.width / s
          const viewH = (vp.height - vp.top - vp.bottom) / s
          const rect = {
            x: -viewW / 2 + PAD / s,
            y: -viewH / 2 + PAD / s,
            w: viewW - (PAD * 2) / s,
            h: viewH - (PAD * 2) / s,
          }

          const heroH = heights.current.get(HERO) ?? 0
          const hero = {
            x: -heroWidth / 2 + (rand() - 0.5) * 130,
            y: -heroH / 2 + (rand() - 0.5) * 90,
          }
          const taken: Rect[] = [{ ...hero, w: heroWidth, h: heroH }]
          const next: Record<string, Placed> = {}

          let ok = true
          for (const id of [...ids].sort(() => rand() - 0.5)) {
            const w = byId.current.get(id)?.width ?? 0
            const h = heights.current.get(id) ?? 0
            const spot = findFreeSpotInRect(w, h, rect, taken, rand)
            if (!spot) {
              ok = false
              break
            }
            taken.push({ ...spot, w, h })
            next[id] = { x: spot.x, y: spot.y, z: ++zTop.current }
          }

          if (ok) {
            canvas.set({
              x: vp.width / 2,
              y: vp.top + (vp.height - vp.top - vp.bottom) / 2,
              s,
            })
            setHeroPos(hero)
            setPlaced({ ...next, ...pinned })
            setReady(true)
            return
          }
        }
      }
    }
    // every plan failed (a very small viewport) — the pinned cards still belong on the canvas
    setPlaced(pinned)
    setReady(true)
  }, [ready, measured, bootIds, canvas, heroWidth])

  /*
   * "Opened everything" — every dock card on the canvas at once. Checked here rather than in
   * `open`, because Random and a restored session can also get you there.
   */
  useEffect(() => {
    if (!ready || !dock.length) return
    const onCanvas = new Set(Object.keys(placed))
    if (dock.every((d) => onCanvas.has(d.id))) findEgg('completionist')
  }, [placed, dock, ready])

  /*
   * Persist the desktop.
   *
   * Layout changes are discrete (open, close, drag end, arrange) so a debounce on `placed` is
   * enough for those. The camera is the exception — it changes on every pan frame and never
   * goes through React — so it is read from the ref at save time, and a save is also forced
   * when the page is hidden, which is the only reliable "user is leaving" signal on mobile.
   */
  const persist = useCallback(() => {
    if (!ready) return
    saveSession({
      cards: Object.entries(placedRef.current).map(([id, p]) => ({
        id,
        x: p.x,
        y: p.y,
        z: p.z,
        rot: p.rot,
      })),
      hero: heroPosRef.current,
      cam: canvas.get(),
    })
  }, [ready, canvas])

  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(persist, 400)
    return () => clearTimeout(t)
  }, [placed, heroPos, ready, persist])

  useEffect(() => {
    if (!ready) return
    const onHide = () => {
      if (document.visibilityState === 'hidden') persist()
    }
    // pagehide is the one that fires reliably on mobile Safari; visibilitychange covers tab switches
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', persist)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [ready, persist])

  /* --- card actions --- */
  const raise = useCallback((id: string) => {
    setFocused(id)
    setPlaced((p) => (p[id] ? { ...p, [id]: { ...p[id], z: ++zTop.current } } : p))
  }, [])

  const move = useCallback((id: string, x: number, y: number) => {
    setPlaced((p) => (p[id] ? { ...p, [id]: { ...p[id], x, y } } : p))
  }, [])

  const close = useCallback((id: string) => {
    play('close')
    clearCardParam(id)
    setClosing((c) => new Set(c).add(id))
  }, [])

  const onClosed = useCallback((id: string) => {
    // a closed card must not keep the focus, or the wheel is owned by something no longer there
    setFocused((f) => (f === id ? null : f))
    setPlaced((p) => {
      const next = { ...p }
      delete next[id]
      return next
    })
    setClosing((c) => {
      const next = new Set(c)
      next.delete(id)
      return next
    })
  }, [])

  const open = useCallback(
    (id: string, origin?: DOMRect | null, fromDock = false) => {
      if (placed[id]) {
        // clicking a dock icon is a toggle; a link from inside another card just focuses it
        if (fromDock) {
          close(id)
          return
        }
        raise(id)
        if (!byId.current.get(id)?.secret) writeCardParam(id)
        const r = rectOf(id)
        if (r) canvas.reveal(r)
        return
      }
      const def = byId.current.get(id)
      if (!def) return
      // secret cards stay out of the address bar; a shared link should not give away an egg
      if (!def.secret) writeCardParam(id)
      noteOpen(id)
      const h = heights.current.get(id) ?? 320 // rig fills these in; fallback is a last resort
      const vp = canvas.viewport()
      const centre = canvas.screenToWorld(vp.width / 2, vp.height / 2)
      const spot = findFreeSpot(def.width, h, centre, takenRects())

      // the dock-FLIP only reads correctly if the card lands where you can see it
      const cam = canvas.get()
      const L = spot.x * cam.s + cam.x
      const T = spot.y * cam.s + cam.y
      const onScreen =
        L > -30 && L + def.width * cam.s < vp.width + 30 && T > 40 && T + h * cam.s < vp.height - 60

      play('open')
      setPlaced((p) => ({
        ...p,
        [id]: { x: spot.x, y: spot.y, z: ++zTop.current, origin: onScreen ? origin : null },
      }))
      setFocused(id)
      canvas.reveal({ ...spot, w: def.width, h })
    },
    [placed, raise, close, rectOf, canvas, takenRects],
  )

  /** Double-tap a card to fly into it; again to fly back where you were. */
  const focusInto = useCallback(
    (id: string) => {
      const r = rectOf(id)
      if (!r) return
      if (focusedOn.current === id && camBefore.current) {
        canvas.flyTo(camBefore.current)
        camBefore.current = null
        focusedOn.current = null
        return
      }
      camBefore.current ??= canvas.get()
      focusedOn.current = id
      canvas.focus(r)
    },
    [canvas, rectOf],
  )

  /** Forget the saved desktop and re-run the opening layout. */
  const resetLayout = useCallback(() => {
    clearSession()
    zTop.current = 10
    setPlaced({})
    setReady(false) // re-arms the opening-layout effect, which now finds no session
    play('arrange')
  }, [])

  const fitAll = useCallback(() => {
    const rects = takenRects()
    if (rects.length) canvas.fit(rects)
  }, [canvas, takenRects])

  const minimiseAll = useCallback(() => {
    play('minimise')
    setClosing((c) => {
      const next = new Set(c)
      for (const id of Object.keys(placedRef.current)) next.add(id)
      return next
    })
  }, [])

  /*
   * Deal three cards out one at a time. Positions are computed up front so the layout is
   * guaranteed collision-free, then revealed on a stagger — dropping them all in on the same
   * frame is what made this feel like a jump cut rather than a shuffle.
   */
  const randomise = useCallback(() => {
    const rand = makeRandom((Date.now() ^ 0x85ebca6b) >>> 0)
    const pool = [...dock].sort(() => rand() - 0.5).slice(0, 3)
    const heroRect = rectOf(HERO)
    const centre = heroRect
      ? { x: heroRect.x + heroRect.w / 2, y: heroRect.y + heroRect.h / 2 }
      : { x: 0, y: 0 }
    const taken: Rect[] = heroRect ? [heroRect] : []
    const deal: { id: string; spot: { x: number; y: number } }[] = []
    for (const item of pool) {
      const def = byId.current.get(item.id)
      if (!def) continue
      const h = heights.current.get(item.id) ?? 320
      const spot = findFreeSpot(def.width, h, centre, taken)
      taken.push({ ...spot, w: def.width, h })
      deal.push({ id: item.id, spot })
    }

    minimiseAll()
    // wait out the close animation, then lay them down one by one
    deal.forEach((d, i) => {
      timers.current.push(
        window.setTimeout(() => {
          play('open')
          setPlaced((p) => ({ ...p, [d.id]: { x: d.spot.x, y: d.spot.y, z: ++zTop.current } }))
        }, 320 + i * 130),
      )
    })
    timers.current.push(window.setTimeout(() => canvas.fit(taken), 320 + deal.length * 130 + 220))
  }, [dock, rectOf, canvas, minimiseAll])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      /*
       * `[data-keys]` marks a subtree that owns its keyboard completely — the games.
       *
       * The shortcuts below are bare single letters, so without this, typing "f" in a typing
       * test fits the canvas, "-" zooms out mid-game, and Escape closes the card you are
       * playing in. Matching `input,textarea` alone isn't enough: a focusable div, a
       * contenteditable or a <select> all fall through it.
       */
      /*
       * Konami is tracked BEFORE the focus guard, not after it.
       *
       * The guard exists so bare letters cannot reach the canvas while someone is typing — but
       * it was also silently killing the code whenever any field had focus, which on a canvas
       * carrying a notes wall, a typing test and a name box is most of the time. Ten specific
       * keys in one specific order are never accidental text, so this one sequence is allowed
       * to listen everywhere. The shortcuts below stay behind the guard, where they belong.
       */
      konami.current = [...konami.current, e.key].slice(-KONAMI.length)
      if (konami.current.length === KONAMI.length && konami.current.every((k, i) => k.toLowerCase() === KONAMI[i].toLowerCase())) {
        konami.current = []
        // findEgg plays the unlock cue itself, and only the first time
        if (!findEgg('konami')) play('unlock')

        /*
         * Centre it, don't just open it.
         *
         * `open` on an already-placed card calls `reveal`, which pans the minimum needed and
         * stops the moment the card clears the padding — so for a terminal already fully on
         * screen it did nothing at all. And the terminal is restored by the saved session, so
         * after the first unlock EVERY later entry of the code looked broken. Same trap the
         * command palette's goTo fell into, fixed the same way.
         */
        if (!placedRef.current.terminal) {
          open('terminal')
        } else {
          raise('terminal')
          const r = rectOf('terminal')
          if (r) canvas.centre(r)
        }
      }

      if (t.matches('input,textarea') || t.closest('[data-keys]') || e.metaKey || e.ctrlKey) return

      if (e.key === '=' || e.key === '+') canvas.zoomBy(1.25)
      else if (e.key === '-' || e.key === '_') canvas.zoomBy(1 / 1.25)
      else if (e.key === '0' || e.key === 'f') fitAll()
      else if (e.key === 'Escape') {
        const top = Object.entries(placedRef.current).sort((a, b) => b[1].z - a[1].z)[0]
        if (top) close(top[0])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canvas, fitAll, close, open, raise, rectOf])

  /**
   * Re-lay everything currently on the canvas, hero included. The layout functions are pure and
   * live in lib/canvas/arrange.ts; this only applies the result and frames it.
   */
  const arrange = useCallback(
    (layoutId: string) => {
      const arrangement = arrangements.find((a) => a.id === layoutId)
      if (!arrangement) return

      const heroH = heights.current.get(HERO) ?? 0
      /*
       * Canonical reading order: hero, then the dock's own order (About → Work → Experience →
       * Stack → Writing → Résumé → Themes → Contact), then anything spawned from a card. Object
       * key order is insertion order, which is arbitrary — Tidy has to be reproducible.
       */
      const rank = new Map(dock.map((d, i) => [d.id, i]))
      const items = [
        { id: HERO, w: heroWidth, h: heroH },
        ...Object.keys(placedRef.current)
          .filter((id) => !isPinned(id))
          .sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999) || a.localeCompare(b))
          .map((id) => ({
            id,
            w: byId.current.get(id)?.width ?? 0,
            h: heights.current.get(id) ?? 0,
          })),
      ]
      /*
       * Shape of the band the result will actually be framed in, so Tidy can pack rows to match
       * it instead of aiming at a square. Without this, enough open cards produce a layout too
       * tall for the camera to fit and the bottom rows clip off screen.
       */
      const vp = canvas.viewport()
      const aspect = vp.width / Math.max(1, vp.height - vp.top - vp.bottom)
      const layout = arrangement.run(items, makeRandom((Date.now() ^ 0xc2b2ae35) >>> 0), aspect)

      setArranging(true)
      const heroAt = layout[HERO]
      if (heroAt) setHeroPos({ x: heroAt.x, y: heroAt.y })
      setPlaced((p) => {
        const next: Record<string, Placed> = {}
        for (const [id, v] of Object.entries(p)) {
          const at = layout[id]
          next[id] = at ? { ...v, x: at.x, y: at.y, rot: at.rot } : v
        }
        return next
      })

      // frame the result once the cards have arrived, then drop the transition class
      timers.current.push(window.setTimeout(() => {
        canvas.fit(items.map((i) => ({ ...layout[i.id], w: i.w, h: i.h })))
      }, 60))
      timers.current.push(window.setTimeout(() => setArranging(false), 620))
      play('arrange')

      // "tried every arrangement" — the set is per visitor and survives reloads
      ranArrangements.current.add(layoutId)
      if (ranArrangements.current.size >= arrangements.length) findEgg('tidy-freak')
    },
    [heroWidth, canvas, dock, isPinned],
  )

  useDragObject({
    nodeRef: heroRef,
    handleRef: heroRef,
    x: heroPos.x,
    y: heroPos.y,
    toWorld: canvas.screenToWorld,
    onMove: useCallback((x: number, y: number) => setHeroPos({ x, y }), []),
    onRaise: useCallback(() => setFocused(null), []),
    onDoubleTap: useCallback(() => focusInto(HERO), [focusInto]),
  })

  const openIds = useMemo(() => new Set(Object.keys(placed)), [placed])
  const dockIds = useMemo(() => dock.map((d) => d.id), [dock])

  /*
   * What the "Go to" menu lists: everything on the canvas, in `cards` order rather than by
   * z-index. A menu that reorders itself as you raise cards moves the row you were reaching for
   * out from under the cursor, and the front-most card is the one you are already looking at.
   *
   * Secret cards are skipped for the same reason the palette skips them: the deep-space card is
   * pinned, so it is on the canvas from the first paint whether or not anyone has been near it,
   * and offering a one-click teleport to it would give away a card whose whole point is the
   * journey out there.
   */
  const gotoItems = useMemo<GotoItem[]>(
    () =>
      cards
        .filter((c) => openIds.has(c.id) && !c.secret)
        .map((c) => ({ id: c.id, label: c.label, icon: c.icon, colour: c.colour })),
    [cards, openIds],
  )

  /*
   * The palette drives the same handlers the chrome does, so there is one implementation of
   * each action. `goTo` is the exception: it centres rather than reveals. `reveal` stops as soon
   * as the card clears the padding, which leaves a card you named by name sitting against an
   * edge — fine as a side effect of opening something, wrong as an answer to "where did it go".
   */
  const paletteActions = useMemo<PaletteActions>(
    () => ({
      goTo: (id) => {
        if (!placed[id]) return open(id)
        raise(id)
        writeCardParam(id)
        const r = rectOf(id)
        if (r) canvas.centre(r)
      },
      open: (id) => open(id),
      close,
      fitAll,
      minimiseAll,
      randomise,
      arrange,
      resetLayout,
      zoomBy: canvas.zoomBy,
    }),
    [open, placed, raise, rectOf, close, fitAll, minimiseAll, randomise, arrange, resetLayout, canvas],
  )

  /*
   * Arriving on `/?card=project:konta` — the inbound half of the deep link.
   *
   * Waits for `ready`, because opening a card needs its measured height and a settled camera;
   * run any earlier and the card is placed against a viewport the boot layout is about to
   * replace. `goTo` rather than `open` so a card the saved session already had on the canvas is
   * centred rather than left wherever it happened to be — following a link to something should
   * always end with that thing in front of you.
   *
   * The ref makes it strictly once per page load. Without it, closing the card would clear the
   * parameter, the effect would see the change and re-open it, and the card could not be closed.
   */
  const linkTarget = useRef<string | null | undefined>(undefined)
  /*
   * useLayoutEffect, like the boot layout above and for the same reason: this places a card and
   * moves the camera, and doing it after paint shows one frame of the canvas at the wrong
   * position before it snaps. Phase 2 in particular would flash the card revealed-but-off-centre.
   */
  useLayoutEffect(() => {
    if (!ready) return

    // phase 1, once: work out what was asked for and put it on the canvas
    if (linkTarget.current === undefined) {
      linkTarget.current = null
      const id = readCardParam()
      if (!id) return
      const def = byId.current.get(id)
      // an unknown or secret id is treated as no id at all, rather than 404-ing the canvas
      if (!def || def.secret) return writeCardParam(null)
      linkTarget.current = id
      /*
       * eslint-disable-next-line react-hooks/set-state-in-effect --
       * This is the case the rule's own guidance allows: a one-time read FROM an external system
       * (the address bar) into React state. The heuristic cannot see that, and it fires the same
       * way for a direct setPlaced here, so there is no phrasing that satisfies it. The boot
       * layout above does the same work and escapes only because its calls sit deeper in loops.
       * The cost is one extra commit, once per load, and only when a deep link was followed.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!placed[id]) open(id)
      return
    }

    /*
     * Phase 2: centre it, once it has a rect to centre.
     *
     * `open` reveals rather than centres — it pans the minimum needed and stops the moment the
     * card clears the padding, which is right when a card is a side effect of clicking a dock
     * icon and wrong when the card is the entire reason someone followed the link. Placement
     * only lands on the next commit, so this cannot happen in the same pass as the open.
     */
    const id = linkTarget.current
    if (!id || !placed[id]) return
    linkTarget.current = null
    raise(id)
    const r = rectOf(id)
    if (r) canvas.centre(r)
  }, [ready, placed, open, raise, rectOf, canvas])

  return (
    <OpenCardContext.Provider value={open}>
      <div
        ref={viewportRef}
        id="viewport"
        /*
         * Clicking bare canvas drops the focus, handing the wheel back to the world.
         *
         * Bubble phase plus a target test, rather than a listener further down: a card body
         * doesn't stop propagation, so an untested handler here would clear the focus that the
         * very same click just set on the card.
         */
        onPointerDown={(e) => {
          if (!(e.target as HTMLElement).closest('[data-obj]')) setFocused(null)
        }}
      >
        {/* a sibling of the world, not a child: see `#grid` in desktop.css */}
        <div ref={gridRef} id="grid" aria-hidden />

        <div ref={worldRef} id="world" style={{ opacity: ready ? 1 : 0 }}>
          {!measured ? <MeasureRig cards={cards} onMeasured={onMeasured} /> : null}

          <div ref={heroRef} data-obj id="hero" className={arranging ? 'is-arranging' : undefined} style={{ left: heroPos.x, top: heroPos.y, width: heroWidth }}>
            {hero}
          </div>

          {cards.map((def) => {
            const p = placed[def.id]
            if (!p) return null
            return (
              <Card
                key={def.id}
                def={def}
                x={p.x}
                y={p.y}
                z={p.z}
                origin={p.origin}
                closing={closing.has(def.id)}
                rotate={p.rot}
                arranging={arranging}
                focused={focused === def.id}
                onMeasure={onMeasure}
                onMove={move}
                onRaise={raise}
                onClose={close}
                onClosed={onClosed}
                onFocusInto={focusInto}
                toWorld={canvas.screenToWorld}
                scale={scaleOf}
              />
            )
          })}
        </div>
      </div>

      <div id="pill">
        <button type="button" onClick={fitAll}>Fit all</button>
        <button type="button" onClick={minimiseAll}>Minimise all</button>
        <GotoMenu items={gotoItems} onPick={paletteActions.goTo} />
        <button type="button" onClick={randomise}>Random</button>
        <ArrangeMenu onPick={arrange} onReset={resetLayout} />
        <span className="pill__div" aria-hidden />
        <ThemeMenu onOpenThemes={() => paletteActions.goTo('themes')} />
        {/*
         * Past the divider, with Sound: everything left of it acts on the canvas, everything
         * right of it leaves or configures it. A plain anchor, not a router push — /resume is a
         * separate document that renders without JavaScript, and that is the point of it.
         */}
        <a className="pill__link" href="/resume">
          Résumé
        </a>
        <SoundMenu />
      </div>

      <Dock
        entries={dockEntries}
        externals={externals}
        openIds={openIds}
        onOpen={(id, origin) => open(id, origin, true)}
        onHover={() => play('hover')}
      />

      <div id="zoom-controls">
        <button type="button" aria-label="Zoom out" onClick={() => canvas.zoomBy(1 / 1.25)}>
          &minus;
        </button>
        <button
          type="button"
          className="zoom-readout"
          aria-label="Fit everything on screen"
          onClick={fitAll}
        >
          <span ref={zoomRef}>100%</span>
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => canvas.zoomBy(1.25)}>
          +
        </button>
      </div>
      <Hint>drag anything · ⌘/ctrl + scroll to zoom · ⌘K for commands</Hint>
      <CommandPalette
        cards={cards}
        dockIds={dockIds}
        openIds={openIds}
        actions={paletteActions}
      />
      <Cursor />
    </OpenCardContext.Provider>
  )
}
