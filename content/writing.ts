import type { Post } from './types'

/** Posts. Sorted by `year` descending in the Writing card. */
export const posts: readonly Post[] = [
  {
    slug: 'chrome-hackathon',
    title: 'Chrome Already Built Our Idea.',
    blurb: 'We won the hackathon anyway.',
    year: 2026,
    readingTime: '6 min',
    href: 'https://medium.com/@aahilminookhan',
  },
  {
    slug: 'old-laptop-cloud',
    title: 'An Old Laptop as a Cloud Server',
    blurb: 'Self-hosting, end to end.',
    year: 2025,
    readingTime: '8 min',
    href: 'https://medium.com/@aahilminookhan',
  },
]
