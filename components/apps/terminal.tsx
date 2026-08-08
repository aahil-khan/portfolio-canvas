'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { useOpenCard } from '@/components/desktop/open-context'
import { useMeasuring } from '@/components/desktop/measuring-context'
import { terminal as T } from '@/content/eggs'
import { apps } from '@/content/apps'
import { themes } from '@/content/themes'
import {
  EGGS,
  findEgg,
  getEggsServerSnapshot,
  getEggsSnapshot,
  subscribeEggs,
} from '@/lib/eggs'
import { setTheme } from '@/lib/theme'
import { play } from '@/lib/audio'

type Kind = 'out' | 'in' | 'dim' | 'err'
interface Line {
  id: number
  kind: Kind
  text: string
}

let seq = 0
const line = (kind: Kind, text: string): Line => ({ id: seq++, kind, text })

/**
 * A small command prompt, unlocked by the konami code.
 *
 * The dark body is the only non-light surface in the app — a deliberate exception, and the
 * reason it is a spawned card rather than a dock tile: it is meant to feel like something you
 * were not supposed to find.
 *
 * The input is a real `<input>`, which matters twice over. The canvas binds bare letters as
 * shortcuts and only lets an event past when the target is an input, and `data-keys` on the
 * wrapper covers the rest.
 */
export function Terminal() {
  const measuring = useMeasuring()
  const open = useOpenCard()
  const eggs = useSyncExternalStore(subscribeEggs, getEggsSnapshot, getEggsServerSnapshot)
  const [lines, setLines] = useState<Line[]>(() => [line('dim', T.boot)])
  const [value, setValue] = useState('')
  const scroll = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  // finding it at all counts
  useEffect(() => {
    if (!measuring) findEgg('terminal')
  }, [measuring])

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [lines])

  const run = useCallback(
    (raw: string) => {
      const cmd = raw.trim()
      const [head, ...rest] = cmd.split(/\s+/)
      const arg = rest.join(' ')
      const out: Line[] = [line('in', `${T.prompt} ${cmd}`)]

      switch (head.toLowerCase()) {
        case '':
          break
        case 'help':
          out.push(...T.help.map((h) => line('out', h)))
          break
        case 'whoami':
          out.push(line('out', T.whoami))
          break
        case 'ls':
          out.push(line('out', apps.map((a) => a.id).join('  ')))
          break
        case 'open': {
          if (!arg) {
            out.push(line('err', T.openUsage))
            break
          }
          const target = apps.find((a) => a.id === arg.toLowerCase())
          if (!target) {
            out.push(line('err', T.openUnknown(arg)))
            break
          }
          out.push(line('dim', T.opened(target.id)))
          open(target.id)
          break
        }
        case 'theme': {
          if (!arg) {
            out.push(line('err', T.themeUsage))
            break
          }
          if (arg.toLowerCase() === 'list') {
            out.push(line('out', themes.map((t) => t.id).join('  ')))
            break
          }
          const found = themes.find((t) => t.id === arg.toLowerCase())
          if (!found) {
            out.push(line('err', T.themeUnknown(arg)))
            break
          }
          setTheme(found.id)
          out.push(line('dim', T.themeSet(found.id)))
          break
        }
        case 'eggs': {
          const got = EGGS.filter((e) => eggs.includes(e.id))
          if (!got.length) {
            out.push(line('dim', T.eggsNone))
            break
          }
          out.push(
            ...EGGS.map((e) =>
              eggs.includes(e.id)
                ? line('out', `[x] ${e.label}`)
                : line('dim', `[ ] ${e.hint}`),
            ),
          )
          break
        }
        case 'sudo':
          out.push(line('err', T.sudo))
          break
        case 'clear':
          setLines([])
          setValue('')
          return
        default:
          out.push(line('err', T.unknown(head)))
      }

      setLines((prev) => [...prev, ...out])
      setValue('')
      play('tick')
    },
    [open, eggs],
  )

  return (
    <div data-keys tabIndex={-1}>
      <div className="term" ref={scroll} onClick={() => input.current?.focus()}>
        {lines.map((l) => (
          <p className="term__l" key={l.id} data-k={l.kind === 'out' ? undefined : l.kind}>
            {l.text}
          </p>
        ))}
        <div className="term__p">
          <span>{T.prompt}</span>
          <input
            ref={input}
            name="command"
            value={value}
            spellCheck={false}
            autoComplete="off"
            aria-label="terminal command"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                run(value)
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}
