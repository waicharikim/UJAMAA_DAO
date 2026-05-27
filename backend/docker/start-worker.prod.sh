#!/usr/bin/env sh
# docker/start-worker.prod.sh — Production worker entrypoint

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

# Worker doesn't run migrations — web container handles that
echo "ℹ️  Skipping migrations (handled by web container)"

echo "🚀 Starting worker process (production)..."
exec node dist/workers.js
