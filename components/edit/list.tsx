'use client'

import { useState } from 'react'

import { editCopy } from '@/content/edit'
import { blank, type Field as F } from '@/lib/edit/schema'

import { Control, ObjFields, type Ctx } from './field'

const C = editCopy.list

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  const [it] = next.splice(from, 1)
  next.splice(to, 0, it)
  return next
}

/** Up, down, duplicate, remove — the same four on every kind of list. */
function Tools({
  i,
  n,
  onMove,
  onDuplicate,
  onRemove,
  children,
}: {
  i: number
  n: number
  onMove: (to: number) => void
  onDuplicate?: () => void
  onRemove: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="ed-tools">
      <button type="button" className="ed-icon" aria-label={C.up} title={C.up} disabled={i === 0} onClick={() => onMove(i - 1)}>
        ↑
      </button>
      <button type="button" className="ed-icon" aria-label={C.down} title={C.down} disabled={i === n - 1} onClick={() => onMove(i + 1)}>
        ↓
      </button>
      {onDuplicate && (
        <button type="button" className="ed-icon" aria-label={C.duplicate} title={C.duplicate} onClick={onDuplicate}>
          ⧉
        </button>
      )}
      <button type="button" className="ed-icon" aria-label={C.remove} title={C.remove} onClick={onRemove}>
        ✕
      </button>
      {children}
    </div>
  )
}

/** A list of groups (projects, roles, links…) as cards that open and close. */
export function ItemList({
  field,
  items,
  onChange,
  path,
  ctx,
  nested = false,
}: {
  field: F & { kind: 'list' }
  items: unknown[]
  onChange: (v: unknown[]) => void
  path: string
  ctx: Ctx
  nested?: boolean
}) {
  const of = field.of as F & { kind: 'obj' }
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const [confirming, setConfirming] = useState<number | null>(null)

  const titleOf = (it: unknown) => {
    const o = (it ?? {}) as Record<string, unknown>
    const t = field.titleKey ? o[field.titleKey] : undefined
    return typeof t === 'string' && t.trim() ? t : C.untitled
  }
  const metaOf = (it: unknown) => {
    const o = (it ?? {}) as Record<string, unknown>
    return [o.year, o.kind, o.when].filter((x) => typeof x === 'string' || typeof x === 'number').join(' · ')
  }
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  const remap = (f: (i: number) => number | null) =>
    setOpen((s) => new Set([...s].map(f).filter((x): x is number => x !== null)))

  return (
    <div className={nested ? 'ed-items ed-items--nested' : 'ed-items'}>
      {items.length === 0 && <p className="ed-empty">{C.empty}</p>}
      {items.map((it, i) => {
        const p = `${path}[${i}]`
        const isOpen = open.has(i)
        const bad = ctx.hasIssueUnder(p)
        return (
          <section key={i} className={`ed-card${isOpen ? ' ed-card--open' : ''}${bad ? ' ed-card--bad' : ''}`}>
            <div className="ed-card__row">
              <button type="button" className="ed-card__title" aria-expanded={isOpen} onClick={() => toggle(i)}>
                {bad && <span className="ed-badge" aria-hidden />}
                {titleOf(it)}
                {metaOf(it) && <small>{metaOf(it)}</small>}
              </button>
              <Tools
                i={i}
                n={items.length}
                onMove={(to) => {
                  onChange(move(items, i, to))
                  remap((x) => (x === i ? to : x === to ? i : x))
                }}
                onDuplicate={() => {
                  const next = [...items]
                  next.splice(i + 1, 0, structuredClone(it))
                  onChange(next)
                  remap((x) => (x > i ? x + 1 : x))
                  setOpen((s) => new Set(s).add(i + 1))
                }}
                onRemove={() => setConfirming(i)}
              >
                <button type="button" className="ed-icon" aria-label={isOpen ? C.collapse : C.expand} onClick={() => toggle(i)}>
                  {isOpen ? '▾' : '▸'}
                </button>
              </Tools>
            </div>
            {confirming === i && (
              <div className="ed-confirm">
                {C.remove} “{titleOf(it)}”?
                <button
                  type="button"
                  className="ed-btn"
                  onClick={() => {
                    onChange(items.filter((_, j) => j !== i))
                    remap((x) => (x === i ? null : x > i ? x - 1 : x))
                    setConfirming(null)
                  }}
                >
                  {C.confirmRemove}
                </button>
                <button type="button" className="ed-btn ed-btn--quiet" onClick={() => setConfirming(null)}>
                  {C.keep}
                </button>
              </div>
            )}
            {isOpen && (
              <div className="ed-card__body">
                <ObjFields field={of} value={it} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} path={p} ctx={ctx} />
              </div>
            )}
          </section>
        )
      })}
      <button
        type="button"
        className="ed-btn ed-add"
        onClick={() => {
          onChange([...items, blank(of)])
          setOpen((s) => new Set(s).add(items.length))
        }}
      >
        + {C.add} {(field.itemLabel ?? of.label).toLowerCase()}
      </button>
    </div>
  )
}

/** A list of single values — bullets, paragraphs, pictures — one row each. */
export function SubList({
  field,
  items,
  onChange,
  path,
  ctx,
}: {
  field: F & { kind: 'list' }
  items: unknown[]
  onChange: (v: unknown[]) => void
  path: string
  ctx: Ctx
}) {
  return (
    <div className="ed-sub">
      {items.map((it, i) => (
        <div key={i} className="ed-sub__row">
          <div className="ed-sub__control">
            <Control
              field={field.of}
              value={it}
              onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))}
              path={`${path}[${i}]`}
              ctx={ctx}
              label={`${field.of.label} ${i + 1}`}
            />
            {ctx.issues.get(`${path}[${i}]`)?.map((m) => (
              <span key={m} className="ed-error">
                {m}
              </span>
            ))}
          </div>
          <Tools i={i} n={items.length} onMove={(to) => onChange(move(items, i, to))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <button type="button" className="ed-btn ed-add" onClick={() => onChange([...items, blank(field.of)])}>
        + {C.add} {field.of.label.toLowerCase()}
      </button>
    </div>
  )
}

/** A project's stack: chips, plus a picker of the tools that are on the shelf. */
export function ToolChips({
  items,
  onChange,
  path,
  ctx,
}: {
  items: string[]
  onChange: (v: string[]) => void
  path: string
  ctx: Ctx
}) {
  const known = new Set(ctx.tools)
  return (
    <div className="ed-chips">
      {items.map((t, i) => (
        <span key={`${t}-${i}`} className={`ed-chip${known.has(t) && !ctx.issues.has(`${path}[${i}]`) ? '' : ' ed-chip--bad'}`}>
          {t}
          <button type="button" aria-label={`${C.remove} ${t}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            ✕
          </button>
        </span>
      ))}
      <select
        className="ed-input ed-input--inline"
        value=""
        aria-label={editCopy.picker.addTool}
        onChange={(e) => e.target.value && onChange([...items, e.target.value])}
      >
        <option value="">{editCopy.picker.addTool}</option>
        {ctx.tools
          .filter((t) => !items.includes(t))
          .map((t) => (
            <option key={t}>{t}</option>
          ))}
      </select>
      {items.map((_, i) =>
        ctx.issues.get(`${path}[${i}]`)?.map((m) => (
          <span key={`${i}${m}`} className="ed-error ed-full">
            {m}
          </span>
        )),
      )}
    </div>
  )
}
