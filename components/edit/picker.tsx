'use client'

import { useRef, useState } from 'react'

import { editCopy } from '@/content/edit'
import type { Field as F } from '@/lib/edit/schema'

import type { Ctx } from './field'

const P = editCopy.picker

/**
 * Choose a file already in public/, or upload a new one. An upload is committed straight away
 * (the server names it), then selected — so a picture is never referenced before it exists.
 */
export function FilePicker({
  field,
  value,
  onChange,
  ctx,
  bad,
}: {
  field: F & { kind: 'file' }
  value: unknown
  onChange: (v: unknown) => void
  ctx: Ctx
  bad: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pdf = field.accept === 'pdf'
  const prefix = field.dir ? `/${field.dir}/` : '/'
  const choices = ctx.publicFiles.filter((p) =>
    pdf ? p.endsWith('.pdf') && p.lastIndexOf('/') === 0 : p.startsWith(prefix) && /\.(png|jpe?g|webp|svg|gif)$/i.test(p),
  )
  const current = typeof value === 'string' ? value : ''
  if (current && !choices.includes(current)) choices.unshift(current)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    const slug = file.name.replace(/\.[^.]+$/, '')
    const path = await ctx.upload(file, pdf ? { resume: true } : { dir: field.dir, slug })
    setBusy(false)
    if (path) onChange(path)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="ed-picker">
      {!pdf && current && ctx.live.has(current) && (
        // a preview of the file that is already live; the editor never renders unsaved uploads
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ed-thumb" src={current} alt="" loading="lazy" />
      )}
      <select className={`ed-input${bad ? ' ed-input--bad' : ''}`} aria-label={field.label} value={current} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{field.optional ? P.none : P.choose}</option>
        {choices.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button type="button" className="ed-btn" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? P.uploading : P.upload}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={pdf ? 'application/pdf' : 'image/png,image/jpeg,image/webp'}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <span className="ed-help ed-full">{pdf ? P.pdfHint : P.imageHint}</span>
    </div>
  )
}
