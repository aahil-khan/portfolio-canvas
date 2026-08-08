'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'

import { themes } from '@/content/themes'
import { arrangements } from '@/lib/canvas/arrange'
import {
  STATIONS,
  getAmbienceServerSnapshot,
  getAmbienceSnapshot,
  playAmbience,
  stopAmbience,
  subscribeAmbience,
} from '@/lib/ambience'
import {
  getSoundServerSnapshot,
  getSoundSnapshot,
  setSoundOn,
  subscribeSound,
} from '@/lib/audio'
import { getThemeServerSnapshot, getThemeSnapshot, setTheme, subscribeTheme } from '@/lib/theme'

import type { CardDef } from './card'

/**
 * Command palette (⌘K / Ctrl+K).
 *
 * On an infinite canvas the usual problem is not "what exists" but "where did it go" — a card
 * you opened is somewhere off-screen and hunting for it means panning blind. So the first group
 * is always the cards currently on the canvas, listed with no query typed: pick one and the
 * camera flies to it.
 *
 * Everything else the canvas can do is reachable from the same box, which matters because a lot
 * of it is otherwise buried: project and job detail cards have no dock icon at all and can only
 * be reached by opening Work or Experience and clicking a row, and picking one of 18 themes by
 * name beats hunting for its swatch.
 */

export interface PaletteActions {
  /** Bring an already-open card into view. */
  goTo: (id: string) => void
  /** Open a card that isn't on the canvas yet. */
  open: (id: string) => void
  close: (id: string) => void
  fitAll: () => void
  minimiseAll: () => void
  randomise: () => void
  arrange: (id: string) => void
  resetLayout: () => void
  zoomBy: (factor: number) => void
}

interface Command {
  id: string
  /** Section header in the list. */
  group: string
  /** Which filter chip this belongs to. Several groups can share one chip. */
  chip: Chip
  label: string
  hint?: string
  /** Extra words that should match but aren't worth showing. */
  keywords?: string
  run: () => void
}

/**
 * Rank: a hit at the start of the label beats one at a word boundary, which beats one anywhere.
 * Deliberately not a fuzzy subsequence matcher — with short labels like "Work" and "Ring" that
 * produces confident nonsense, and typing two letters should not surface every card that
 * happens to contain them.
 */
function score(cmd: Command, q: string): number {
  if (!q) return 0
  const label = cmd.label.toLowerCase()
  const hay = `${label} ${cmd.group.toLowerCase()} ${(cmd.keywords ?? '').toLowerCase()}`
  if (label.startsWith(q)) return 100 - label.length
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(label)) return 60
  if (label.includes(q)) return 40
  if (hay.includes(q)) return 20
  return -1
}

/*
 * The chips exist because a flat list of forty rows does not tell you what the palette is FOR.
 * Seven labels across the top answer that in one glance, and double as filters.
 */
const CHIPS = ['On the canvas', 'Cards', 'Canvas', 'Arrange', 'Theme', 'Sound', 'Elsewhere'] as const
type Chip = (typeof CHIPS)[number]

/** How many rows of each group to show before you have typed anything. */
const PREVIEW_PER_GROUP = 4

export function CommandPalette({
  cards,
  dockIds,
  openIds,
  actions,
}: {
  cards: readonly CardDef[]
  dockIds: readonly string[]
  openIds: ReadonlySet<string>
  actions: PaletteActions
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [chip, setChip] = useState<Chip | null>(null)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot)
  const soundOn = useSyncExternalStore(subscribeSound, getSoundSnapshot, getSoundServerSnapshot)
  const amb = useSyncExternalStore(
    subscribeAmbience,
    getAmbienceSnapshot,
    getAmbienceServerSnapshot,
  )

  const dock = useMemo(() => new Set(dockIds), [dockIds])

  const commands = useMemo<Command[]>(() => {
    const out: Command[] = []
    const byId = new Map(cards.map((c) => [c.id, c]))

    // 1. what's already on the canvas — the reason this exists
    for (const id of openIds) {
      const def = byId.get(id)
      if (!def) continue
      out.push({
        id: `go:${id}`,
        group: 'On the canvas',
        chip: 'On the canvas',
        label: def.label,
        hint: 'jump to it',
        keywords: 'go to find where locate reveal',
        run: () => actions.goTo(id),
      })
    }

    // 2. everything openable, detail cards included — those have no dock icon
    for (const def of cards) {
      if (openIds.has(def.id)) continue
      const isDetail = !dock.has(def.id)
      out.push({
        id: `open:${def.id}`,
        group: isDetail ? 'Projects & details' : 'Cards',
        chip: 'Cards',
        label: def.label,
        hint: isDetail ? 'open card' : undefined,
        keywords: def.id.replace(/[:_-]/g, ' '),
        run: () => actions.open(def.id),
      })
    }

    // 3. close a specific card, useful when it is somewhere off-screen
    for (const id of openIds) {
      const def = byId.get(id)
      if (!def) continue
      out.push({
        id: `close:${id}`,
        group: 'Close',
        chip: 'On the canvas',
        label: `Close ${def.label}`,
        keywords: 'dismiss hide remove',
        run: () => actions.close(id),
      })
    }

    out.push(
      { id: 'c:fit', group: 'Canvas', chip: 'Canvas', label: 'Fit all', hint: 'frame everything', keywords: 'zoom show overview', run: actions.fitAll },
      { id: 'c:min', group: 'Canvas', chip: 'Canvas', label: 'Minimise all', hint: 'clear the canvas', keywords: 'close hide empty', run: actions.minimiseAll },
      { id: 'c:rand', group: 'Canvas', chip: 'Canvas', label: 'Random', hint: 'deal three cards', keywords: 'shuffle surprise', run: actions.randomise },
      { id: 'c:reset', group: 'Canvas', chip: 'Canvas', label: 'Reset layout', hint: 'forget saved positions', keywords: 'clear session default', run: actions.resetLayout },
      { id: 'c:in', group: 'Canvas', chip: 'Canvas', label: 'Zoom in', keywords: 'closer bigger', run: () => actions.zoomBy(1.25) },
      { id: 'c:out', group: 'Canvas', chip: 'Canvas', label: 'Zoom out', keywords: 'further smaller', run: () => actions.zoomBy(1 / 1.25) },
    )

    for (const a of arrangements)
      out.push({
        id: `arr:${a.id}`,
        group: 'Arrange',
        chip: 'Arrange',
        label: a.label,
        hint: a.hint,
        keywords: 'arrange layout tidy organise',
        run: () => actions.arrange(a.id),
      })

    for (const t of themes)
      out.push({
        id: `theme:${t.id}`,
        group: 'Theme',
        chip: 'Theme',
        label: t.label,
        hint: t.id === theme ? 'current' : t.dark ? 'dark' : 'light',
        keywords: `theme colour color ${t.dark ? 'dark' : 'light'}`,
        run: () => setTheme(t.id),
      })

    out.push({
      id: 'snd:ui',
      group: 'Sound',
      chip: 'Sound',
      label: soundOn ? 'Turn interface sounds off' : 'Turn interface sounds on',
      keywords: 'audio mute lofi clicks',
      run: () => setSoundOn(!soundOn),
    })
    out.push({
      id: 'snd:amb',
      group: 'Sound',
      chip: 'Sound',
      label: amb.playing ? 'Stop ambience' : 'Play ambience',
      hint: amb.station.label,
      keywords: 'music radio lofi beats',
      run: () => (amb.playing ? stopAmbience() : void playAmbience(amb.station)),
    })
    /* Stations sit under the Sound header rather than a second one of their own: the toggles and
       the stations are one control surface, and each station's blurb already identifies it. */
    for (const s of STATIONS)
      out.push({
        id: `st:${s.id}`,
        group: 'Sound',
        chip: 'Sound',
        label: s.label,
        hint: s.blurb,
        keywords: 'station radio music play',
        run: () => void playAmbience(s),
      })

    /*
     * `ext:`, not `go:` — `go:` is taken by the jump-to-card rows, which are keyed off card ids,
     * and there is a card called `resume`. Sharing the prefix produced two rows keyed `go:resume`
     * whenever that card was open, which React reports as a duplicate key.
     */
    out.push(
      { id: 'ext:resume', group: 'Elsewhere', chip: 'Elsewhere', label: 'Open résumé', hint: '/resume', keywords: 'cv print pdf page', run: () => router.push('/resume') },
      { id: 'ext:gh', group: 'Elsewhere', chip: 'Elsewhere', label: 'GitHub', keywords: 'code repo profile', run: () => window.open('https://github.com/aahil-khan', '_blank', 'noopener,noreferrer') },
      { id: 'ext:li', group: 'Elsewhere', chip: 'Elsewhere', label: 'LinkedIn', keywords: 'profile work', run: () => window.open('https://www.linkedin.com/in/aahil-khan77/', '_blank', 'noopener,noreferrer') },
    )

    return out
  }, [cards, openIds, dock, actions, theme, soundOn, amb, router])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = chip ? commands.filter((c) => c.chip === chip) : commands

    if (q) {
      return pool
        .map((c) => ({ c, s: score(c, q) }))
        .filter((r) => r.s >= 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 40)
        .map((r) => r.c)
    }

    /*
     * Nothing typed: show a few of every group rather than forty rows of one. A capped preview
     * per group is what makes the range of the palette visible instead of burying Theme and
     * Sound under whatever happens to be open.
     */
    const order: Chip[] = chip ? [chip] : [...CHIPS]
    const out: Command[] = []
    for (const g of order) {
      const rows = pool.filter((c) => c.chip === g && c.group !== 'Close')
      out.push(...(chip ? rows : rows.slice(0, PREVIEW_PER_GROUP)))
    }
    return out
  }, [commands, query, chip])

  /* --- open / close --- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        setQuery('')
        setCursor(0)
        setChip(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // keep the highlighted row in view as you arrow through a long list
  useEffect(() => {
    listRef.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, query])

  const runAt = useCallback(
    (i: number) => {
      const cmd = results[i]
      if (!cmd) return
      setOpen(false)
      setQuery('')
      cmd.run()
    },
    [results],
  )

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(results.length - 1, c + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(0, c - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runAt(cursor)
    }
  }

  if (!open) return null

  let lastGroup = ''
  return (
    <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
      <button className="cmdk__scrim" aria-label="Close" onClick={() => setOpen(false)} />
      <div className="cmdk__panel">
        <input
          ref={inputRef}
          className="cmdk__input"
          placeholder="Jump to a card, switch theme, run a command…"
          value={query}
          role="combobox"
          aria-expanded
          aria-controls="cmdk-list"
          aria-autocomplete="list"
          onChange={(e) => {
            setQuery(e.target.value)
            setCursor(0)
          }}
          onKeyDown={onInputKey}
        />
        <div className="cmdk__chips" role="tablist" aria-label="Filter commands">
          <button
            type="button"
            role="tab"
            aria-selected={chip === null}
            className="cmdk__chip"
            onClick={() => {
              setChip(null)
              setCursor(0)
            }}
          >
            All
          </button>
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={chip === c}
              className="cmdk__chip"
              onClick={() => {
                setChip((v) => (v === c ? null : c))
                setCursor(0)
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="cmdk__list" id="cmdk-list" role="listbox" ref={listRef}>
          {results.length === 0 ? (
            <p className="cmdk__empty">Nothing matches “{query}”</p>
          ) : (
            results.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null
              lastGroup = c.group
              return (
                <div key={c.id}>
                  {header ? <div className="cmdk__group">{header}</div> : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === cursor}
                    data-active={i === cursor || undefined}
                    className="cmdk__row"
                    onMouseMove={() => setCursor(i)}
                    onClick={() => runAt(i)}
                  >
                    <span className="cmdk__label">{c.label}</span>
                    {c.hint ? <span className="cmdk__hint">{c.hint}</span> : null}
                  </button>
                </div>
              )
            })
          )}
        </div>
        <div className="cmdk__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
