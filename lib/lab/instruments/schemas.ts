/**
 * The instrument registry's schemas: one entry per instrument, checking the shape of its figure
 * data (`lab-figures.json`). Contract: `content/lab/API.md` §1 (`Figure`) and §6.
 *
 * PR 11 fills it, so `validateLab` refuses an instrument or figure name that is not registered here,
 * and figure data that does not have its instrument's shape. The components that draw each one are
 * `components/lab/instruments/*`; the shapes below are what they read, and nothing else.
 *
 *   board       a study's board; its data is the study file (`studies/<id>.json`), not a figure
 *   compare     A against B: `head`, `rows` (text), `chosen` (the column marked as picked)
 *   spec-table  a table: `head`, `rows`, `num` (right-aligned number columns)
 *   chart       ranges on a 0–`max` scale: `rows` of `{ label, lo, hi?, base?, note? }`
 *   schedule    an item's concession steps (lib/lab/haggle.ts): `item`, `items`, `copy`
 *   haggle      the haggle toy (lib/lab/haggle.ts): `items`, `item?`, `copy`
 *   scenarios   the scenario browser: `groups`, `items`, `copy`
 *   passk       pass@k against pass^k: `copy`, `ks?`, `p?`
 *   before-after  before and after: `copy.before`, `copy.after`
 *
 * Plain TypeScript with no imports beyond types, so Node runs it with `--experimental-strip-types`.
 */

/** Checks one figure's `data`; returns one message per problem, or none. */
export type InstrumentSchema = (data: Record<string, unknown>) => string[]

type D = Record<string, unknown>

const isObj = (v: unknown): v is D => !!v && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** `copy` must be a group holding a non-empty line under each key. */
function copyHas(d: D, keys: readonly string[]): string[] {
  if (!isObj(d.copy)) return ['needs a "copy" group of words']
  const c = d.copy
  return keys.filter((k) => !isStr(c[k])).map((k) => `copy.${k} is missing`)
}

/** `head` and `rows`: a header row of words and rows of the same width. */
function table(d: D): string[] {
  const out: string[] = []
  if (!Array.isArray(d.head) || !d.head.every((h) => typeof h === 'string')) out.push('"head" must be a list of column headings')
  if (!Array.isArray(d.rows) || !d.rows.length) return [...out, '"rows" must be a list of rows']
  const width = Array.isArray(d.head) ? d.head.length : 0
  d.rows.forEach((r, i) => {
    if (!Array.isArray(r) || !r.every((c) => typeof c === 'string')) out.push(`rows[${i}] must be a list of words`)
    else if (width && r.length !== width) out.push(`rows[${i}] has ${r.length} cells, the head ${width}`)
  })
  return out
}

/** `items`: the pricing table, `{ id: { id, name, list, floor } }`, each floor under its list. */
function items(d: D, need?: unknown): string[] {
  if (!isObj(d.items) || !Object.keys(d.items).length) return ['"items" must hold the priced items']
  const out: string[] = []
  for (const [k, v] of Object.entries(d.items)) {
    if (!isObj(v) || !isStr(v.name) || !isNum(v.list) || !isNum(v.floor)) out.push(`items.${k} needs a name, a list price and a floor`)
    else if (v.floor >= v.list) out.push(`items.${k}: the floor must be under the list price`)
    else if (!Number.isInteger(v.list) || !Number.isInteger(v.floor)) out.push(`items.${k}: prices are whole rupees`)
  }
  if (need !== undefined && !(isStr(need) && need in d.items)) out.push(`"item" must name one of the items`)
  return out
}

/** The haggle's lines: every one the toy can say, so none is ever blank. */
export const HAGGLE_COPY = ['q', 'label', 'offer', 'again', 'you', 'shop', 'open', 'counter0', 'counter1', 'counter2', 'counter3', 'hold', 'accept', 'agreed', 'bad', 'deal', 'sees', 'abA', 'abB', 'abLabel'] as const
export const SCHEDULE_COPY = ['list', 'counter', 'label', 'floor'] as const
export const SCENARIO_COPY = ['groups', 'list', 'SALE', 'NOSALE', 'SALEOK', 'wants', 'pays', 'checked'] as const
export const PASSK_COPY = ['p', 'at', 'hat', 'atKey', 'hatKey'] as const
export const OUTCOMES = ['SALE', 'NO_SALE', 'SALE_OK'] as const

export const INSTRUMENT_SCHEMAS: Readonly<Record<string, InstrumentSchema>> = {
  board: () => [],

  compare: (d) => {
    const out = table(d)
    if (d.chosen !== undefined && !(Number.isInteger(d.chosen) && (d.chosen as number) >= 1 && Array.isArray(d.head) && (d.chosen as number) < d.head.length))
      out.push('"chosen" must be the index of a column after the first')
    return out
  },

  'spec-table': (d) => {
    const out = table(d)
    if (d.num !== undefined && !(Array.isArray(d.num) && d.num.every((n) => Number.isInteger(n) && n >= 0))) out.push('"num" must list column indexes')
    return out
  },

  chart: (d) => {
    const out: string[] = []
    if (!isNum(d.max) || d.max <= 0) out.push('"max" must be a number above 0')
    if (!Array.isArray(d.rows) || !d.rows.length) return [...out, '"rows" must be a list of bars']
    d.rows.forEach((r, i) => {
      if (!isObj(r) || !isStr(r.label) || !isNum(r.lo)) out.push(`rows[${i}] needs a label and a value (lo)`)
      else if (r.hi !== undefined && !(isNum(r.hi) && r.hi >= r.lo)) out.push(`rows[${i}].hi must be at least lo`)
      else if (isNum(d.max) && ((r.hi as number | undefined) ?? r.lo) > d.max) out.push(`rows[${i}] runs past max`)
    })
    return out
  },

  schedule: (d) => [...items(d, d.item), ...copyHas(d, SCHEDULE_COPY)],

  haggle: (d) => [...items(d, d.item ?? Object.keys(isObj(d.items) ? d.items : {})[0]), ...copyHas(d, HAGGLE_COPY)],

  scenarios: (d) => {
    const out = copyHas(d, SCENARIO_COPY)
    if (!Array.isArray(d.groups) || !d.groups.length) return [...out, '"groups" must list the scenario groups']
    const ids = new Set<string>()
    d.groups.forEach((g, i) => {
      if (!isObj(g) || !isStr(g.id) || !isStr(g.name)) out.push(`groups[${i}] needs an id and a name`)
      else ids.add(g.id)
    })
    if (!Array.isArray(d.items) || !d.items.length) return [...out, '"items" must list the scenarios']
    const seen = new Set<string>()
    d.items.forEach((x, i) => {
      if (!isObj(x) || !isStr(x.id) || !isStr(x.who) || !isStr(x.wants)) return void out.push(`items[${i}] needs an id, who and wants`)
      if (seen.has(x.id)) out.push(`items[${i}]: "${x.id}" is listed twice`)
      seen.add(x.id)
      if (!ids.has(String(x.g))) out.push(`items[${i}] (${x.id}): group "${String(x.g)}" is not one of the groups`)
      if (!(OUTCOMES as readonly unknown[]).includes(x.expected)) out.push(`items[${i}] (${x.id}): expected must be one of ${OUTCOMES.join(', ')}`)
    })
    for (const g of ids) if (!d.items.some((x) => isObj(x) && x.g === g)) out.push(`group "${g}" has no scenarios`)
    return out
  },

  passk: (d) => {
    const out = copyHas(d, PASSK_COPY)
    if (d.ks !== undefined && !(Array.isArray(d.ks) && d.ks.length && d.ks.every((k) => Number.isInteger(k) && k >= 1))) out.push('"ks" must list whole numbers of runs')
    if (d.p !== undefined && !(isNum(d.p) && d.p > 0 && d.p < 1)) out.push('"p" must be a chance between 0 and 1')
    return out
  },

  'before-after': (d) => copyHas(d, ['before', 'after']),
}
