'use client'

import { useEffect, useState } from 'react'

import { editCopy } from '@/content/edit'

const H = editCopy.historyPage

interface Entry {
  sha: string
  message: string
  date: string
  author: string
}

/** Recent content commits, each undoable with one more commit. */
export function History({ onReverted }: { onReverted: (commit: string) => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () =>
    fetch('/api/edit/history', { cache: 'no-store' })
      .then((r) => r.json())
      .then((r) => setEntries(Array.isArray(r) ? r : []))
      .catch(() => setEntries([]))

  useEffect(() => {
    refresh()
  }, [])

  async function revert(sha: string) {
    setBusy(true)
    const res = await fetch('/api/edit/revert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha }),
    })
    const r = await res.json().catch(() => ({ ok: false, message: editCopy.loadFailed }))
    setBusy(false)
    setConfirming(null)
    if (!r.ok) return setNote(r.message)
    setNote(H.reverted)
    onReverted(r.commit)
    refresh()
  }

  return (
    <>
      <div className="ed-head">
        <h2>{H.title}</h2>
        <span className="ed-help">{H.lede}</span>
      </div>
      {note && (
        <p className="ed-note" role="status">
          {note}
        </p>
      )}
      {entries === null ? (
        <p className="ed-muted">{editCopy.loading}</p>
      ) : entries.length === 0 ? (
        <p className="ed-muted">{H.empty}</p>
      ) : (
        <ol className="ed-history">
          {entries.map((e) => (
            <li key={e.sha} className="ed-card">
              <div className="ed-card__row">
                <span className="ed-card__title ed-card__title--static">
                  {e.message.split('\n')[0]}
                  <small>
                    {new Date(e.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {e.author} · {e.sha.slice(0, 7)}
                  </small>
                </span>
                {confirming === e.sha ? (
                  <span className="ed-tools">
                    {H.confirm}
                    <button className="ed-btn" disabled={busy} onClick={() => revert(e.sha)}>
                      {H.revert}
                    </button>
                    <button className="ed-btn ed-btn--quiet" onClick={() => setConfirming(null)}>
                      {editCopy.list.keep}
                    </button>
                  </span>
                ) : (
                  <button className="ed-btn" onClick={() => setConfirming(e.sha)}>
                    {H.revert}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
