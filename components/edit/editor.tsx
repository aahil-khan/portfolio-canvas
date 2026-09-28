'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { editCopy } from '@/content/edit'
import { FILES, SCHEMAS, type ContentSet, type FileId } from '@/content/schema'
import { validateSet } from '@/lib/edit/rules'
import type { Issue } from '@/lib/edit/schema'

import { Help, ObjFields, type Ctx } from './field'
import { History } from './history'
import { ItemList } from './list'

const E = editCopy

interface Section {
  data: unknown
  /** What is on GitHub — the edit is dirty when `data` differs from it. */
  saved: unknown
  sha: string
}

type Status =
  | { kind: 'idle' }
  | { kind: 'building'; commit: string; since: number }
  | { kind: 'live' }
  | { kind: 'failed' }
  | { kind: 'dev' }

type View = FileId | 'history'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function Editor({ login, dev }: { login: string; dev: boolean }) {
  const [sections, setSections] = useState<Record<FileId, Section> | null>(null)
  const [publicFiles, setPublicFiles] = useState<string[]>([])
  const [live, setLive] = useState<Set<string>>(() => new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>('profile')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ text: string; reload?: boolean } | null>(null)
  const [serverIssues, setServerIssues] = useState<Issue[]>([])
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const load = useCallback(async (keepDirty = false) => {
    setLoadError(null)
    const res = await fetch('/api/edit/content', { cache: 'no-store' })
    if (res.status === 401) return location.reload()
    if (!res.ok) return setLoadError((await res.json().catch(() => ({}))).message ?? E.loadFailed)
    const body = (await res.json()) as { files: Record<FileId, { sha: string; data: unknown }>; publicFiles: string[] }
    setPublicFiles(body.publicFiles)
    setLive((l) => (l.size ? l : new Set(body.publicFiles)))
    setSections((prev) => {
      const next = {} as Record<FileId, Section>
      for (const f of FILES) {
        const remote = body.files[f.id]
        const old = prev?.[f.id]
        // an unsaved edit survives a reload that is only refreshing the others
        next[f.id] =
          keepDirty && old && !same(old.data, old.saved)
            ? old
            : { data: remote.data, saved: remote.data, sha: remote.sha }
      }
      return next
    })
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the initial fetch has to start somewhere
    load()
  }, [load])

  const dirty = useMemo(
    () => new Set(FILES.filter((f) => sections && !same(sections[f.id].data, sections[f.id].saved)).map((f) => f.id)),
    [sections],
  )

  useEffect(() => {
    if (!dirty.size) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [dirty])

  // every rule, over every section as it stands — the same check the server runs before it commits
  const issues = useMemo(() => {
    if (!sections) return [] as Issue[]
    const set = Object.fromEntries(FILES.map((f) => [f.id, sections[f.id].data])) as ContentSet
    const known = new Set(publicFiles)
    return validateSet(set, (p) => known.has(p))
  }, [sections, publicFiles])

  const all = useMemo(() => [...issues, ...serverIssues], [issues, serverIssues])

  const ctx: Ctx = useMemo(() => {
    const byPath = new Map<string, string[]>()
    for (const i of all) byPath.set(i.path, [...(byPath.get(i.path) ?? []), i.message])
    const tools = ((sections?.stack.data ?? []) as { tools?: { name?: string }[] }[])
      .flatMap((g) => g.tools ?? [])
      .map((t) => t.name)
      .filter((n): n is string => !!n)
    return {
      issues: byPath,
      hasIssueUnder: (p) => all.some((i) => i.path === p || i.path.startsWith(`${p}.`) || i.path.startsWith(`${p}[`)),
      tools,
      publicFiles,
      live,
      upload: async (file, target) => {
        const form = new FormData()
        form.set('file', file)
        if ('resume' in target) form.set('resume', '1')
        else {
          form.set('dir', target.dir)
          form.set('slug', target.slug)
        }
        const res = await fetch('/api/edit/upload', { method: 'POST', body: form })
        const r = await res.json().catch(() => ({ message: E.loadFailed }))
        if (!res.ok || !r.ok) {
          setNotice({ text: r.message })
          return null
        }
        setPublicFiles((f) => (f.includes(r.path) ? f : [...f, r.path]))
        track(r.commit)
        return r.path as string
      },
    }
    // track is stable enough: it only reads `dev` and sets state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, sections, publicFiles, live])

  function track(commit: string) {
    setStatus(dev ? { kind: 'dev' } : { kind: 'building', commit, since: Date.now() })
  }

  // after a save, watch the running site until it reports the new commit
  useEffect(() => {
    if (status.kind !== 'building') return
    const t = setInterval(async () => {
      const r = await fetch('/api/version', { cache: 'no-store' }).then((x) => x.json()).catch(() => null)
      if (r?.sha === status.commit) setStatus({ kind: 'live' })
      else if (Date.now() - status.since > 10 * 60_000) setStatus({ kind: 'failed' })
    }, 10_000)
    return () => clearInterval(t)
  }, [status])

  if (loadError)
    return (
      <div className="ed-center">
        <p>{loadError}</p>
        <button className="ed-btn" onClick={() => load()}>
          {E.retry}
        </button>
      </div>
    )
  if (!sections) return <p className="ed-center">{E.loading}</p>

  const file = view === 'history' ? null : FILES.find((f) => f.id === view)!
  const schema = file ? SCHEMAS[file.id] : null
  const sectionIssues = file ? all.filter((i) => i.path === file.id || i.path.startsWith(`${file.id}.`) || i.path.startsWith(`${file.id}[`)) : []
  const setData = (id: FileId, data: unknown) => {
    setServerIssues([])
    setSections((s) => (s ? { ...s, [id]: { ...s[id], data } } : s))
  }

  async function save() {
    if (!file || !sections) return
    setSaving(true)
    setNotice(null)
    const s = sections[file.id]
    const res = await fetch(`/api/edit/content/${file.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: s.data, sha: s.sha, message }),
    })
    const r = await res.json().catch(() => ({ ok: false, message: E.loadFailed }))
    setSaving(false)
    if (res.status === 401) return location.reload()
    if (!r.ok) {
      setServerIssues(r.issues ?? [])
      return setNotice({ text: r.message, reload: res.status === 409 })
    }
    setMessage('')
    if (r.commit) track(r.commit)
    // pick up the new blob sha for this file; other unsaved sections are left as they are
    setSections((prev) => (prev ? { ...prev, [file.id]: { ...prev[file.id], saved: prev[file.id].data } } : prev))
    await load(true)
  }

  const statusLine =
    status.kind === 'idle' ? null : status.kind === 'dev' ? (
      <span className="ed-step ed-step--done">{E.status.dev}</span>
    ) : status.kind === 'failed' ? (
      <span className="ed-error">{E.status.failed}</span>
    ) : (
      <>
        <span>{E.status.lastSave}</span>
        <span className="ed-step ed-step--done">{E.status.saved} ✓</span>→
        <span className={`ed-step${status.kind === 'building' ? ' ed-step--now' : ''}`}>{E.status.building}</span>→
        <span className={`ed-step${status.kind === 'live' ? ' ed-step--live' : ''}`}>
          {E.status.live}
          {status.kind === 'live' && ' ✓'}
        </span>
      </>
    )

  return (
    <div className="ed" data-scroll-page>
      <header className="ed-bar">
        <h1>{E.title}</h1>
        <a className="ed-btn ed-btn--quiet" href="/" target="_blank" rel="noreferrer">
          {E.viewSite}
        </a>
        <span className="ed-who">
          {E.signedInAs} <b>{login}</b>
        </span>
        <form method="post" action="/api/edit/auth/logout">
          <button className="ed-btn">{E.signOut}</button>
        </form>
      </header>
      {dev && <p className="ed-dev">{E.devMode}</p>}

      <div className="ed-shell">
        <nav className="ed-nav" aria-label={E.sectionsLabel}>
          {FILES.map((f) => (
            <button key={f.id} type="button" aria-current={view === f.id ? 'page' : undefined} onClick={() => setView(f.id)}>
              {f.label}
              {dirty.has(f.id) && <span className="ed-dot" title={E.unsaved} />}
            </button>
          ))}
          <hr />
          <button type="button" aria-current={view === 'history' ? 'page' : undefined} onClick={() => setView('history')}>
            {E.history}
          </button>
        </nav>

        <main>
          <select className="ed-input ed-nav-select" aria-label={E.sectionsLabel} value={view} onChange={(e) => setView(e.target.value as View)}>
            {FILES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
                {dirty.has(f.id) ? ' •' : ''}
              </option>
            ))}
            <option value="history">{E.history}</option>
          </select>

          {view === 'history' ? (
            <History
              onReverted={(commit) => {
                track(commit)
                load(true)
              }}
            />
          ) : (
            file &&
            schema && (
              <>
                <div className="ed-head">
                  <h2>{file.label}</h2>
                  <Help text={schema.help} />
                </div>
                {schema.kind === 'list' ? (
                  <ItemList key={file.id} field={schema} items={(sections[file.id].data as unknown[]) ?? []} onChange={(v) => setData(file.id, v)} path={file.id} ctx={ctx} />
                ) : schema.kind === 'obj' ? (
                  <div className="ed-panel">
                    <ObjFields key={file.id} field={schema} value={sections[file.id].data} onChange={(v) => setData(file.id, v)} path={file.id} ctx={ctx} />
                  </div>
                ) : null}
              </>
            )
          )}
        </main>
      </div>

      <footer className="ed-save">
        {file && (
          <div className="ed-save__in">
            {sectionIssues.length > 0 ? (
              <span className="ed-issues">{E.save.issues(sectionIssues.length)}</span>
            ) : !dirty.has(file.id) ? (
              <span className="ed-muted">{E.save.nothing}</span>
            ) : null}
            {dirty.has(file.id) ? (
            <input className="ed-input ed-save__msg" placeholder={E.save.message} aria-label={E.save.message} value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} />
            ) : (
              <span className="ed-spacer" />
            )}
            <button className="ed-btn ed-btn--primary" disabled={saving || !dirty.has(file.id) || sectionIssues.length > 0} onClick={save}>
              {saving ? E.save.saving : `${E.save.action} ${file.label}`}
            </button>
          </div>
        )}
        {(notice || statusLine) && (
          <div className="ed-save__in ed-save__status" aria-live="polite">
            {notice && (
              <span className="ed-error">
                {notice.text}{' '}
                {notice.reload && (
                  <button className="ed-btn" onClick={() => location.reload()}>
                    {E.save.reload}
                  </button>
                )}
              </span>
            )}
            {!notice && statusLine}
          </div>
        )}
      </footer>
    </div>
  )
}
