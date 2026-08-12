import type { Profile } from './types'

/** Identity. The hero, the About card and the résumé page all read from here. */
export const profile: Profile = {
  name: 'Aahil Khan',
  initials: 'AK',
  resumePdf: '/aahil-khan-resume.pdf',
  portrait: '/pfp/main.jpeg',
  portraitHidden: '/pfp/hidden.jpeg',
  role: { prefix: 'Full-stack engineer,', emphasis: 'AI retrieval & agents' },
  location: 'Bareilly, India',
  availability: '',
  email: 'aahilminookhan@gmail.com',
  intro:
    'I build AI stuff and anything else I find interesting, RAG pipelines, multi agent systems, Full Stack apps, and generally anything that looks shiny at 2AM in the morning :)',
  notes: [
    'Final year Computer Engineering at Thapar, with an IIT Madras Diploma in Programming under my belt, because apparently one courseload wasn\'t enough',
    'Right now I split my time between two internships: building production AI systems at Oddmind Innovations, and working on accent invariant speech research with Samsung PRISM',
    'I like building things, breaking them, and occasionally wondering why I decided to build them in the first place',
  ],

  /**
   * The About card's closing line, on the canvas only.
   *
   * `notes` above is biography, and all three surfaces render it — the canvas card, `/resume`
   * and the front page. This line is not biography: it invites you to use the Notes card, which
   * only exists on the canvas. On the other two it was asking people to leave a note on a page
   * with nowhere to leave one.
   */
  deskWelcome: 'Almost forgot, Welcome to the site! Leave a note if you like it :D',
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
  { value: '9.16', label: 'cgpa' },
  { value: '2', label: 'wins' },
  { value: '3', label: 'domains' },
] as const
