'use client'

import * as m from 'motion/react-m'
import { useEffect, useRef, useState } from 'react'

import { track } from '@/lib/events'
import { shareUrls } from '@/lib/lab/view'
import { useReducedMotion } from '@/lib/motion/reduced'
import { EASE_BEZIER, LAB, sec } from '@/lib/motion/tokens'

export interface ShareLabels {
  title: string
  native: string
  copy: string
  copied: string
  x: string
  linkedin: string
}

/**
 * Share (decision 7; NEXT.md shortcut 7): one "Share…" button, at the end of every entry and in
 * the rail. It opens the device's own share sheet with the page's canonical URL where the browser
 * has one, and otherwise a small menu of Copy link, X and LinkedIn: plain links that load nothing
 * until pressed. Esc or a press outside closes the menu, and Esc returns focus to the button.
 * "Link copied" crossfades in 140ms and goes back after 1.8s. With JavaScript off only the X and
 * LinkedIn links show, since they work without it.
 */
export function Share({ where, url, title, path, labels }: { where: 'end' | 'rail'; url: string; title: string; path: string; labels: ShareLabels }) {
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  const reduced = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const links = shareUrls(url, title)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btn.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open])

  const onShare = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        track('share', { path, via: 'native' })
      } catch {
        /* dismissed */
      }
      return
    }
    if (!open) setShown(true)
    setOpen(!open)
  }
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      return
    }
    track('share', { path, via: 'copy' })
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), LAB.copied.hold)
  }
  const id = `lab-share-${where}`
  const lift = reduced ? 0 : -4
  return (
    <div ref={root} className={`lab-share${where === 'end' ? ' lab-share-end' : ' lab-rail-wide'}`} data-share={where}>
      <h2 className="end-h">{labels.title}</h2>
      <div className="lab-share-row">
        <button ref={btn} type="button" className="lab-chip" data-share-open aria-expanded={open} aria-controls={id} onClick={onShare}>
          {labels.native}
        </button>
        <m.div
          id={id}
          className="lab-share-menu"
          data-share-menu
          hidden={!shown}
          initial={false}
          variants={{
            in: { opacity: 1, x: 0, transition: { duration: sec(LAB.control.in), ease: EASE_BEZIER } },
            out: { opacity: 0, x: lift, transition: { duration: sec(reduced ? LAB.control.in : LAB.control.out), ease: EASE_BEZIER } },
          }}
          animate={open ? 'in' : 'out'}
          onAnimationComplete={(v) => {
            if (v === 'out') setShown(false)
          }}
        >
          <button type="button" className="lab-chip" data-share-copy onClick={onCopy} aria-live="polite">
            <span className="lab-copy-word">
              <span aria-hidden={copied}>{labels.copy}</span>
              <span aria-hidden={!copied}>{labels.copied}</span>
            </span>
          </button>
          <a className="lab-chip" data-share-x href={links.x} target="_blank" rel="noopener noreferrer" onClick={() => track('share', { path, via: 'x' })}>
            {labels.x}
          </a>
          <a className="lab-chip" data-share-linkedin href={links.linkedin} target="_blank" rel="noopener noreferrer" onClick={() => track('share', { path, via: 'linkedin' })}>
            {labels.linkedin}
          </a>
        </m.div>
      </div>
    </div>
  )
}
