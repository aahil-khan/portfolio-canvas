/*
 * prototype/lab/night-mode/series.js: the research shelf's one series, THE RELIABILITY STUDY.
 *
 * ── SAMPLE CONTENT: PLACEHOLDER ─────────────────────────────────────────────────────────────
 * None of this is Aahil's writing, and none of these measurements happened. It exists so the
 * series hub, the thread banner, the progress bar and the read / listen totals can be judged
 * with something in them. Every page that shows it carries the "sample content: placeholder"
 * banner (copy.js: series.sample), and check.mjs fails if one doesn't.
 *
 * In the React build this becomes a `kind: "series"` entry in content/data/lab.json with one
 * level of `chapters[]` (research.md §4), with bodies in content/lab/**.md.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NIGHT = (root_.NIGHT = root_.NIGHT || {})
  NIGHT.series = [
    {
      slug: 'reliability-study',
      title: 'the reliability study',
      question: 'what breaks first when an old laptop runs as a home server for a year?',
      status: 'ongoing',
      started: '2026-09',
      updated: '2026-11',
      planned: 6,
      placeholder: true,
      chapters: [
        {
          n: 1, slug: 'reliability-study-01', title: 'baseline: what normal looks like', date: '2026-09', status: 'final',
          body: `## the setup

The study follows one machine: the laptop that already runs everything at home. It has a quad-core i5, sixteen gigabytes of memory, two solid state drives and a battery that is older than some of the services on it. Nothing about it is special, which is the point.

Before anything can be said to break, normal has to be written down. For the first four weeks the plan was to change nothing and measure everything: temperatures, disk health counters, memory pressure, how long each container takes to answer, and every reboot with its reason.

## what gets measured

A small script samples the sensors once a minute and appends a line to a log. Disk counters are read once an hour, because reading them more often makes some drives unhappy. Every service gets a health check from a second machine, so a check never passes just because the box is talking to itself.

## what normal turned out to be

Normal is quieter than expected. The processor idles near forty degrees and climbs past seventy only during builds. Memory sits at about half, with the page cache taking whatever is left. The two drives report no reallocated sectors at all.

The one surprise is the battery. It charges to full, discharges a little overnight, and charges again, every single day. That cycle is the first thing on the watch list for chapter two.`,
        },
        {
          n: 2, slug: 'reliability-study-02', title: 'the first disk warning', date: '2026-10', status: 'final',
          body: `## the counter that moved

Six weeks in, one number changed. The second drive reported a single uncorrectable read, logged as attribute 187. One is not many, but the baseline said zero, and the whole study exists to notice exactly this kind of quiet change.

## what was tried

The first step was to do nothing for a week and see whether the number moved again. It did not. The second step was a full read of the drive, end to end, which took most of a night and found nothing new.

The third step was the honest one: checking which services wrote to that drive, and how much. The answer was a logging container that had been writing every debug line it could find, about nine gigabytes a day, for a month.

## what changed

The logging was turned down, the drive now gets a weekly check instead of an hourly glance, and the backups were moved so they no longer land on the same disk they protect.

The counter still says one. Chapter three goes looking for the other thing a closet does to a laptop: heat.`,
        },
        {
          n: 3, slug: 'reliability-study-03', title: 'power, heat and the closet', date: '2026-11', status: 'draft',
          body: `## moving it

The laptop moved from a desk to a closet shelf, because the fan is audible at night. The closet has no window, one door and a shelf of towels. Every number in this chapter comes from the two weeks either side of that move.

## heat

Idle temperature rose by about six degrees. Under a build it now touches eighty-five, and twice the processor slowed itself down to stay below the limit. Nothing failed, but builds took a fifth longer, which is the kind of cost that never shows up as an error.

## power

The house loses power a few times a month. The battery covers short cuts, and the services come back on their own, which chapter one made sure of. What the closet changed is the battery itself: warmer charging cycles age it faster, and its reported capacity has started to fall.

## so far

Three chapters in, the pattern is that nothing has broken outright. Things have drifted: a counter, a temperature, a capacity. The next chapters are about whether drift becomes failure, and how early it can be seen.`,
        },
      ],
      // the chapters still to come, shown as empty slots on the hub
      next: ['the battery, measured properly', 'a year of uptime, honestly counted', 'what i would build differently'],
    },
  ]
})()
