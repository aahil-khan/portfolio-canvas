'use client'

import { useEffect, useRef, useState } from 'react'

import { LAB } from '@/lib/motion/tokens'

import { copyText, useLeadUse } from './live'

/**
 * A build's install line (`install`, the end of a build's chain): the command, and a Copy button
 * that says "Copied" for 1.8s, crossfading in 140ms like Share's. The command is plain text, so it
 * reads and selects with JavaScript off; the button needs JavaScript and is hidden without it.
 */
export function Install({ command, labels }: { command: string; labels: { copy: string; copied: string } }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const used = useLeadUse('install')
  useEffect(() => () => clearTimeout(timer.current), [])
  const onCopy = async () => {
    if (!(await copyText(command))) return
    used()
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), LAB.copied.hold)
  }
  return (
    <div className="lab-install" data-draw="in">
      <pre>
        <code>{command}</code>
      </pre>
      <button type="button" className="lab-chip" data-needs-js onClick={onCopy}>
        <span className="lab-copy-word">
          <span aria-hidden={copied}>{labels.copy}</span>
          <span aria-hidden={!copied}>{labels.copied}</span>
        </span>
      </button>
      <span className="sr" aria-live="polite">
        {copied ? labels.copied : ''}
      </span>
    </div>
  )
}
