# syntax=docker/dockerfile:1
#
# Multi-stage build for the `stage deploy` pipeline on aahil-server (see ~/staging/README.md
# there). The server builds this from source -- node_modules and .next are excluded from the
# rsync and rebuilt here, never shipped.

FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# .env.local is optional -- the site builds and runs without it, see .env.example. `touch`
# leaves a real, rsynced one (with secrets) untouched and only fills in a placeholder when
# building somewhere that doesn't have one.
RUN touch .env.local
RUN npm run build

# `output: 'standalone'` in next.config.ts makes this runner image small: only the traced
# server bundle, not the full node_modules tree.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Standalone output does not carry env files itself -- server.js reads process.env at request
# time (Upstash Redis, the GitHub token, STATS_TOKEN), so they have to land next to it.
COPY --from=builder --chown=nextjs:nodejs /app/.env.local ./.env.local

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
