'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'

import type { ControllerProps, Recorded } from './controller'

const PREVIEW = 'a[data-preview]'

/**
 * The previews slot (API.md §6), replacing PR 6's stub with the real thing: hover, focus or tap any
 * `a[data-preview]` (an entry, a term, a tag, a citation, a link out) and its window, card or sheet
 * opens.
 *
 * This root is all that loads with a page, a few hundred bytes. It listens for a reader's first
 * intent on a preview link, and only then loads the controller (`controller.tsx`), which brings
 * Floating UI, the windows and their CSS (plan PR 10: "loaded on first intent, not on page load").
 * What happens while it loads is recorded with its timestamps and replayed, so a first hover still
 * opens at 300ms from when it began. A first tap on touch is taken here and then (`preventDefault`,
 * which PR 6's `SoftNav` respects), so it opens a sheet and does not navigate.
 */
export function PreviewRoot() {
  const [Ctl, setCtl] = useState<ComponentType<ControllerProps> | null>(null)
  const [queue] = useState<Recorded[]>(() => [])
  const detach = useRef<() => void>(() => {})
  const [onReady] = useState(() => () => detach.current())

  useEffect(() => {
    let started = false
    let lastPointer = 'mouse'
    const load = () => {
      if (started) return
      started = true
      import('./controller').then((m) => setCtl(() => m.Controller)).catch(() => {
        started = false
      })
    }
    const trig = (t: EventTarget | null) => (t instanceof Element ? t.closest(PREVIEW) : null)
    const rec = (type: Recorded['type'], e: Event, via?: Recorded['via']) => {
      const p = e as PointerEvent
      queue.push({ type, target: e.target, related: (e as MouseEvent).relatedTarget ?? null, t: e.timeStamp, x: p.clientX ?? 0, y: p.clientY ?? 0, pointerType: p.pointerType ?? '', via })
    }
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !trig(e.target)) return
      load()
      rec('over', e)
    }
    const onOut = (e: PointerEvent) => {
      if (started && trig(e.target)) rec('out', e)
    }
    const onFocus = (e: FocusEvent) => {
      const a = trig(e.target)
      if (!a || !a.matches(':focus-visible')) return
      load()
      rec('focusin', e)
    }
    const onDown = (e: PointerEvent) => {
      lastPointer = e.pointerType || 'mouse'
      if (trig(e.target)) load()
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !trig(e.target)) return
      if (lastPointer !== 'touch' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      e.preventDefault()
      load()
      rec('press', e, lastPointer === 'touch' ? 'tap' : 'click')
    }
    document.addEventListener('pointerover', onOver, { passive: true })
    document.addEventListener('pointerout', onOut, { passive: true })
    document.addEventListener('focusin', onFocus)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('click', onClick, true)
    const off = () => {
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('click', onClick, true)
    }
    detach.current = off
    return off
  }, [queue])

  return Ctl ? <Ctl queue={queue} onReady={onReady} /> : null
}
