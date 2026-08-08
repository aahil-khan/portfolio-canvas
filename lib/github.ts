/**
 * The GitHub contribution calendar.
 *
 * SERVER ONLY — reads `GITHUB_TOKEN`. Called from `buildCards()`, which runs during render on
 * the server, so the finished grid ships as HTML: no client JS, no loading state, and a height
 * that is already correct when MeasureRig measures it.
 *
 * The calendar is not in GitHub's REST API — it only exists in GraphQL, and that endpoint
 * requires auth even for public data. Without a token this returns null and the card renders an
 * honest empty state rather than a skeleton that never resolves.
 */

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

interface ApiResponse {
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
 * Buckets counts into the five ramp steps.
 *
 * Thresholds come from the busiest day rather than fixed numbers: a fixed scale makes a quiet
 * year look empty and a busy one look uniformly maxed. Any non-zero day is at least level 1, so
 * a day you did something on never renders as a blank square.
 */
function levelFor(count: number, max: number): number {
  if (count <= 0) return 0
  if (max <= 1) return 1
  const q = count / max
  if (q > 0.75) return 4
  if (q > 0.5) return 3
  if (q > 0.25) return 2
  return 1
}

export async function fetchContributions(login: string): Promise<Contributions | null> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return null

  let json: ApiResponse
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
        // GitHub rejects API requests without one
        'User-Agent': 'portfolio-canvas',
      },
      body: JSON.stringify({ query: QUERY, variables: { login } }),
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) {
      console.warn(`[github] contributions failed: ${res.status}`)
      return null
    }
    json = (await res.json()) as ApiResponse
  } catch (err) {
    console.warn('[github] contributions threw:', err)
    return null
  }

  if (json.errors?.length) {
    console.warn('[github] contributions errors:', json.errors.map((e) => e.message).join('; '))
    return null
  }

  const cal = json.data?.user?.contributionsCollection?.contributionCalendar
  if (!cal) return null

  const raw = cal.weeks.map((w) =>
    w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
  )
  const max = Math.max(1, ...raw.flat().map((d) => d.count))
  const weeks: (Day | null)[][] = raw.map((w, wi) => {
    const days: (Day | null)[] = w.map((d) => ({ ...d, level: levelFor(d.count, max) }))
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
