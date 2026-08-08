import type { ToolGroup } from './types'

/**
 * The toolbox, grouped as it appears on the Stack card.
 *
 * `logo` is a path under `public/`. Omit it and the tile renders as text alone. A coloured
 * initial used to stand in, but "L" served both LLM APIs and LangGraph and read as a broken
 * image rather than a considered absence — several of these are capabilities, not products,
 * and have no mark to show.
 *
 * S3 and DynamoDB carry the AWS wordmark. That is their own parent brand rather than a
 * near-enough logo borrowed from an unrelated tool, which is still the line.
 *
 * `invert: true` is for assets that ship white-on-transparent for dark UIs. This site is
 * light, so those need inverting. Run `npm run check` to detect new ones automatically —
 * it measures each asset's luminance rather than trusting a hand-maintained flag.
 */
export const toolGroups: readonly ToolGroup[] = [
  {
    label: 'Languages',
    tools: [
      { name: 'Python', logo: '/logos/python-original.svg' },
      { name: 'TypeScript', logo: '/logos/Typescript.svg' },
      { name: 'JavaScript', logo: '/logos/javascript-original.svg' },
    ],
  },
  {
    label: 'Frameworks',
    tools: [
      { name: 'React', logo: '/logos/react-original.svg' },
      { name: 'Next.js', logo: '/logos/nextjs-original.svg' },
      { name: 'Node.js', logo: '/logos/nodejs-original.svg' },
      { name: 'Express.js', logo: '/logos/express-original.svg' },
      { name: 'FastAPI', logo: '/logos/FastAPI.svg' },
    ],
  },
  {
    label: 'Databases',
    tools: [
      { name: 'PostgreSQL', logo: '/logos/postgresql-original.svg' },
      { name: 'MySQL', logo: '/logos/mysql-original.svg' },
      { name: 'Redis', logo: '/logos/redis-original.svg' },
      { name: 'DynamoDB', logo: '/logos/amazonwebservices-original-wordmark.svg' },
      { name: 'Prisma', logo: '/logos/prisma-original.svg' },
    ],
  },
  {
    label: 'Cloud & DevOps',
    tools: [
      { name: 'AWS', logo: '/logos/amazonwebservices-original-wordmark.svg' },
      { name: 'Docker', logo: '/logos/docker-original.svg' },
      { name: 'Git', logo: '/logos/git-original.svg' },
      { name: 'GitHub Actions', logo: '/logos/github-original.svg' },
      { name: 'S3', logo: '/logos/amazonwebservices-original-wordmark.svg' },
    ],
  },
  {
    label: 'AI/ML',
    tools: [
      { name: 'LLM APIs' },
      { name: 'LangGraph' },
      { name: 'RAG pipelines' },
      { name: 'Vector embeddings' },
      { name: 'Semantic search' },
    ],
  },
  {
    label: 'Testing',
    tools: [
      { name: 'Jest', logo: '/logos/jest-plain.svg' },
      { name: 'Vitest', logo: '/logos/Vitest.svg' },
    ],
  },
]

/** Flat lookup, so a project's `stack` entry can find its logo. */
export const toolsByName = new Map(
  toolGroups.flatMap((g) => g.tools.map((t) => [t.name, t] as const)),
)
