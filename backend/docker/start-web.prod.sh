#!/usr/bin/env sh
# docker/start-web.prod.sh — Production web server entrypoint

set -e

DB_HOST="postgres"
DB_PORT="5432"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-60}"

echo "⏳ Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
./docker/postgrescheck.sh "$DB_HOST" "$DB_PORT" "$WAIT_TIMEOUT"

echo "🚀 Applying Prisma migrations (production)..."
npx prisma migrate deploy --schema=prisma/schema.prisma

echo "🌱 Seeding database..."
node dist/core/database/seed.js

echo "🚀 Starting web server (production)..."
exec node dist/index.js
