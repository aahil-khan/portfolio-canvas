'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { track } from '@/lib/events'
import { shareUrls } from '@/lib/lab/view'
import { LAB } from '@/lib/motion/tokens'

export interface ShareLabels {
  title: string
  native: string
  copy: string
  copied: string
  x: string
  linkedin: string
}

/** Nothing changes it, but React reads the snapshot again once subscribed, after hydration. */
const onceAfterHydration = (changed: () => void) => {
  queueMicrotask(changed)
  return () => {}
}
/** Whether this browser has a share sheet. Never on the server, so hydration matches the HTML. */
const useNativeShare = () =>
  useSyncExternalStore(
    onceAfterHydration,
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false,
  )

/** The clipboard, and the old selection trick where the async API is missing or refused. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

/**
 * Share (decision 7, revised 27 Nov): the actions themselves, in one row, at the end of every entry
 * and in the rail. Copy link, X and LinkedIn always; the device's own "Share…" only where the
 * browser has `navigator.share`. No menu to open first. X and LinkedIn are plain links that load
 * nothing until pressed. "Link copied" crossfades in 140ms and goes back after 1.8s. With
 * JavaScript off only X and LinkedIn show, since they work without it.
 */
export function Share({ where, url, title, path, labels }: { where: 'end' | 'rail'; url: string; title: string; path: string; labels: ShareLabels }) {
  const [copied, setCopied] = useState(false)
  const native = useNativeShare()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const links = shareUrls(url, title)

  useEffect(() => () => clearTimeout(timer.current), [])

  const onCopy = async () => {
    if (!(await copyText(url))) return
    track('share', { path, via: 'copy' })
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), LAB.copied.hold)
  }
  const onNative = async () => {
    try {
      await navigator.share({ title, url })
      track('share', { path, via: 'native' })
    } catch {
      /* dismissed */
    }
  }
  return (
    <div className={`lab-share${where === 'end' ? ' lab-share-end' : ' lab-rail-wide lab-rail-sec'}`} data-share={where} data-rail-section={where === 'rail' ? 'share' : undefined}>
      <h2 className="end-h">{labels.title}</h2>
      <div className="lab-share-row" data-share-row>
        <button type="button" className="lab-chip" data-share-copy data-needs-js onClick={onCopy}>
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
        {native ? (
          <button type="button" className="lab-chip" data-share-native onClick={onNative}>
            {labels.native}
          </button>
        ) : null}
        <span className="sr" aria-live="polite">
          {copied ? labels.copied : ''}
        </span>
      </div>
    </div>
  )
}
