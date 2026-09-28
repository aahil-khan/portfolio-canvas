'use client'

import { useId } from 'react'

import { editCopy } from '@/content/edit'
import type { Field as F } from '@/lib/edit/schema'

import { ItemList, SubList, ToolChips } from './list'
import { FilePicker } from './picker'

/** What every field needs from the editor around it. */
export interface Ctx {
  /** Issues by exact path. */
  issues: Map<string, string[]>
  /** Every path that has an issue at or under it — so a closed card can say it has one. */
  hasIssueUnder: (path: string) => boolean
  tools: string[]
  publicFiles: string[]
  /** Files the running site can already serve — only these get a thumbnail. */
  live: Set<string>
  upload: (file: File, target: { dir: string; slug: string } | { resume: true }) => Promise<string | null>
}

type Obj = Record<string, unknown>

const WIDE = new Set(['text', 'rich', 'list', 'obj', 'file', 'shot'])

export const isWide = (f: F) => WIDE.has(f.kind) || (f.kind === 'str' && (f.max === undefined || f.max > 60))

function Errors({ path, ctx }: { path: string; ctx: Ctx }) {
  const list = ctx.issues.get(path)
  if (!list?.length) return null
  return (
    <span className="ed-error" role="alert">
      {list.join(' ')}
    </span>
  )
}

export function Help({ text }: { text?: string }) {
  return text ? <span className="ed-help">{text}</span> : null
}

function rowsFor(v: unknown) {
  const s = typeof v === 'string' ? v : ''
  return Math.min(12, Math.max(2, Math.ceil(s.length / 70) + (s.match(/\n/g)?.length ?? 0)))
}

/** An input, select or textarea for one value — no label. Used by fields and by list rows. */
export function Control({
  field,
  value,
  onChange,
  path,
  ctx,
  label,
}: {
  field: F
  value: unknown
  onChange: (v: unknown) => void
  path: string
  ctx: Ctx
  label?: string
}) {
  const bad = ctx.issues.has(path)
  const cls = `ed-input${bad ? ' ed-input--bad' : ''}`
  switch (field.kind) {
    case 'text':
    case 'rich':
      return (
        <textarea
          className={cls}
          aria-label={label}
          rows={rowsFor(value)}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'num':
      return (
        <input
          className={cls}
          aria-label={label}
          inputMode="numeric"
          value={typeof value === 'number' && Number.isFinite(value) ? String(value) : ''}
          onChange={(e) => {
            const t = e.target.value.trim()
            onChange(t === '' ? undefined : Number(t))
          }}
        />
      )
    case 'bool':
      return (
        <input type="checkbox" className="ed-check" aria-label={label} checked={value === true} onChange={(e) => onChange(e.target.checked)} />
      )
    case 'enum':
      return (
        <select className={cls} aria-label={label} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || undefined)}>
          {field.optional && <option value="">{editCopy.picker.none}</option>}
          {field.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )
    case 'ref':
      return (
        <select className={cls} aria-label={label} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">{editCopy.picker.choose}</option>
          {ctx.tools.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      )
    case 'file':
      return <FilePicker field={field} value={value} onChange={onChange} ctx={ctx} bad={bad} />
    case 'shot': {
      const shot = typeof value === 'string' ? { src: value } : ((value ?? {}) as { src?: string; caption?: string })
      // a bare path stays a bare path until it gets a caption, so untouched entries don't churn
      const set = (src: unknown, caption: string | undefined) => onChange(caption ? { src, caption } : src)
      return (
        <div className="ed-shot">
          <FilePicker
            field={{ kind: 'file', label: field.label, accept: 'image', dir: field.dir }}
            value={shot.src}
            onChange={(src) => set(src, shot.caption)}
            ctx={ctx}
            bad={bad}
          />
          <input
            className="ed-input"
            placeholder={editCopy.picker.caption}
            aria-label={editCopy.picker.caption}
            value={shot.caption ?? ''}
            onChange={(e) => set(shot.src, e.target.value || undefined)}
          />
        </div>
      )
    }
    default:
      return (
        <input
          className={cls}
          aria-label={label}
          type={field.kind === 'email' ? 'email' : field.kind === 'url' ? 'url' : 'text'}
          maxLength={'max' in field ? field.max : undefined}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

/** One labelled field, of any kind — recursing into lists and groups. */
export function Field({
  field,
  value,
  onChange,
  path,
  ctx,
}: {
  field: F
  value: unknown
  onChange: (v: unknown) => void
  path: string
  ctx: Ctx
}) {
  const id = useId()
  const wide = isWide(field) ? ' ed-full' : ''

  if (field.kind === 'list') {
    const items = Array.isArray(value) ? value : []
    const set = (v: unknown[]) => onChange(field.optional && v.length === 0 ? undefined : v)
    return (
      <div className={`ed-field${wide}`}>
        <span className="ed-label">{field.label}</span>
        <Help text={field.help} />
        {field.of.kind === 'ref' ? (
          <ToolChips items={items as string[]} onChange={set} path={path} ctx={ctx} />
        ) : field.of.kind === 'obj' ? (
          <ItemList field={field} items={items} onChange={set} path={path} ctx={ctx} nested />
        ) : (
          <SubList field={field} items={items} onChange={set} path={path} ctx={ctx} />
        )}
        <Errors path={path} ctx={ctx} />
      </div>
    )
  }

  if (field.kind === 'obj') {
    return (
      <fieldset className={`ed-group${wide}`}>
        <legend className="ed-label">{field.label}</legend>
        <Help text={field.help} />
        <ObjFields field={field} value={value} onChange={onChange} path={path} ctx={ctx} />
        <Errors path={path} ctx={ctx} />
      </fieldset>
    )
  }

  if (field.kind === 'bool') {
    return (
      <label className={`ed-field ed-field--check${wide}`}>
        <Control field={field} value={value} onChange={(v) => onChange(v ? true : field.optional ? undefined : false)} path={path} ctx={ctx} />
        <span>
          <span className="ed-label">{field.label}</span>
          <Help text={field.help} />
        </span>
      </label>
    )
  }

  return (
    <div className={`ed-field${wide}`}>
      <label className="ed-label" htmlFor={id}>
        {field.label}
      </label>
      <div id={id} className="ed-control">
        <Control field={field} value={value} onChange={onChange} path={path} ctx={ctx} label={field.label} />
      </div>
      <Help text={field.help} />
      <Errors path={path} ctx={ctx} />
    </div>
  )
}

/** The fields of a group, in a two-column grid. Optional fields left empty are removed from the data. */
export function ObjFields({
  field,
  value,
  onChange,
  path,
  ctx,
}: {
  field: F & { kind: 'obj' }
  value: unknown
  onChange: (v: unknown) => void
  path: string
  ctx: Ctx
}) {
  const obj = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Obj
  const setKey = (key: string, f: F, v: unknown) => {
    const next = { ...obj }
    if (v === undefined || (f.optional && v === '')) delete next[key]
    else next[key] = v
    onChange(next)
  }
  return (
    <div className="ed-grid">
      {Object.entries(field.fields).map(([key, f]) => (
        <Field key={key} field={f} value={obj[key]} onChange={(v) => setKey(key, f, v)} path={path ? `${path}.${key}` : key} ctx={ctx} />
      ))}
    </div>
  )
}
