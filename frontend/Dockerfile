# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# UjamaaDAO Frontend — Dockerfile
#
# dev  stage: hot-reload via mounted volume (used in docker-compose)
# prod stage: standalone Next.js output for deployment (future)
#
# The `--mount=type=cache,target=/root/.npm` on each `npm ci` persists npm's
# download cache across builds, so packages aren't re-fetched from the registry
# every time the lockfile changes — big win on the small prod droplet.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
WORKDIR /app
# Install dependencies only when package.json changes
COPY package.json package-lock.json .npmrc ./

# ─────────────────────────────────────────────────────────────────────────────
# DEV — dependencies installed, source mounted at runtime by docker-compose
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS dev
RUN --mount=type=cache,target=/root/.npm npm ci --legacy-peer-deps
# Source code is mounted by docker-compose volume — not copied here
EXPOSE 3000
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["npm", "run", "dev"]

# ─────────────────────────────────────────────────────────────────────────────
# PROD — full build, standalone output
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS prod-deps
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM base AS builder
# NEXT_PUBLIC_* vars are inlined at build time — must be ARG/ENV before npm run build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_AUTH_TOKEN
# On-chain governance (Coinbase Smart Wallet + user-signed votes). NEXT_PUBLIC_CHAIN
# selects the chain (base = mainnet, else Base Sepolia); the others point the client
# at the GovernanceVoting contract + RPC. The gasless paymaster URL is derived from
# NEXT_PUBLIC_API_URL at runtime (backend proxy), so no Pimlico key is inlined here.
ARG NEXT_PUBLIC_CHAIN
ARG NEXT_PUBLIC_GOVERNANCE_VOTING_ADDRESS
ARG NEXT_PUBLIC_BASE_RPC_URL
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV NEXT_PUBLIC_CHAIN=$NEXT_PUBLIC_CHAIN
ENV NEXT_PUBLIC_GOVERNANCE_VOTING_ADDRESS=$NEXT_PUBLIC_GOVERNANCE_VOTING_ADDRESS
ENV NEXT_PUBLIC_BASE_RPC_URL=$NEXT_PUBLIC_BASE_RPC_URL
ENV NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
