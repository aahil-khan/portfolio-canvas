'use client'

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  type Camera,
  type Rect,
  findFreeSpot,
  findFreeSpotInRect,
  makeRandom,
} from '@/lib/canvas/geometry'
import { arrangements } from '@/lib/canvas/arrange'
import { clearSession, loadSession, saveSession } from '@/lib/canvas/session'
import { useCanvas } from '@/lib/canvas/use-canvas'
import { useIsMobile } from '@/lib/use-mobile'
import { useDragObject } from '@/lib/canvas/use-drag-object'
import { resumeAmbienceOnFirstGesture } from '@/lib/ambience'
import { play } from '@/lib/audio'

import { Card, type CardDef } from './card'
import { Cursor } from './cursor'
import { ArrangeMenu } from './arrange-menu'
import { SoundMenu } from './sound-menu'
import { Dock, type DockItem } from './dock'
import { MeasureRig } from './measure-rig'
import { CommandPalette, type PaletteActions } from './command-palette'
import { MobileShell } from './mobile-shell'
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
  dock: readonly DockItem[]
  externals: readonly DockItem[]
  /** Which cards are on screen when someone arrives. */
  bootIds: readonly string[]
  hero: ReactNode
  heroWidth: number
}

const HERO = '__hero'

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
  return mobile ? (
    <MobileShell cards={props.cards} dock={props.dock} externals={props.externals} hero={props.hero} />
  ) : (
    <CanvasDesktop {...props} />
  )
}

function CanvasDesktop({ cards, dock, externals, bootIds, hero, heroWidth }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
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
    onScale: useCallback((s: number) => {
      if (zoomRef.current) zoomRef.current.textContent = `${Math.round(s * 100)}%`
    }, []),
  })

  /** Stable getter for the live camera scale, so Card's callbacks don't churn. */
  const scaleOf = useCallback(() => canvas.get().s, [canvas])

  const camBefore = useRef<Camera | null>(null)
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

  const takenRects = useCallback((): Rect[] => {
    const out: Rect[] = []
    const hero = rectOf(HERO)
    if (hero) out.push(hero)
    for (const id of Object.keys(placed)) {
      const r = rectOf(id)
      if (r && r.x > -50000) out.push(r)
    }
    return out
  }, [placed, rectOf])

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
    const saved = loadSession(new Set(byId.current.keys()))
    if (saved && saved.cards.length) {
      const restored: Record<string, Placed> = {}
      for (const c of saved.cards) {
        restored[c.id] = { x: c.x, y: c.y, z: c.z, rot: c.rot }
        zTop.current = Math.max(zTop.current, c.z)
      }
      canvas.set(saved.cam)
      setHeroPos(saved.hero)
      setPlaced(restored)
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
            setPlaced(next)
            setReady(true)
            return
          }
        }
      }
    }
    setReady(true)
  }, [ready, measured, bootIds, canvas, heroWidth])

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
    setClosing((c) => new Set(c).add(id))
  }, [])

  const onClosed = useCallback((id: string) => {
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
        const r = rectOf(id)
        if (r) canvas.reveal(r)
        return
      }
      const def = byId.current.get(id)
      if (!def) return
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
      if (t.matches('input,textarea') || e.metaKey || e.ctrlKey) return
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
  }, [canvas, fitAll, close])

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
    },
    [heroWidth, canvas, dock],
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
   * The palette drives the same handlers the chrome does, so there is one implementation of
   * each action. `goTo` is `open` on a card that is already placed, which raises it and flies
   * the camera over — exactly what "where did that card go" needs.
   */
  const paletteActions = useMemo<PaletteActions>(
    () => ({
      goTo: (id) => open(id),
      open: (id) => open(id),
      close,
      fitAll,
      minimiseAll,
      randomise,
      arrange,
      resetLayout,
      zoomBy: canvas.zoomBy,
    }),
    [open, close, fitAll, minimiseAll, randomise, arrange, resetLayout, canvas],
  )

  return (
    <OpenCardContext.Provider value={open}>
      <div ref={viewportRef} id="viewport">
        <div ref={worldRef} id="world" style={{ opacity: ready ? 1 : 0 }}>
          <div id="grid" aria-hidden />
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
        <button type="button" onClick={randomise}>Random</button>
        <ArrangeMenu onPick={arrange} onReset={resetLayout} />
        <span className="pill__div" aria-hidden />
        <SoundMenu />
      </div>

      <Dock
        items={dock}
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
      <p id="hint" aria-hidden>drag anything · ⌘/ctrl + scroll to zoom · ⌘K for commands</p>
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
