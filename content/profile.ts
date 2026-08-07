import type { Profile } from './types'

/** Identity. The hero, the About card and the résumé page all read from here. */
export const profile: Profile = {
  name: 'Aahil Khan',
  initials: 'AK',
  resumePdf: '/aahil-khan-resume.pdf',
  role: { prefix: 'Full-stack &', emphasis: 'AI engineer' },
  location: 'Patiala, India',
  availability: 'open to work',
  email: 'aahilminookhan@gmail.com',
  intro:
    'I build production systems — scalable APIs, RAG pipelines and LLM-powered applications that actually ship.',
  note: 'Currently finishing a B.E. at Thapar and a Diploma at IIT Madras, simultaneously.',
  links: [
    { label: 'GitHub', href: 'https://github.com/aahil-khan' },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/aahil-khan' },
    { label: 'Email', href: 'mailto:aahilminookhan@gmail.com' },
  ],
}

/**
 * Numbers worth leading with. Shown as the stat strip on the Work card.
 * Keep this to three — it is a highlight reel, not a report.
 */
export const headlineStats = [
  { value: '1.26s', label: 'p50 latency' },
  { value: '10,000+', label: 'students served' },
  { value: '40%', label: 'fewer errors' },
] as const
