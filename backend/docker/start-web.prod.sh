#!/usr/bin/env sh
# docker/start-web.prod.sh — Production web server entrypoint

set -e

DB_HOST="postgres"
DB_PORT="5432"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-60}"

echo "⏳ Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
./docker/postgrescheck.sh "$DB_HOST" "$DB_PORT" "$WAIT_TIMEOUT"

echo "🔄 Merging Prisma schemas..."
npm run db:merge

echo "✅ Validating schema..."
npx prisma validate

echo "🔄 Generating Prisma client..."
npx prisma generate

echo "🚀 Applying Prisma migrations (production)..."
# In production, use migrate deploy — never creates new migrations
npx prisma migrate deploy

echo "🚀 Starting web server (production)..."
exec node dist/index.js
