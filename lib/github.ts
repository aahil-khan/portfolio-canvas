/**
 * The GitHub contribution calendar.
 *
 * SERVER ONLY — reads `GITHUB_TOKEN`, which is never logged or sent anywhere but GitHub. Called
 * from `buildCards()` (the canvas card) and from the front page's Work section, both during render
 * on the server, so the finished grid ships as HTML: no client JS, no loading state, and a height
 * that is already correct when MeasureRig measures it.
 *
 * The calendar is not in GitHub's REST API — it only exists in GraphQL, and that endpoint
 * requires auth even for public data. Without a token this returns null and the card renders an
 * honest empty state rather than a skeleton that never resolves.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

const ENDPOINT = 'https://api.github.com/graphql'

/** One hour. The graph changes at most a few times a day; this is well inside GitHub's limits. */
const REVALIDATE = 3600

export interface Day {
  date: string
  count: number
  /** 0-4, the five steps of the colour ramp. */
  level: number
}

export interface Contributions {
  total: number
  /**
   * ~53 weeks, oldest first, each exactly 7 slots running Sunday to Saturday.
   *
   * GitHub returns the first and last weeks short when the year doesn't start on a Sunday. The
   * grid flows column by column, so a 5-day week there would shunt every later day up two rows
   * and skew the whole calendar. Missing slots are `null` and render as a gap.
   */
  weeks: (Day | null)[][]
  /** Index of the first week of each month, for the labels above the grid. */
  months: { label: string; week: number }[]
}

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { date contributionCount }
        }
      }
    }
  }
}`

export interface ApiResponse {
  data?: {
    user?: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number
          weeks: { contributionDays: { date: string; contributionCount: number }[] }[]
        }
      }
    } | null
  }
  errors?: { message: string }[]
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Thresholds for the four active ramp steps, as quartiles of the ACTIVE days.
 *
 * Scaling off the busiest day is the obvious approach and it looks terrible on real data: one
 * 90-commit outlier put 124 of 144 active days into the faintest shade and left the graph
 * reading as binary. Quartiles of the distribution spread the days evenly across the four
 * shades regardless of how lopsided the year was — which is what GitHub's own graph does.
 *
 * Fixed cutoffs are worse again: they make a quiet year look empty and a busy one uniformly
 * maxed.
 */
function thresholds(counts: number[]): [number, number, number] {
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b)
  if (!active.length) return [1, 2, 3]
  const at = (p: number) => active[Math.min(active.length - 1, Math.floor(active.length * p))]
  return [at(0.25), at(0.5), at(0.75)]
}

/** Any non-zero day is at least level 1, so a day you did something on is never blank. */
function levelFor(count: number, [t1, t2, t3]: [number, number, number]): number {
  if (count <= 0) return 0
  if (count > t3) return 4
  if (count > t2) return 3
  if (count > t1) return 2
  return 1
}

/**
 * A recorded GraphQL response to read in place of the network, for tests, `check:lab` rule GH and
 * screenshots. A path to a JSON file holding exactly what the endpoint returns. Never set on a
 * deploy: it exists so the calendar can be proved without a token anywhere near a test run.
 */
const FIXTURE_ENV = 'GITHUB_CONTRIB_FIXTURE'

/**
 * How long the fetch may hold a render. GitHub's calendar query is usually well under a second,
 * but a cold one has taken long enough that `/`'s first request after a deploy ran past 20s. After
 * this the calendar is null, as with no token: `/` renders without the block, the canvas card shows
 * its empty state, nothing is cached for the failure, and the next revalidation tries again.
 */
export const TIMEOUT_MS = 3000

export async function fetchContributions(
  login: string,
  { timeoutMs = TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<Contributions | null> {
  const fixture = process.env[FIXTURE_ENV]
  if (fixture) return readFixture(fixture)

  const token = process.env.GITHUB_TOKEN
  if (!token) return null

  // the signal stops the request and its body; the race holds even where a fetch ignores it
  // (Next drops the signal from a background revalidation)
  const signal = AbortSignal.timeout(timeoutMs)
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<'late'>((resolve) => {
    timer = setTimeout(() => resolve('late'), timeoutMs)
  })

  const request = async (): Promise<ApiResponse | null> => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
        // GitHub rejects API requests without one
        'User-Agent': 'portfolio-canvas',
      },
      body: JSON.stringify({ query: QUERY, variables: { login } }),
      signal,
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) {
      console.warn(`[github] contributions failed: ${res.status}`)
      return null
    }
    return (await res.json()) as ApiResponse
  }

  let json: ApiResponse | null
  try {
    const won = await Promise.race([request(), late])
    if (won === 'late') {
      console.warn(`[github] contributions took over ${timeoutMs}ms; rendering without them`)
      return null
    }
    json = won
  } catch (err) {
    // an abort lands here too, if it beats the timer by a tick; never print the request itself
    const name = err instanceof Error ? err.name : 'Error'
    if (name === 'TimeoutError' || name === 'AbortError') {
      console.warn(`[github] contributions took over ${timeoutMs}ms; rendering without them`)
    } else {
      console.warn('[github] contributions threw:', err instanceof Error ? err.message : String(err))
    }
    return null
  } finally {
    clearTimeout(timer)
  }

  return json && parseContributions(json)
}

async function readFixture(file: string): Promise<Contributions | null> {
  return parseContributions(JSON.parse(await readFile(path.resolve(file), 'utf8')) as ApiResponse)
}

/**
 * The GraphQL response, as the calendar both surfaces draw: padded weeks, ramp levels, month
 * labels. Pure, so a recorded response can be checked without a network or a token.
 */
export function parseContributions(json: ApiResponse): Contributions | null {
  if (json.errors?.length) {
    console.warn('[github] contributions errors:', json.errors.map((e) => e.message).join('; '))
    return null
  }

  const cal = json.data?.user?.contributionsCollection?.contributionCalendar
  if (!cal) return null

  const raw = cal.weeks.map((w) =>
    w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
  )
  const cuts = thresholds(raw.flat().map((d) => d.count))
  const weeks: (Day | null)[][] = raw.map((w, wi) => {
    const days: (Day | null)[] = w.map((d) => ({ ...d, level: levelFor(d.count, cuts) }))
    if (days.length === 7 || days.length === 0) return days
    // a short first week is missing days at the START; any other short week, at the end
    if (wi === 0) {
      const weekday = new Date(w[0].date).getUTCDay()
      return [...Array<null>(weekday).fill(null), ...days]
    }
    return [...days, ...Array<null>(7 - days.length).fill(null)]
  })

  // one label per month, positioned at the first week that month appears in
  const months: { label: string; week: number }[] = []
  weeks.forEach((week, i) => {
    const first = week.find((d): d is Day => d !== null)
    if (!first) return
    const m = new Date(first.date).getUTCMonth()
    const label = MONTH[m]
    if (months.length === 0 || months[months.length - 1].label !== label) {
      months.push({ label, week: i })
    }
  })

  return { total: cal.totalContributions, weeks, months }
}
