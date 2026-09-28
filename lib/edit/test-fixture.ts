import type { ContentSet } from '../../content/schema/index.ts'
import { site } from '../../content/site.ts'

/** The smallest content set that is valid. Each test breaks exactly one thing in a copy of it. */
export function fixture(): ContentSet {
  return {
    profile: {
      profile: {
        name: 'A',
        initials: 'A',
        role: { prefix: 'Engineer,', emphasis: 'AI' },
        location: 'Earth',
        availability: '',
        email: 'a@b.c',
        intro: 'Hi.',
        links: [{ label: 'GitHub', href: 'https://github.com/a' }],
        resumePdf: '/cv.pdf',
      },
      headlineStats: [
        { value: '9.1', label: 'cgpa' },
        { derived: 'wins', label: 'wins' },
      ],
    },
    projects: [
      {
        slug: 'p1',
        name: 'P1',
        tagline: 't',
        year: 2025,
        kind: 'System',
        lede: 'l',
        highlights: ['h'],
        stack: ['Python'],
        images: ['/work/p1-1.webp'],
        links: [{ label: 'Repo', href: 'https://github.com/a/p1' }],
      },
    ],
    experience: {
      jobs: [
        {
          slug: 'j1',
          role: 'r',
          company: 'c',
          period: '2025',
          year: 2025,
          lede: 'l',
          highlights: ['h'],
          stack: ['Python'],
        },
      ],
      education: [{ institution: 'i', degree: 'd', detail: 'x' }],
      awards: [{ title: 'Winner', event: 'E' }],
    },
    archive: [{ id: 'a1', kind: 'built', title: 'T', when: 'now' }],
    now: { updated: '2026-08', lede: 'l', items: [{ label: 'L', what: 'w' }], foot: '' },
    writing: [{ slug: 'w1', title: 't', blurb: 'b', year: 2025, readingTime: '1 min', href: 'https://x.dev' }],
    stack: [{ label: 'Languages', tools: [{ name: 'Python', logo: '/logos/py.svg' }] }],
    site: structuredClone(site),
  }
}


/** The public/ files the fixture references. */
export const FIXTURE_FILES = ['/work/p1-1.webp', '/cv.pdf', '/logos/py.svg']
