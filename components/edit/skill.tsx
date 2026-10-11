'use client'

import { useState } from 'react'

import { editCopy } from '@/content/edit'

const S = editCopy.skillPage

/** The update-content skill, verbatim, with a copy button — so it can be taken anywhere. */
export function Skill({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('failed')
    }
  }

  return (
    <>
      <div className="ed-head">
        <h2>{S.title}</h2>
        <span className="ed-help">{S.lede}</span>
      </div>
      <div className="ed-skill">
        <div className="ed-skill__bar">
          <code>SKILL.md</code>
          <button type="button" className="ed-btn ed-btn--primary" onClick={copy}>
            {state === 'copied' ? S.copied : S.copy}
          </button>
        </div>
        {state === 'failed' && (
          <p className="ed-error" role="alert">
            {S.failed}
          </p>
        )}
        <pre className="ed-pre" tabIndex={0}>
          {text}
        </pre>
      </div>
    </>
  )
}
