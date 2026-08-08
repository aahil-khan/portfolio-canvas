import type { Education, Job } from './types'

/** Roles. Sorted by `year` descending in the Experience card. */
export const jobs: readonly Job[] = [
  {
    slug: 'samsung-prism',
    role: 'Research Intern',
    company: 'Samsung PRISM',
    period: 'Jul 2026 – present',
    year: 2026,
    meta: 'Samsung PRISM · Remote · Jul 2026 – present',
    lede: 'Teaching multilingual SpeechLLMs to cope with accents they were never really trained on.',
    highlights: [
      'Work-let: **accent-invariant representation learning** for SpeechLLMs, mentored by Dr. Spandan Dey and Hirak Mondal.',
      'Reproducing and benchmarking baseline multilingual pipelines — **SALM, Qwen-Audio, SALMONN** — then running accent failure analysis to find which accents actually break, and why.',
      'Building parameter-efficient adaptation: **LoRA adapters**, accent-aware front-end encoders and MoE dynamic adapter routing — better ASR/AST on accented and low-resource speech, without retraining the whole model.',
      'Closure deliverable is a **peer-reviewed publication**, so the bar here is a paper rather than a demo.',
    ],
    stack: ['Python'],
  },
  {
    slug: 'zariya',
    role: 'Full Stack AI Intern',
    company: 'Recruit by Zariya AI',
    period: 'Apr 2026 – present',
    year: 2026,
    meta: 'Recruit by Zariya AI · Bangalore, remote · Apr 2026 – present',
    lede: 'Building an AI interview platform end to end — frontend, backend and the realtime layer.',
    highlights: [
      'Shipping across the frontend, backend and **LiveKit** service: custom interviews, realtime sessions and recruiter workflows.',
      'Built audio interview **evaluation pipelines** on AWS S3 and the Gemini Files API, storing structured scores, recording metadata and recruiter-facing report data.',
      'Added **versioned prompt templates** with centralised resolution logic, so changing a prompt stops being a find-and-replace across the codebase.',
      'Recruiter pipeline tooling with server-side filtering and candidate workflow management.',
    ],
    stack: ['Next.js', 'React', 'TypeScript', 'Node.js', 'Prisma', 'S3', 'LiveKit', 'Gemini'],
  },
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
      'Secure authentication, multi-user support and **savepoints**, so partial work resumes instead of starting over.',
      'Improved the generation workflow, cutting scheduling errors by **40%**.',
      'Integrated with **Oracle PeopleSoft** to automate structured data ingestion and export between the legacy system and the new one.',
    ],
    stack: ['Flask', 'MySQL', 'Python'],
  },
  {
    slug: 'edutube',
    role: 'Team Lead / Full-stack',
    company: 'Thapar EduTube',
    period: 'Oct 2024 – Jan 2025',
    year: 2024,
    meta: 'Thapar EduTube · Patiala · Oct 2024 – Jan 2025',
    lede: 'Led 3 engineers building a lecture archival platform for **15,000+** students.',
    highlights: [
      'Backend APIs and dashboards for lecture uploads, metadata management, access control and search.',
      'Built a **CLI sync tool** for local lecture management with automated YouTube uploads and diff-based updates, which took a large bite out of upload times.',
      'Evaluated Elasticsearch against **PostgreSQL full-text search** and migrated the search infrastructure — less operational complexity, same performance.',
      'Used **k6 load testing** and deployment tuning to hold up under concurrent traffic on college-hosted Linux servers.',
    ],
    stack: ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'Docker', 'AWS'],
  },
]

/** Shown as quieter rows beneath the roles. */
export const education: readonly Education[] = [
  {
    institution: 'Thapar Institute of Engineering & Technology',
    degree: 'B.E. Computer Engineering',
    detail: 'CGPA 9.16 · Aug 2023 – present',
  },
  {
    institution: 'Indian Institute of Technology Madras',
    degree: 'Diploma in Programming',
    detail: 'CGPA 8.34 · Sept 2023 – Sept 2025',
  },
]

/** Standalone awards. Project-specific ones live on the project itself. */
export const awards = [
  { title: 'Winner', event: 'Samsung PRISM Web Agent Hackathon' },
  { title: 'Innovation Award', event: 'Agentic AI Hackathon, Ulster University (UK)' },
] as const
