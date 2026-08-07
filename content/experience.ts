import type { Education, Job } from './types'

/** Roles. Sorted by `year` descending in the Experience card. */
export const jobs: readonly Job[] = [
  {
    slug: 'datesheet',
    role: 'Backend Engineer',
    company: 'Datesheet Generator',
    period: 'Mar – Jul 2025',
    year: 2025,
    meta: 'Datesheet Generator · Thapar University · Mar – Jul 2025',
    lede: "Re-architected an exam scheduling system that couldn't survive a page refresh.",
    highlights: [
      'Moved from **session-based state to a persistent MySQL-backed workflow** — the core fix.',
      'Secure login, multi-user support and **savepoints**, so partial work resumes instead of restarting.',
      'Improved generation workflows, cutting scheduling errors by **40%**.',
      'Integrated with **Oracle PeopleSoft** to automate structured data ingestion and export.',
    ],
    stack: ['Flask', 'MySQL', 'Python'],
  },
  {
    slug: 'edutube',
    role: 'Team Lead / Full-stack',
    company: 'Thapar EduTube',
    period: 'Oct 2024 – Jan 2025',
    year: 2024,
    meta: 'Thapar EduTube · Oct 2024 – Jan 2025',
    lede: 'Led 3 engineers building a lecture platform for **10,000+** students.',
    highlights: [
      'Designed backend APIs for lecture ingestion, metadata management, full-text search and access control.',
      'Built full-stack admin and teacher dashboards for uploads, course management and workflow customisation.',
      'Chose **PostgreSQL FTS over Elasticsearch** after evaluating both — optimising for latency *and* operational simplicity.',
      'Deployed and operated production services on **AWS EC2** with Docker, reliable enough for daily academic use.',
    ],
    stack: ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'Docker', 'AWS'],
  },
]

/** Shown as quieter rows beneath the roles. */
export const education: readonly Education[] = [
  {
    institution: 'Thapar Institute of Engineering & Technology',
    degree: 'B.E. Computer Engineering',
    detail: 'CGPA 9.23 · Aug 2023 – present',
  },
  {
    institution: 'Indian Institute of Technology Madras',
    degree: 'Diploma in Programming',
    detail: 'CGPA 8.34 · Sept 2023 – present',
  },
]

/** Standalone awards. Project-specific ones live on the project itself. */
export const awards = [
  { title: 'Winner', event: 'Samsung PRISM Web Agent Hackathon' },
  { title: 'Innovation Award', event: 'Agentic AI Hackathon, Ulster University (UK)' },
] as const
