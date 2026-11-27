import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, test } from 'node:test'

import { calendarLayout, CELL, fill, LABEL_WEEKS, ROWS, STEP } from './contrib-grid.ts'
import { type ApiResponse, type Day, fetchContributions, parseContributions } from './github.ts'

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
