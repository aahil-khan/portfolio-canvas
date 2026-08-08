import type { Project } from './types'

/**
 * Selected work.
 *
 * To add a project: copy a block, change the fields, done. Order here doesn't matter —
 * the Work card sorts by `year` descending.
 *
 * Screenshots: drop files in `public/work/` and list them in `images`, in order. One image
 * renders as a plain frame; two or more become a carousel with arrows, dots and a counter. The
 * first image sets the frame's shape and the rest are letterboxed into it, so nothing is ever
 * cropped. Dimensions are read from the files at build time — no sizes to type.
 *
 * `stack` entries must match a tool `name` in `stack.ts`. `npm run check` fails the build
 * if one doesn't, so a renamed tool can't silently lose its logo.
 */
export const projects: readonly Project[] = [
  {
    slug: 'sop-opera',
    name: 'SOP Opera',
    tagline: 'Agentic industrial safety intelligence',
    year: 2026,
    kind: 'System',
    meta: '2026 · System · Python, LangGraph, pgvector',
    lede: 'A compound-risk engine that catches the hazard no single sensor is looking for.',
    highlights: [
      'Fuses gas readings, work permits, isolation state and worker location into **hazard pathways** — the danger that only exists when four boring facts line up.',
      'Cut the false-negative rate from **44.5% to 0%** across 593 statutorily-labelled cases, and alarms **28 minutes** before a conventional single-sensor threshold fires.',
      '**LangGraph** multi-agent assessment pipeline with conditional agent fan-out and hybrid pgvector/SQL retrieval over a clause-level regulatory corpus.',
      'The risk verdict stays **fully deterministic**, and every generated citation is validated against the evidence it was retrieved from — no confidently invented regulations.',
      'Durable Postgres job queue plus a non-blocking **WebSocket** layer with per-client backpressure, so a slow browser never stalls the pipeline.',
      'Hash-chained, **tamper-evident audit trail**: edit or reorder a recorded safety decision and the verification endpoint names the exact sequence where it happened.',
    ],
    stack: ['Python', 'TypeScript', 'FastAPI', 'LangGraph', 'PostgreSQL', 'Next.js', 'Docker'],
  },
  {
    slug: 'flowsync',
    name: 'FlowSync AI',
    tagline: 'Project memory for coding agents, over MCP',
    year: 2025,
    kind: 'System',
    meta: '2025 · System · TypeScript, Python, AWS',
    lede: 'Persistent memory for coding agents, so they stop re-learning your codebase every session.',
    highlights: [
      'Gives coding agents durable project context via the **Model Context Protocol**.',
      'A **VS Code extension** and MCP server for context logging, project search, recent changes and branch-aware RAG retrieval.',
      'Event-driven async **AWS pipeline** that reads git diffs with Bedrock models and pulls out the decisions, risks and tasks hiding in them.',
      'Branch-aware RAG with DynamoDB caching: **1.26s** median push-to-search latency, **1.60s** p95.',
    ],
    stack: ['TypeScript', 'Python', 'AWS', 'Bedrock', 'DynamoDB', 'S3'],
    links: [
      { label: 'Demo', href: 'https://flowsync.aahil-khan.tech/' },
      { label: 'Repo', href: 'https://github.com/anoushkawasthi/flowsync' },
    ],
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
      '**Local-first**: nothing ever leaves the machine. The semantic embeddings run on-device.',
      'Multi-stage retrieval pipeline for private, low-latency search.',
      '**Knowledge graph** linking pages by semantic, temporal and contextual relationships.',
      'Sessionization with context-boundary detection, so your tax admin and your holiday research never end up in the same context.',
    ],
    stack: ['React', 'TypeScript'],
    links: [
      { label: 'Releases', href: 'https://github.com/konta-oss/konta/releases' },
      { label: 'Repo', href: 'https://github.com/konta-oss/konta' },
    ],
  },
  {
    slug: 'gina',
    name: 'GINA',
    tagline: 'Natural language → SQL analytics',
    year: 2025,
    kind: 'Research',
    meta: '2025 · Research · NL → SQL',
    lede: 'Grounded insights from natural-language analytics — ask in English, get a real query.',
    highlights: [
      'Multi-model **NL→SQL** pipeline for conversational data analytics with structured outputs.',
      '**SSE streaming** with fast-path routing (snapshot + cache restore), which buys both latency and transparency.',
      'Context-aware multi-turn handling using structured conversation state, so "and for last quarter?" still knows what you meant.',
      'Schema-correction retries and resilient API/SSE error handling keep the workflow reliable end to end.',
    ],
    stack: ['Next.js', 'TypeScript', 'Fastify', 'PostgreSQL'],
    links: [
      { label: 'Demo', href: 'https://gina-cfp.vercel.app' },
      { label: 'Repo', href: 'https://github.com/vanshGupta18/Gina_cfp' },
    ],
  },
]
