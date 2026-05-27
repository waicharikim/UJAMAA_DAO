# ────────────────────────
# COMMON BASE
# ────────────────────────
FROM node:22-slim AS base
WORKDIR /usr/src/app

# Install required system packages for Debian slim
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
      openssl \
      ca-certificates \
      netcat-openbsd \
      bash \
    && rm -rf /var/lib/apt/lists/*

# ────────────────────────
# DEPENDENCIES (shared)
# ────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci

# ────────────────────────
# BUILD STAGE
# ────────────────────────
FROM base AS builder
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npm run db:generate && NODE_OPTIONS="--max-old-space-size=3072" npm run build && npm prune --omit=dev --ignore-scripts

# ──────────────────────── 
# DEVELOPMENT IMAGE (hot reload)
# Used by both web and worker containers
# ────────────────────────
FROM base AS dev
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

RUN echo "alias ls='ls -la --color=auto'" >> /etc/bash.bashrc && \
    echo "export PS1='\\[\e[32m\\]/usr/src/app\\[\e[0m\\]# '" >> /etc/bash.bashrc && \
    echo "export TERM=xterm-256color" >> /etc/bash.bashrc

# bash is already installed in base
RUN bash --version

# Make ALL scripts executable (handles all your new scripts)
RUN chmod +x ./docker/*.sh

EXPOSE 4000

# Default command (overridden by docker-compose for worker)
CMD ["sh", "./docker/start-web.sh"]

# ────────────────────────
# PRODUCTION WEB IMAGE
# ────────────────────────
FROM base AS prod-web
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/docker ./docker
RUN chmod +x ./docker/*.sh
EXPOSE 4000
CMD ["sh", "./docker/start-web.prod.sh"]

# ────────────────────────
# PRODUCTION WORKER IMAGE
# ────────────────────────
FROM base AS prod-worker
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/docker ./docker
RUN chmod +x ./docker/*.sh
CMD ["sh", "./docker/start-worker.prod.sh"]