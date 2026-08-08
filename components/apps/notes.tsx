'use client'

import { useCallback, useEffect, useState } from 'react'

import { useMeasuring } from '@/components/desktop/measuring-context'
import { NAME_MAX, NOTE_MAX, notesCopy } from '@/content/notes'
import { play } from '@/lib/audio'

interface Note {
  id: string
  text: string
  name: string
  at: number
}

/** Compact relative time. Only ever rendered after the client fetch, so it can't desync SSR. */
function ago(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

type Status = 'idle' | 'posting' | 'error' | 'limited'

/**
 * A public wall anyone can post to.
 *
 * Two constraints shape this. The list is a FIXED 300px scroller, because card heights are
 * measured exactly once and never again — if the card grew with the number of notes, every
 * layout algorithm downstream (collision avoidance, fit-all, tidy) would be working from a
 * stale box. And the initial fetch is skipped while measuring, or every page load would issue
 * two requests, one of them from a card that is not on screen.
 */
export function NotesWall() {
  const measuring = useMeasuring()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [hp, setHp] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    if (measuring) return
    let live = true
    fetch('/api/notes')
      .then((r) => r.json())
      .then((d: { notes?: Note[] }) => {
        if (live) setNotes(d.notes ?? [])
      })
      .catch(() => {
        if (live) setNotes([])
      })
    return () => {
      live = false
    }
  }, [measuring])

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const clean = text.trim()
      if (!clean || status === 'posting') return
      setStatus('posting')
      try {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean, name: name.trim(), website: hp }),
        })
        if (res.status === 429) {
          setStatus('limited')
          return
        }
        const data = (await res.json()) as { ok?: boolean; note?: Note }
        if (!res.ok || !data.ok) {
          setStatus('error')
          return
        }
        // the honeypot path answers ok without a note; nothing to add in that case
        if (data.note) setNotes((n) => [data.note!, ...(n ?? [])])
        setText('')
        setStatus('idle')
        play('click')
      } catch {
        setStatus('error')
      }
    },
    [text, name, hp, status],
  )

  const over = text.length > NOTE_MAX - 10
  const busy = status === 'posting'

  return (
    <>
      <p className="lede">{notesCopy.lede}</p>

      {notes === null ? (
        <div className="notes__empty">{notesCopy.loading}</div>
      ) : notes.length === 0 ? (
        <div className="notes__empty">
          {notesCopy.empty}
          <small>{notesCopy.emptyHint}</small>
        </div>
      ) : (
        <div className="notes__list">
          {notes.map((n) => (
            <div className="note" key={n.id}>
              {/* text node, never innerHTML — this is what makes stored XSS a non-issue */}
              <p>{n.text}</p>
              <div className="note__by">
                {n.name || notesCopy.anon} <time dateTime={new Date(n.at).toISOString()}>{ago(n.at)}</time>
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="compose" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))}
          placeholder={notesCopy.placeholder}
          maxLength={NOTE_MAX}
          aria-label={notesCopy.placeholder}
        />
        {/* honeypot: off-screen and hidden from assistive tech, so only a bot fills it in */}
        <input
          className="compose__hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          placeholder="Leave blank"
        />
        <div className="compose__foot">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            placeholder={notesCopy.namePlaceholder}
            maxLength={NAME_MAX}
            aria-label={notesCopy.namePlaceholder}
          />
          <span className={over ? 'compose__count over' : 'compose__count'}>
            {text.length}/{NOTE_MAX}
          </span>
          <button className="btn" type="submit" disabled={busy || !text.trim()}>
            {busy ? notesCopy.submitting : notesCopy.submit}
          </button>
        </div>
        {/*
          Always rendered, even when empty. Showing it conditionally would grow the card after
          mount, and heights are measured exactly once — the layout maths would keep using the
          shorter box for collision avoidance and framing.
        */}
        <p className="compose__msg" role="status">
          {status === 'limited' ? notesCopy.rateLimited : status === 'error' ? notesCopy.error : ''}
        </p>
      </form>
    </>
  )
}
