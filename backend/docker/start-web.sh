#!/usr/bin/env sh
# docker/start-web.sh — Web server entrypoint

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

# Verify client was generated
if [ ! -d "node_modules/.prisma/client" ]; then
  echo "❌ ERROR: Prisma client generation failed — directory not found!"
  ls -la node_modules/.prisma || true
  exit 1
fi

echo "✅ Prisma client generated successfully"

echo "🚀 Applying Prisma migrations (dev mode)..."
# --name required for non-TTY (Docker) environments (Prisma v7+)
npx prisma migrate dev --name "schema_alignment" || \
  npx prisma migrate deploy || \
  echo "⚠️ Migration issues in dev — continuing..."

echo "🚀 Starting web server (tsx watch)..."
exec npx tsx watch src/index.ts
