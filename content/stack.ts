import type { ToolGroup } from './types'

/**
 * The toolbox, grouped as it appears on the Stack card.
 *
 * `logo` is a path under `public/`. Omit it and the tile renders a coloured initial —
 * which is the honest option when no asset is shipped, and better than borrowing a
 * near-enough logo from another tool.
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
      { name: 'TypeScript' },
      { name: 'JavaScript', logo: '/logos/javascript-original.svg' },
    ],
  },
  {
    label: 'Backend',
    tools: [
      { name: 'Node.js', logo: '/logos/nodejs-original.svg' },
      { name: 'Express', logo: '/logos/express-original.svg' },
      { name: 'Fastify' },
      { name: 'FastAPI' },
      { name: 'Flask', logo: '/logos/flask-original.svg' },
    ],
  },
  {
    label: 'Frontend',
    tools: [
      { name: 'React', logo: '/logos/react-original.svg' },
      { name: 'Next.js', logo: '/logos/nextjs-original.svg' },
      { name: 'Tailwind', logo: '/logos/tailwindcss-original.svg' },
    ],
  },
  {
    label: 'Data',
    tools: [
      { name: 'PostgreSQL', logo: '/logos/postgresql-original.svg' },
      { name: 'MySQL', logo: '/logos/mysql-original.svg' },
      { name: 'Redis', logo: '/logos/redis-original.svg' },
      { name: 'Prisma', logo: '/logos/prisma-original.svg' },
      { name: 'Qdrant', logo: '/logos/qdrant.png', invert: true },
      { name: 'DynamoDB' },
      { name: 'S3' },
    ],
  },
  {
    label: 'Cloud & ops',
    tools: [
      { name: 'AWS', logo: '/logos/amazonwebservices-original-wordmark.svg' },
      { name: 'Docker', logo: '/logos/docker-original.svg' },
      { name: 'GitHub Actions', logo: '/logos/github-original.svg' },
      { name: 'Nginx' },
    ],
  },
  {
    label: 'Testing',
    tools: [
      { name: 'Jest', logo: '/logos/jest-plain.svg' },
      { name: 'Postman', logo: '/logos/postman-original.svg' },
      { name: 'Vitest' },
    ],
  },
]

/** Flat lookup, so a project's `stack` entry can find its logo. */
export const toolsByName = new Map(
  toolGroups.flatMap((g) => g.tools.map((t) => [t.name, t] as const)),
)
