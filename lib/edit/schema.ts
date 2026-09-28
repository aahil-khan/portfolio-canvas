/**
 * The vocabulary the editable content is described in.
 *
 * One `Field` tree per file in `content/data/`. It is read three ways: `check` validates a value
 * against it (at build, on save, and as you type in `/edit`), `blank` makes the empty value an
 * "Add" button inserts, and the editor renders a form from it. That is why this is data rather
 * than TypeScript types — types vanish at runtime, and all three of those happen at runtime.
 *
 * Deliberately small, and with no dependency: the canvas's "Next and React only" rule applies to
 * anything that could end up in a shared chunk.
 */

interface Base {
  label: string
  /** One sentence under the field in the editor. */
  help?: string
  optional?: boolean
}

export type Field =
  | (Base & { kind: 'str' | 'text' | 'rich' | 'url' | 'email'; max?: number })
  | (Base & { kind: 'num'; int?: boolean; min?: number; max?: number })
  | (Base & { kind: 'bool' })
  | (Base & { kind: 'enum'; options: readonly string[] })
  | (Base & { kind: 'ref'; to: 'tool' })
  | (Base & { kind: 'file'; accept: 'image' | 'pdf'; dir: 'work' | 'archive' | 'pfp' | 'logos' | '' })
  | (Base & { kind: 'shot'; dir: 'archive' })
  | (Base & { kind: 'list'; of: Field; itemLabel?: string; titleKey?: string })
  | (Base & { kind: 'obj'; fields: Record<string, Field> })

export interface Issue {
  /** Where, as `projects[2].stack[0]`. Empty for the root. */
  path: string
  message: string
}

const join = (path: string, key: string) => (path ? `${path}.${key}` : key)
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** A path under `public/`, written as the site references it: leading slash, no climbing. */
const isPublicPath = (v: string) => /^\/\S+$/.test(v) && !v.split('/').includes('..')

function checkString(field: Field & { max?: number }, v: unknown, path: string, out: Issue[]) {
  if (typeof v !== 'string') return void out.push({ path, message: `${field.label} must be text` })
  if (!v.trim()) {
    if (!field.optional) out.push({ path, message: `${field.label} is required` })
    return
  }
  if (field.max !== undefined && v.length > field.max)
    out.push({ path, message: `${field.label} is longer than ${field.max} characters` })
  if (field.kind === 'url' && !/^(https?:\/\/|mailto:)/.test(v))
    out.push({ path, message: `${field.label} must start with https://, http:// or mailto:` })
  if (field.kind === 'email' && !/^[^@\s]+@[^@\s]+$/.test(v))
    out.push({ path, message: `${field.label} does not look like an email address` })
  if (field.kind === 'file' && !isPublicPath(v))
    out.push({ path, message: `${field.label} must be a path under public/, like /work/name.webp` })
}

export function check(field: Field, value: unknown, path = ''): Issue[] {
  const out: Issue[] = []
  walk(field, value, path, out)
  return out
}

function walk(field: Field, v: unknown, path: string, out: Issue[]): void {
  if (v === undefined) {
    if (!field.optional) out.push({ path, message: `${field.label} is required` })
    return
  }
  switch (field.kind) {
    case 'str':
    case 'text':
    case 'rich':
    case 'url':
    case 'email':
    case 'ref':
    case 'file':
      return checkString(field, v, path, out)
    case 'num':
      if (typeof v !== 'number' || !Number.isFinite(v))
        return void out.push({ path, message: `${field.label} must be a number` })
      if (field.int && !Number.isInteger(v))
        out.push({ path, message: `${field.label} must be a whole number` })
      if (field.min !== undefined && v < field.min)
        out.push({ path, message: `${field.label} must be at least ${field.min}` })
      if (field.max !== undefined && v > field.max)
        out.push({ path, message: `${field.label} must be at most ${field.max}` })
      return
    case 'bool':
      if (typeof v !== 'boolean') out.push({ path, message: `${field.label} must be on or off` })
      return
    case 'enum':
      if (typeof v !== 'string' || !field.options.includes(v))
        out.push({ path, message: `${field.label} must be one of: ${field.options.join(', ')}` })
      return
    case 'shot': {
      const file: Field = { kind: 'file', label: field.label, accept: 'image', dir: field.dir }
      if (typeof v === 'string') return walk(file, v, path, out)
      if (!isObj(v)) return void out.push({ path, message: `${field.label} must be a picture` })
      return walk(
        {
          kind: 'obj',
          label: field.label,
          fields: { src: file, caption: { kind: 'str', label: 'Caption', optional: true } },
        },
        v,
        path,
        out,
      )
    }
    case 'list':
      if (!Array.isArray(v)) return void out.push({ path, message: `${field.label} must be a list` })
      v.forEach((item, i) => walk(field.of, item, `${path}[${i}]`, out))
      return
    case 'obj':
      if (!isObj(v)) return void out.push({ path, message: `${field.label} must be a group of fields` })
      for (const [key, f] of Object.entries(field.fields)) walk(f, v[key], join(path, key), out)
      for (const key of Object.keys(v))
        if (!(key in field.fields)) out.push({ path: join(path, key), message: `unknown field "${key}"` })
      return
  }
}

/** The value an "Add" button inserts: required fields present and empty, optional ones absent. */
export function blank(field: Field): unknown {
  switch (field.kind) {
    case 'num':
      return field.min ?? 0
    case 'bool':
      return false
    case 'enum':
      return field.options[0]
    case 'list':
      return []
    case 'obj':
      return Object.fromEntries(
        Object.entries(field.fields)
          .filter(([, f]) => !f.optional)
          .map(([k, f]) => [k, blank(f)]),
      )
    default:
      return ''
  }
}
