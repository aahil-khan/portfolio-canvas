import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, test } from 'node:test'

import { themes } from '../content/themes.ts'
import { contributions } from '../content/contributions.ts'
import {
  calendarLayout,
  CELL,
  cellAt,
  dayName,
  daySentence,
  fill,
  GREENS,
  LABEL_WEEKS,
  ordinal,
  ROWS,
  scaleCss,
  STEP,
} from './contrib-grid.ts'
import { type ApiResponse, type Day, fetchContributions, parseContributions, TIMEOUT_MS } from './github.ts'

/*
 * The contribution calendar, from a recorded GraphQL response (`lib/fixtures/`, recorded
 * 27 Nov 2026 for aahil-khan with the same query `lib/github.ts` sends). No network, no token.
 */

const FIXTURE = path.join(import.meta.dirname, 'fixtures/github-contributions.json')
const recorded = JSON.parse(readFileSync(FIXTURE, 'utf8')) as ApiResponse
const calendar = recorded.data!.user!.contributionsCollection.contributionCalendar
const rawDays = calendar.weeks.flatMap((w) => w.contributionDays)

const DAY_MS = 86_400_000
const env = { token: process.env.GITHUB_TOKEN, fixture: process.env.GITHUB_CONTRIB_FIXTURE }
const realFetch = globalThis.fetch

afterEach(() => {
  for (const [k, v] of [['GITHUB_TOKEN', env.token], ['GITHUB_CONTRIB_FIXTURE', env.fixture]] as const) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  globalThis.fetch = realFetch
})

test('the recorded response becomes a calendar of whole weeks', () => {
  const c = parseContributions(recorded)
  assert.ok(c)
  assert.equal(c.total, calendar.totalContributions)
  assert.equal(c.weeks.length, calendar.weeks.length)
  assert.ok(c.weeks.length >= 52 && c.weeks.length <= 54, `a year is 52–54 weeks, got ${c.weeks.length}`)
  for (const [i, w] of c.weeks.entries()) assert.equal(w.length, ROWS, `week ${i} has ${w.length} slots`)
})

test('every day keeps its date and count, in order, in its weekday row', () => {
  const c = parseContributions(recorded)!
  const days = c.weeks.flat().filter((d): d is Day => d !== null)
  assert.deepEqual(
    days.map((d) => [d.date, d.count]),
    rawDays.map((d) => [d.date, d.contributionCount]),
  )
  for (let i = 1; i < days.length; i++) {
    assert.equal(Date.parse(days[i].date) - Date.parse(days[i - 1].date), DAY_MS, `a gap before ${days[i].date}`)
  }
  c.weeks.forEach((w, wi) =>
    w.forEach((d, di) => {
      if (d) assert.equal(new Date(d.date).getUTCDay(), di, `${d.date} sits in row ${di} of week ${wi}`)
    }),
  )
  // padding only before the first day and after the last
  const flat = c.weeks.flat()
  const first = flat.findIndex((d) => d !== null)
  const last = flat.findLastIndex((d) => d !== null)
  assert.ok(flat.slice(first, last + 1).every((d) => d !== null), 'a hole inside the year')
  assert.equal(days.reduce((n, d) => n + d.count, 0), c.total)
})

test('levels run 0–4, 0 exactly on an empty day, and rise with the count', () => {
  const days = parseContributions(recorded)!.weeks.flat().filter((d): d is Day => d !== null)
  for (const d of days) {
    assert.ok(Number.isInteger(d.level) && d.level >= 0 && d.level <= 4, `${d.date}: level ${d.level}`)
    assert.equal(d.level === 0, d.count === 0, `${d.date}: ${d.count} at level ${d.level}`)
  }
  const sorted = [...days].sort((a, b) => a.count - b.count)
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].level >= sorted[i - 1].level)
  const used = new Set(days.map((d) => d.level))
  assert.equal(used.size, 5, 'a real year uses every step of the ramp')
})

test('month labels advance week by week and name each month once in a row', () => {
  const { months, weeks } = parseContributions(recorded)!
  assert.ok(months.length >= 12 && months.length <= 13)
  for (let i = 1; i < months.length; i++) {
    assert.ok(months[i].week > months[i - 1].week)
    assert.notEqual(months[i].label, months[i - 1].label)
  }
  assert.ok(months.every((m) => m.week >= 0 && m.week < weeks.length))
})

test('the layout puts one square per day on the week × weekday grid', () => {
  const c = parseContributions(recorded)!
  const g = calendarLayout(c)
  assert.equal(g.weeks, c.weeks.length)
  assert.equal(g.cells.length, rawDays.length)
  assert.equal(g.width, g.weeks * STEP - (STEP - CELL))
  assert.equal(g.height, ROWS * STEP - (STEP - CELL))
  const seen = new Set<string>()
  c.weeks.forEach((w, wi) =>
    w.forEach((d, di) => {
      if (!d) return
      const cell = g.cells.find((x) => x.date === d.date)
      assert.ok(cell, `no square for ${d.date}`)
      assert.deepEqual([cell.x, cell.y, cell.level, cell.count], [wi * STEP, di * STEP, d.level, d.count])
      seen.add(`${cell.x},${cell.y}`)
    }),
  )
  assert.equal(seen.size, g.cells.length, 'two squares in one place')
  for (const cell of g.cells) {
    assert.ok(cell.x >= 0 && cell.x + CELL <= g.width && cell.y >= 0 && cell.y + CELL <= g.height)
  }
})

test('month labels that would overprint are dropped, the rest kept', () => {
  const c = parseContributions(recorded)!
  const { months } = calendarLayout(c)
  assert.ok(months.length >= 11, `only ${months.length} labels left`)
  for (const [i, m] of months.entries()) {
    const next = months[i + 1]?.week ?? c.weeks.length
    assert.ok(next - m.week >= LABEL_WEEKS, `${m.label} has ${next - m.week} weeks`)
    assert.ok(c.months.some((o) => o.label === m.label && o.week === m.week))
  }
})

test('a year that starts mid-week is padded at the front, and one that ends mid-week at the back', () => {
  // Wednesday 2 Jan 2030 → Tuesday 8 Jan: three slots before, then a week ending on Saturday
  const day = (date: string, n: number) => ({ date, contributionCount: n })
  const short: ApiResponse = {
    data: {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: 6,
            weeks: [
              { contributionDays: [day('2030-01-02', 1), day('2030-01-03', 0), day('2030-01-04', 2), day('2030-01-05', 0)] },
              { contributionDays: [day('2030-01-06', 3), day('2030-01-07', 0), day('2030-01-08', 0)] },
            ],
          },
        },
      },
    },
  }
  const c = parseContributions(short)!
  assert.deepEqual(c.weeks.map((w) => w.map((d) => d?.date.slice(8) ?? null)), [
    [null, null, null, '02', '03', '04', '05'],
    ['06', '07', '08', null, null, null, null],
  ])
  assert.equal(calendarLayout(c).cells[0].y, 3 * STEP)
})

test('GitHub errors and a missing user give no calendar', () => {
  assert.equal(parseContributions({ errors: [{ message: 'Bad credentials' }] }), null)
  assert.equal(parseContributions({ data: { user: null } }), null)
  assert.equal(parseContributions({}), null)
})

test('with no token, nothing is fetched and there is no calendar', async () => {
  delete process.env.GITHUB_TOKEN
  delete process.env.GITHUB_CONTRIB_FIXTURE
  globalThis.fetch = () => {
    throw new Error('fetched without a token')
  }
  assert.equal(await fetchContributions('aahil-khan'), null)
})

test('the fixture variable reads the recorded response in place of the network', async () => {
  delete process.env.GITHUB_TOKEN
  process.env.GITHUB_CONTRIB_FIXTURE = FIXTURE
  globalThis.fetch = () => {
    throw new Error('fetched with a fixture set')
  }
  assert.deepEqual(await fetchContributions('aahil-khan'), parseContributions(recorded))
})

test('the token goes only in the Authorization header to GitHub', async () => {
  delete process.env.GITHUB_CONTRIB_FIXTURE
  process.env.GITHUB_TOKEN = 'test-token-not-real'
  const calls: { url: string; init: RequestInit }[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(recorded), { status: 200 })
  }) as typeof fetch
  const c = await fetchContributions('aahil-khan')
  assert.equal(c?.total, calendar.totalContributions)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.github.com/graphql')
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'bearer test-token-not-real')
  assert.ok(!String(calls[0].init.body).includes('test-token-not-real'))
})

test('fill replaces the named slots and leaves unknown ones', () => {
  assert.equal(fill('{count} on {date}', { count: 3, date: '2026-01-02' }), '3 on 2026-01-02')
  assert.equal(fill('{total} and {nope}', { total: '5,115' }), '5,115 and {nope}')
})

/** A fetch that answers with the recorded response after `ms`, or when its signal aborts, rejects. */
function slowFetch(ms: number, { honourSignal = true } = {}) {
  const seen: { signal?: AbortSignal | null } = {}
  const f = ((_url: string, init: RequestInit) => {
    seen.signal = init.signal
    return new Promise<Response>((resolve, reject) => {
      const t = setTimeout(() => resolve(new Response(JSON.stringify(recorded), { status: 200 })), ms)
      if (honourSignal)
        init.signal?.addEventListener('abort', () => {
          clearTimeout(t)
          reject(init.signal!.reason)
        })
    })
  }) as unknown as typeof fetch
  return { f, seen }
}

test('the fetch gives up after about three seconds, so it cannot hold a render', () => {
  assert.equal(TIMEOUT_MS, 3000)
})

test('a GitHub slower than the timeout gives no calendar, promptly, and says so without the token', async () => {
  delete process.env.GITHUB_CONTRIB_FIXTURE
  process.env.GITHUB_TOKEN = 'test-token-not-real'
  const { f, seen } = slowFetch(2_000)
  globalThis.fetch = f
  const warned: string[] = []
  const warn = console.warn
  console.warn = (...a: unknown[]) => void warned.push(a.map(String).join(' '))
  try {
    const t0 = Date.now()
    assert.equal(await fetchContributions('aahil-khan', { timeoutMs: 60 }), null)
    const took = Date.now() - t0
    assert.ok(took < 1_000, `took ${took}ms`)
    assert.ok(seen.signal instanceof AbortSignal, 'the request carries a signal')
    assert.ok(seen.signal.aborted, 'the request is aborted, not left running')
  } finally {
    console.warn = warn
  }
  assert.equal(warned.length, 1)
  assert.match(warned[0], /took over 60ms/)
  assert.ok(!warned.join('').includes('test-token-not-real'))
})

test('the timeout holds even when the fetch ignores its signal', async () => {
  delete process.env.GITHUB_CONTRIB_FIXTURE
  process.env.GITHUB_TOKEN = 'test-token-not-real'
  globalThis.fetch = slowFetch(2_000, { honourSignal: false }).f
  const warn = console.warn
  console.warn = () => {}
  try {
    const t0 = Date.now()
    assert.equal(await fetchContributions('aahil-khan', { timeoutMs: 60 }), null)
    assert.ok(Date.now() - t0 < 1_000)
  } finally {
    console.warn = warn
  }
})

test('a GitHub inside the timeout gives the recorded calendar', async () => {
  delete process.env.GITHUB_CONTRIB_FIXTURE
  process.env.GITHUB_TOKEN = 'test-token-not-real'
  globalThis.fetch = slowFetch(10).f
  assert.deepEqual(await fetchContributions('aahil-khan', { timeoutMs: 1_000 }), parseContributions(recorded))
})

test("a day's sentence is GitHub's, with the count and an ordinal date", () => {
  const day = contributions.home.day
  assert.equal(daySentence(5, '2026-11-03', day), '5 contributions on November 3rd.')
  assert.equal(daySentence(0, '2026-01-01', day), 'No contributions on January 1st.')
  assert.equal(daySentence(1, '2026-02-22', day), '1 contribution on February 22nd.')
  assert.equal(daySentence(1234, '2026-12-12', day), '1,234 contributions on December 12th.')
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 30, 31].map(ordinal), [
    '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '30th', '31st',
  ])
  assert.equal(dayName('2026-09-30'), 'September 30th')
})

test('cellAt finds the square under a point, and nothing in a gap or past the edge', () => {
  assert.deepEqual(cellAt(0, 0, 53), { week: 0, day: 0 })
  assert.deepEqual(cellAt(CELL - 0.1, CELL - 0.1, 53), { week: 0, day: 0 })
  assert.equal(cellAt(CELL + 1, 0, 53), null, 'the gap after a square')
  assert.deepEqual(cellAt(STEP * 52 + 2, STEP * 6 + 2, 53), { week: 52, day: 6 })
  assert.equal(cellAt(STEP * 53 + 2, 0, 53), null, 'past the last week')
  assert.equal(cellAt(2, STEP * 7 + 2, 53), null, 'below Saturday')
  assert.equal(cellAt(-1, 2, 53), null)
  // every square the layout draws is found at its own centre
  const g = calendarLayout(parseContributions(recorded)!)
  for (const c of g.cells) {
    assert.deepEqual(cellAt(c.x + CELL / 2, c.y + CELL / 2, g.weeks), { week: c.x / STEP, day: c.y / STEP })
  }
})

test("the greens follow each theme's dark flag, and every dark theme is named", () => {
  const css = scaleCss(themes)
  const [light, ...dark] = css.split('}').filter(Boolean)
  assert.match(light, /^\.site \.contrib\{/)
  for (const [i, c] of GREENS.light.entries()) assert.ok(light.includes(`--c${i}:${c}`))
  assert.equal(dark.length, 1)
  for (const [i, c] of GREENS.dark.entries()) assert.ok(dark[0].includes(`--c${i}:${c}`))
  for (const t of themes) {
    assert.equal(dark[0].includes(`[data-theme="${t.id}"] `), t.dark, `${t.id} is ${t.dark ? 'dark' : 'light'}`)
  }
})
