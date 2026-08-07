import type { Project } from './types'

/**
 * Selected work.
 *
 * To add a project: copy a block, change the fields, done. Order here doesn't matter —
 * the Work card sorts by `year` descending.
 *
 * `stack` entries must match a tool `name` in `stack.ts`. `npm run check` fails the build
 * if one doesn't, so a renamed tool can't silently lose its logo.
 */
export const projects: readonly Project[] = [
  {
    slug: 'flowsync',
    name: 'FlowSync AI',
    tagline: 'Project memory for coding agents, over MCP',
    year: 2025,
    kind: 'System',
    meta: '2025 · System · TypeScript, Python, AWS',
    lede: 'Persistent memory for coding agents, over the Model Context Protocol.',
    highlights: [
      'Gave coding agents persistent project context via **MCP**, so they stop re-learning the codebase every session.',
      'Built a **VS Code extension** and MCP server for context logging, project search, recent changes and a branch-aware RAG pipeline with vector retrieval.',
      'Event-driven async **AWS pipeline** extracting decisions, risks and tasks straight from git diffs using Bedrock models.',
      'Branch-aware RAG with DynamoDB caching: **1.26s** median push-to-search latency, **1.60s** p95.',
    ],
    stack: ['TypeScript', 'Python', 'AWS', 'DynamoDB', 'S3'],
  },
  {
    slug: 'konta',
    name: 'Konta',
    tagline: 'Local-first context-aware browsing',
    year: 2025,
    kind: 'Product',
    tag: 'Award',
    award: 'Winner — Samsung PRISM Web Agent Hackathon',
    meta: '2025 · Product · Local-first',
    lede: 'A Chrome extension that turns your browsing into a private, on-device knowledge base.',
    highlights: [
      '**Local-first**: nothing leaves the machine. Semantic embeddings run on-device.',
      'Multi-stage retrieval pipeline for private, low-latency search.',
      '**Knowledge graph** linking pages by semantic, temporal and contextual relationships.',
      'Sessionization with context-boundary detection, so unrelated browsing tasks never merge.',
    ],
    stack: ['React', 'TypeScript'],
  },
  {
    slug: 'gina',
    name: 'GINA',
    tagline: 'Natural language → SQL analytics',
    year: 2025,
    kind: 'Research',
    meta: '2025 · Research · NL → SQL',
    lede: 'Grounded insights from natural-language analytics.',
    highlights: [
      'Multi-model **NL→SQL** pipeline for conversational data analytics with structured outputs.',
      '**SSE streaming** with fast-path routing (snapshot + cache restore) for latency and transparency.',
      'Context-aware multi-turn handling using structured conversation state, so follow-ups stay grounded.',
      'Semantic schema-correction loops and failure-tolerant API/SSE error handling.',
    ],
    stack: ['Next.js', 'Fastify', 'PostgreSQL'],
  },
  {
    slug: 'portana',
    name: 'Portana',
    tagline: 'AI-powered interactive portfolio',
    year: 2025,
    kind: 'Product',
    meta: '2025 · Product · The previous version of this site',
    lede: 'A conversational portfolio you could interrogate instead of scroll.',
    highlights: [
      '**AI-driven** portfolio platform with conversational project exploration.',
      'Modular API routes enabling real-time rendering.',
      '**n8n**-based auto-sync workflows for GitHub and LinkedIn, keeping content current without edits.',
      'Analytics and monitoring for usage and system behaviour.',
    ],
    stack: ['Next.js', 'Fastify', 'Qdrant', 'Docker'],
  },
]
