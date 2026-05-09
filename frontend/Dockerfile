# ─────────────────────────────────────────────────────────────────────────────
# UjamaaDAO Frontend — Dockerfile
#
# dev  stage: hot-reload via mounted volume (used in docker-compose)
# prod stage: standalone Next.js output for deployment (future)
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
WORKDIR /app
# Install dependencies only when package.json changes
COPY package.json package-lock.json .npmrc ./

# ─────────────────────────────────────────────────────────────────────────────
# DEV — dependencies installed, source mounted at runtime by docker-compose
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS dev
RUN npm ci --legacy-peer-deps
# Source code is mounted by docker-compose volume — not copied here
EXPOSE 3000
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["npm", "run", "dev"]

# ─────────────────────────────────────────────────────────────────────────────
# PROD — full build, standalone output
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS prod-deps
RUN npm ci --omit=dev

FROM base AS builder
RUN npm ci
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
