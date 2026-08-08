import type { Profile } from './types'

/** Identity. The hero, the About card and the résumé page all read from here. */
export const profile: Profile = {
  name: 'Aahil Khan',
  initials: 'AK',
  resumePdf: '/aahil-khan-resume.pdf',
  role: { prefix: 'Full-stack engineer,', emphasis: 'AI retrieval & agents' },
  location: 'Patiala, India',
  availability: 'open to work',
  email: 'aahilminookhan@gmail.com',
  intro:
    'I build AI retrieval and agent infrastructure — RAG pipelines, multi-agent systems and MCP tooling — with a soft spot for systems that can prove they got the answer right, instead of merely sounding like it.',
  notes: [
    'That means deterministic verdicts backed by retrieved evidence, audit trails that can show nothing was quietly edited, and evaluation harnesses that catch a regression before it ships.',
    'Final-year Computer Engineering at Thapar, with an IIT Madras programming diploma running alongside it — two courseloads at once, which was either ambitious or a scheduling error.',
    'Right now I split my time between two internships: production AI systems at Zariya AI, and accent-invariant speech research with Samsung PRISM.',
  ],
  links: [
    { label: 'GitHub', href: 'https://github.com/aahil-khan' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/aahil-khan77/' },
    { label: 'Email', href: 'mailto:aahilminookhan@gmail.com' },
  ],
}

/**
 * Numbers worth leading with. Shown as the stat strip on the Work card.
 * Keep this to three — it is a highlight reel, not a report.
 */
export const headlineStats = [
  { value: '44.5% → 0%', label: 'missed hazards' },
  { value: '15,000+', label: 'students served' },
  { value: '1.26s', label: 'p50 retrieval' },
] as const
