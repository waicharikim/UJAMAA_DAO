#!/usr/bin/env sh
# docker/start-worker.sh — Worker process entrypoint

set -e

DB_HOST="postgres"
DB_PORT="5432"
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-60}"

echo "⏳ Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
./docker/postgrescheck.sh "$DB_HOST" "$DB_PORT" "$WAIT_TIMEOUT"

echo "⏳ Waiting for Redis at ${REDIS_HOST}:${REDIS_PORT}..."
./docker/redischeck.sh "$REDIS_HOST" "$REDIS_PORT" "$WAIT_TIMEOUT"

echo "🔄 Merging Prisma schemas..."
npm run db:merge

echo "✅ Validating schema..."
npx prisma validate

echo "🔄 Generating Prisma client..."
npx prisma generate

# Verify client was generated
if [ ! -d "node_modules/.prisma/client" ]; then
  echo "❌ ERROR: Prisma client generation failed — directory not found!"
  ls -la node_modules/.prisma || true
  exit 1
fi

echo "✅ Prisma client generated successfully"

# Worker doesn't run migrations — web container handles that
echo "ℹ️  Skipping migrations (handled by web container)"

echo "🚀 Starting worker process (tsx watch)..."
exec npx tsx watch src/worker.ts
